// TODO(mmc): Split this up into logical components
let events = require("sdk/system/events");
const { Cc, Ci, Cu, Cr } = require("chrome");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

let thirdPartyUtil = Cc["@mozilla.org/thirdpartyutil;1"]
                       .getService(Ci.mozIThirdPartyUtil);
let eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"]
                    .getService(Ci.nsIEffectiveTLDService);
let ss = require("simple-storage");

let cookiePermSvc = Cc["@mozilla.org/cookie/permission;1"]
                      .getService(Ci.nsICookiePermission);

const kACCESS_DEFAULT = cookiePermSvc.ACCESS_DEFAULT;
const kACCESS_ALLOW = cookiePermSvc.ACCESS_ALLOW;
const kACCESS_DENY = cookiePermSvc.ACCESS_DENY;
const kACCESS_ALLOW_FIRST_PARTY_ONLY = cookiePermSvc.ACCESS_ALLOW_FIRST_PARTY_ONLY;

let simplePrefs = require("simple-prefs").prefs;
simplePrefs["micropilotlog"] = true;
simplePrefs["sdk.console.logLevel"] = 0;

const kSTUDY_NAME = "cookiemonster";
// const kUPLOAD_DURATION = (86400 * 1000); // One day
// const kPULSE_INTERVAL = (86400 * 1000);

const kSTUDY_DURATION = (86400 * 1000 * 7); // One week
const kPULSE_INTERVAL = (300 * 1000);
// const kUPLOAD_URL =
//   "https://testpilot.mozillalabs.com/submit/testpilot_micropilot_" + kSTUDY_NAME;

const kUPLOAD_URL =
  "http://127.0.0.1/";

const kCM_VERSION = 1; // XXXddahl: set version as first data collection

const kSOCIAL_HOSTS = { "twitter.com": 0,
                        "www.facebook.com": 1,
                        "platform.twitter.com": 2,
                        "connect.facebook.com": 3,
                        "plus.google.com": 4,
                      };

const kSHARE_URLS = [
  "http://www.facebook.com/sharer/sharer.php",
  "https://www.facebook.com/sharer/sharer.php",
  "http://twitter.com/intent/tweet",
  "https://twitter.com/intent/tweet",
  "https://twitter.com/share",
  "https://plus.google.com/share",
  "http://plus.google.com/share",
];

const kSOCIAL_WIDGET_URLS = [
  "http://connect.facebook.net/en_US/all.js",
  "https://connect.facebook.net/en_US/all.js",
  "https://platform.twitter.com/widgets.js",
  "https://twitter.com/twitterapi",
  "https://platform.twitter.com/widgets/follow_button.html",
];

const kMODE_SET_COOKIE = 1;
const kMODE_GET_COOKIE = 2;
const kTYPE_LOGIN_COOKIE = 1;

let micropilot = require("micropilot");
let fuse = micropilot.Fuse;
let monitor = require("micropilot").Micropilot('cookiemonster');
monitor.start();

let self = this;

let kDEBUG = true;
function log() {
  if (kDEBUG) {
    let args = [];
    for (let prop in arguments) {
      args.push(arguments[prop]);
    }
    console.log(args.join(" "));
  }
}

function pprint(aObj) {
  if (!kDEBUG) {
    return;
  }
  if (typeof aObj == "string") {
    log(aObj);
  }
  else {
    for (let prop in aObj) {
      log(prop + ": " + aObj[prop]);
    }
  }
}

/**
 * The object that keeps track of all of our cookie stats.
 */
if (!ss.storage.cookiemonster) {
  initializeCookieMonster();
}
let cookiemonster = ss.storage.cookiemonster;

/**
 * A function initialize all of the cookie stats.
 */
function initializeCookieMonster() {
  log("initializeCookieMonster()");
  // Our cookie monster object
  ss.storage.cookiemonster = {lastUpload: null};
  // A map of domains to counts of first party cookies
  ss.storage.cookiemonster.firstDomains = {};
  // A map of domains to counts of third party cookies
  ss.storage.cookiemonster.thirdDomains = {};
  // A map of keys to cookie counts, where the key is "first_party:third_party"
  ss.storage.cookiemonster.pairedDomains = {};
  // A map of overall cookie counts. first + third + unknown == total
  ss.storage.cookiemonster.cookies =
    { "first" : 0, "third": 0, "unknown" : 0, "total" : 0 };
  // A histogram of cookie expiration times
  ss.storage.cookiemonster.buckets = [];
  for (let i = 0; i < 10; i++) {
    ss.storage.cookiemonster.buckets[i] = 0;
  }
}

