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
  count = int(l[1])
  if domain not in domain_map:
    domain_map[domain] = {}
  domain_map[domain][type] = count

print "domain\tall\tthird\trejected\tproportion_third\tproportion_rejected_all\tproportion_rejected_third"
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
  proportion_third = float(third) / float(all)
  proportion_rejected_all = float(rejected) / (all)
  proportion_rejected_third = 0
  if third:
    proportion_rejected_third = float(rejected) / float(third)
  print "%s\t%d\t%d\t%d\t%f\t%f\t%f" % (d, all, third, rejected, proportion_third, proportion_rejected_all, proportion_rejected_third)
