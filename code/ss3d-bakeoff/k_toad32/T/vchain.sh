#!/usr/bin/env bash
cd /workspace/work/ss3d-bakeoff/k_toad32
node vshot.js 8790 T/v_hd_front.png 1280 720 '?rot=0' 2000 > T/va.log 2>&1
node vshot.js 8790 T/v_hd_q.png 1280 720 '?rot=0.75' 2000 > T/vb.log 2>&1
node vshot.js 8790 T/v_32_front.png 1280 720 '?retro=1&rot=0' 2000 > T/vc.log 2>&1
node vshot.js 8790 T/v_32_q.png 1280 720 '?retro=1&rot=0.75' 2000 > T/vd.log 2>&1
node vshot.js 8790 T/v_m_night.png 390 844 '?night=1&rot=0.5&anim=swing' 2000 > T/ve.log 2>&1
echo DONE > T/vchain.done