/**
 * Given a URI, returns the (eTLD+1) base domain for that host. Returns the
 * host itself if there is some sort of error with the eTLD service.
 * @param {nsURI} aURI the host in question
 * @return {string} the base domain for that host
 */
function getBaseDomain(aURI) {
  let etld = aURI.host;
  try {
    etld = eTLDService.getBaseDomain(aURI);
  } catch (e) {
    console.log("eTLDService error getting tld from", aURI.host);
  }
  return etld;
}
exports.getBaseDomain = getBaseDomain;

function onModifyRequest(event) {
  // log("onModifyRequest()");
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  if (checkForPrivateChannel(channel)) {
    log("Private channel found, abort cookie collection.");
    return;
  }

  try {
    let cookie = channel.getRequestHeader("Cookie");
    log("get cookie...");
    let request = channel.QueryInterface(Ci.nsIRequest);
    let name = request.name;
    let uri = Services.io.newURI(name, null, null);

    // Do not log safebrowsing requests
    if (uri.host == "safebrowsing-cache.google.com") {
      return;
    }

    let domain = getBaseDomain(uri);
    let referrer = getBaseDomain(channel.referrer);
    parseAndLogCookies(cookie, domain, referrer, kMODE_GET_COOKIE, channel);
  }
  catch (e) {
    // console.log(e);
  }
}
exports.onModifyRequest = onModifyRequest;

// Cookie attributes we care about.
const kATTRIBUTES = { "expires": 0, "path": 0, "domain": 0, "max-age": 0 };

/**
 * A single Set-Cookie header may contain multiple cookies.
 */
function parseAndLogCookies(cookies, domain, referrer, mode, channel, ref) {
  log("parseAndLogCookies()");
  let parts = cookies.split("\n");
  for (let i = 0; i < parts.length; i++) {
    let kv = parseCookie(parts[i]);
    let len = parts.length;
    log(JSON.stringify(kv));
    log("cookie:", JSON.stringify(kv));
    let type = null; // XXXddahl: have not identified login cookies yet. Issue #3

    logCookie(kv, domain, referrer, len, mode, type, channel, ref);
  }
}

/**
 * Parse a SetCookie header.
 * @param aCookie {string} Contains a string of the form
 * http://tools.ietf.org/html/rfc6265
 * @returns {map} A map of key value pairs, or an empty map if parsing failed.
 */
function parseCookie(aCookie) {
  let kv = {};
  // Cookie attributes are separated by semicolons.
  let parts = aCookie.split(";");
  // The first attribute is name=value, where value may contain= (as in the
  // Google PREF cookie)
  let pos = parts[0].indexOf("=");
  kv.name = parts[0].substring(0, pos);
  kv.value = parts[0].substring(pos + 1);
  // Check for other cookie attributes.
  for (let i = 1; i < parts.length; i++) {
    let namevalue = parts[i].split("=");
    if (namevalue.length > 2) {
      throw "Parse error: invalid attribute", namevalue;
    }
    let name = namevalue[0].toLowerCase().trim();
    if (name in kATTRIBUTES) {
      kv[name] = namevalue[1].trim();
    }
  }
  // Convert timestamps to max-age. All times are in seconds since epoch
  if (!("max-age" in kv)) {
    let d = new Date();
    let now = d.getTime() / 1000;
    if (!kv["expires"]) {
      // Session cookie
      kv["max-age"] = 0;
    } else {
      // JS Date cannot parse strings with -
      let expiration = Date.parse(kv["expires"].replace(/-/g, " ")) / 1000;
      kv["max-age"] = Math.round(expiration - now);
    }
  }
  return kv;
}
exports.parseCookie = parseCookie;

/**
 * Log a set/get cookie event with monitor.record
 *
 * @param object aCookieObj
 *        A map of cookie attributes that must include max-age
 * @param string aDomain
 *        The domain setting the cookie
 * @param string aReferrer
 *        The referrer domain
 * @param integer aLength
 *        The count of cookies set/read during this event
 * @param integer aMode
 *        kMODE_SET_COOKIE or kMODE_GET_COOKIE
 * @param integer aType
 *        kTYPE_LOGIN_COOKIE or null
 * @param nsIChannel aChannel
 *        The domain channel
 * @returns object
 **/
function
logCookie(aCookieObj, aDomain, aReferrer, aLength, aMode, aType, aChannel) {
  log("logCookie()");
  log(aChannel);
  log(aChannel.URI);

  let cookieAccess = canAccessCookies(aChannel.URI, aChannel); // XXXddahl may be the wrong URI
  log("referrer: " + aReferrer);
  let success = cookieWasSet(cookieAccess, aChannel.URI, aReferrer);

  function createCookieEvent() {
    let event = {
      eventType: "COOKIE_EVENT",
      timestamp: Date.now(),
      mode: aMode,
      count: aLength,
      type: aType || null,
      expiration: aCookieObj["max-age"],
      domain: aDomain,
      referrer: aReferrer,
      access: cookieAccess,
      success: success,
    };
    return event;
  }
  let event = createCookieEvent();
  monitor.record(event);
  return event;
}

