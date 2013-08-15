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
R="aggregate"
hadoop jar ${STREAMING} \
 -file "$M" \
 -mapper "$M" \
 -reducer "$R" \
 -input /user/glind/user-actions-raw/*snappy \
 -output "$OUT" \
 -jobconf mapred.reduce.tasks=16 \

hdfs dfs -text "$OUT/part*" > $BASE.tsv
