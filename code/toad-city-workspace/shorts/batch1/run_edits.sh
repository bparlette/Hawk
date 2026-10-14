#!/bin/bash
cd /workspace/work/toad-city/shorts/batch1
for n in "$@"; do echo "== $n $(date +%T)"; python3 edit.py specs/$n.json; done
echo ALLDONE $(date +%T)
