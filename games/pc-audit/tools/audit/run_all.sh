#!/bin/sh
# run_all.sh — every audit probe (AUDIT-REPORT.md). From games/pc-audit/: sh tools/audit/run_all.sh
# Reads ../palm-city/shell.json (+ shell_layout.json) the same way the game does. Exit 1 if any BUG line prints.
cd "$(dirname "$0")" || exit 1
out=$(for p in p1_jump p2_grid p3_idle p4_craft_heli p5_drive p6_startjump; do echo "== $p"; node $p.mjs 2>&1; done)
printf '%s\n' "$out"
printf '%s' "$out" | grep -q '^BUG' && exit 1 || exit 0
