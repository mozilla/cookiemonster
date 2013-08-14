#!/bin/bash
set -e
set -o nounset

USAGE="usage: $0 outdir"
[ $# -lt 1 ] && echo "$USAGE" && exit 1

OUT=${1}
OUT="/user/$(whoami)/$OUT"
echo 'hdfs outdirectory:' $OUT

hdfs dfs -rm -r "$OUT" || true 
STREAMING=/opt/cloudera/parcels/CDH/lib/hadoop-0.20-mapreduce/contrib/streaming/*jar
HERE=`dirname ${0}`
M="${HERE}/domain_mapper.py"
R="${HERE}/counter_reducer.py"
hadoop jar ${STREAMING} \
 -file "$M" \
 -mapper "$M" \
 -file "$R" \
 -reducer "$R" \
 -input /user/glind/user-actions-raw/*snappy \
 -output "$OUT" \
 -jobconf mapred.reduce.tasks=16 \
