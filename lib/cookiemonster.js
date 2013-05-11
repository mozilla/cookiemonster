// TODO(mmc): Split this up into logical components
const data = require("self").data;
let events = require("sdk/system/events");
const panel = require("panel");
const prefs = require("sdk/preferences/service");
const { Cc, Ci, Cu, Cr } = require("chrome");
const { defer, resolve, promised, all } = require("sdk/core/promise");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyServiceGetter(Services, "cookiemgr",
                                   "@mozilla.org/cookiemanager;1",
                                   "nsICookieManager2");

let eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"]
                    .getService(Ci.nsIEffectiveTLDService);
let { storage } = require("simple-storage");

let cookiePermSvc = Cc["@mozilla.org/cookie/permission;1"]
                      .getService(Ci.nsICookiePermission);

let simplePrefs = require("simple-prefs").prefs;

const kSTUDY_NAME = "cookiemonster";
//const kPULSE_INTERVAL = 24 * 60 * 60 * 1000; // One day in milliseconds
const kPULSE_INTERVAL = 60 * 1000; // One day in milliseconds
const kSTUDY_DURATION = 7 * kPULSE_INTERVAL; // One week

const kUPLOAD_URL =
  "https://testpilot.mozillalabs.com/submit/testpilot_micropilot_" +
  kSTUDY_NAME;

const kCM_VERSION = 1;

/*
const kSOCIAL_SITES = {
  twitter: {
    share_host: {
      url: "twitter.com",
      paths: { "intent/tweet": 1, "share": 1 }
    }
    widget_host: {
      url: "platform.twitter.com",
      paths: { "widgets.js": 1 }
    }
  }
}
  host: { type: "share", url: "twitter.com"
*/

const kSOCIAL_HOSTS = { "twitter.com": 0,
                        "www.facebook.com": 1,
                        "platform.twitter.com": 2,
                        "connect.facebook.com": 3,
                        "connect.facebook.net": 4,
                        "plus.google.com": 5,
                        "localhost": 6, // test only
                      };

const kSHARE_URLS = [
  "www.facebook.com/sharer/sharer.php",
  "www.facebook.com/dialog/plugin.optin",
  "www.facebook.com/share.php",
  "twitter.com/intent/tweet",
  "twitter.com/share",
  "plus.google.com/share",
  "localhost/share", // test only
];

const kSOCIAL_WIDGET_URLS = [
  "connect.facebook.net/en_US/all.js", // XXXddahl: will we need to swap out en_US? in other locales?
  "www.facebook.com/plugins/like.php",
  "platform.twitter.com/widgets.js",
  "twitter.com/twitterapi",
  "platform.twitter.com/widgets/follow_button.html",
  "www.facebook.com/plugins/likebox.php",
  "apis.google.com/js/plusone.js",
];

const kTYPE_LOGIN_COOKIE = 1;

const kEvents = exports.kEvents = {
  // Read and set cookie events
  SET_COOKIE: "set-cookie",
  READ_COOKIE: "read-cookie",
  COOKIE_ADDED: "cookie-added",
  COOKIE_CHANGED: "cookie-changed",
  COOKIE_REJECTED: "cookie-rejected",
  // Clear cookie events
  COOKIE_DELETED: "cookie-deleted",
  ALL_COOKIES_DELETED: "all-cookies-deleted",
  SOME_COOKIES_DELETED: "some-cookies-deleted",
  // Preference data
  PREFERENCE: "preference",
  // A metadata event that we set once per upload
  METADATA: "metadata",
  SHARE_URL_LOADED: "share-url-loaded",
  SOCIAL_WIDGET_LOADED: "social-widget-loaded",
};

const kCookieServiceEvents = exports.kCookieServiceEvents = {
  // One of the following 3 happens when Set-Cookie succeeds
  "added": "COOKIE_ADDED",
  "changed": "COOKIE_CHANGED",
  "rejected": "COOKIE_REJECTED",
  // Clear cookie for a particular site
  "deleted": "COOKIE_DELETED",
  // Clear all cookies
  "cleared": "ALL_COOKIES_DELETED",
  // Select which cookies to clear
  "batch-deleted": "SOME_COOKIES_DELETED"
};

