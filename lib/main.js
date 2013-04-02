// TODO(mmc): Split this up into logical components
let events = require("sdk/system/events");
const { Cc, Ci, Cu, Cr } = require("chrome");
let thirdPartyUtil = Cc["@mozilla.org/thirdpartyutil;1"]
                       .getService(Ci.mozIThirdPartyUtil);
let eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"]
                    .getService(Ci.nsIEffectiveTLDService);
let ss = require("simple-storage");

let simplePrefs = require("simple-prefs").prefs;
simplePrefs["micropilotlog"] = true;
simplePrefs["sdk.console.logLevel"] = 0;

const kSTUDY_NAME = "cookiemonster";
// const kUPLOAD_DURATION = (86400 * 1000); // One day
// const kPULSE_INTERVAL = (86400 * 1000);

const kUPLOAD_DURATION = (300 * 1000);
const kPULSE_INTERVAL = (300 * 1000);
// const kUPLOAD_URL =
//   "https://testpilot.mozillalabs.com/submit/testpilot_micropilot_" + kSTUDY_NAME;

const kUPLOAD_URL =
  "http://127.0.0.1/";

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
  ss.storage.cookiemonster = {};
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

// Read cookies. Do we need this?
function onModifyRequest(event) {
  log("onModifyRequest()");
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  if (checkForPrivateChannel(channel)) {
    log("Private channel found, abort cookie collection.");
    return;
  }

  try {
    let cookie = channel.getRequestHeader("Cookie");
    log("get cookie...");
    log("Cookie", cookie);
    let request = channel.QueryInterface(Ci.nsIRequest);
    let name = request.name;
    log("name", name);
    let uri = Services.io.newURI(name, null, null);
    log(uri.host);
    // Do not log safebrowsing requests
    if (uri.host == "safebrowsing-cache.google.com") {
      return;
    }
    // XXXddahl: what exactly do we capture here?

  } catch (e) {
    // console.log(e);
  }
}
exports.onModifyRequest = onModifyRequest;

// Cookie attributes we care about.
const attributes = { "expires": 0, "path": 0, "domain": 0, "max-age": 0 };

/**
 * A single Set-Cookie header may contain multiple cookies.
 */
function parseAndLogCookies(cookies, domain, referrer) {
  log("parseAndLogCookies()");
  let parts = cookies.split("\n");
  for (let i = 0; i < parts.length; i++) {
    let kv = parseCookie(parts[i]);
    log(JSON.stringify(kv));
    log("cookie:", JSON.stringify(kv));
    logCookie(kv, domain, referrer);
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
    if (name in attributes) {
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
 * Log statistics for the given cookie.
 * @param kv {map} A map of cookie attributes that must include max-age.
 * @param domain {string} The domain setting the cookie.
 * @param referrerDomain {string} The top-level URL for third party cookies.
 */
function logCookie(kv, domain, referrerDomain) {
  // Bucketize cookie
  let maxAge = kv["max-age"];
  let buckets = cookiemonster.buckets;
  if (maxAge < 0) {
    // Deletions
    buckets[0] += 1;
  } else if (maxAge == 0) {
    // Session cookies
    buckets[1] += 1;
  } else if (maxAge < 60*60*24) {
    // 1 day
    buckets[2] += 1;
  } else if (maxAge < 60*60*24*7) {
    // 1 week
    buckets[3] += 1;
  } else if (maxAge < 60*60*24*28) {
    // 4 weeks
    buckets[4] += 1;
  } else if (maxAge < 60*60*24*7*26) {
    // 6 months
    buckets[5] += 1;
  } else if (maxAge < 60*60*24*365) {
    // 1 year
    buckets[6] += 1;
  } else {
    // Practically infinite
    buckets[7] += 1;
  }
  cookiemonster.cookies.total += 1;
  let firstParty = referrerDomain == domain;
  if (firstParty) {
    cookiemonster.cookies.first += 1;
    if (!cookiemonster.firstDomains[domain]) {
      cookiemonster.firstDomains[domain] = 0;
    }
    cookiemonster.firstDomains[domain] += 1;
    return;
  }
  cookiemonster.cookies.third += 1;
  if (!cookiemonster.thirdDomains[domain]) {
    cookiemonster.thirdDomains[domain] = 0;
  }
  cookiemonster.thirdDomains[domain] += 1;
  let key = referrerDomain + ":" + domain;
  if (!cookiemonster.pairedDomains[key]) {
    cookiemonster.pairedDomains[key] = 0;
  }
  cookiemonster.pairedDomains[key] += 1;
}
exports.logCookie = logCookie;

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
  parseAndLogCookies(cookies, domain, referrerDomain);
}
exports.onExamineResponse = onExamineResponse;

// TODO(mmc): What do we do with this?
function onQuitApplication(event) {
  log("Cookies!", JSON.stringify(cookiemonster));
}

events.on("http-on-modify-request", onModifyRequest, false);
events.on("http-on-examine-response", onExamineResponse, false);
events.on("quit-application", onQuitApplication, false);

/**
 * Schedule data upload every 24 hours
 * @returns void
 **/
function scheduleUpload() {
  log("scheduleUpload()");
  if (!ss.lastupload) {
    ss.lastupload = Date.now();
  }

  // Write cookiemonster collected data to the MP study.
  // We do not use the MicroPilot data storage mechanism as we are summarizing
  // the data on the fly - the MicroPilot data collection is not ideal for CM
  fuse({ start: ss.lastupload,
         duration: kUPLOAD_DURATION,
         pulseinterval: kPULSE_INTERVAL,
         pulsefn: function _upload() {
           monitor.record(cookiemonster).then(function _record(aData) {
             monitor.upload(kUPLOAD_URL).then(function _clear() {
               monitor.clear();
               ss.lastupload = Date.now();
             });
           });
         },
         resolve_this: self }).then(function _afterFuse() {
           // re-initialize cookiemonster data
           // XXXddahl: this does not reset the stored values!
           initializeCookieMonster();
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
