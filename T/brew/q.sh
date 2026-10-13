#!/bin/bash
# T/brew/q.sh: the full Brewmaster test queue, one run at a time on the shared chrome lock; each writes T/brew/<name>.log (+ .ok when it passes)
cd "$(dirname "$0")/../.." && . ./env.sh
run() { name=$1; shift; rm -f T/brew/$name.ok; flock /workspace/work/toad-city/locks/chrome.flock timeout 1200 node T/brew/"$@" > T/brew/$name.log 2>&1; if grep -q "ERRORS 0" T/brew/$name.log; then touch T/brew/$name.ok; fi; }
for job in "$@"; do case $job in
  w390) run w390 run.js 8841 win 390 844 T/brew/w390.png 2 "s:chase,p:3,s:haymaker,rep:,s:flee,s:spin,s:spinTell" ;;
  w1280) run w1280 run.js 8841 win 1280 720 T/brew/w1280.png 2 "s:towerTell,s:chase,p:3,rep:,over:" ;;
  l390) run l390 run.js 8841 lose 390 844 - 3 ;;
  l1280) run l1280 run.js 8841 lose 1280 720 - 3 0 "" 30 ;;
  m390) run m390 run.js 8841 mash 390 844 - 3 ;;
  part1|part2|part3) run $job run.js 8841 win 390 844 T/brew/$job.png 3 8 ${job#part} ;;
  e390) run e390 entry.js 8841 390 844 bw ;;
  e390base) run e390base entry.js 8843 390 844 base ;;
esac; done
touch T/brew/q.done
