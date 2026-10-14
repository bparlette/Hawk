#!/bin/bash
# deploy ss3d/site to https://shellshock-3d.surge.sh and check every file with curl + md5
cd /workspace/work/ss3d
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
echo shellshock-3d.surge.sh > site/CNAME
for i in 1 2 3; do $S ./site shellshock-3d.surge.sh > T/deploy.log 2>&1 && { echo DEPLOY_OK; break; } || { echo "DEPLOY_FAIL try $i"; tail -4 T/deploy.log; sleep 20; }; done
n=0; bad=0
for f in $(cd site && find . -type f ! -name CNAME | sed 's|^\./||'); do
  L=$(curl -s -m 30 "https://shellshock-3d.surge.sh/$f?nc=$RANDOM" | md5sum | cut -c1-32); M=$(md5sum < site/$f | cut -c1-32); n=$((n+1))
  [ "$L" = "$M" ] || { bad=$((bad+1)); echo "MISMATCH $f live=$L local=$M"; }
done
echo "checked $n files, $bad mismatches"; curl -s -o /dev/null -w "HTTP %{http_code}\n" https://shellshock-3d.surge.sh/
for f in index.html game.js; do echo "$f live=$(curl -s "https://shellshock-3d.surge.sh/$f?nc=$RANDOM" | md5sum | cut -c1-12) local=$(md5sum < site/$f | cut -c1-12)"; done
echo DEPLOY_SCRIPT_DONE
