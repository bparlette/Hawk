#!/usr/bin/env bash
# deploys ./site to https://brad-demos.surge.sh (token file + login, same as ss3d-bakeoff/i_cel/deploy.sh), then checks it with curl
cd "$(dirname "$0")"
mkdir -p T
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
echo brad-demos.surge.sh > site/CNAME
$S ./site brad-demos.surge.sh > T/deploy.log 2>&1 && echo DEPLOY_OK || { echo DEPLOY_FAIL; tail -8 T/deploy.log; exit 1; }
for f in index.html shell.js games.json demo-embed.js; do
  L=$(curl -s -m 20 "https://brad-demos.surge.sh/$f?nc=$RANDOM" | md5sum | cut -c1-8); M=$(md5sum < site/$f | cut -c1-8)
  echo "$f live=$L local=$M $([ "$L" = "$M" ] && echo MATCH || echo MISMATCH)"
done
