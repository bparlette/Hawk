#!/usr/bin/env bash
# recapture.sh [names...]  : one command to refresh Gallery GIFs after later merges.
#   names = merge tags used in manifest.js `recapture` (stadiums, landmarks, rigs, finale, "gang wiring" as gang_wiring),
#           or a gif id (landmarks, bosses, fighters, specials, features), or gif:seg (e.g. bosses:bobby).
#   no names = everything.
# Steps: 1) refresh snap/ from the current integration worktree build (game-int/site, minus home/), record its commit in snap.rev
#        2) start the local server OUTSIDE the chrome lock
#        3) capture the matching segments with --force, in chunks of <=6 segments, each chunk in its own chrome.flock hold
#        4) make.sh re-encodes the affected GIFs (+ MP4/WebP/poster) and rewrites out/index.json
#        5) publish.sh copies out/ into game-int/site/home/gallery/ and regenerates the Gallery section (no deploy, no commit)
# Resumable: a segment whose done.json was already captured from the same snap.rev is skipped, so if a run dies just
# run the same command again (with SKIP_SNAP=1 to keep the same build). FORCE=1 redoes every matching segment anyway.
# Env: SKIP_SNAP=1 keeps snap/ as is; FORCE=1; PORT (default 8791); SRC (default ../game-int).
set -e
cd "$(dirname "$0")"; G=$PWD
. /workspace/work/hubtest/env.sh 2>/dev/null || true
PORT=${PORT:-8791}; SRC=${SRC:-$G/../game-int}
if [ -z "$SKIP_SNAP" ]; then
  find snap -mindepth 1 -maxdepth 1 ! -name home -exec rm -rf {} +
  for f in "$SRC"/site/*; do [ "$(basename "$f")" = home ] || cp -a "$f" snap/; done
  git -C "$SRC" rev-parse --short HEAD > snap.rev
  echo "snap <- $(cat snap.rev) game.js $(md5sum snap/game.js | cut -c1-8)"
fi
# pick segments
node -e '
const M = require("./manifest.js"); const want = process.argv.slice(1).map((w) => w.replace("gang_wiring", "gang wiring"));
const out = {};
for (const g of M.gifs) for (const s of g.segments) {
  const hit = !want.length || want.some((w) => w === g.id || w === g.id + ":" + s.id || (s.recapture || []).includes(w));
  if (hit) (out[g.id] = out[g.id] || []).push(s.id); }
for (const [g, segs] of Object.entries(out)) for (let i = 0; i < segs.length; i += 6) console.log(g + " " + segs.slice(i, i + 6).join(","));
' "$@" > tmp_recap.txt
cat tmp_recap.txt
# server outside the lock
curl -s -o /dev/null -m 5 http://127.0.0.1:$PORT/ || { (cd snap && setsid nohup python3 -m http.server $PORT --bind 127.0.0.1 > /dev/null 2>&1 < /dev/null &); sleep 1.5; }
gifs=""
while read -r gid segs; do
  echo "== $gid $segs $(date +%T)"
  flock /workspace/work/toad-city/locks/chrome.flock node capture.js $PORT $gid --seg=$segs ${FORCE:+--force} --stale
  case " $gifs " in *" $gid "*) ;; *) gifs="$gifs $gid";; esac
done < tmp_recap.txt
rm -f tmp_recap.txt
[ -n "$gifs" ] && ./make.sh $gifs
./publish.sh
echo RECAPTURE_DONE $(date +%T)
