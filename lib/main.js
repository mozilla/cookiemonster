"use strict";

// we could use the things from gregglind/micropilot-template here.

let micropilot = require("micropilot");
let fuse = micropilot.Fuse;
let monitor = require("micropilot").Micropilot('cookiemonster').start();
exports.monitor = monitor;
monitor.watch("cookiemonster")
