#!/usr/bin/env bash
# deploys the four bake-off sites (or the ones named: ./deploy.sh skyline) (token file + login, same as trailer_v2/deploy_surge.sh)
cd "$(dirname "$0")"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
for m in ${@:-free paper gta skyline}; do $S ./site_$m shellshock-$m-city.surge.sh > T/deploy_$m.log 2>&1 && echo "DEPLOY_OK $m" || { echo "DEPLOY_FAIL $m"; tail -5 T/deploy_$m.log; }; done
