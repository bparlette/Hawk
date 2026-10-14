#!/usr/bin/env bash
cd "$(dirname "$0")"; LEVEL_SRC=$PWD/final_game/levels python3 make_page2.py out_final site_final && echo PAGE_OK
