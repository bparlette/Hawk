#!/bin/sh
# install_test.sh <N> <before|after> : put the level file (orig or new) into test/levels with a test-only G handle
N=$1; W=/workspace/work/props_9_13
if [ "$2" = before ]; then SRC=$W/orig/level$N.js; else SRC=$W/level$N.js; fi
sed 's|^  SS.registerLevel({|  window.__LG = () => G; window.__LG2 = (v) => (G = v);\n  SS.registerLevel({|' $SRC > $W/test/levels/level$N.js
for f in $W/level${N}_*.png $W/level${N}_*.jpg; do [ -e "$f" ] && case $f in *_rgba.png) ;; *) cp $f $W/test/levels/ ;; esac; done
grep -c "__LG" $W/test/levels/level$N.js
