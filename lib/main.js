"use strict";

// Other people's stuff
let { storage } = require("simple-storage");
let simplePrefs = require("simple-prefs").prefs;
let micropilot = require("micropilot");

// Our stuff
let self = this;
let cookiemonster = require("./cookiemonster");
let kSTUDY_NAME = cookiemonster.kSTUDY_NAME;

// Timers and constants for uploading study data
let fuse = micropilot.Fuse;
let monitor = require("micropilot").Micropilot(kSTUDY_NAME).start();
const kUPLOAD_URL =
  "https://testpilot.mozillalabs.com/submit/testpilot_micropilot_" +
  kSTUDY_NAME;

//const kPULSE_INTERVAL = 24 * 60 * 60 * 1000; // One day in milliseconds
const kPULSE_INTERVAL = 60 * 1000; // One day in milliseconds
const kSTUDY_DURATION = 7 * kPULSE_INTERVAL; // One week

// Watch events that are associated with cookiemonster
monitor.watch([kSTUDY_NAME]);

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
           cookiemonster.recordMetadata().
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
