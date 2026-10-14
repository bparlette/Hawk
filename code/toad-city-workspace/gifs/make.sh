#!/usr/bin/env bash
# make.sh [gifId ...]: encode captured frames (frames/<gif>/<seg>/*.jpg, 15 fps) into out/ per manifest.js:
#   combined GIFs -> out/<gif>_all.{gif,mp4,webp,jpg}; "each" GIFs -> out/<gif>_<seg>.{gif,mp4,webp,jpg}
# GIF: 480 px wide, palettegen/paletteuse, 15 fps -> drops to 12 fps, then 160/128/96 colours until it is under 3.9 MB.
# MP4: H.264 yuv420p, faststart, no audio. WebP: animated loop. JPG: middle frame (poster + QA). Writes out/index.json (sizes, frames, fps).
# Then: node mkhtml.js renders the home-page Gallery section from out/index.json.
set -e
cd "$(dirname "$0")"; mkdir -p out tmp
LIMIT=$((3900 * 1024))
node -e '
const M = require("./manifest.js"); const only = process.argv.slice(1);
for (const g of M.gifs) { if (only.length && !only.includes(g.id)) continue;
  const segs = g.segments.map((s) => s.id).filter((id) => require("fs").existsSync(`frames/${g.id}/${id}/done.json`));
  if (g.mode === "combined") console.log([g.id + "_all", g.id, segs.join(",")].join(" "));
  else for (const s of segs) console.log([g.id + "_" + s, g.id, s].join(" ")); }' "$@" > tmp/jobs.txt
while read -r name gid segs; do
  list=tmp/$name.txt; : > "$list"
  for s in ${segs//,/ }; do for f in frames/$gid/$s/*.jpg; do echo "file '$PWD/$f'" >> "$list"; echo "duration 0.0666667" >> "$list"; done; done
  n=$(grep -c '^file' "$list")
  # middle frame poster
  mid=$(grep '^file' "$list" | sed -n "$(( (n + 1) / 2 ))p" | sed "s/^file '//; s/'$//")
  ffmpeg -nostdin -loglevel error -y -i "$mid" -vf scale=480:-2:flags=lanczos -q:v 4 out/$name.jpg
  # GIF list: single clips use every frame; combined tours keep the middle GIF_SEG frames of each segment (default 18 = 1.2 s)
  glist=$list; nseg=$(echo ${segs//,/ } | wc -w)
  if [ "$nseg" -gt 1 ]; then glist=tmp/$name.gif.txt; : > "$glist"; K=${GIF_SEG:-18}
    for s in ${segs//,/ }; do fs=(frames/$gid/$s/*.jpg); c=${#fs[@]}; a=$(( c > K ? (c - K) / 2 : 0 ))
      for f in "${fs[@]:$a:$K}"; do echo "file '$PWD/$f'" >> "$glist"; echo "duration 0.0666667" >> "$glist"; done; done; fi
  # quality ladder width:fps:colours, first rung that fits LIMIT wins (combined tours start lower)
  if [ "$nseg" -gt 1 ]; then LAD="400:10:128 360:10:96 360:8:96 320:8:80 320:6:64 280:6:64"; else LAD="480:15:192 480:12:128 400:12:128 400:10:96 360:10:96 320:8:64"; fi
  ok=""
  for r in $LAD; do IFS=: read -r w fps col <<< "$r"
    ffmpeg -nostdin -loglevel error -y -f concat -safe 0 -i "$glist" -vf "fps=$fps,scale=$w:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=$col:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 out/$name.gif
    sz=$(stat -c %s out/$name.gif); if [ "$sz" -le "$LIMIT" ]; then ok="${w}px/${fps}fps/${col}c"; break; fi
  done
  [ -z "$ok" ] && ok="OVER"
  # MP4 (what the page plays): full length, 480 px, 15 fps
  ffmpeg -nostdin -loglevel error -y -f concat -safe 0 -i "$list" -vf "fps=15,scale=480:-2:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 27 -movflags +faststart -an out/$name.mp4
  rm -f out/$name.webp
  echo "$name frames=$n gif=$(stat -c %s out/$name.gif) ($ok) mp4=$(stat -c %s out/$name.mp4)"
done < tmp/jobs.txt
node -e '
const fs = require("fs"), M = require("./manifest.js"); const idx = [];
for (const g of M.gifs) { const segs = g.segments.filter((s) => !s.skipGallery && fs.existsSync(`frames/${g.id}/${s.id}/done.json`));
  const items = g.mode === "combined" ? [{ name: g.id + "_all", title: g.title, sub: segs.map((s) => s.label).join(" · "), segs: segs.map((s) => s.id), recapture: [...new Set(segs.flatMap((s) => s.recapture || []))] }]
    : segs.map((s) => ({ name: g.id + "_" + s.id, title: s.label, sub: (s.labelOpt && s.labelOpt.sub) || "", segs: [s.id], recapture: s.recapture || [] }));
  for (const it of items) { const b = (e) => { try { return fs.statSync(`out/${it.name}.${e}`).size; } catch (x) { return 0; } }; if (!b("gif")) continue;
    idx.push({ group: g.group, ...it, gif: b("gif"), mp4: b("mp4"), webp: b("webp"), frames: it.segs.reduce((n, s) => n + fs.readdirSync(`frames/${g.id}/${s}`).filter((f) => f.endsWith(".jpg")).length, 0) }); } }
fs.writeFileSync("out/index.json", JSON.stringify(idx, null, 1)); console.log("index", idx.length);'
