#!/usr/bin/env bash
cd /workspace/work/ss3d-bakeoff/k_toad32
PRE="__cel.hero.pos.z=36.2; __cel.partner.pos.set(-2.0,0,36.6); __cel.CAM.pivot.z=36.2;"
for sz in "1280 720 d" "390 844 m"; do set -- $sz
  for t in "0 day" "0.25 dusk" "0.5 night"; do set -- $sz $t
    node shot.js 8790 T/f_$3_$5.png $1 $2 "?nointro=1&tod=$4" 4500 "$PRE" > T/f_$3_$5.log 2>&1
  done
done
echo ALLDONE > T/shots.done
