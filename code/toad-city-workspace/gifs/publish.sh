#!/usr/bin/env bash
# publish.sh [homeDir] : update the Toad City Page SOURCE and copy it into a home dir.
#  1) source = /workspace/built/sites/d5e6bf6a-8a64-43fd-8a7e-c910f3eb9873 (the Toad City Page; site/home is a copy of it minus work/)
#  2) homefix.py swaps stale "In production"/"Coming soon" labels for live links (HF_SKIP=key,key skips features not live)
#  3) gallery media (out/*.mp4|gif|jpg + Shorts from ../shorts/batch1/final, re-encoded 540x960) -> source/gallery/
#  4) mkhtml.js (re)writes the Gallery section in source/index.html
#  5) copies source (minus work/) into homeDir; default homeDir = gifs/preview/home (staging, safe).
#     deploy.sh passes game-int/site/home (under locks/integration.lock) and the stage dir.
set -e
cd "$(dirname "$0")"; G=$PWD
B=${PAGE_SRC:-/workspace/built/sites/d5e6bf6a-8a64-43fd-8a7e-c910f3eb9873}
T=${1:-$G/preview/home}
if [ -z "$NO_SRC_UPDATE" ]; then
  [ -z "$HOMEFIX" ] || python3 homefix.py "$B/index.html" ${HF_SKIP:+--skip $HF_SKIP} --report "$G/out/homefix_report.txt"
  rm -rf "$B/gallery/shorts"; [ -z "$GAL_SHORTS" ] || mkdir -p "$B/gallery/shorts"; find "$B/gallery" -maxdepth 1 -type f -delete
  node -e 'const idx = require("./out/index.json"); for (const i of idx) for (const e of ["mp4", "gif", "jpg"]) console.log(`out/${i.name}.${e}`);' > tmp_pub.txt
  while read -r f; do cp "$f" "$B/gallery/"; done < tmp_pub.txt; rm -f tmp_pub.txt
  # Shorts: one light 540x960 copy each (with sound) + poster; titles below
  SH=$G/../shorts/batch1/final; echo '[' > out/shorts.json; first=1
  # Shorts now live in the separate Clips section (shorts-batch1); keep them out of the Gallery unless GAL_SHORTS=1
  for f in "$SH"/*.mp4; do [ -n "$GAL_SHORTS" ] || break; [ -f "$f" ] || continue; n=$(basename "$f" .mp4)
    case "$n" in 01_*) t="Grandma vs the Penthouse Pigeon";; 02_*) t="The Stoop Scrubber's marble steps";; 03_*) t="The Hon Queen on Federal Hill";;
      04_*) t="Chompy and harbor fishing";; 05_*) t="Poe's stealth night: Nevermore";; *) t=$(echo "$n" | sed 's/^[0-9]*_//; s/_/ /g');; esac
    o=$B/gallery/shorts/$n.mp4
    if [ ! -s "$o" ] || [ "$f" -nt "$o" ]; then
      ffmpeg -nostdin -loglevel error -y -i "$f" -vf "scale=540:-2:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 26 -c:a aac -b:a 96k -movflags +faststart "$o"
      ffmpeg -nostdin -loglevel error -y -ss 3 -i "$f" -frames:v 1 -vf scale=540:-2 -q:v 4 "$B/gallery/shorts/$n.jpg"; fi
    [ $first = 1 ] || echo ',' >> out/shorts.json; first=0
    printf '{"name":"%s","title":"%s","bytes":%s}' "$n" "$t" "$(stat -c %s "$o")" >> out/shorts.json
  done; echo ']' >> out/shorts.json
  # Ending video (featured card): web copy out/ending/toadcity_ending.{mp4,jpg} (540x960, faststart) -> gallery/ending/
  rm -rf "$B/gallery/ending"; rm -f out/ending.json
  if [ -z "$NO_ENDING" ] && [ -s out/ending/toadcity_ending.mp4 ] && [ -s out/ending/toadcity_ending.jpg ]; then
    mkdir -p "$B/gallery/ending"; cp out/ending/toadcity_ending.mp4 out/ending/toadcity_ending.jpg "$B/gallery/ending/"
    printf '{"name":"toadcity_ending","title":"The Ending","bytes":%s,"secs":%s}\n' "$(stat -c %s out/ending/toadcity_ending.mp4)" \
      "$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/ending/toadcity_ending.mp4 | cut -d. -f1)" > out/ending.json; fi
  node mkhtml.js "$B/index.html"
fi
# copy the Page source (minus work/) into the target home dir
if [ -z "$1" ]; then rm -rf "$T"; fi
mkdir -p "$T"; rm -rf "$T/gallery"
for f in "$B"/* "$B"/.[!.]*; do [ -e "$f" ] || continue; case "$(basename "$f")" in work) continue;; esac; cp -a "$f" "$T/"; done
du -sh "$T/gallery"
