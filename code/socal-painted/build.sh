#!/usr/bin/env bash
# concatenates src parts into build/index.html (+ three.module.min.js beside it)
set -e; cd "$(dirname "$0")"
mkdir -p build
cat src/00_head.html src/01_core.js src/02_audio.js src/03_render.js src/03b_gear.js src/04_game.js src/0[5-9]_*.js src/1*_*.js src/90_hud.js src/91_podium.js src/99_boot.js > build/index.html 2>/dev/null || true
printf '\n</script>\n</body>\n</html>\n' >> build/index.html
echo "built $(wc -c < build/index.html) bytes"
