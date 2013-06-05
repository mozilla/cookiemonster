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
                    i += 1
            except:
                continue
    return domain_map, domains


def make_domain_pair_map(cookie_data, domain_map):
    dp_map = {}
    pairs = []
    pair_counts = {}
    i = 0
    for obj in cookie_data:
        if obj["data"]:
            try:
                pair = "&".join([obj["data"]["domain"], obj["data"]["referrer"],])
                if pair not in pairs:
                    # XXXddahl: we might need all raw data for the domain pair histogram!
                    print(pair)
                    pairs.append(pair)
                    dp_map[i] = pair
                    pair_counts[pair] = 1 
                    i += 1
                else:
                    pair_counts[pair] =   pair_counts[pair] + 1
            except Exception as err:
                print(err)
                continue
    pprint(pair_counts)
    return dp_map, pairs, pair_counts


def domain_pair_histogram(domain_pair_map):
    return domain_histogram(domain_pair_map)


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
                #print(obj["data"]["maxage"])
                maxage.append(int(obj["data"]["maxage"]))
        except:
            continue

    h = numpy.histogram(maxage)
    return h

def build_json_data_for_js(cookie_data):
    """Build and output to disk JSON data that brows JS can use in visualization """
    

if __name__ == "__main__":
    cd = get_cookie_data()
    sch = set_cookie_histogram(cd)
    dm, domains = make_domain_map(cd)
    dh = domain_histogram(dm)
    eh = expiry_histogram(cd)
    dpm, pairs, pair_counts = make_domain_pair_map(cd, dm)
    dph = domain_pair_histogram(dpm)
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
    print("domian pair map:")
    pprint(dpm)
    print("domain pairs:")
    pprint(pairs)
    print("pair_counts:")
    pprint(pair_counts)
    print("domain_pair_histogram:")
    _domains = []
    for id in dph[0]:
        _domains.append(dpm[id])
    dph = (_domains, dph[1],)
    pprint(dph)
