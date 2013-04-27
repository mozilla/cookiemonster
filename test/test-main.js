var main = require("main");

const kEvents = main.kEvents;
const { Cc, Ci, Cu, Cr } = require("chrome");
const tabs = require("sdk/tabs");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyServiceGetter(Services, "cookies",
                                   "@mozilla.org/cookieService;1",
                                   "nsICookieService");
XPCOMUtils.defineLazyServiceGetter(Services, "cookiemgr",
                                   "@mozilla.org/cookiemanager;1",
                                   "nsICookieManager2");
let { nsHttpServer } = require("sdk/test/httpd");
let monitor = main.monitor;
const { defer, resolve, promised } = require("sdk/core/promise");

function testMonitor(assert, expectedEvents) {
  return monitor.upload("http://example.com", {simulate: true}).
    then(function(response) {
      let deferred = defer();
      let events = JSON.parse(response.content).events;
      console.log("EVENTS", JSON.stringify(events));
      console.log("expectedEvents", JSON.stringify(expectedEvents));
      assert.equal(expectedEvents.length, events.length);
      for (let i = 0; i < events.length; ++i) {
        for (key in events[i]) {
          if (key != "timestamp" && key != "eventstoreid") {
            assert.equal(expectedEvents[i].key, events[i].key);
          }
        }
      }
      assert.pass("Got expected events");
      deferred.resolve(true);
      return deferred.promise; });
    //then(null, function(e) { return resolve(console.log("couldn't clear", e)); });
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
  console.log("set cookie");
  aResponse.setStatusLine(aRequest.httpVersion, 200, "OK");
  aResponse.setHeader("Set-Cookie", "cookie1=value1; Max-Age=60", false);
  aResponse.setHeader("Content-Type", "text/html", false);
  aResponse.write("Setting a cookie");
}

function testParseCookie(assert) {
  expectedEvents = [{ eventType: kEvents.SET_COOKIE,
                      maxage: 60,
                      count: 1,
                      referrer: "localhost",
                      domain: "localhost" }];
  aUrl = "http://localhost:4444/setcookie";
  return doNav(aUrl).
    then(function() { return testMonitor(assert, expectedEvents); });
}

exports["test main async"] = function(assert, done) {
  console.log("async test running");
  assert.pass("async Unit test running!");
  let httpServer = new nsHttpServer();
  httpServer.registerPathHandler("/setcookie", setCookie);
  httpServer.start(4444);
  testParseCookie().
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
