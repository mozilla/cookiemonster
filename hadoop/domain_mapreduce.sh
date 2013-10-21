#!/bin/bash
set -e
set -o nounset
set -x

BASE=domains
OUT="/user/$(whoami)/$BASE"
echo 'hdfs outdirectory:' $OUT

hdfs dfs -rm -r "$OUT" || true 
STREAMING=/opt/cloudera/parcels/CDH/lib/hadoop-0.20-mapreduce/contrib/streaming/*jar
HERE=`dirname ${0}`
M="${HERE}/domain_mapper.py"
CM_USERS="${HERE}/cm_users.py"
CM_HISTORY="${HERE}/cm_history.py"
CM_TOP_USERS="${HERE}/top_users.py"
PUBLIC_SUFFIX="${HERE}/publicsuffix.py"
PUBLIC_SUFFIX_DATA="${HERE}/publicsuffix.txt"
R="aggregate"
hadoop jar ${STREAMING} \
 -file "$M" \
 -file "$CM_USERS" \
 -file "$CM_TOP_USERS" \
 -file "$CM_HISTORY" \
 -file "$PUBLIC_SUFFIX" \
 -file "$PUBLIC_SUFFIX_DATA" \
 -mapper "$M" \
 -reducer "$R" \
 -input /user/glind/user-actions-raw/*snappy \
 -output "$OUT" \
 -jobconf mapred.reduce.tasks=16 \

hdfs dfs -text "$OUT/part*" > $BASE.tsv
./compute_times.py < domains.tsv > times.tsv
./compute_history.py < domains.tsv > cm_history.py
./proportion_rejects.py < domains.tsv > proportion_rejects.tsv
# Sort by all cookies
sort -n -r -k2 proportion_rejects.tsv | head -100 > top_100_all.tsv
# Sort by third party cookies
sort -n -r -k3 proportion_rejects.tsv | head -100 > top_100_third.tsv
grep tab_domain domains.tsv | sort -n -k2 -r > top_tab_domains.tsv
# Get top users
sort -n -k6 -r times.tsv | head -30 | cut -f1 | sort > top_users.tsv
