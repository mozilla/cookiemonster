#!/usr/bin/python

import errno
import json
import sys
import numpy
from pprint import pprint

study_data_string = open("data.json")

print(study_data_string)

data = json.load(study_data_string)

cookie_data = []

for obj in study_data_string:
    if obj.msg == "cookiemonster":
        cookie_data.append(obj)

set_cookie_count = []

for obj in cookie_data:
    if obj.data.eventType == "set-cookie":    
        set_cookie_count.append(obj.data.count)

h = numpy.histogram(cookie_data)

pprint(h)
