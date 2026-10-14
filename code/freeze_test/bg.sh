#!/bin/bash
# bg.sh name url secs pick browser
cd /workspace/work/freeze_test; . ./env.sh
FAST=${FAST:-1} node soak.js "$2" "$3" "$4" "${5:-webkit}" "res_$1" > "res_$1.log" 2>&1
echo "EXIT $?" >> "res_$1.log"
