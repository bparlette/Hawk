#!/bin/bash
# bg2.sh name url secs pick browser
cd /workspace/work/freeze_test; . ./env.sh
CHROME=/home/sandbox/.cache/ms-playwright/chromium-1134/chrome-linux/chrome FAST=${FAST:-1} node soak2.js "$2" "$3" "$4" "${5:-webkit}" "res2_$1" > "res2_$1.log" 2>&1
echo "EXIT $?" >> "res2_$1.log"
