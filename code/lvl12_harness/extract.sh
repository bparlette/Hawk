python3 - <<'PY'
import re
s=open('/workspace/work/lvl12_test/index.html').read()
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
big=max(scripts,key=len); open('/workspace/work/lvl12_harness/game.js','w').write(big)
PY
node --check /workspace/work/lvl12_harness/game.js && echo CHECK_OK
