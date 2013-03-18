// TODO(mmc): Split this up into logical components

let events = require("sdk/system/events");
const { Cc, Ci, Cu, Cr } = require("chrome");
let thirdPartyUtil = Cc["@mozilla.org/thirdpartyutil;1"]
                       .getService(Ci.mozIThirdPartyUtil);
let eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"]
                    .getService(Ci.nsIEffectiveTLDService);
let ss = require("simple-storage");

let system = require("sdk/system");
for (let prop in system) {
  console.log(prop);
}

function oneYearFromNow()
{
  let nextYear = Date.now() + (1000 * 60 * 60 * 24 * 365);
  return nextYear;
}

function parseDate(aDateStr)
{
  let dateStr;
  if (aDateStr.contains("-")) {
    dateStr = aDateStr.replace(/-/g, " ");
  }
  else {
    dateStr = aDateStr;
  }
  try {
    return Date.parse(dateStr);
  }
  catch (ex) {
    console.error(ex);
    return "Undetermined Date"
  }
}

function parseCookie(aCookieStr)
{
  let cookieObj = {};
  let cookieParts = aCookieStr.split(";");
  if (!cookieParts.length) {
    return null;
  }
  else {
    for (let idx in cookieParts) {
      let cookieProp = cookieParts[idx].split("=");
      console.log("\ncookieProp...");
      console.log(cookieProp);
      if (!cookieProp) {
        continue;
      }
      let _date;
      if (cookieProp[0].trim() == "expires") {
        _date = parseDate(cookieProp[1].trim());
      }
      if (cookieProp.length == 2) {
        cookieObj[cookieProp[0].trim()] = _date || cookieProp[1].trim();
      }
      else if (cookieProp.length == 1) {
        cookieObj[cookieProp[0].trim()] = "null";
      }
    }
  }
  return cookieObj;
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
  ss.storage.cookiemonster.neverexpire = {};
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
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  try {
    let cookie = channel.getRequestHeader("cookie");
    console.log("cookie", cookie);
    let request = channel.QueryInterface(Ci.nsIRequest);
    let name = request.name;
    console.log("name", name);
  } catch (e) {
    //console.log(e);
  }
}
exports.onModifyRequest = onModifyRequest;

// http-on-examine-response
// https://addons.mozilla.org/en-US/developers/docs/sdk/1.13/modules/sdk/system/events.html
function onExamineResponse(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  let domain = getBaseDomain(channel.URI);
  let cookie;
  try {
    cookie = channel.getResponseHeader("set-cookie");
  } catch (ex if ex.result == Cr.NS_ERROR_NOT_AVAILABLE) {
    return;
  }

  console.log("set cookie", cookie, domain);
  let cookieObject = parseCookie(cookie);
  let cookieStr = JSON.stringify(cookieObject);
  console.log(cookieStr);

  let referrerDomain = domain;
  if (channel.referrer) {
    referrerDomain = getBaseDomain(channel.referrer);
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

  if (cookieObject.expires > oneYearFromNow()) {
    if (!cookiemonster.neverexpire[domain]) {
      cookiemonster.neverexpire[domain] = [];
    }
    console.log("*** neverexpire: " + cookieStr);
    cookiemonster.neverexpire[domain].push(cookieObject);
  }
}
exports.onExamineResponse = onExamineResponse;

// TODO(mmc): What do we do with this?
function onQuitApplication(event) {
  console.log("Cookies!", JSON.stringify(cookiemonster));
}

//events.on("http-on-modify-request", onModifyRequest, false);
events.on("http-on-examine-response", onExamineResponse, false);
events.on("quit-application", onQuitApplication, false);
