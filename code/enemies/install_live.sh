#!/bin/sh
# install_live.sh "<levels>" : patch the REAL built + deploy copies in place (re-reads each file right before editing). No deploy.
set -e
for D in /workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf /workspace/work/deploy/shell-shock-live-action; do
  tag=$(echo $D | md5sum | cut -c1-6); mkdir -p /workspace/work/enemies/orig/$tag
  [ -f /workspace/work/enemies/orig/$tag/index.html ] || cp $D/index.html /workspace/work/enemies/orig/$tag/index.html
  for n in $1; do [ -f /workspace/work/enemies/orig/$tag/level$n.js ] || cp $D/levels/level$n.js /workspace/work/enemies/orig/$tag/; done
  python3 /workspace/work/enemies/patch_engine.py $D/index.html
  for f in /workspace/work/enemies/out/enemies_*.png; do case $f in *_rgba.png) ;; *) cp $f $D/levels/;; esac; done
  python3 /workspace/work/enemies/patch_levels.py $D/levels $1
  python3 /workspace/work/enemies/patch_gallery.py $D/index.html
done
