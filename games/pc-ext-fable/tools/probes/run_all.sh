#!/bin/sh
# run_all.sh — every gameplay probe against one build. Each BUG line is a known defect (see
# games/pc-audit/AUDIT-REPORT.md); exit 1 while any remain, 0 once they are all fixed.
#   BUILD=<folder under games/> sh tools/probes/run_all.sh        (default: this folder)
cd "$(dirname "$0")" || exit 1
out=$(for p in p1_jump p2_grid p3_idle p4_craft_heli p5_drive p6_startjump; do echo "== $p"; node $p.mjs 2>&1; done)
printf '%s\n' "$out"
n=$(printf '%s\n' "$out" | grep -c '^BUG'); echo "PROBES: $n BUG line(s) on ${BUILD:-this build}"
[ "$n" -eq 0 ]
