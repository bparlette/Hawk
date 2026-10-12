#!/usr/bin/env bash
# builds site/index.html (single static file) from src/*.js
cd "$(dirname "$0")"; mkdir -p site
python3 - <<'PY'
import glob
js='\n'.join(open(f).read() for f in sorted(glob.glob('src/*.js')))
js='(() => {\n'+js+'\n})();'
open('site/game.js','w').write(js)
t=open('src/index.tpl.html').read().replace('<script>\n/*GAME*/\n</script>','<script src="game.js"></script>')
open('site/index.html','w').write(t)
PY
node --check site/game.js && echo BUILD_OK
