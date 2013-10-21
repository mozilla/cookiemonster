#!/usr/bin/env python

import re
import os
import operator
import fileinput
import sys
try:
  import simplejson as json
except:
  import json

# Each line is of the form
# cm_user:<start_time|end_time>:<uid> ts
# cm_user:end_time:1131077915     1371945027062
cm_users = {}
for line in sys.stdin: 
  # Lines are tab-delimited
  l = line.split('\t')
  # cm_user:<start|end>:uid
  fields = l[0].split(':')
  if fields[0] != "cm_user":
    continue
  type = fields[1]
  uid = fields[2]
  count = float(l[1])
  if uid not in cm_users:
    cm_users[uid] = {}
  cm_users[uid][type] = count
  
for uid in cm_users:
  u = cm_users[uid]
  length = u["end_time"] - u["start_time"]
  print "%s\t%d\t%d\t%d\t%d\t%d" % (uid, length,
    u["start_time"],
    u["end_time"],
    u["tab"],
    u["cookie"])