/**
 * Check if the cookie being set will be ignored by 3rd party cookie blocking
 *
 * @param nsIURI aURI
 *        The URI trying to set the cookie
 * @param nsIChannel aChannel
 *        The channel corresponding to aURI
 * @returns int
 *        One of kACCESS_DEFAULT, kACCESS_ALLOW, kACCESS_DENY, or
 *        kACCESS_ALLOW_FIRST_PARTY_ONLY
 **/
function canAccessCookies(aURI, aChannel) {
  return cookiePermSvc.canAccess(aURI, aChannel);
}

/**
 * Verify that the cookie was actually set
 *
 * @param nsICookieAccess aAccess
 * @param string aDomain
 * @param string aCookieDomain
 *
 * @returns boolean
 **/
function cookieWasSet(aAccess, aDomainURI, aCookieDomainURI) {
  let result = false;

  switch (aAccess) {
  case kACCESS_DENY:
    return false;
  case kACCESS_DEFAULT: // XXXddahl: not exactly sure what "DEFAULT" means
  case kACCESS_ALLOW:
  case kACCESS_ALLOW_FIRST_PARTY_ONLY:
    // let domainURI = Services.io.newURI(aDomain, null, null);
    // let cookieDomainURI = Services.io.newURI(aCookieDomain, null, null);

    if (getBaseDomain(aDomainURI) == getBaseDomain(aCookieDomainURI)) {
      return true;
    }
    // 3rd party cookies are blocked
    return false;
  default:
    return false;
  }
}

// http-on-examine-response
// https://addons.mozilla.org/en-US/developers/docs/sdk/1.13/modules/sdk/system/events.html
function onExamineResponse(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);

  if (checkForPrivateChannel(channel)) {
    return;
  }

  let domain = getBaseDomain(channel.URI);
  let referrerDomain = domain;
  if (channel.referrer) {
    referrerDomain = getBaseDomain(channel.referrer);
  }
  let cookies;
  try {
    cookies = channel.getResponseHeader("set-cookie");
  } catch (ex if ex.result == Cr.NS_ERROR_NOT_AVAILABLE) {
    return;
  }
  let mode = kMODE_SET_COOKIE;
  parseAndLogCookies(cookies,
                     domain,
                     referrerDomain,
                     mode,
                     channel,
                     channel.referrer);
}
exports.onExamineResponse = onExamineResponse;


/**
 * On quit, properly tear down services and delete data we are using/creating
 * @param event event
 * @returns void
 **/
function onQuitApplication(event) {
  NetworkListener.detach();
}

const kCOOKIE_SERVICE_EVENTS = {
  ONE_DELETED: 1,
  ALL_CLEARED: 2,
  BATCH_DELETED: 3,
  ONE_CHANGED: 4,
};

/**
 * Handle cookie change events
 * When cookies are deleted either by scripts or the user, we are notified here
 *
 * "deleted" means a cookie was deleted. aSubject is the deleted cookie.
 * "added"   means a cookie was added. aSubject is the added cookie.
 * "changed" means a cookie was altered. aSubject is the new cookie.
 * "cleared" means the entire cookie list was cleared. aSubject is null.
 * "batch-deleted" means a set of cookies was purged. aSubject is
 * the list of cookies.
 *
 * @param observerEvent event
 * @returns void
 **/
function onCookieChanged(event) {
  switch (event.data) {
  case "deleted":
    handleDeletedCookie(event);
    break;
  case "cleared":
    handleClearedCookies(event);
    break;
  case "batch-deleted":
    handleBatchDeletedCookies(event);
    break;
  default:
    break;
  }
}

function handleDeletedCookie(event) {
  log("handleDeletedCookie()");
  pprint(event);
  for (let prop in event) {
    pprint(event[prop]);
  }
  try {
    var cookie = event.subject.QueryInterface(Ci.nsICookie);
  }
  catch (ex) {
    log(ex);
    log(ex.stack);
  }

  monitor.record({eventType: "COOKIE_SERVICE_EVENT",
                  timestamp: Date.now(),
                  event: kCOOKIE_SERVICE_EVENTS.ONE_DELETED,
                  host: cookie.host,
                 });
}

function handleClearedCookies(event) {
  log("handleClearedCookies()");
  // This receives a nullptr, all cookies are manually removed by the user.
  monitor.record({eventType: "COOKIE_SERVICE_EVENT",
                  timestamp: Date.now(),
                  event: kCOOKIE_SERVICE_EVENTS.ALL_CLEARED,
                  host: null
                 });
}

