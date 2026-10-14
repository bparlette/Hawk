#!/usr/bin/env bash
# concatenates src/*.js into site/game.js (one ES module)
cd "$(dirname "$0")" && cat src/0*.js > site/game.js && cp site/game.js /tmp/_tcb_check.mjs && node --check /tmp/_tcb_check.mjs 2>&1 | head -5; cat src/01_core.js src/04_actors.js src/v_viewer.js > site/viewer.js && node --check site/viewer.js 2>&1 | head -5; echo "built $(wc -c < site/game.js) + viewer $(wc -c < site/viewer.js) bytes"
