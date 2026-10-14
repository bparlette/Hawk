#!/usr/bin/env bash
R=/workspace/work/re-requiem; C=$R/tools/capture.js; U=http://127.0.0.1:8732
rm -rf $R/cap/t_wardrobe; node $C "$U/game/index.html?capture&demo=wardrobe&w=360&h=640" $R/cap/t_wardrobe 10 360 640
for n in lightning:6 door:5 caught:6 wardrobe:15 laser:16; do d=${n%%:*}; s=${n##*:}; rm -rf $R/cap/F_$d; node $C "$U/game/index.html?capture&demo=$d&w=720&h=1280" $R/cap/F_$d $s 720 1280; done
echo JOB_DONE
