#!/usr/bin/python

import errno
import json
import sys
import numpy
from pprint import pprint

def get_cookie_data():

    study_data_string = open("data.json")    
    data = json.load(study_data_string)
    cookie_data = []

    for obj in data:
        if obj["msg"]: 
            if obj["msg"] == u"cookiemonster":
                cookie_data.append(obj)
    return cookie_data


def set_cookie_histogram(cookie_data):

    set_cookie_count = []

    for obj in cookie_data:
        if obj["data"]["eventType"] == "set-cookie":
            set_cookie_count.append(int(obj["data"]["count"]))

    h = numpy.histogram(set_cookie_count)
    return h

# Do this with expiry times, domains via a map->numbers
# 

def make_domain_map(cookie_data):
    """Map out the domains so we can reference them by number"""
    domain_map = {}
    domains = []
    i = 0
    for obj in cookie_data:
        if obj["data"]:
            try:
                if obj["data"]["domain"] not in domains:
                    d = obj["data"]["domain"]
                    domain_map[i] = d
                    domains.append(d)
                    i = i + 1
            except:
                continue
    return domain_map, domains


def domain_histogram(domain_map):
    d = []
    for id in domain_map:
        d.append(id)
    
    h = numpy.histogram(d)
    return h


def expiry_histogram(cookie_data):
    maxage = []
    for obj in cookie_data:
        try:
            if obj["data"]["maxage"]:
                print(obj["data"]["maxage"])
                maxage.append(int(obj["data"]["maxage"]))
        except:
            continue

    h = numpy.histogram(maxage)
    return h

if __name__ == "__main__":
    cd = get_cookie_data()
    sch = set_cookie_histogram(cd)
    dm, domains = make_domain_map(cd)
    dh = domain_histogram(dm)
    eh = expiry_histogram(cd)

    print("set-cookie histogram:")
    pprint(sch)
    print("domain histogram:")
    #pprint(dh)
    _domains = []
    for id in dh[0]:
        _domains.append(dm[id])
    dh3 = (_domains, dh[1],)
    pprint(dh3)
    print("expiry histogram:")
    pprint(eh)
