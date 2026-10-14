#!/bin/bash
cd /workspace/work/mashup-brawler
mkdir -p dist
{ cat <<'H'
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover">
<title>Mashup Brawler</title><meta name="robots" content="noindex,nofollow"><style>html,body{margin:0;height:100%;background:#120a24;overflow:hidden}canvas{display:block;margin:auto;touch-action:none}</style></head><body><canvas id="c"></canvas><script>
H
cat src/*.js; echo '</script></body></html>'; } > dist/index.html
node -e "new Function(require('fs').readFileSync('dist/index.html','utf8').split('<script>')[1].split('</script>')[0])" && echo built $(wc -c < dist/index.html)
