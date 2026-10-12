#!/usr/bin/env bash
# deploys ./site to knockout-round1.surge.sh (same token approach as ss3d-bakeoff/deploy.sh)
cd "$(dirname "$0")"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
$S ./site knockout-round1.surge.sh > deploy.log 2>&1 && echo DEPLOY_OK || { echo DEPLOY_FAIL; tail -8 deploy.log; }
