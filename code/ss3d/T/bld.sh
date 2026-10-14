#!/bin/bash
cd /workspace/work/ss3d
python3 build.py && cp site/game.js /tmp/g.mjs && node --check /tmp/g.mjs && echo SYNTAX_OK
echo BUILD_DONE
