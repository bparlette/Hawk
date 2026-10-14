#!/usr/bin/env bash
# concatenates src/*.js into site/game.js (one ES module); PROBE=1 adds the course-design probe
cd "$(dirname "$0")/.." && F=$(ls src/0*.js src/1*.js 2>/dev/null | sort); [ -n "$PROBE" ] && F="$F src/99_probe.js"; cat $F > site/game.js && cp site/game.js /tmp/_drone_check.mjs && node --check /tmp/_drone_check.mjs 2>&1 | head -5; echo "built $(wc -c < site/game.js) bytes"
