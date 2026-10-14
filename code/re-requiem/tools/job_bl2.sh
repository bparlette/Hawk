#!/usr/bin/env bash
R=/workspace/work/re-requiem; B=$R/tools/blooper.js; U=http://127.0.0.1:8732
E='camHolder.position.set(-1.5,1.7,4); state.yaw=Math.PI/2; stalkerGroup.position.set(-11,0,4);'
node $B "$U/orig/v2.html" $R/cap/bl/v2 15 540 960 "[{\"wait\":3500},{\"click\":\"#btn-play\"},{\"wait\":600},{\"eval\":\"$E\"},{\"wait\":3000},{\"eval\":\"$E\"}]"
node $B "$U/orig/v3.html" $R/cap/bl/v3w 15 540 960 "[{\"wait\":5000},{\"eval\":\"document.getElementById('btn-play') && document.getElementById('btn-play').click()\"},{\"wait\":600},{\"eval\":\"$E\"},{\"wait\":3000},{\"eval\":\"$E\"}]"
echo JOB_DONE
