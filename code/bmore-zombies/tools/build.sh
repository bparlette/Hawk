#!/usr/bin/env bash
# Toad City: Dead Streets build: re-copy the Toad City modules (read-only), concatenate into one ES module, syntax check, atomic swap into site/.
set -e
cd "$(dirname "$0")/.."
python3 tools/extract.py >/dev/null
mkdir -p site
cat src/01_core.js src/02_atlas.js src/03_kit.js src/03b_hd.js src/03f_fells.js src/04_actors.js src/04b_rig_merge.js src/05_fx.js src/10_dz_world.js src/11_dz_horde.js src/12_dz_game.js > /tmp/_dz_check.mjs
node --check /tmp/_dz_check.mjs
[ -f site/three.module.min.js ] || cp /workspace/work/toad-city/game-int/site/three.module.min.js site/three.module.min.js
cp /tmp/_dz_check.mjs site/.game.js.tmp && mv site/.game.js.tmp site/game.js
cp src/index.html site/.index.tmp && mv site/.index.tmp site/index.html
echo "built $(wc -c < site/game.js) bytes"
