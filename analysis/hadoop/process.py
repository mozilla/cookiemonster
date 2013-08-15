#!/usr/bin/python
"""
first party cookies - count  O(providers)
third party cookies - count  O(providers) 
1-3 pair - count    O(providers pairs)
set-cookies count - int
maxage - histogram, max  O(18mm, naive), but can do better!
person - cookiecounts  O(2400)
count domain timestamp existingcount referrer ts
"""

# A=cookiemonsterdata; hdfs dfs -text "$A"/*snappy | ./process.py > cookie_data.json

import sys
import simplejson as json
from collections import defaultdict

import stream_sampler
def Counter():  return defaultdict(int)

data = {
    "first": Counter(),
    "third":  Counter(),
    "domain_pairs":   Counter(),
    "people":  Counter(),
    "social_widget": Counter(),
    "share_url": Counter(),
    "total_count": 0,
    "events": 0,
}

samplers = {
    "maxage": stream_sampler.StreamSampler(10000,50,50),
    "set_cookie_count": stream_sampler.StreamSampler(10000,50,50),
}

def set_cookie_count(ii, person, js):
    try:
        if js["eventType"] == "set-cookie":
            data["first"][js["domain"]] += js['count']
            data["third"][js["referrer"]] += js['count']
            p = "%s:%s" % (js["domain"], js["referrer"])
            data["domain_pairs"][p] += js['count']
            data["people"][person] +=  js['count']  
            samplers['maxage'].sample(js['maxage'], ii)
            samplers["set_cookie_count"].sample(int(js["count"]), ii)
            data['total_count'] += js["count"]
        elif js["eventType"] == "SOCIAL_WIDGET_LOADED":
            data["social_widget"][js["widget"]] += 1
        elif js["eventType"] == "SHARE_URL_LOADED":
            data["share_url"][js["shareURL"]] += 1
        data['events'] += 1
    except KeyError, e:
        sys.stderr.write("KeyError: %s\n" % str(e))


def process_data(ii, person, js):
    """Process each kind of data encountered"""
    obj = js["data"]
    def not_found(ii, person, obj):
        sys.stderr.write("%s action not found.\n" % obj["eventType"])
    def switch(obj):
        return {
            'set-cookie': set_cookie_count,
            'SOCIAL_WIDGET_LOADED': set_cookie_count,
            'SHARE_URL_LOADED': set_cookie_count,
            }.get(obj["eventType"], not_found)
    func = switch(obj)
    func(ii, person, obj)


def write_output(data):
    data['maxage'] = sorted(samplers['maxage'].list)
    data['maxage'][-1] = max(samplers['maxage'].maxes.list)
    data['maxage'][0] = min(samplers['maxage'].mins.list)
    
    data['maxage_mins'] = min(samplers['maxage'].mins.list)
    
    file = open("output.json", "write")
    file.write(json.dumps(data))
    file.flush()
    file.close()


def test():
    # FIXME
    return True
    test_file = open("process_cookie_data-test.txt", "read")
    for line in test_file:
        js = json.loads(line)
        process_data(js)
    write_output(data)


if __name__ == "__main__":
    # format:  serialized json per line
    import time
    then = time.time()
    for (ii,line) in enumerate(sys.stdin):
        if ii % 1000 == 0:
            now = time.time()
            print ii, now - then, then
            then = now

        person, ts, js = line.split("\t", 2)
        obj = json.loads(js)
        process_data(ii, person, obj)
    
    write_output(data)
