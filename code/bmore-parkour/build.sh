#!/usr/bin/env bash
# concatenates src/*.js (Toad City modules 01-05 copied verbatim + Rooftops modules 1x_) into site/game.js (one ES module)
cd "$(dirname "$0")" && cat src/*.js > site/game.js && cp site/game.js /tmp/_tcr_check.mjs && node --check /tmp/_tcr_check.mjs 2>&1 | head -5; echo "built $(wc -c < site/game.js) bytes"
