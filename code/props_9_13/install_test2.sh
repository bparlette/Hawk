#!/bin/sh
# install_test2.sh <N> <before|after>: puts the level's js + assets into test/levels as REAL files.
# (test/levels entries were symlinks into built/ -> never cp through them; rm first.)
N=$1; W=/workspace/work/props_9_13; D=/workspace/work/deploy/shell-shock-live-action/levels; T=$W/test/levels
for f in $T/level${N}.js $T/level${N}_*; do [ -e "$f" ] || [ -L "$f" ] && rm -f "$f"; done
for f in $D/level${N}_*; do cp $f $T/; done
if [ "$2" = before ]; then SRC=$W/orig/level$N.js; else SRC=$W/level$N.js;
  for f in $W/level${N}_*.png $W/level${N}_*.jpg; do [ -e "$f" ] && case $f in *_rgba.png) ;; *) cp $f $T/ ;; esac; done; fi
sed 's|^  SS.registerLevel({|  window.__LG = () => G; window.__LG2 = (v) => (G = v);\n  SS.registerLevel({|' $SRC > $T/level$N.js
grep -c "__LG" $T/level$N.js
