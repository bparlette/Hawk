#!/usr/bin/env bash
# deploys G: HD-2D CITY (same token + login as ../deploy.sh)
cd "$(dirname "$0")"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
$S ./site_hd2d shellshock-hd2d-city.surge.sh > T/deploy_hd2d.log 2>&1 && echo "DEPLOY_OK hd2d" || { echo "DEPLOY_FAIL hd2d"; tail -5 T/deploy_hd2d.log; }
