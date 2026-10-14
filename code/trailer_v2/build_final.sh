#!/usr/bin/env bash
cd "$(dirname "$0")"; export LEVEL_SRC=/workspace/work/trailer_v2/final_game/levels
python3 -u build2.py raw_final ref_final out_final levels && python3 -u build2.py raw_final ref_final out_final stills && python3 -u build2.py raw_final ref_final out_final full && python3 -u build2.py raw_final ref_final out_final screen && echo BUILD_OK