function handleBatchDeletedCookies(event) {
  log("handleBatchDeletedCookies()");
  monitor.record({eventType: "COOKIE_SERVICE_EVENT",
                  timestamp: Date.now(),
                  event: kCOOKIE_SERVICE_EVENTS.BATCH_DELETED,
                  host: "BATCH_DELETE",
                 });
}

// Register all observer event handlers
events.on("http-on-modify-request", onModifyRequest, false);
events.on("http-on-examine-response", onExamineResponse, false);
events.on("quit-application", onQuitApplication, false);
events.on("cookie-changed", onCookieChanged, false);

/**
 * Schedule data upload every 24 hours
 * @returns void
 **/
function scheduleUpload() {
  log("scheduleUpload()");
  if (!ss.storage.cookiemonster.lastUpload) {
    ss.storage.cookiemonster.lastUpload = Date.now();
  }

  // Write cookiemonster collected data to the MP study.
  // We do not use the MicroPilot data storage mechanism as we are summarizing
  // the data on the fly - the MicroPilot data collection is not ideal for CM
  fuse({ start: ss.storage.cookiemonster.lastUpload,
         duration: kSTUDY_DURATION,
         pulseinterval: kPULSE_INTERVAL,
         pulsefn: function _upload() {
           // Record any metadata to accompany this upload event
           monitor.record({eventType: "COOKIE_MONSTER_METADATA",
                           timestamp: Date.now(),
                           version: kCM_VERSION,
                          });
           // Upload the collected data
           monitor.upload(kUPLOAD_URL).then(function _clear() {
             monitor.clear();
             ss.storage.cookiemonster.lastUpload = Date.now();
           });
         },
         resolve_this: self
       });
}

scheduleUpload();

/**
 * Check channel to see if it is part of a private browsing window
 * @param aChannel nsIChannel
 * @returns bool
 **/
function checkForPrivateChannel(aChannel) {
  // log("checkForPrivateChannel()");
  let channel = aChannel.QueryInterface(Ci.nsIPrivateBrowsingChannel);
  if (channel.isChannelPrivate) {
    return true;
  }
  return false;
}

/**
 * NetworkListener
 *
 * We need to check all HTTP traffic for social widgets
 *
 * https://mxr.mozilla.org/mozilla-central/source/netwerk/protocol/http/nsIHttpActivityObserver.idl#14
 **/

let ActivityDistributor = Cc['@mozilla.org/network/http-activity-distributor;1']
                            .getService(Ci.nsIHttpActivityDistributor);

let NetworkListener = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports,
                                         Ci.nsIHttpActivityObserver]),
  isActive: true,

  attach: function _attach() {
    ActivityDistributor.addObserver(this);
  },

  detach: function _detach() {
     ActivityDistributor.removeObserver(this);
  },

  observeActivity: function _observeActivity(aHttpChannel,
                                             aActivityType,
                                             aActivitySubtype,
                                             aTimestamp,
                                             aExtraSizeData,
                                             aExtraStringData)
  {
    // log("observeActivity()...");
    // Check the channel for social widgets loading into content or
    // content being shared

    if (!(aHttpChannel.URI.host in kSOCIAL_HOSTS)) {
      return;
    }

    log("prePath: " + aHttpChannel.URI.prePath);
    log("spec: " + aHttpChannel.URI.spec);
    let prePath = aHttpChannel.URI.prePath;
    let path = aHttpChannel.URI.path;
    let url = prePath + path;
    log("url: " + url);

    if (kSHARE_URLS.indexOf(url)) {
      log("Share URL detected...");
    }
    else if (kSOCIAL_WIDGET_URLS.indexOf(url)) {
      log("Share URL detected...");
    }
    else {
      return;
    }
    log("Observed HTTP channel: ");
    pprint(aHttpChannel.URI);
  },

  activityTypes: {
    ACTIVITY_TYPE_SOCKET_TRANSPORT:     0x0001,
    ACTIVITY_TYPE_HTTP_TRANSACTION:     0x0002,
    ACTIVITY_SUBTYPE_REQUEST_HEADER:    0x5001,
    ACTIVITY_SUBTYPE_REQUEST_BODY_SENT: 0x5002,
    ACTIVITY_SUBTYPE_RESPONSE_START:    0x5003,
    ACTIVITY_SUBTYPE_RESPONSE_HEADER:   0x5004,
    ACTIVITY_SUBTYPE_RESPONSE_COMPLETE: 0x5005,
    ACTIVITY_SUBTYPE_TRANSACTION_CLOSE: 0x5006
  }
};

NetworkListener.attach();
