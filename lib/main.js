"use strict";

let cookiemonster = require("./cookiemonster");

let micropilot = require("micropilot");
let fuse = micropilot.Fuse;
let monitor = require("micropilot").Micropilot('cookiemonster').start();
exports.monitor = monitor;
monitor.watch("cookiemonster") ;
