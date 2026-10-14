#!/usr/bin/env bash
# game-only (no cabinet) level clips + stills for the page: out_final/out/game/levelN.mp4, out_final/screens/game/levelN/*.jpg
cd "$(dirname "$0")"; export LEVEL_SRC=/workspace/work/trailer_v2/final_game/levels
python3 -u build2.py raw_final ref_final out_final game "$@" && echo GAME_OK
