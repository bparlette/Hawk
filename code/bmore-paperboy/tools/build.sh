#!/usr/bin/env bash
# Toad City Paperboy build: re-copy the Toad City modules (read-only), concatenate into one ES module, syntax check.
set -e
cd "$(dirname "$0")/.."
python3 tools/extract.py >/dev/null
mkdir -p site
cat src/01_core.js src/02_atlas.js src/03_kit.js src/03b_hd.js src/03f_fells.js src/04_actors.js src/04b_rig_merge.js src/05_fx.js src/10_paperboy.js > site/game.js
cp src/index.html site/index.html
cp /workspace/work/toad-city/game-int/site/three.module.min.js site/three.module.min.js
cp site/game.js /tmp/_pb_check.mjs && node --check /tmp/_pb_check.mjs && echo "built $(wc -c < site/game.js) bytes"
