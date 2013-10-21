#!/bin/bash
set -e
set -o nounset
set -x

for i in `cat top_users.tsv`:
  do
    ./user_mapreduce.sh $i
  done
