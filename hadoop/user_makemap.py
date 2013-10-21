#!/usr/bin/env python

import re
import os
import operator
import fileinput
import sys
# Each line is of the form
# domain:uid:<domain> count
# domain:1078540297:118	1

for line in sys.stdin: 
  # Lines are tab-delimited
  l = line.split('\t')
  if len(l) != 2:
    continue

  fields = l[0].split(':')
  uid = fields[1]
  domain = fields[2]
  print domain
