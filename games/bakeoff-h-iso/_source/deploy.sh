#!/usr/bin/env bash
# deploys H: Iso City (site_iso) to shellshock-iso-city.surge.sh (same token + login as ../deploy.sh)
cd "$(dirname "$0")"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
$S ./site_iso shellshock-iso-city.surge.sh > T/deploy_iso.log 2>&1 && echo "DEPLOY_OK iso" || { echo "DEPLOY_FAIL iso"; tail -5 T/deploy_iso.log; }
