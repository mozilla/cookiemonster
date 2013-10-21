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
import urlparse
import publicsuffix

# Each line is of the form
# uid ts eventstoreid event-type event-subtype middle-final event-json
# 1078540297	1370076131322	1	addon-main	--	m	{"msg": "addon-main", "eventstoreid": 1, "data": {"reason": "install", "version": "10.5.0"}, "ts": 1370076131322}

NFIELDS = 7
UID = sys.argv[1]
psl = publicsuffix.PublicSuffixList()

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

  if uid != UID:
    continue

  # Collect the history based on tab-ready events
  # 1078540297	1370076132626	5	micropilot-user-events	tabs	m	{"msg": "micropilot-user-events", "eventstoreid": 5, "data": {"index": 5, "tabid": "13700761315695", "group": "tabs", "title": "DKR COMPLETE -137290", "url": "http://dkr1.ssisurveys.com/projects/end?rst=1&basic=89790&PID=1078540297", "ts": 1370076132626, "pinned": false, "windowid": 3, "action": "tab-ready"}, "ts": 1370076132627, "subject": null}
  if event_type != "micropilot-user-events":
    continue

  if event_subtype != "tabs":
    continue

  event = json.loads(l[-1])
  tab_event = event["data"]

  # We only care about tab-ready events for now
  if tab_event["action"] != "tab-ready":
    continue
  url = urlparse.urlparse(tab_event["url"])
  domain = psl.get_public_suffix(url.netloc)

  # Map to tlds
  print "LongValueSum:domain:%s:%s\t1" % (uid, domain)
