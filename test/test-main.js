const events = require("sdk/system/events");
var main = require("./main");
var cookiemonster = require("./cookiemonster");
const { defer, resolve, promised, all } = require("sdk/core/promise");

const kEvents = cookiemonster.kEvents;
const { Cc, Ci, Cu, Cr } = require("chrome");
const tabs = require("sdk/tabs");
const prefs = require("sdk/preferences/service");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyServiceGetter(Services, "cookies",
                                   "@mozilla.org/cookieService;1",
                                   "nsICookieService");
XPCOMUtils.defineLazyServiceGetter(Services, "cookiemgr",
                                   "@mozilla.org/cookiemanager;1",
                                   "nsICookieManager2");

let { nsHttpServer } = require("sdk/test/httpd");

// Returns a promise that resolves when we see the event that we expect
function expectEvent(expected) {
  console.log("expecting");
  let deferred = defer();
  let checkEvent = function(actual) {
    let match = true;
    for (key in actual) {
      if (key != "timestamp" && key != "eventstoreid" &&
          expected[key] != actual[key]) {
          match = false;
          break;
      }
    }
    if (match) {
      assert.pass("Found a match", JSON.stringify(actual));
      deferred.resolve(true);
      // We can stop listening since we found a match
      events.off(cookiemonster.kSTUDY_NAME, checkEvent);
    }
  }
  events.on(cookiemonster.kSTUDY_NAME, checkEvent);
  return deferred.promise;
}

// Returns a promise that resolves when we see all of the events that we expect
function testMonitor(assert, expectedEvents) {
  console.log("testing monitor", JSON.stringify(expectedEvents));
  let promiseArray = []
  for (let i = 0; i < expectedEvents.length; i++) {
    promiseArray.push(function() { return expectEvent(expectedEvents[i]); });
  }
  return all(promiseArray);
}
  
// Returns a promise that resolves when the tab is open with the given URL.
function doNav(aUrl) {
  let deferred = defer();
  tabs.on("ready", function() {
    console.log("tab is ready");
    deferred.resolve(true);
  });
  tabs[0].url = aUrl;
  return deferred.promise;
}

// An HTTP handler that sets a cookie for localhost
function setCookie(aRequest, aResponse) {
  aResponse.setStatusLine(aRequest.httpVersion, 200, "OK");
  aResponse.setHeader("Set-Cookie", "cookie1=value1; Max-Age=60", false);
  aResponse.setHeader("Content-Type", "text/html", false);
  aResponse.write("Setting a cookie");
}

// Test that when we visit a page that sets a cookie we see a SET_COOKIE event
function testSetCookie(assert) {
  console.log("testSetCookie");
  let events = [
    { eventType: kEvents.SET_COOKIE,
      maxage: 60,
      count: 1,
      referrer: "localhost",
      domain: "localhost" },
    { eventType: kEvents.COOKIE_ADDED,
      domain: "localhost" }];
  let aUrl = "http://localhost:4444/setcookie";
  // Set up all the event listeners
  let p = testMonitor(assert, events);
  doNav(aUrl);
  return p;
}

// Test that when cookies get sent, we see a READ_COOKIE event
function testReadCookie(assert) {
  console.log("testReadCookie");
  let aUrl = "http://localhost:4444/";
  let e = { eventType: kEvents.READ_COOKIE,
            count: 1,
            referrer: "localhost", domain: "localhost" };
  let p = testMonitor(assert, [e]);
  doNav(aUrl);
  return p;
}

// Test that we notice when a single cookie is deleted
function testClearSingleCookie(assert) {
  console.log("testClearSingleCookie");
  let e = { eventType: kEvents.COOKIE_DELETED, domain: "localhost" };
  let p = testMonitor(assert, [e]);
  // Remove the cookie and block access for localhost
  Services.cookiemgr.remove("localhost", "cookie1", "/", true);
  return p;
}

// Test that when we reject cookies, we get rejection events
function testRejectCookie(assert) {
  console.log("testRejectCookie");
  let aUrl = "http://localhost:4444/setcookie";
  let expectedEvents = [{ eventType: kEvents.COOKIE_REJECTED,
                          domain: "localhost" }];
  return doNav(aUrl).
    then(function() { return testMonitor(assert, expectedEvents); });
}

// Test that we notice when all cookies are deleted
function testClearCookies(assert) {
  console.log("testClearCookies");
  e = { eventType: kEvents.ALL_COOKIES_DELETED };
  let p = testMonitor(assert, [e]);
  Services.cookiemgr.removeAll();
  return p;
}

