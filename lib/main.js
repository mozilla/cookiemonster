let events = require("sdk/system/events");
const { Cc, Ci } = require("chrome");

function onModifyRequest(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  try {
    let cookie = channel.getRequestHeader("cookie");
    console.log("cookie", cookie);
  } catch (e) {
    console.log(e);
  }
}
exports.onModifyRequest = onModifyRequest;

function onExamineResponse(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  try {
    let cookie = channel.getResponseHeader("set-cookie");
    console.log("set cookie", cookie);
  } catch (e) {
    console.log(e);
  }
}
exports.onExamineResponse = onExamineResponse;

events.on("http-on-modify-request", onModifyRequest, false);
events.on("http-on-examine-response", onExamineResponse, false);
