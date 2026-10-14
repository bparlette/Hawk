set -e
S=/workspace/work/reviews/hawk-ab/src; G=/workspace/work/toad-city/game/src
ORDER="rowkit_tiles rowkit_rowhouse rowkit_corner rowkit_block props_tiles props_street props_crab_shack veh_cars veh_boats veh_carts"
# 1) modules alone, export stripped, META untouched
: > mods_raw.js; for f in $ORDER; do sed -E 's/^export //' $S/$f.js >> mods_raw.js; echo >> mods_raw.js; done
echo "--- modules only, export stripped (META untouched):"; node --check mods_raw.js 2>&1 | head -4 || true
# 2) META renamed per file
: > mods_meta.js; for f in $ORDER; do sed -E 's/^export //; s/\bMETA\b/META_'$f'/g' $S/$f.js >> mods_meta.js; echo >> mods_meta.js; done
echo "--- modules only, META renamed:"; node --check mods_meta.js 2>&1 | head -4 && echo OK
# 3) appended to the real game build
cat $G/0*.js mods_meta.js > game_plus.js
echo "--- real game + modules:"; node --check game_plus.js 2>&1 | head -4 && echo OK
