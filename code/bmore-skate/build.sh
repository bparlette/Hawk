#!/usr/bin/env bash
# Toad City Skate build: Toad City Baltimore modules (tc/, copied verbatim from toad-city game-int e1aaac3; one RES line added in 03_city.js)
# + the skate game (src/) -> one ES module inlined into dist/index.html, three.module.min.js beside it.
cd "$(dirname "$0")"
TC="tc/01_core.js tc/02_atlas.js tc/03_city.js tc/03b_landmarks_hd.js tc/03c_landmarks_hd_b2.js tc/03d_lexington.js tc/03e_stadiums_hd.js tc/03f_landmarks_hd_b3.js tc/04_actors.js tc/04c_rigs.js tc/05_fx.js"
mkdir -p dist
cat $TC src/*.js > build_game.js || exit 1
cp build_game.js /tmp/_tcs_check.mjs && node --check /tmp/_tcs_check.mjs || exit 1
python3 - <<'PY'
s = open('index.tpl.html').read(); g = open('build_game.js').read()
assert '</script' not in g
open('dist/index.html', 'w').write(s.replace('/*GAME*/', g))
PY
cp three.module.min.js dist/
echo "built dist/index.html $(wc -c < dist/index.html) bytes"
