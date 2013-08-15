#!/usr/bin/python

# Processing the entire cookiemonster study dataset with Hadoop and python...
# The first job that was run to reduce the micropilot data down to just our cookie data was:
# bash -x /home/glind/secrettestpilotweb/hadoop_processing/more/search-user-action2.sh "-1.msg=~cookiemonster" cookiemonsterdata
# Which created a cookiemonsterdata Hadoop dataset, use: hdfs dfs -ls /user/ddahl/cookiemonsterdata
#     ... in order to view the .snappy files list 

# In order to stream this reduced dataset (it is now only 4.4 GB of JSON:)) use this command:
# A=cookiemonsterdata; hdfs dfs -text "$A"/*snappy

# In order to run the now modified analysis scripts you do this (which cuts out only the JSON strings, 1 per line):
# A=cookiemonsterdata; hdfs dfs -text "$A"/*snappy | cut -f3- | process_cookie_data.py > cookie_data.json

# TODO: some glue code for the result data to generate the histograms with numpy
# TODO: need number of total user sessions, another hadoop job should be run for this number
# TODO: need unique user count and corresponding prefs dump
# How do 3rd party cookie counts differ between users with restricted cookie prefs vs. default prefs?

import sys
try:
    import simplejson as json
except:
    import json

data = {
    "set_cookie_count": set(),
    "maxage": set(),
    "domain_map": {},
    "domains": set(),
    "domain_map_i": 0,
    "dp_map": {},
    "pairs": set(),
    "pair_counts": {},
    "domain_pair_map_i": 0,
    "domain_widget_map": {},
    "domain_widgets": set(),
    "widgets": set(),
    "share_widget_map": {},
    "share_domain_widgets": set(),
    "share_widgets": set()
}

def set_cookie_count(js):
    try:
        if js["eventType"] == "set-cookie":
            data["set_cookie_count"].add(int(js["count"]))
    except KeyError, e:
        sys.stderr.write("KeyError in line: %s" % json.dumps(js))
    
    # Process additional data that relates to set-cookie:
    expiry_data(js)
    domain_map(js)
    domain_pair_map(js)


def process_data(js):
    """Process each kind of data encountered"""
    data = js["data"]

    def not_found(data):
        sys.stderr.write("%s action not found." % data["eventType"])

    def switch(data):
        return {
            'set-cookie': set_cookie_count,
            'SHARE_URL_LOADED': share_widgets,
            'SOCIAL_WIDGET_LOADED': social_widgets,
            }.get(data["eventType"], not_found)

    func = switch(data)
    func(data)


def write_output(data):
    file = open("output.json", "write")
    final = data
    final["set_cookie_count"] = convert_set(data["set_cookie_count"])
    final["maxage"] = convert_set(data["maxage"])
    final["domains"] = None # do not need this data for now
    final["pairs"] = None # do not need this data for now
    final["domain_widgets"] = convert_set(data["domain_widgets"])
    final["widgets"] = convert_set(data["widgets"])
    final["share_domain_widgets"] = convert_set(data["share_domain_widgets"])
    final["share_widgets"] = convert_set(data["share_widgets"])

    file.write(json.dumps(final))
    file.flush()
    file.close()


def expiry_data(js):
    try:
        if js["maxage"]:
            data["maxage"].add(int(js["maxage"]))
    except:
        pass


def domain_pair_map(js):
    i = data["domain_pair_map_i"]
    try:
        pair = ":".join([js["domain"], js["referrer"],])
        if pair not in data["pairs"]:
            data["pairs"].add(pair)
            data["dp_map"][i] = pair
            data["pair_counts"][pair] = 1 
            i += 1
        else:
            data["pair_counts"][pair] = data["pair_counts"][pair] + 1
    except Exception, e:
        sys.stderr.write(str(e))


def domain_map(js):
    """Map out the domains so we can reference them by number"""
    i = data["domain_map_i"]
    try:
        if js["domain"] not in data["domains"]:
            data["domain_map"][i] = js["domain"]
            data["domains"].add(js["domain"])
            i += 1
    except Exception, e:
        sys.stderr.write(str(e))


def social_widgets(js):
    """Make SOCIAL_WIDGET data pie-chartable"""
    widgets = data["widgets"]
    domain_widgets = data["domain_widgets"]
    domain_widget_map = data["domain_widget_map"]
    try:
        if js["widget"] not in widgets:
            wid = {"widget": js["widget"], "value": 1}
            domain_widgets.add(wid)
            w = js["widget"]
            domain_widget_map[w] = 1 
            widgets.add(w)
        else:
            w = js["widget"]
            for widge in domain_widgets:
                if widge["widget"] == w:
                    widge["value"] = widge["value"] + 1

    except Exception, e:
        sys.stderr.write(str(e))


def share_widgets(js):
    """Make SHARE_WIDGET data pie-chartable"""
    share_widget_map = data["share_widget_map"]
    share_domain_widgets = data["share_domain_widgets"]
    share_widgets = data["share_widgets"]
    try:
        if js["eventType"] == "SHARE_URL_LOADED":
            if js["shareURL"] not in share_widgets:
                wid = {"shareURL": js["shareURL"], "value": 1}
                share_domain_widgets.add(wid)
                w = js["shareURL"]
                share_widget_map[w] = 1 
                share_widgets.add(w)
            else:
                w = js["shareURL"]
                for widge in share_domain_widgets:
                    if widge["shareURL"] == w:
                        widge["value"] = widge["value"] + 1

    except Exception, e:
        sys.stdout.write(str(e))


def generate_web_output_js():
    """Generate histogram data and CMData global dataset for the web report"""
    try:
        import numpy
        # set-cookie histogram
        # maxage historgram
        
    except:
        sys.stderr.write("Cannot import numpy, quitting.")


def convert_set(s):
    l = []
    for k in s:
        l.append(k)
    return l


def test():
    """A very small dataset is provided in process_cookie_data-test.txt in order to test each function in this module"""
    test_file = open("process_cookie_data-test.txt", "read")
    for line in test_file:
        js = json.loads(line)
        process_data(js)
    write_output(data)
    # TODO: read output, check it for correct data


if __name__ == "__main__":
    for line in sys.stdin:
        js = json.loads(line)
        process_data(js)
    
    write_output(data)
