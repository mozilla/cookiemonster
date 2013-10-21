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
import cm_users
import cm_history
import top_users
import urlparse
import publicsuffix

# Each line is of the form
# uid ts eventstoreid event-type event-subtype middle-final event-json
# 1078540297	1370076131322	1	addon-main	--	m	{"msg": "addon-main", "eventstoreid": 1, "data": {"reason": "install", "version": "10.5.0"}, "ts": 1370076131322}

NFIELDS = 7
psl = publicsuffix.PublicSuffixList()

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
  if max_age <= 90 * 24 * 60  * 60:
    return "3month"
  if max_age <= 180 * 24 * 60  * 60:
    return "6month"
  if max_age <= 365 * 24 * 60  * 60:
    return "year"
  if max_age <= 2* 365 * 24 * 60  * 60:
    return "2year"
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
  print "UniqValueCount:users_total\t%s" % uid

  # If they're a cookie monster user, count extensions and tab-ready events
  if uid in cm_users.cm_users and event_type == "micropilot-user-events":
    if event_subtype == "startup-shutdown":
      event = json.loads(l[-1])
      startup_shutdown_event = event["data"]
      try:
        extensions = json.dumps(startup_shutdown_event["snapshot"]["extensions"])
        extensions = extensions.replace(" ", "")
        print "LongValueSum:%s:%s:extensions\t1" % (uid, extensions)
      except:
        print "LongValueSum:%s:extension_error\t1" % uid
      prefs = startup_shutdown_event["prefs"]
      for p in ["privacy.sanitize.sanitizeOnShutdown",
                "privacy.clearOnShutdown.cookies",
                "privacy.cpd.cookies",
                "network.cookie.cookieBehavior"]:
        print "LongValueSum:%s:pref:%s:%s\t1" % (uid, p, prefs[p])
    elif event_subtype == "tabs":
      event = json.loads(l[-1])
      tab_event = event["data"]
      if tab_event["action"] == "tab-ready":
        print "LongValueSum:cm_user:tab:%s\t1" % uid
        try:
          url = urlparse.urlparse(tab_event["url"])
          domain = psl.get_public_suffix(url.netloc)
          if domain:
            print "LongValueSum:%s:tab_domain\t1" % domain
            print "LongValueSum:%s:%s:tab_history_user\t1" % (uid, domain)
        except:
          print "LongValueSum:error_tab\t1"

  # We only care about cookiemonster set-cookie events for now
  if event_type != "cookiemonster":
    continue

  # Count the number of cookie monster users
  event = json.loads(l[-1])
  cm_event = event["data"]
  if cm_event["eventType"] != "set-cookie":
    continue

  # Count number of users, how active they were, and how long they participated
  print "UniqValueCount:cm_users_total\t%s" % uid
  print "LongValueMin:cm_user:start_time:%s\t%s" % (uid, ts)
  print "LongValueMax:cm_user:end_time:%s\t%s" % (uid, ts)

  # The addon emitted 1 event for each cookie in the set-cookie header, so
  # count the number of headers
  num_headers = 1.0 / float(cm_event["count"])

  print "DoubleValueSum:cm_user:cookie:%s\t%f" % (uid, num_headers)

  # Map to domains only
  print "DoubleValueSum:%s:domain\t%f" % (cm_event["domain"], num_headers)

  # Ugh, we have some unparsable maxages.
  if cm_event["maxage"]:
    print "LongValueSum:maxage:%s\t1" % bucket(int(cm_event["maxage"]))
    # Too many ages to be a histogram
    age = int(cm_event["maxage"])
    if age < 0:
      age = 0
    print "ValueHistogram:ages:%d\t1" % (age / 3600)

  if cm_event["domain"] == cm_event["referrer"]:
    # First party cookie
    print "DoubleValueSum:%s:first_party\t%f" % (cm_event["domain"], num_headers)
    # Count up all first party cookies
    print "DoubleValueSum:first_total\t%f" % num_headers
  else:
    # Count up all first party cookies
    print "DoubleValueSum:third_total\t%f" % num_headers
    if int(cm_event["existingCount"]) > 0:
      # It would be accepted under FROM_VISITED
      print "DoubleValueSum:%s:third_party_accepted\t%f" % (cm_event["domain"], num_headers)
      print "DoubleValueSum:third_party_accepted_total\t%f" % num_headers
    else:
      # It would be rejected under FROM_VISITED
      print "DoubleValueSum:%s:third_party_rejected\t%f" % (cm_event["domain"], num_headers)
      print "DoubleValueSum:third_party_rejected_total\t%f" % num_headers
      if cm_event["domain"] == "doubleclick.net":
        print "DoubleValueSum:doubleclick_reject:%s\t%f" % (uid, num_headers)
    history = cm_history.cm_history[uid]
    # For top users only
    if True or uid in top_users.top_users:
      print "DoubleValueSum:third_history_total\t%f" % (num_headers)
      if cm_event["domain"] in history:
        # It would be accepted under simulated history
        print "DoubleValueSum:%s:third_party_history_accepted\t%f" % (cm_event["domain"], num_headers)
        print "DoubleValueSum:third_party_history_accepted_total\t%f" % num_headers
      else:
        # It would be rejected under simulated history
        print "DoubleValueSum:%s:third_party_history_rejected\t%f" % (cm_event["domain"], num_headers)
        print "DoubleValueSum:third_party_history_rejected_total\t%f" % num_headers
    # Print domain pairs
    print "DoubleValueSum:%s:%s:domain_pair\t%f" % (
      cm_event["domain"], cm_event["referrer"], num_headers)
