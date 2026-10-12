#!/usr/bin/env bash
# concatenates src/*.js into site/game.js (one ES module)
cd "$(dirname "$0")" && cat src/0*.js > site/game.js && node --check site/game.js 2>&1 | head -5; echo "built $(wc -c < site/game.js) bytes"
