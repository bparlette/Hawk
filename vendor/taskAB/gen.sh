#!/usr/bin/env bash
# vendor/taskAB/gen.sh: concatenates the fixed Task A/B modules into src/02b_taskab_vendor.js for the one-module game build
# (`export` stripped; every file already has its own META_* name, so nothing collides). Run by build.sh.
cd "$(dirname "$0")"
O=../../src/02b_taskab_vendor.js
{ echo "// ---------------- GENERATED from vendor/taskAB/*.js by vendor/taskAB/gen.sh: do not edit here ----------------"
  for f in rowkit_tiles rowkit_rowhouse rowkit_corner rowkit_block props_tiles props_street props_crab_shack veh_cars veh_boats veh_carts; do
    echo "// ---- vendor/taskAB/$f.js ----"; sed -E 's/^export (const|function|class) /\1 /' $f.js; echo; done; } > $O
