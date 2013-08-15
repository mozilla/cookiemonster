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
# uid ts eventstoreid event-type event-subtype middle-final event-json
# 1078540297	1370076131322	1	addon-main	--	m	{"msg": "addon-main", "eventstoreid": 1, "data": {"reason": "install", "version": "10.5.0"}, "ts": 1370076131322}

NFIELDS = 7

# Return a bucket for max age (in seconds)
def bucket(max_age):
  if max_age <= 60:
    return "minute"
  if max_age <= 60*60:
    return "hour"
  if max_age <= 24 * 60 * 60:
    return "day"
  if max_age <= 7 * 24 * 60 * 30:
    return "week"
  if max_age <= 30 * 24 * 60  * 60:
    return "month"
  if max_age <= 365 * 24 * 60  * 60:
    return "year"
  return "yearplus"


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

  # Count the number of distinct users
  print "UniqValueCount:users\t%s" % uid

  # We only care about startup-shutdown and cookiemonster events for now
  if event_type != "cookiemonster":
    continue

  # Count the number of cookie monster users
  print "UniqValueCount:cm_users\t%s" % uid

  event = json.loads(l[-1])
  cm_event = event["data"]
  if cm_event["eventType"] != "set-cookie":
    continue

  # Map to domains only
  print "LongValueSum:%s:domain\t1" % cm_event["domain"]

  # Too many ages to be a histogram
  # print "ValueHistogram:%s\t%1" % cm_event["maxage"]
  # Ugh, we have some unparsable maxages.
  if cm_event["maxage"]:
    print "LongValueSum:maxage:%s\t1" % bucket(int(cm_event["maxage"]))

  if cm_event["domain"] == cm_event["referrer"]:
    # First party cookie
    print "LongValueSum:%s:first\t1" % cm_event["domain"]
    # Count up all first party cookies
    print "LongValueSum:first\t1"
  else:
    # Count up all first party cookies
    print "LongValueSum:third\t1"
    if int(cm_event["existingCount"]) > 0:
      # It would be accepted under FROM_VISITED
      print "LongValueSum:%s:third_party_accepted\t1" % cm_event["domain"]
      print "LongValueSum:third_party_accepted\t1"
    else:
      # It would be rejected under FROM_VISITED
      print "LongValueSum:%s:third_party_rejected\t1" % cm_event["domain"]
      print "LongValueSum:third_party_rejected\t1"
    # Print domain pairs
    print "LongValueSum:%s:%s:domain_pair\t1" % (
      cm_event["domain"], cm_event["referrer"])
