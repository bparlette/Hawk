#!/usr/bin/env bash
# qa.sh [gif ...] : contact sheet of each segment's middle frame -> qa/<gif>_sheet.jpg (4 columns, 360 px tiles)
cd "$(dirname "$0")"; mkdir -p qa tmp
for g in ${@:-landmarks bosses fighters specials features}; do
  l=tmp/qa_$g.txt; : > "$l"; n=0
  for d in frames/$g/*/; do [ -f "$d/done.json" ] || continue; fs=("$d"*.jpg); m=${fs[$(( ${#fs[@]} / 2 ))]}; echo "file '$PWD/$m'" >> "$l"; n=$((n+1)); done
  [ $n = 0 ] && continue; rows=$(( (n + 3) / 4 ))
  ffmpeg -nostdin -loglevel error -y -f concat -safe 0 -i "$l" -vf "scale=360:-2,tile=4x$rows" -frames:v 1 -q:v 4 qa/${g}_sheet.jpg && echo "qa/${g}_sheet.jpg ($n)"
done
