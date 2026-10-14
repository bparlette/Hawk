#!/usr/bin/env bash
# Redeploys the portrait-fill games to their existing surge URLs and checks the changed files by md5.
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
W=/workspace/work
dep() { # dir domain files...
  local d=$1 dom=$2; shift 2
  local ok=0
  for try in 1 2 3; do
    if $S "$d" "$dom" > /workspace/work/pfill/T/dep_$dom.log 2>&1; then ok=1; break; fi
    sleep 10
  done
  [ $ok = 1 ] && echo "DEPLOY_OK $dom" || { echo "DEPLOY_FAIL $dom"; tail -4 /workspace/work/pfill/T/dep_$dom.log; return; }
  for f in "$@"; do
    L=$(curl -s -m 25 "https://$dom/$f?nc=$RANDOM$RANDOM" | md5sum | cut -c1-12); M=$(md5sum < "$d/$f" | cut -c1-12)
    echo "  $dom/$f live=$L local=$M $([ "$L" = "$M" ] && echo MATCH || echo MISMATCH)"
  done
}
dep $W/ss3d-bakeoff/site_free shellshock-free-city.surge.sh game.js
dep $W/ss3d-bakeoff/site_paper shellshock-paper-city.surge.sh game.js
dep $W/ss3d-bakeoff/site_gta shellshock-gta-city.surge.sh game.js
dep $W/ss3d-bakeoff/site_skyline shellshock-skyline-city.surge.sh game.js
dep $W/ss3d-bakeoff/e_gta32/site_gta32 shellshock-gta32-city.surge.sh game.js
dep $W/ss3d-bakeoff/f_free16/site_f shellshock-free16-city.surge.sh game.js
dep $W/ss3d-bakeoff/g_hd2d/site_hd2d shellshock-hd2d-city.surge.sh game.js
dep $W/ss3d-bakeoff/h_iso/site_iso shellshock-iso-city.surge.sh game.js
echo ALLDONE