// Test that we record preferences accurately.
function testPrefs(assert) {
  console.log("testPrefs woot!");
  let type = kEvents.PREFERENCE;
  let events = [
    {eventType: type, name: "browser.privatebrowsing.autostart", value: false},
    {eventType: type, name: "network.cookie.cookieBehavior", value: 3},
    {eventType: type, name: "network.cookie.lifetimePolicy", value: 0},
    {eventType: type, name: "privacy.sanitize.sanitizeOnShutdown", value: false},
    {eventType: type, name: "privacy.clearOnShutdown.cache", value: true},
    {eventType: type, name: "privacy.clearOnShutdown.cookies", value: true},
    {eventType: type, name: "privacy.clearOnShutdown.downloads", value: true},
    {eventType: type, name: "privacy.clearOnShutdown.formdata", value: true},
    {eventType: type, name: "privacy.clearOnShutdown.history", value: true},
    {eventType: type, name: "privacy.clearOnShutdown.offlineApps", value: false},
    {eventType: type, name: "privacy.clearOnShutdown.passwords", value: false},
    {eventType: type, name: "privacy.clearOnShutdown.sessions", value: true},
    {eventType: type, name: "privacy.clearOnShutdown.siteSettings", value: false},
    {eventType: type, name: "privacy.cpd.cache", value: true},
    {eventType: type, name: "privacy.cpd.cookies", value: true},
    {eventType: type, name: "privacy.cpd.downloads", value: true},
    {eventType: type, name: "privacy.cpd.formdata", value: true},
    {eventType: type, name: "privacy.cpd.history", value: true},
    {eventType: type, name: "privacy.cpd.offlineApps", value: false},
    {eventType: type, name: "privacy.cpd.passwords", value: false},
    {eventType: type, name: "privacy.cpd.sessions", value: true},
    {eventType: type, name: "privacy.cpd.siteSettings", value: false}];
  let p = testMonitor(assert, events);
  cookiemonster.dumpPrefs();
  return p;
}

// An HTTP handler that loads a page with a social widget in it
function socialLoaded(aRequest, aResponse) {
  aResponse.setStatusLine(aRequest.httpVersion, 200, "OK");
  aResponse.setHeader("Content-Type", "text/html", false);
  aResponse.write("<html><head><script src=\"//http://connect.facebook.net/en_US/all.js\"></script></head><body></body></html>");
}

// Test that we record social widgets loading.
function testSocialWidgetsLoaded(assert) {
  console.log("testSocialWidgetsLoaded");
  let e = { eventType: kEvents.SOCIAL_WIDGET_LOADED,
            widget: "connect.facebook.net",
            referrer: "localhost" };
  let aUrl = "http://localhost:4444/socialloaded";
  let p = testMonitor(assert, [e]);
  doNav(aUrl);
  return p;
}

// An HTTP handler that loads a fake share url
function shareURL(aRequest, aResponse) {
  aResponse.setStatusLine(aRequest.httpVersion, 200, "OK");
  aResponse.setHeader("Content-Type", "text/html", false);
  aResponse.write("<html><head></head><body>SHARE!</body></html>");
}

// Test that we record a 'share url' being used.
function testShareURLUsed(assert) {
  console.log("testShareURLUsed");
  let e = { eventType: kEvents.SHARE_URL_LOADED,
            shareURL: "localhost",
            referrer: null };

  let aUrl = "http://localhost:4444/share";
  let p = testMonitor(assert, [e]);
  doNav(aUrl);
  return p;
}

exports["test main async"] = function(assert, done) {
  console.log("async test running");
  assert.pass("async Unit test running!");
  let httpServer = new nsHttpServer();
  httpServer.registerPathHandler("/setcookie", setCookie);
  httpServer.registerPathHandler("/socialloaded", socialLoaded);
  httpServer.registerPathHandler("/share", shareURL);

  httpServer.start(4444);
  testSetCookie(assert).
    then(function() { return testReadCookie(assert); }).
    then(function() { return testClearSingleCookie(assert); }).
    //then(function() { return testRejectCookie(assert); }).
    then(function() { return testClearCookies(assert); }).
    then(function() { return testPrefs(assert); }).
    then(function() { return testSocialWidgetsLoaded(assert); }).
    then(function() { return testShareURLUsed(assert); }).
    then(function() {
      httpServer.stop(done);
      return resolve(done());
    }).
    then(null, function() {
      assert.fail("Failed somewhere");
      httpServer.stop(done);
      done;
    });
};

require("sdk/test").run(exports);
