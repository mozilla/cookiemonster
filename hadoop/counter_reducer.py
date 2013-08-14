#!/usr/bin/env python
import sys
import os

delimiter = os.environ.get("dlm","\t")

super_total = 0
total = 0
key = None
def reset(k):
  global super_total, total, key
  super_total += total
  total = 0
  key = k

def dump():
  if key == None: 
    return
  else:
    print delimiter.join((key,str(total)))

for line in sys.stdin:
  line = line.strip()
  k, n = line.split(delimiter,1)
  if key == None:
    reset(k)

  # Record the old key and start a new key.
  if k != key:
    dump()
    reset(k)

  total += int(n)

# at the end dump a final time
dump()
