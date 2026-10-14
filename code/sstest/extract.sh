python3 - <<'PY'
import re
s=open('/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/index.html').read()
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
big=max(scripts,key=len); open('/workspace/work/sstest/game.js','w').write(big)
PY
node --check /workspace/work/sstest/game.js && echo CHECK_OK