const kPrefs = [
  "browser.privatebrowsing.autostart",
  "network.cookie.cookieBehavior",
  "network.cookie.lifetimePolicy",
  "privacy.sanitize.sanitizeOnShutdown",
  "privacy.clearOnShutdown.cache",
  "privacy.clearOnShutdown.cookies",
  "privacy.clearOnShutdown.downloads",
  "privacy.clearOnShutdown.formdata",
  "privacy.clearOnShutdown.history",
  "privacy.clearOnShutdown.offlineApps",
  "privacy.clearOnShutdown.passwords",
  "privacy.clearOnShutdown.sessions",
  "privacy.clearOnShutdown.siteSettings",
  "privacy.cpd.cache",
  "privacy.cpd.cookies",
  "privacy.cpd.downloads",
  "privacy.cpd.formdata",
  "privacy.cpd.history",
  "privacy.cpd.offlineApps",
  "privacy.cpd.passwords",
  "privacy.cpd.sessions",
  "privacy.cpd.siteSettings",
]

let micropilot = require("micropilot");
let fuse = micropilot.Fuse;
let monitor = require("micropilot").Micropilot('cookiemonster').start();
exports.monitor = monitor;

let self = this;

// Log everything or nothing
let kDEBUG = simplePrefs.micropilotlog;
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

let installPanel = panel.Panel({
  contentURL: data.url("install.html"),
  width: 500,
  onMessage: function(aMessage) {
    if (aMessage == "disable") {
      this.hide();
      let id = require("self").id;
      require("sdk/addon/installer").uninstall(id);
    } else {
      this.hide();
    }
  }
});

if (!storage.firstRun) {
  storage.firstRun = true;
  installPanel.show();
}

/**
 * Given a URI, returns the (eTLD+1) base domain for that host. Returns the
 * host itself if there is some sort of error with the eTLD service.
 * @param {nsURI} aURI the host in question
 * @return {string} the base domain for that host
 */
function getBaseDomain(aURI) {
  if (typeof aURI == 'string') {
    return aURI;
  }
  let etld = aURI.host;
  try {
    etld = eTLDService.getBaseDomain(aURI);
  } catch (e if e.result == Cr.NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS) {
    // This case is not important
  } catch(e) {
    // log("eTLDService error getting tld from", aURI.host, e);
  }
  return etld;
}

function onModifyRequest(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  if (checkForPrivateChannel(channel)) {
    log("Private channel found, abort cookie collection.");
    return;
  }

  let cookies;
  try {
    cookies = channel.getRequestHeader("Cookie");
  } catch (ex if ex.result == Cr.NS_ERROR_NOT_AVAILABLE) {
    return;
  }
  // Do not log safebrowsing requests
  if (channel.URI.host == "safebrowsing-cache.google.com") {
    return;
  }
  let domain = getBaseDomain(channel.URI);
  let referrer = domain;
  if (channel.referrer) {
    referrer = getBaseDomain(channel.referrer);
  }
  let parts = cookies.split(";");
  return emitEvent({eventType: kEvents.READ_COOKIE,
                      domain: domain,
                      referrer: referrer,
                      count: parts.length});
}

// Cookie attributes we care about.
const kATTRIBUTES = { "expires": 0, "path": 0, "domain": 0, "max-age": 0 };

/**
 * A single Set-Cookie header may contain multiple cookies.
 */
function parseAndLogCookies(cookies, domain, referrer, existingCount) {
  let parts = cookies.split("\n");
  let len = parts.length;
  for (let i = 0; i < parts.length; i++) {
    let kv = parseCookie(parts[i]);
    let event = {
      eventType: kEvents.SET_COOKIE,
      count: len,
      maxage: kv["max-age"],
      domain: domain,
      referrer: referrer,
      existingCount: existingCount,
    };
    return emitEvent(event);
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

// http-on-examine-response
// https://addons.mozilla.org/en-US/developers/docs/sdk/1.13/modules/sdk/system/events.html
function onExamineResponse(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);

  if (checkForPrivateChannel(channel)) {
    return;
  }
  if (channel.URI.host == "sb-ssl.google.com") {
    return;
  }

  let domain = getBaseDomain(channel.URI);
  let existingCount = Services.cookiemgr.countCookiesFromHost(domain);
  let referrerDomain = domain;
  if (channel.referrer) {
    referrerDomain = getBaseDomain(channel.referrer);
  }
  let cookies;
  try {
    cookies = channel.getResponseHeader("set-cookie");
    return parseAndLogCookies(cookies, domain, referrerDomain, existingCount);

  } catch (ex if ex.result == Cr.NS_ERROR_NOT_AVAILABLE) {
    return;
  }
}

/**
 * On quit, properly tear down services and delete data we are using/creating
 * @param event event
 * @returns void
 **/
function onQuitApplication(event) {
  NetworkListener.detach();
}

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
  let eventType = kEvents[kCookieServiceEvents[event.data]];
  let evt = { eventType: eventType };
  // Set the host, for added, changed, deleted, and rejected cookies.
  if (eventType == kEvents.COOKIE_DELETED ||
      eventType == kEvents.COOKIE_CHANGED ||
      eventType == kEvents.COOKIE_ADDED) {
    let cookie = event.subject.QueryInterface(Ci.nsICookie);
    evt.domain = getBaseDomain(cookie.host);
  } else if (eventType == kEvents.COOKIE_REJECTED) {
    let uri = event.subject.QueryInterface(Ci.nsIURI);
    evt.domain = getBaseDomain(uri.host);
  }
  return emitEvent(evt);
}

