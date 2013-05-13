"use strict";

let cookiemonster = require("./cookiemonster");
let kSTUDY_NAME = cookiemonster.kSTUDY_NAME;

let micropilot = require("micropilot");
let fuse = micropilot.Fuse;
let monitor = require("micropilot").Micropilot(kSTUDY_NAME).start();
exports.monitor = monitor;
monitor.watch(kSTUDY_NAME);

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
             // return monitor.clear();
           });
         },
         resolve_this: self
       });
}

scheduleUpload();
