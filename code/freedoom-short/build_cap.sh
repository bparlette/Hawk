#!/bin/bash
# build native capture engine in /tmp (fast local disk)
set -e
SRC=/workspace/work/freedoom-short/doomgeneric/doomgeneric
mkdir -p /tmp/fdsrc && rsync -a --exclude 'build*' --exclude 'frenzy_cap_*' $SRC/ /tmp/fdsrc/
cd /tmp/fdsrc && make -f Makefile.frenzy -j2 "$@" > /tmp/fdbuild.log 2>&1 && echo BUILD_OK >> /tmp/fdbuild.log || echo BUILD_FAIL >> /tmp/fdbuild.log
cp /tmp/fdsrc/frenzy_cap_* /tmp/fdrun/ && cp /tmp/fdsrc/frenzy_cap_* /workspace/work/freedoom-short/run/
