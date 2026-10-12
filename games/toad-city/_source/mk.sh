#!/usr/bin/env bash
# rebuild src/03_city.js from parts/ then site/game.js
cd "$(dirname "$0")" && cat parts/a_mb.js parts/a2_chunk.js parts/b_helpers.js parts/f_layout.js parts/c_buildings.js parts/d_props.js parts/h_landmarks.js parts/g_night.js parts/e_sky.js parts/i_nightfx.js > src/03_city.js && ./build.sh
