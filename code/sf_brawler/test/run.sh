#!/bin/bash
# usage: bash run.sh "<search>" maxFrames   (extracts engine JS, then auto-plays headless)
cd /workspace/work/sf_brawler/test
python3 - <<'PY'
import re
s=open('/workspace/work/sf_brawler/game/index.html').read()
big=max(re.findall(r'<script>(.*?)</script>',s,re.S),key=len); open('/workspace/work/sf_brawler/test/game.js','w').write(big)
PY
node --check game.js && node --check ../game/levels/level1.js || exit 1
node play.js "$1" "${2:-60000}"
