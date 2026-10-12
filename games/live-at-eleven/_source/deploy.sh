#!/usr/bin/env bash
# deploys Live at Eleven to shellshock-live-at-eleven.surge.sh (same token/login as the bake-off deploys)
cd "$(dirname "$0")"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
$S ./site shellshock-live-at-eleven.surge.sh > T/deploy.log 2>&1 && echo DEPLOY_OK || { echo DEPLOY_FAIL; tail -5 T/deploy.log; }
