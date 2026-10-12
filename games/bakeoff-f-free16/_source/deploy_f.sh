#!/usr/bin/env bash
# deploys prototype F (site_f) to shellshock-free16-city.surge.sh (token file + login, same as ../deploy.sh)
cd "$(dirname "$0")"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
$S ./site_f shellshock-free16-city.surge.sh > T/deploy_f.log 2>&1 && echo "DEPLOY_OK free16" || { echo "DEPLOY_FAIL free16"; tail -5 T/deploy_f.log; }
