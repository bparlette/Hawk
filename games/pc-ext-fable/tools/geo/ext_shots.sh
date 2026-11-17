#!/bin/sh
# ext_shots.sh — THE BAR captures for the extension candidate, phone size (420x860 @2x), static camera.
# From games/pc-ext-fable/: CHROME=<chromium> sh tools/geo/ext_shots.sh   -> shots/ext-*.png
# The opening reference shots are this build's core, which is byte-for-byte the live game's core.
cd "$(dirname "$0")/../.." || exit 1
shot() { node tools/shot.mjs "shots/$1.png" "cam=$2&t=$3" --dpr 2 --wait 17000 || exit 1; }
shot ext-bar-opening-golden 1240,1240 0.1
shot ext-bar-opening-dusk   600,1100  0.9
shot ext-bar-downtown-golden -3540,460 0.1
shot ext-bar-downtown-dusk   -3540,460 0.9
shot ext-phase1-brickell     -3640,1990 0.15
shot ext-phase1-port         -2300,1150 0.15
shot ext-phase1-causeway     -1500,1095 0.15
shot ext-phase1-watson       -2450,560 0.15
shot ext-phase1-landfall     -3180,330 0.5
shot ext-phase1-causeway-dusk -1500,1095 0.92
