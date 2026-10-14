#!/bin/bash
cd /workspace/work/freeze_test
chk() { python3 - "$1" <<'PY'
import re,sys,subprocess
s=open(sys.argv[1]).read(); ok=True
for i,b in enumerate(re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>',s,re.S)):
    open('/tmp/chk_d.js','w').write(b); r=subprocess.run(['node','--check','/tmp/chk_d.js'],capture_output=True,text=True)
    if r.returncode: ok=False; print('FAIL',sys.argv[1],i,r.stderr[:300])
print('check',sys.argv[1],'OK' if ok else 'FAIL'); sys.exit(0 if ok else 1)
PY
}
export SURGE_LOGIN=rbparle@gmail.com SURGE_TOKEN=$(cat /workspace/work/.surge_token)
# --- SF: full staging copy (stages 2-3 are LIVE; include all levels)
SF=/workspace/work/sf_brawler/game
rm -rf sf_stage && mkdir sf_stage && cp -a $SF/. sf_stage/ && find sf_stage -name "*.bak" -delete
chk $SF/index.html && node --check $SF/levels/level1.js && grep -q "FREEZE FIX: every one-shot source" $SF/index.html || { echo SF_CHECK_FAIL; exit 1; }
echo "SF staged md5 $(md5sum sf_stage/index.html | cut -c1-32)"
(cd sf_stage && npx -y surge@0.24.6 . sf-worldbrawl.surge.sh) 2>&1 | tail -5
# --- SS
SS=/workspace/work/deploy/shell-shock-live-action
chk $SS/index.html || { echo SS_CHECK_FAIL; exit 1; }
for f in $SS/levels/*.js; do node --check $f || { echo "SS_LEVEL_FAIL $f"; exit 1; }; done; echo "SS levels ok"
grep -q "FREEZE FIX: every one-shot source" $SS/index.html || { echo SS_NOFIX; exit 1; }
echo "SS md5 $(md5sum $SS/index.html | cut -c1-32)"
(cd $SS && npx -y surge@0.24.6 . shellshock-live.surge.sh) 2>&1 | tail -5
echo DEPLOY_DONE
