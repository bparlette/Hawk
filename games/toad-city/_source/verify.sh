#!/usr/bin/env bash
# verify.sh: HTTP 200 + md5 of live files == local
cd "$(dirname "$0")"; ok=1
for f in index.html game.js viewer.html viewer.js three.module.min.js fmthumbs.webp; do
  code=$(curl -s -o /tmp/tcb_$f -w "%{http_code}" "https://toad-city-baltimore.surge.sh/$f?nc=$RANDOM")
  l=$(md5sum < site/$f | cut -c1-8); r=$(md5sum < /tmp/tcb_$f | cut -c1-8); echo "$f $code local=$l live=$r"; [ "$code" = 200 ] && [ "$l" = "$r" ] || ok=0
done
echo "root $(curl -s -o /dev/null -w '%{http_code}' https://toad-city-baltimore.surge.sh/)"; [ $ok = 1 ] && echo VERIFY_OK || echo VERIFY_FAIL
