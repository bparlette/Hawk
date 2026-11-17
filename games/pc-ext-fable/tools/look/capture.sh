#!/bin/sh
# capture.sh — phone-size captures (420x860 @2x, static camera, pinned light) of the standard look-check
# spots, for THE BAR and for before/after of any look change.
#   CHROME=<chromium> sh tools/look/capture.sh <prefix> [spot ...]      (from games/<build>/)
# -> shots/<prefix>-<spot>.png. Spots: opening-golden opening-dusk pier nova downtown-golden
#    downtown-dusk causeway brickell port (default: all). Add a spot = add a line to SPOTS.
cd "$(dirname "$0")/../.." || exit 1
P="$1"; shift; [ -z "$P" ] && { sed -n 2,7p "$0"; exit 1; }
SPOTS="opening-golden 1240,1240 0.1
opening-dusk 600,1100 0.9
pier 1560,1035 0.1
nova 1035,1275 0.96
downtown-golden -3540,460 0.1
downtown-dusk -3540,460 0.9
causeway -1500,1095 0.15
brickell -3640,1990 0.15
port -2300,1150 0.15"
echo "$SPOTS" | while read n c t; do
  if [ $# -gt 0 ]; then case " $* " in *" $n "*) ;; *) continue;; esac; fi
  node tools/shot.mjs "shots/$P-$n.png" "cam=$c&t=$t" --dpr 2 --wait ${WAIT:-17000} || exit 1
done
