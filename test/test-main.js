var main = require("main");

const kEvents = main.kEvents;
const { Cc, Ci, Cu, Cr } = require("chrome");
const tabs = require("sdk/tabs");
/*
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyServiceGetter(Services, "cookies",
                                   "@mozilla.org/cookieService;1",
                                   "nsICookieService");
XPCOMUtils.defineLazyServiceGetter(Services, "cookiemgr",
                                   "@mozilla.org/cookiemanager;1",
                                   "nsICookieManager2");
*/
let { nsHttpServer } = require("sdk/test/httpd");
let monitor = main.monitor;
const { defer, resolve, promised } = require("sdk/core/promise");

// Tests that we recorded the events that we expected.
function testMonitor(assert, expectedEvents) {
  return monitor.upload("http://example.com", {simulate: true}).
    then(function(response) {
      // Oh man, this is awful -- this throws BLOCKED [IDBVersionChangeEvent]
      // but just ignore it, since the clear seems to actually work.
      monitor.clear();
      let deferred = defer();
      let events = JSON.parse(response.content).events;
      console.log("EVENTS", JSON.stringify(events));
      console.log("expectedEvents", JSON.stringify(expectedEvents));
      assert.equal(expectedEvents.length, events.length);
      for (let i = 0; i < events.length; ++i) {
        let actual = events[i];
        let expected = expectedEvents[i];
        for (key in actual) {
          if (key != "timestamp" && key != "eventstoreid" && key != "success") {
            assert.equal(expected[key], actual[key]);
          }
        }
      }
      assert.pass("Got expected events");
      deferred.resolve(true);
      return deferred.promise;
    });
}

// Returns a promise that resolves when the tab is open with the given URL.
function doNav(aUrl) {
  let deferred = defer();
  tabs.on("ready", function() {
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
  let expectedEvents = [{ eventType: kEvents.SET_COOKIE,
                          maxage: 60,
                          count: 1,
                          referrer: "localhost",
                          domain: "localhost" },
                        { eventType: kEvents.COOKIE_ADDED,
                          domain: "localhost" }];
  let aUrl = "http://localhost:4444/setcookie";
  return doNav(aUrl).
    then(function() { return testMonitor(assert, expectedEvents); });
}

// Test that when cookies get sent, we see a READ_COOKIE event
function testReadCookie(assert) {
  let aUrl = "http://localhost:4444/";
  let expectedEvents = [{ eventType: kEvents.READ_COOKIE,
                          count: 1,
                          // This seems like a bug
                          referrer: null,
                          domain: "localhost" }];
  return doNav(aUrl).
    then(function() { return testMonitor(assert, expectedEvents); });
}

// Test that when we reject cookies, we get rejection events
function testRejectCookie(assert) {
  // Reject all cookies
  prefs.set("network.cookie.cookieBehavior", 2);
  console.log("prefs", prefs.get("network.cookie.cookieBehavior", 0));
  let aUrl = "http://localhost:4444/setcookie";
  let expectedEvents = [{ eventType: kEvents.COOKIE_REJECTED,
                          domain: "localhost" }];
  return doNav(aUrl).
    then(function() { return testMonitor(assert, expectedEvents); });
}

exports["test main async"] = function(assert, done) {
  console.log("async test running");
  assert.pass("async Unit test running!");
  let httpServer = new nsHttpServer();
  httpServer.registerPathHandler("/setcookie", setCookie);
  httpServer.start(4444);
  testSetCookie(assert).
    then(function() { return testReadCookie(assert); }).
    //then(function() { return testRejectCookie(assert); }).
    then(function() {
      httpServer.stop(done);
      done();
    }).
    then(null, function() {
      assert.fail("Failed somewhere");
      httpServer.stop(done);
      done;
    });
};

require("sdk/test").run(exports);
