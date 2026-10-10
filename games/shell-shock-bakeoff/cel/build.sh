#!/usr/bin/env bash
# rebuilds game.js (one ES module, three r160) from src/0*.js
cd "$(dirname "$0")" && cat src/0*.js > game.js && echo "built $(wc -c < game.js) bytes"
