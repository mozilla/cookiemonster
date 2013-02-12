let events = require("sdk/system/events");
const { Cc, Ci, Cu, Cr } = require("chrome");
let thirdPartyUtil = Cc["@mozilla.org/thirdpartyutil;1"]
                       .getService(Ci.mozIThirdPartyUtil);
let eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"]
                    .getService(Ci.nsIEffectiveTLDService);
let ss = require("simple-storage");
let parseUri = require("./parseuri");

/**
 * The object that keeps track of all of our cookie stats.
 */
if (!ss.storage.cookiemonster) {
  ss.storage.cookiemonster = {};
  ss.storage.cookiemonster.domains = {};
  ss.storage.cookiemonster.pairs = {};
}
let cookiemonster = ss.storage.cookiemonster;

/**
 * Given a host represented by a string, returns the (eTLD+1) base domain
 * for that host. Returns the host itself if there is some sort of error
 * with the eTLD service.
 * @param {string} aHost the host in question
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

function getBaseDomainFromHost(host) {
  let etld = host;
  try {
    etld = eTLDService.getBaseDomainFromHost(host);
  } catch (e) {
    console.log("eTLDService error getting tld from", host);
  }
  return etld;
}
exports.getBaseDomainFromHost = getBaseDomainFromHost;

/**
 * Given an nsIURI.spec, strip the path. Gross, gross -- we should not be
 * modifying the DOM.
 */
function parseUri(location) {
  let uri = parseUri.parseUri(location);
  return uri;
}

// Read cookies
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

// Set cookie.
function onExamineResponse(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  let cookie;
  try {
    cookie = channel.getResponseHeader("set-cookie");
  } catch (ex if ex.result == Cr.NS_ERROR_NOT_AVAILABLE) {
  }
  if (!cookie) {
    return;
  }
  console.log("set cookie", cookie);
  let request = channel.QueryInterface(Ci.nsIRequest);
  let name = request.name;
  let cookieEtld = getBaseDomainFromHost(getHostFromLocation(name));
  // Wow, this is wrong, it's getting the last dotted string that may be a
  // query param.
  console.log("cookie etld", cookieEtld, "name", name);
  // This call works, but we still need the domains themselves. So basically,
  // useless.
  let isThirdParty = false;
  try {
    isThirdParty = thirdPartyUtil.isThirdPartyChannel(channel);
  } catch (ex if ex.result == Cr.NS_ERROR_ILLEGAL_VALUE) {
  }
  console.log("third party", isThirdParty);
  let loadGroup = request.loadGroup;
  if (!loadGroup) {
    return;
  }
  let cbs = loadGroup.notificationCallbacks;
  if (!cbs) {
    return;
  }
  let context = cbs.getInterface(Ci.nsILoadContext);
  let window = context.associatedWindow;
  console.log("Got the window associated with the request", window.location);
  let topEtld = getBaseDomainFromHost(getHostFromLocation(window.location));
  console.log("window etld", topEtld);
}
exports.onExamineResponse = onExamineResponse;

function onCookieChanged(event) {
  console.log("cookie changed", JSON.stringify(event));
}
exports.onCookieChanged = onCookieChanged;

function onCookieRejected(event) {
  console.log("cookie rejected", JSON.stringify(event));
}
exports.onCookieChanged = onCookieChanged;

events.on("http-on-modify-request", onModifyRequest, false);
events.on("http-on-examine-response", onExamineResponse, false);
events.on("cookie-changed", onCookieChanged, false);
events.on("cookie-rejected", onCookieRejected, false);
