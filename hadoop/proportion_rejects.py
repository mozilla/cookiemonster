#!/usr/bin/env python

import re
import os
import operator
import fileinput
import sys
# In domains.tsv, the format is
# domain:<first_party|third_party_accepted|third_party_rejected> count

# Map of domains to the first party, third party accepted, and third party rejected counts
domain_map = {}

# Map of domains to proportion of third party cookie rejections (as a fraction of all cookies)
domain_reject_all = {}

# Map of domains to proportion of third party cookie rejections (as a fraction of third party cookies)
domain_reject_third = {}

for line in sys.stdin: 
  # Lines are tab-delimited
  l = line.split('\t')
  if len(l) != 2:
    continue

  fields = l[0].split(':')
  if len(fields) != 2:
    continue
  type = fields[1]
  if type not in [ "first_party", "third_party_accepted", "third_party_rejected" ]:
    continue
  domain = fields[0]
  count = float(l[1])
  if domain not in domain_map:
    domain_map[domain] = {}
  domain_map[domain][type] = count

for d in domain_map:
  if "third_party_rejected" in domain_map[d]:
    rejected = domain_map[d]["third_party_rejected"]
  else:
    rejected = 0
  third = rejected
  if "third_party_accepted" in domain_map[d]:
    third = third + domain_map[d]["third_party_accepted"]
  all = third
  if "first_party" in domain_map[d]:
    all = all + domain_map[d]["first_party"]
  domain_reject_all[d] = rejected / all
  if third:
    domain_reject_third[d] = rejected / third
  else:
    domain_reject_third[d] = 0

print "domain\tall\tthird"
for d in domain_map:
  print "%s\t%f\t%f" % (d, domain_reject_all[d], domain_reject_third[d])
