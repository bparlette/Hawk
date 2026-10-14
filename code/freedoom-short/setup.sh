#!/bin/bash
# idempotent env setup (sandbox may reset /tmp and system packages)
W=/workspace/work/freedoom-short
if ! which gcc >/dev/null 2>&1 || ! which fluidsynth >/dev/null 2>&1; then
  sudo apt-get update -q >/dev/null 2>&1
  sudo apt-get install -y -q build-essential rsync fluidsynth fluid-soundfont-gm clang lld wasi-libc libclang-rt-19-dev-wasm32 >/tmp/apt.log 2>&1
fi
python3 -c "import numpy, PIL" 2>/dev/null || pip install -q numpy pillow >/dev/null 2>&1
mkdir -p /tmp/fdrun
[ -f /tmp/fdrun/freedoom2.wad ] || cp $W/freedoom-0.13.0/freedoom2.wad /tmp/fdrun/
cp $W/run/frenzy.cfg /tmp/fdrun/
[ -f /tmp/fdrun/frenzy_cap_540x960 ] || cp $W/run/frenzy_cap_540x960 /tmp/fdrun/ 2>/dev/null
echo SETUP_OK
