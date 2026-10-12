#!/usr/bin/env bash
# bundles src/ (three.js vendored from node_modules, no CDN) into dist/game.js + dist/index.html
set -e; cd "$(dirname "$0")"; mkdir -p dist
./node_modules/.bin/esbuild src/main.js --bundle --format=esm --minify --target=es2020 --outfile=dist/game.js --log-level=warning
cp index.html dist/index.html
ls -la dist
