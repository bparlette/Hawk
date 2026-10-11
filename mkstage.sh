#!/usr/bin/env bash
# mkstage.sh: build a deploy copy (T/stage) from the committed src/ files + the working radio (src/08_radio.js) and site/index.html,
# so uncommitted work by others in src/ is not shipped by a radio-only deploy
cd "$(dirname "$0")"; rm -rf T/stage; mkdir -p T/stage; cp site/* T/stage/ 2>/dev/null
: > T/stage/game.js
for f in $(git ls-tree --name-only HEAD src/ | grep '^src/0'); do if [ "$f" = src/08_radio.js ]; then cat src/08_radio.js; else git show HEAD:$f; fi; done >> T/stage/game.js
git show HEAD:site/viewer.js > T/stage/viewer.js; git show HEAD:site/viewer.html > T/stage/viewer.html
node --check T/stage/game.js && echo "stage game.js $(wc -c < T/stage/game.js) bytes"
