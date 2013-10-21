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
# <uid>:<domain>:tab_history_domain count
# cm_user:end_time:1131077915     1371945027062
cm_history = {}
for line in sys.stdin: 
  # Lines are tab-delimited
  l = line.split('\t')
  # cm_user:<start|end>:uid
  fields = l[0].split(':')
  if len(fields) != 3 or fields[2] != "tab_history_user":
    continue
  uid = fields[0]
  domain = fields[1]
  if not domain:
    print "error", fields
  if uid not in cm_history:
    cm_history[uid] = {}
  cm_history[uid][domain] = 1
  
print "cm_history = ", cm_history
