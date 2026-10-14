#!/bin/bash
# prevdeploy.sh <worktree> <domain>: copies <worktree>/site to a temp dir, strips CNAME + home/, deploys with the deploy.sh token method, verifies md5 of game.js/index.html
set -e; W=$1; DOM=$2; T=$(mktemp -d /tmp/prev_XXXX)
cp -r $W/site/. $T/; rm -rf $T/CNAME $T/home
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
$S $T $DOM > /tmp/prevdeploy_$DOM.log 2>&1 && echo DEPLOY_OK || { echo DEPLOY_FAIL; tail -5 /tmp/prevdeploy_$DOM.log; exit 1; }
ok=1; for f in index.html game.js; do l=$(md5sum < $W/site/$f | cut -c1-8); r=$(curl -s "https://$DOM/$f?nc=$RANDOM" | md5sum | cut -c1-8); echo "$f local=$l remote=$r"; [ "$l" = "$r" ] || ok=0; done
[ $ok = 1 ] && echo VERIFY_OK || echo VERIFY_FAIL; rm -rf $T
