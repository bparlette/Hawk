#!/usr/bin/env bash
# deploys dist/ to crystal-cave-25d.surge.sh (same token+login approach as ss3d-bakeoff/deploy.sh)
cd "$(dirname "$0")"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
echo crystal-cave-25d.surge.sh > dist/CNAME
$S ./dist crystal-cave-25d.surge.sh > T/deploy.log 2>&1 && echo DEPLOY_OK || { echo DEPLOY_FAIL; tail -5 T/deploy.log; }
