#!/usr/bin/env bash
cd /workspace/work/demos
for t in 1 2 3; do
  if pgrep -f "surge.*brad-demos" >/dev/null; then echo "other deploy running, waiting"; sleep 60; continue; fi
  ./deploy.sh && break
  sleep 20
done
for f in g/knockout/game.js g/bakeoff-a-free/game.js g/bakeoff-h-iso/game.js g/rta-barrel-climb/index.html g/rta-duck-shoot/index.html g/hollow-manor/index.html g/shell-shock-live/index.html g/shell-shock-16bit/index.html; do
  L=$(curl -s -m 25 "https://brad-demos.surge.sh/$f?nc=$RANDOM$RANDOM" | md5sum | cut -c1-12); M=$(md5sum < site/$f | cut -c1-12)
  echo "$f live=$L local=$M $([ "$L" = "$M" ] && echo MATCH || echo MISMATCH)"
done
echo ALLDONE
