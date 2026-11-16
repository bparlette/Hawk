#!/bin/sh
# check_all.sh — every headless rule check plus the real-touch check, one line each. Exit 1 if any fails.
# Usage (from games/palm-city/): CHROME=/path/to/chrome sh tools/check_all.sh
cd "$(dirname "$0")/.." || exit 1
fail=0
for t in "sim_run.mjs 34" skate_check.mjs feel_check.mjs destruct_check.mjs bust_check.mjs jobs_check.mjs events_check.mjs pressure_check.mjs siege_check.mjs map_check.mjs director_check.mjs turbo_check.mjs skid_check.mjs activities_check.mjs touch_check.mjs; do
  out=$(node tools/$t 2>&1); code=$?
  printf '%-22s %s\n' "$t" "$(printf '%s' "$out" | tail -1)"
  [ $code -ne 0 ] && fail=1
done
exit $fail