function emitEvent(event) {
  // Make sure we record timestamps
  console.log("emitting", JSON.stringify(event));
  event.ts = Date.now();
  event.group = "cookiemonster";
  sysevents.emit("cookiemonster",{data:event})
  //return monitor.record(event);
}

// Register all observer event handlers
events.on("http-on-modify-request", onModifyRequest, false);
events.on("http-on-examine-response", onExamineResponse, false);
events.on("quit-application", onQuitApplication, false);
events.on("cookie-changed", onCookieChanged, false);

// We only export this for testing
// Return a promise that resolves when all of the prefs are recorded.
exports.dumpPrefs = function dumpPrefs() {
  // An array of promises that resolve when the preference is recorded
  let promiseArray = []
  for (let i = 0; i < kPrefs.length; i++) {
    let pref = kPrefs[i];
    console.log("pref", pref, prefs.get(pref, "UNDEFINED"));
    promiseArray.push(emitEvent(
      { eventType: kEvents.PREFERENCE,
        name: pref,
        value: prefs.get(pref, "UNDEFINED") }));
  }
  return all(promiseArray);
}

function recordMetadata() {
  return dumpPrefs().
    then(function() { return emitEvent({eventType: kEvents.METADATA,
                        lastUpload: storage.lastUpload,
                        version: kCM_VERSION,
                        });
    });
}

/**
 * Schedule data upload every 24 hours
 * @returns void
 **/
function scheduleUpload() {
  if (!storage.lastUpload) {
    storage.lastUpload = Date.now();
  }

  let simulate = simplePrefs.enable_reporting;
  // Write cookiemonster collected data to the MP study.
  fuse({ start: storage.lastUpload,
         duration: kSTUDY_DURATION,
         pulseinterval: kPULSE_INTERVAL,
         pulsefn: function _upload() {
           // Record any metadata to accompany this upload event
           recordMetadata().
           // Upload the collected data
           then(function() {
             storage.lastUpload = Date.now();
             return monitor.upload(kUPLOAD_URL, {simulate: fakeUpload});
           }).
           // Clear the monitor
           then(function _clear(response) {
             console.log("upload response", JSON.stringify(response));
             return monitor.clear();
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
  let channel = aChannel.QueryInterface(Ci.nsIPrivateBrowsingChannel);
  return channel.isChannelPrivate;
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
    // Check the channel for social widgets loading into content or
    // content being shared
    if (!aHttpChannel.URI || !(aHttpChannel.URI.host in kSOCIAL_HOSTS)) {
      return;
    }
    // Ignore all other HTTP activity except the request header which will have
    // the social urls we are looking for in them
    if (aActivitySubtype != Ci.nsIHttpActivityObserver.ACTIVITY_SUBTYPE_RESPONSE_COMPLETE) {
      return;
    }

    let host = aHttpChannel.URI.host;
    let path = aHttpChannel.URI.path;
    let preQ = path.split("?");
    let url;
    if (preQ.length == 2) {
      url = host + preQ[0];
    }
    else {
      url = host + path;
    }
    log(url + "\n");
    let referrer = null;

    try {
      referrer = getBaseDomain(aHttpChannel.referrer);
    } catch (ex) {
      // log("referrer not proper URI: " + aHttpChannel.referrer);
    }
    log("Share or Widget URL??: " + url);
    log(path);
    if (kSHARE_URLS.indexOf(url) > -1) {
      log("Share URL index: " + kSHARE_URLS.indexOf(url));
      log("Share URL detected: " + url);
      monitor.record({eventType: kEvents.SHARE_URL_LOADED,
                      timestamp: Date.now(),
                      shareURL: host,
                      referrer: referrer,
                     });
    }
    else if (kSOCIAL_WIDGET_URLS.indexOf(url) > -1) {
      log("Social widget URL index: " + kSOCIAL_WIDGET_URLS.indexOf(url));
      log("Social widget URL loaded: " + url);
      monitor.record({eventType: kEvents.SOCIAL_WIDGET_LOADED,
                      timestamp: Date.now(),
                      widget: host,
                      referrer: referrer,
                     });
    }
    else {
      return;
    }
  },
};

NetworkListener.attach();

log("Cookie Monster Loaded");
