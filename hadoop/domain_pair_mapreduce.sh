#!/bin/bash
set -e
set -o nounset
set -x

BASE=domain_pairs
OUT="/user/$(whoami)/$BASE"
echo 'hdfs outdirectory:' $OUT

hdfs dfs -rm -r "$OUT"
STREAMING=/opt/cloudera/parcels/CDH/lib/hadoop-0.20-mapreduce/contrib/streaming/*jar
HERE=`dirname ${0}`
M="${HERE}/domain_pair_mapper.py"
R="${HERE}/counter_reducer.py"
hadoop jar ${STREAMING} \
 -file "$M" \
 -mapper "$M" \
 -file "$R" \
 -reducer "$R" \
 -input /user/glind/user-actions-raw/*snappy \
 -output "$OUT" \
 -jobconf mapred.reduce.tasks=16 \

hdfs dfs -text "$OUT/part*" > $BASE
sort -r -n -k2 $BASE > $BASE.out
awk '{ sum += $2 }; END { print sum }' $BASE.out
