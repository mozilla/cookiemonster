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

# Usage: user_cookie_mapper <uid>
# Expects a file named user_<uid>.history to exist with one domain per line

# Each line is of the form
# uid ts eventstoreid event-type event-subtype middle-final event-json
# 1078540297	1370076131322	1	addon-main	--	m	{"msg": "addon-main", "eventstoreid": 1, "data": {"reason": "install", "version": "10.5.0"}, "ts": 1370076131322}

NFIELDS = 7

for line in sys.stdin: 
  # Lines are tab-delimited
  l = line.split('\t')
  if len(l) != NFIELDS:
    continue

  uid = l[0]
  ts = l[1]
  eventstore_id = l[2]
  event_type = l[3]
  event_subtype = l[4]
  slice_type = l[5]

  if uid != sys.argv[1]:
    continue

  print line
