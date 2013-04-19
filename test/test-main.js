var main = require("main");

const { Cc, Ci, Cu, Cr } = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyServiceGetter(Services, "cookies",
                                   "@mozilla.org/cookieService;1",
                                   "nsICookieService");
XPCOMUtils.defineLazyServiceGetter(Services, "cookiemgr",
                                   "@mozilla.org/cookiemanager;1",
                                   "nsICookieManager2");
function testParseCookie() {
  const kATTRIBUTES = { "expires": 0, "path": 0, "domain": 0, "max-age": 0 };
}

exports["test main async"] = function(assert, done) {
  assert.pass("async Unit test running!");
  done();
};

require("test").run(exports);
