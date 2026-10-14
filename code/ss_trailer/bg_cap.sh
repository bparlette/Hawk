#!/usr/bin/env bash
cd /workspace/work/ss_trailer
./snapshot.sh /workspace/work/deploy/shell-shock-live-action
running=0
for n in 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  ./run_captures.sh "$n" &
  running=$((running+1)); if [ $running -ge 2 ]; then wait -n; running=$((running-1)); fi
done
wait; echo ALLDONE
