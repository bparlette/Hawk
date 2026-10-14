#!/usr/bin/env bash
R=/workspace/work/re-requiem; C=$R/tools/capture.js; B=$R/tools/blooper.js; U=http://127.0.0.1:8732
for n in wardrobe:14 laser:12; do d=${n%%:*}; s=${n##*:}; rm -rf $R/cap/t_$d; node $C "$U/game/index.html?capture&demo=$d&w=360&h=640" $R/cap/t_$d $s 360 640; done
node $B "$U/orig/v1.html" $R/cap/bl/v1 14 540 960 '[{"wait":5000},{"click":"#btnStartGame"},{"wait":400},{"eval":"stalker.group.position.set(player.position.x+1, 0, player.position.z-7)"},{"key":"KeyW","hold":2500},{"key":"KeyA","hold":1200},{"key":"KeyW","hold":2500}]'
node $B "$U/orig/v2.html" $R/cap/bl/v2 15 540 960 '[{"wait":3500},{"click":"#btn-viral"}]'
node $B "$U/orig/v3.html" $R/cap/bl/v3 16 540 960 '[{"wait":5000},{"eval":"document.getElementById(\"btn-viral\").click()"}]'
echo JOB_DONE
