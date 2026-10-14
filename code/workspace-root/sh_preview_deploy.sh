#!/usr/bin/env bash
# preview deploy of hark/boss-shellacious to toad-city-shellacious.surge.sh (never the live site)
set -e
W=/workspace/work/toad-city/game-shellacious
T=$(mktemp -d /tmp/sh_prev.XXXX)
cp -r $W/site/. $T/
rm -rf $T/CNAME $T/home
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
timeout 300 $S $T toad-city-shellacious.surge.sh > /workspace/work/sh_preview_deploy.log 2>&1 && echo DEPLOY_OK || { echo DEPLOY_FAIL; tail -5 /workspace/work/sh_preview_deploy.log; }
echo "local  $(md5sum < $W/site/game.js)"
echo "remote $(curl -s https://toad-city-shellacious.surge.sh/game.js | md5sum)"
