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

f = open("user_%s.history" % sys.argv[1], "r")
history = {}
for l in f.readlines():
  history[l.strip()] = 1

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

  # We only care about startup-shutdown and cookiemonster events for now
  if event_type != "cookiemonster":
    continue

  event = json.loads(l[-1])
  cm_event = event["data"]
  if cm_event["eventType"] != "set-cookie":
    continue

  # How long did they participate
  print "LongValueMin:start_time\t%s" % ts
  print "LongValueMax:end_time\t%s" % ts

  # The domain of the cookie being set
  domain = cm_event["domain"]
  if domain == cm_event["referrer"]:
    # First party cookie
    print "LongValueSum:%s:first_party\t1" % cm_event["domain"]
    # Count up all first party cookies
    print "LongValueSum:first_party_total\t1"
  else:
    # Count up all first party cookies
    print "LongValueSum:third_party_total\t1"
    if int(cm_event["existingCount"]) > 0:
      # It would be accepted under FROM_VISITED
      print "LongValueSum:%s:third_party_accepted\t1" % domain
      print "LongValueSum:third_party_accepted_total\t1"
    else:
      # It would be rejected under FROM_VISITED
      print "LongValueSum:%s:third_party_rejected\t1" % domain
      print "LongValueSum:third_party_rejected_total\t1"
    # Pretend they cleared their history
    if domain in history:
      print "LongValueSum:%s:third_party_history_accepted\t1" % domain
      print "LongValueSum:third_party_history_accepted_total\t1"
    else:
      print "LongValueSum:%s:third_party_history_rejected\t1" % domain
      print "LongValueSum:third_party_history_rejected_total\t1"
    # Print domain pairs
    print "LongValueSum:%s:%s:domain_pair\t1" % (
      cm_event["domain"], cm_event["referrer"])
