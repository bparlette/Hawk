#!/bin/sh
# fresh test copy of the built site + engine/level patches + sheets. usage: ./install_test.sh "2 3 4 ..."
B=/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf; T=/workspace/work/enemies/test
rm -rf $T; mkdir -p $T; cp -r $B/* $T/; rm -rf $T/work
python3 /workspace/work/enemies/patch_engine.py $T/index.html
for f in /workspace/work/enemies/out/enemies_*.png; do case $f in *_rgba.png) ;; *) cp $f $T/levels/;; esac; done
python3 /workspace/work/enemies/patch_levels.py $T/levels $1
