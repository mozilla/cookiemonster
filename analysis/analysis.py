#!/usr/bin/python

import errno
import json
import sys
import numpy
from pprint import pprint

def get_cookie_data():

    study_data_string = open("bigdata.json")    
    data = json.load(study_data_string)
    cookie_data = []
    user_sessions = 0
    for obj_ in data:
        user_sessions += 1
        if obj_["events"]:
            evts = obj_["events"]
            for obj in  evts:
                if obj["msg"]: 
                    if obj["msg"] == u"cookiemonster":
                        cookie_data.append(obj)
    return cookie_data, user_sessions


def set_cookie_histogram(cookie_data):

    set_cookie_count = []
    
    for obj in cookie_data:
        if obj["data"]["eventType"] == "set-cookie":
            set_cookie_count.append(int(obj["data"]["count"]))
            
    h = numpy.histogram(set_cookie_count)
    return h, set_cookie_count

# Do this with expiry times, domains via a map->numbers
# 

def cookie_changed(cookie_data):
    changed = []
    deleted = []
    rejected = []
    
    for obj in cookie_data:
        if obj["data"]:
            try:
                if obj["data"]["eventType"] == "cookie-deleted":
                    deleted.append(obj["data"])
                elif obj["data"]["eventType"] == "cookie-changed":
                    changed.append(obj["data"])
                elif obj["data"]["eventType"] == "cookie-rejected":
                    rejected.append(obj["data"])
            except Exception, ex:
                print ex

    return changed, deleted, rejected

def make_social_widget_data(cookie_data):
    """Make SOCIAL_WIDGET data pie-chartable"""
    domain_widget_map = {}
    domain_widgets = []
    widgets = []
    for obj in cookie_data:
        if obj["data"]:
            try:
                if obj["data"]["eventType"] == "SOCIAL_WIDGET_LOADED":
                    # print("SOCIAL_WIDGET: ")
                    if obj["data"]["widget"] not in widgets:
                        wid = {"widget": obj["data"]["widget"], "value": 1}
                        domain_widgets.append(wid)
                        w = obj["data"]["widget"]
                        domain_widget_map[w] = 1 
                        widgets.append(w)
                    else:
                        w = obj["data"]["widget"]
                        for widge in domain_widgets:
                            # print(widge)
                            # print(widge["widget"])
                            if widge["widget"] == w:
                                widge["value"] = widge["value"] + 1

            except Exception, ex:
                print(ex)
                continue
    return domain_widgets


def make_share_widget_data(cookie_data):
    """Make SHARE_WIDGET data pie-chartable"""
    domain_widget_map = {}
    domain_widgets = []
    widgets = []
    for obj in cookie_data:
        if obj["data"]:
            try:
                if obj["data"]["eventType"] == "SHARE_URL_LOADED":
                    # print("SHARE_URL: ")
                    if obj["data"]["shareURL"] not in widgets:
                        wid = {"shareURL": obj["data"]["shareURL"], "value": 1}
                        domain_widgets.append(wid)
                        w = obj["data"]["shareURL"]
                        domain_widget_map[w] = 1 
                        widgets.append(w)
                    else:
                        w = obj["data"]["shareURL"]
                        for widge in domain_widgets:
                            # print(widge)
                            # print(widge["shareURL"])
                            if widge["shareURL"] == w:
                                widge["value"] = widge["value"] + 1

            except Exception, ex:
                print(ex)
                continue
    return domain_widgets


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
                    pairs.append(pair)
                    dp_map[i] = pair
                    pair_counts[pair] = 1 
                    i += 1
                else:
                    pair_counts[pair] =   pair_counts[pair] + 1
            except Exception as err:
                print(err)
                continue
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
    js_data = []
    for obj in cookie_data:
        try:
            if obj["data"]["maxage"]:
                #print(obj["data"]["maxage"])
                maxage.append(int(obj["data"]["maxage"]))
                js_data.append(str(obj["data"]["maxage"]))
        except:
            continue

    h = numpy.histogram(maxage)
    return h, js_data

def convert_histogram_to_json(hist):
    jhist = {"id": [], "values": []}
    for id in hist[0]:
        jhist["id"].append(id)

    for val in hist[1]:
        jhist["values"].append(val)

    return jhist

def build_json_data_for_js():
    """Build and output to disk JSON data that brows JS can use in visualization """
    data = {}
    cd, us = get_cookie_data()
    # data["cookie_data"] = cd
    changed, deleted, rejected = cookie_changed(cd)
    data["changed"] = changed
    data["deleted"] = deleted
    data["rejected"] = rejected
    data["total_cookie_events"] = len(cd)
    data["total_user_sessions"] = us
    data["social_widget_loaded"] = make_social_widget_data(cd)
    data["share_urls"] = make_share_widget_data(cd)
    sch, set_cookie_count = set_cookie_histogram(cd)
    data["set_cookie_histogram"] = convert_histogram_to_json(sch)
    data["set_cookie_count"] = set_cookie_count
    dm, domains = make_domain_map(cd)
    data["domain_map"] = dm
    dpm, pairs, pair_counts = make_domain_pair_map(cd, dm)
    data["domain_pair_map"] = dpm
    data["domain_pairs"] = pairs
    data["domain_pair_counts"] = pair_counts
    dph = domain_pair_histogram(dpm)
    data["domain_pair_histogram"] = convert_histogram_to_json(dph)
    
    dh = domain_histogram(dm)
    data["domain_histogram"] = convert_histogram_to_json(dh)

    eh, js_data = expiry_histogram(cd)
    data["expiry_histogram"] = convert_histogram_to_json(eh)
    _str = "var CMData = "
    _str = _str + json.dumps(data, sort_keys=True, separators=(',', ':'))
    
    f = open("cm_data.json", "w")
    f.write(_str)
    f.close()

    return _str
    
    
if __name__ == "__main__":
    cd, us = get_cookie_data()
    sch = set_cookie_histogram(cd)
    dm, domains = make_domain_map(cd)
    dh = domain_histogram(dm)
    eh, js_data = expiry_histogram(cd)
    dpm, pairs, pair_counts = make_domain_pair_map(cd, dm)
    dph = domain_pair_histogram(dpm)
    swd = make_social_widget_data(cd)
    _domains = []
    for id in dh[0]:
        _domains.append(dm[id])
    dh3 = (_domains, dh[1],)
    _domains = []
    for id in dph[0]:
        _domains.append(dpm[id])
    dph = (_domains, dph[1],)

