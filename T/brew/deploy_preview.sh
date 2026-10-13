#!/usr/bin/env bash
# preview deploy ONLY: a temp copy of site/ without CNAME and home/ -> toad-city-brewmaster.surge.sh (token method from deploy.sh). Never the live site.
cd "$(dirname "$0")/../.." || exit 1
D=$(mktemp -d /tmp/bwprev.XXXX); cp -r site/. "$D"/; rm -rf "$D/CNAME" "$D/home"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
$S "$D" toad-city-brewmaster.surge.sh > T/brew/deploy.log 2>&1 && echo DEPLOY_OK || { echo DEPLOY_FAIL; tail -5 T/brew/deploy.log; }
rm -rf "$D"
