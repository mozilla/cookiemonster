#!/bin/bash
set -e
set -o nounset
set -x

# A per-user mapreduce that generates whether or not a user would accept third party cookies, based on their history
CM_UID=$1
BASE=user_$CM_UID
OUT="/user/$(whoami)/$BASE"
echo 'hdfs outdirectory:' $OUT

# Dump all of the users history (TLDs) from tab-ready events
hdfs dfs -rm -r "$OUT" || true 
STREAMING=/opt/cloudera/parcels/CDH/lib/hadoop-0.20-mapreduce/contrib/streaming/*jar
HERE=`dirname ${0}`
M="${HERE}/user_mapper.py"
PUBLIC_SUFFIX="${HERE}/publicsuffix.py"
PUBLIC_SUFFIX_DATA="${HERE}/publicsuffix.txt"
R="aggregate"
hadoop jar ${STREAMING} \
 -file "$M" \
 -file "$PUBLIC_SUFFIX" \
 -file "$PUBLIC_SUFFIX_DATA" \
 -mapper "$M $CM_UID" \
 -reducer "$R" \
 -input /user/glind/user-actions-raw/*snappy \
 -output "$OUT" \
 -jobconf mapred.reduce.tasks=16 \

hdfs dfs -text "$OUT/part*" > $BASE.tsv
# Package it up into a python file
HISTORY=$BASE.history
./user_makemap.py < $BASE.tsv > $HISTORY

# Dump all of the cookies that the user would accept or reject based on history
M="${HERE}/user_cookie_mapper.py"
BASE=user_cookie_$CM_UID
OUT="/user/$(whoami)/$BASE"
hdfs dfs -rm -r "$OUT" || true 
hadoop jar ${STREAMING} \
 -file "$M" \
 -file "$HISTORY" \
 -mapper "$M $CM_UID" \
 -reducer "$R" \
 -input /user/glind/user-actions-raw/*snappy \
 -output "$OUT" \
 -jobconf mapred.reduce.tasks=16 \

hdfs dfs -text "$OUT/part*" > $BASE.tsv
