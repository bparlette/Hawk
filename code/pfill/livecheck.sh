#!/usr/bin/env bash
# livecheck.sh <file-relative> <localdir> <domain> : md5 of live vs local
f=$1; d=$2; dom=$3
L=$(curl -s -m 25 "https://$dom/$f?nc=$RANDOM$RANDOM" | md5sum | cut -c1-12); M=$(md5sum < "$d/$f" | cut -c1-12)
echo "$dom/$f live=$L local=$M $([ "$L" = "$M" ] && echo MATCH || echo MISMATCH)"
