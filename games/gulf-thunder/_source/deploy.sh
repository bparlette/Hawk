#!/usr/bin/env bash
# deploy ./site to https://gulf-thunder.surge.sh and verify md5 of every file
cd "$(dirname "$0")"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
echo gulf-thunder.surge.sh > site/CNAME
$S ./site gulf-thunder.surge.sh > deploy.log 2>&1 && echo DEPLOY_OK || { echo DEPLOY_FAIL; tail -8 deploy.log; exit 1; }
for f in index.html js/core.js js/art.js js/scenes.js js/boat.js js/brawl.js js/kasbah.js; do
  L=$(curl -s -m 20 "https://gulf-thunder.surge.sh/$f?nc=$RANDOM" | md5sum | cut -c1-8); M=$(md5sum < site/$f | cut -c1-8)
  echo "$f live=$L local=$M $([ "$L" = "$M" ] && echo MATCH || echo MISMATCH)"
done
