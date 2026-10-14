#!/bin/bash
cd /workspace/work/demos
for i in 1 2 3 4 5; do
  ./build.py --resync shell-shock-3d > /workspace/work/ss3d/T/demos_build.log 2>&1 && ./deploy.sh && { echo DEMOS_OK; break; }
  echo "demos try $i failed"; tail -5 /workspace/work/ss3d/T/demos_build.log; sleep 30
done
echo "g/shell-shock-3d/game.js live=$(curl -s "https://brad-demos.surge.sh/g/shell-shock-3d/game.js?nc=$RANDOM" | md5sum | cut -c1-12) local=$(md5sum < /workspace/work/ss3d/site/game.js | cut -c1-12)"
echo DEMOS_DONE
