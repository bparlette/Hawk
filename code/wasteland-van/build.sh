#!/usr/bin/env bash
# src/0*.js + 10_main.js -> one ES module inlined into site/index.html (imports ./three.module.min.js, r160)
cd "$(dirname "$0")"
cat src/*.js > T/game.mjs && node --check T/game.mjs 2>&1 | head -5
{ cat head.html; cat T/game.mjs; printf '\n</script>\n</body>\n</html>\n'; } > site/index.html
echo "built $(wc -c < site/index.html) bytes"
