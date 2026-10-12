#!/usr/bin/env bash
# deploys Toad City Baltimore to toad-city-baltimore.surge.sh (same token/login method as k_toad32/deploy.sh)
cd "$(dirname "$0")"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
$S ./site toad-city-baltimore.surge.sh > T/deploy.log 2>&1 && echo DEPLOY_OK || { echo DEPLOY_FAIL; tail -5 T/deploy.log; }
