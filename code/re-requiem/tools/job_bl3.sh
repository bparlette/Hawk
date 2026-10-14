#!/usr/bin/env bash
# Wall-clip bloopers for v2/v3 (as-is builds): camera parked at an oblique angle to the x=-5.5 corridor wall,
# stalker started behind it; its chase AI ignores colliders, so it walks straight through the wall toward camera.
R=/workspace/work/re-requiem; B=$R/tools/blooper.js; U=http://127.0.0.1:8732
CAM='camHolder.position.set(1,1.7,0); state.yaw=2.12; state.pitch=0;'
E="$CAM stalker.speed=2.2; stalkerGroup.position.set(-11.3,0,6.6);"
node $B "$U/orig/v2.html" $R/cap/bl/v2c 13 540 960 "[{\"wait\":3500},{\"click\":\"#btn-play\"},{\"wait\":600},{\"eval\":\"$E\"},{\"wait\":1500},{\"eval\":\"$CAM\"}]"
node $B "$U/orig/v3.html" $R/cap/bl/v3c 14 540 960 "[{\"wait\":5000},{\"eval\":\"document.getElementById('btn-play').click()\"},{\"wait\":600},{\"eval\":\"$E\"},{\"wait\":1500},{\"eval\":\"$CAM\"}]"
echo JOB_DONE
