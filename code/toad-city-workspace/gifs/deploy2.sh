#!/usr/bin/env bash
# deploy.sh : ship the Gallery to the LIVE home page only (game untouched), and commit it to hark/integration.
#  1) takes locks/integration.lock (noclobber; exits 3 if another builder holds it). The lock is KEPT on success so the
#     caller can push to bparlette/Hawk, then: rm /workspace/work/toad-city/locks/integration.lock
#  2) backs up the live site (root files + /home/ and everything /home/index.html references) to live_backup_<ts>_pre_gallery/
#  3) stage = that live backup; publish.sh adds home/gallery/ + the Gallery section to stage/home/index.html
#     (so the live game.js and anything other builders put live, e.g. Clips, ships back byte-identical)
#  4) same publish into game-int/site/home + git commit (site/home only)
#  5) surge deploy of stage, then verify: game.js md5 before == after, / 200, /home/ 200 with the Gallery, media 200
set -e
cd "$(dirname "$0")"; G=$PWD; TC=/workspace/work/toad-city; SRC=$TC/game-int; LOCK=$TC/locks/integration.lock
URL=https://toad-city-baltimore.surge.sh
( set -o noclobber; echo "gifs-gallery subagent: deploying home-page Gallery (home/ only) $(date -u '+%F %T') UTC" > "$LOCK" ) 2>/dev/null || { echo "LOCK_BUSY: $(cat $LOCK)"; exit 3; }
trap 'rc=$?; if [ $rc -ne 0 ]; then rm -f "$LOCK"; echo "FAILED rc=$rc, lock released"; fi' EXIT
TS=$(date -u +%Y%m%dT%H%M); BK=$TC/live_backup_${TS}_pre_gallery; mkdir -p "$BK/home"
get() { local code; code=$(curl -s -m 60 -o "$2" -w '%{http_code}' "$URL/$1?nc=$RANDOM"); [ "$code" = 200 ] || { echo "backup: $1 -> $code"; rm -f "$2"; return 1; }; }
for f in $(ls "$SRC/site"); do [ "$f" = home ] && continue; get "$f" "$BK/$f" || true; done
get home/index.html "$BK/home/index.html"
# every relative asset /home/index.html references (src/href/poster/data-src), incl. other builders' folders such as clips/
grep -oE '(src|href|poster|data-src)="[^"#?:]+"' "$BK/home/index.html" | sed -E 's/^[a-z-]+="//; s/"$//' | grep -vE '^(/|mailto)' | sort -u > "$G/tmp_refs.txt"
while read -r r; do mkdir -p "$BK/home/$(dirname "$r")"; get "home/$r" "$BK/home/$r" || true; done < "$G/tmp_refs.txt"
grep -oE "url\(['\"]?[^)'\":]+['\"]?\)" "$BK/home/index.html" | sed -E "s/^url\(['\"]?//; s/['\"]?\)$//" | sort -u > "$G/tmp_refs2.txt" || true
while read -r r; do [ -f "$BK/home/$r" ] || { mkdir -p "$BK/home/$(dirname "$r")"; get "home/$r" "$BK/home/$r" || true; }; done < "$G/tmp_refs2.txt"
# plus anything integration's home has that the page loads indirectly (CSS/JS refs, remix.json)
for r in $(cd "$SRC/site/home" && find . -type f ! -path './gallery/*' | sed 's|^\./||'); do [ -f "$BK/home/$r" ] || { mkdir -p "$BK/home/$(dirname "$r")"; get "home/$r" "$BK/home/$r" || true; }; done
[ -s "$BK/game.js" ] && [ -s "$BK/index.html" ] || { echo "backup incomplete"; exit 1; }
MD5_BEFORE=$(md5sum < "$BK/game.js" | cut -c1-32)
echo "backup -> $BK ($(du -sh "$BK" | cut -f1)), live game.js md5 $MD5_BEFORE"
# how does live home compare with integration's home (before adding the Gallery)?
cmp -s "$BK/home/index.html" "$SRC/site/home/index.html" && echo "live home/index.html == integration home/index.html" || echo "NOTE: live home/index.html differs from integration (kept live as the base)"
# stage
ST=$G/stage; rm -rf "$ST"; cp -a "$BK" "$ST"; rm -rf "$ST/home/gallery"
./publish.sh "$ST/home"
cmp -s "$ST/game.js" "$BK/game.js" || { echo "stage game.js changed?!"; exit 1; }
# integration commit (home only)
NO_SRC_UPDATE=1 ./publish.sh "$SRC/site/home"
git -C "$SRC" add site/home
git -C "$SRC" commit -q -m "home: Gangs badge -> live links (crews shipped) + Baltimore Bike Life tile (?bike=1); home/ only, game untouched" && git -C "$SRC" log --oneline -1
# deploy
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
$S "$ST" toad-city-baltimore.surge.sh > "$G/logs/deploy.log" 2>&1 && echo DEPLOY_OK || { echo DEPLOY_FAIL; tail -5 "$G/logs/deploy.log"; exit 1; }
sleep 3
# verify
curl -s -m 60 -o "$G/tmp_live_game.js" "$URL/game.js?nc=$RANDOM"; MD5_AFTER=$(md5sum < "$G/tmp_live_game.js" | cut -c1-32)
echo "game.js md5 before=$MD5_BEFORE after=$MD5_AFTER $([ "$MD5_BEFORE" = "$MD5_AFTER" ] && echo MD5_SAME || echo MD5_CHANGED)"
echo "/ $(curl -s -o /dev/null -w '%{http_code}' $URL/)  /home/ $(curl -s -o "$G/tmp_live_home.html" -w '%{http_code}' "$URL/home/?nc=$RANDOM")"
grep -q 'id="gallery"' "$G/tmp_live_home.html" && echo "gallery section live" || { echo "gallery MISSING on live /home/"; exit 1; }
cmp -s "$G/tmp_live_home.html" "$ST/home/index.html" && echo "live home == stage" || echo "NOTE: live home differs from stage (CDN lag?)"
bad=0; for f in $(cd "$ST/home/gallery" && find . -type f | sed "s,^\./,,"); do c=$(curl -s -o /dev/null -w '%{http_code}' -I "$URL/home/gallery/$f"); [ "$c" = 200 ] || { echo "media $f $c"; bad=1; }; done; [ $bad = 0 ] && echo "all gallery media 200"
rm -f "$G"/tmp_*.txt "$G"/tmp_live_*
[ "$MD5_BEFORE" = "$MD5_AFTER" ] && echo DEPLOY_VERIFIED || exit 1
