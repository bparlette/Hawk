cd /workspace/work/mashup-brawler
{ echo '<!doctype html><html><head><meta charset=utf-8></head><body style="margin:0"><canvas id="c"></canvas><script>'; cat src/01_core.js src/02_rig.js src/03_chars.js test/$1.js; echo '</script></body></html>'; } > test/$1.html
