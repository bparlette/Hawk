python3 - <<'PY'
import re,os
site=os.environ.get('SITE','/workspace/work/ss_feat')
s=open(site+'/index.html').read()
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
big=max(scripts,key=len); open('/workspace/work/ss_feat_test/game.js','w').write(big)
PY
node --check /workspace/work/ss_feat_test/game.js && echo CHECK_OK
