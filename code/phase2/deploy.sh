#!/bin/bash
# phase2 deploy: build_assets -> chk -> cp -a stage -> surge -> curl md5
set -e
D=/workspace/work/deploy/shell-shock-live-action; ST=/workspace/work/phase2/stage
python3 /workspace/work/ss_engine/build_assets.py $D | tail -2
bash /workspace/work/ss_engine/chk.sh $D/index.html | tail -1 | grep -q "CHECK OK" || { echo CHECK_FAIL; exit 1; }
grep -q '#fsbtn { display: none !important; }' $D/index.html || { echo NO_FSBTN; exit 1; }
rm -rf $ST && cp -a $D $ST && find $ST -name "*.bak" -delete
export SURGE_LOGIN=rbparle@gmail.com SURGE_TOKEN=$(cat /workspace/work/.surge_token)
(cd $ST && npx -y surge@0.24.6 . shellshock-live.surge.sh) 2>&1 | tail -3
for f in index.html sw.js assets.json levels/level15.js levels/level1.js levels/level2.js; do
  [ -f $ST/$f ] || continue
  L=$(curl -s "https://shellshock-live.surge.sh/$f?nc=$RANDOM" | md5sum | cut -c1-8); M=$(md5sum $ST/$f | cut -c1-8); echo "$f live=$L local=$M $([ $L = $M ] && echo MATCH || echo MISMATCH)"
done
