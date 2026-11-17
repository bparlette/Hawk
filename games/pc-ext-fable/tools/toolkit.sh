#!/bin/sh
# toolkit.sh — one door into every Palm City tool. Run from games/pc-ext-fable/ (or any build that
# carries these tools). Browser tools need a Chromium: CHROME=/path/to/chrome (Mac: Google Chrome.app's
# binary; cloud box: /opt/pw-browsers/chromium). Full guide: TOOLKIT.md.
#
#   TEST
#     sh tools/toolkit.sh check                  all 28 rule checks (headless + real touch)      -> exit 0 = green
#     sh tools/toolkit.sh probes [build]         gameplay probes: strandings, duplicates, JUMPs  -> 0 BUG lines = green
#     sh tools/toolkit.sh perf [build ...]       scripted causeway drive: frame times + chunk LRU (vs live)
#   LOOK
#     sh tools/toolkit.sh capture <prefix> [spot ...]   phone-size captures of the standard spots -> shots/
#     sh tools/toolkit.sh sheet out.png a.png b.png ... side-by-side contact sheet (before/after, BAR)
#     sh tools/toolkit.sh palette list|show|apply <preset> [build]   ground colour presets (roads etc.)
#   BUILD NEW PARTS
#     sh tools/toolkit.sh geo [sample|phase1]    real geography -> shell.json + shell_layout.json
#     sh tools/toolkit.sh area x0 y0 x1 y1       what is in a rectangle, what sprites fit there, ASCII map
#     sh tools/toolkit.sh shots                  re-make the extension's BAR captures (shots/ext-*.png)
cd "$(dirname "$0")/.." || exit 1
cmd="$1"; [ $# -gt 0 ] && shift
case "$cmd" in
  check)   sh tools/check_all.sh ;;
  probes)  BUILD="${1:-$BUILD}" sh tools/probes/run_all.sh ;;
  perf)    node tools/geo/ext_perf.mjs "$@" ;;
  capture) sh tools/look/capture.sh "$@" ;;
  sheet)   python3 tools/look/sheet.py "$@" ;;
  palette) node tools/look/palette.mjs "$@" ;;
  geo)     python3 tools/geo/geo_to_shell.py "${1:-phase1}" ;;
  area)    python3 tools/geo/area_report.py "$@" ;;
  shots)   sh tools/geo/ext_shots.sh ;;
  *)       sed -n 2,21p "$0" ;;
esac
