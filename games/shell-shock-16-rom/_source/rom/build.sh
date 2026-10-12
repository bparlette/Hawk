#!/bin/bash
# Build the ROM: needs m68k-linux-gnu-gcc (or m68k-elf-gcc), Java 11+, and SGDK at $GDK.
set -e
cd "$(dirname "$0")"
export GDK=${GDK:-/workspace/work/g16/sgdk/SGDK}
export PATH=$PATH:${HOSTBIN:-/workspace/work/g16/sgdk/hostbin}
PREFIX=${PREFIX:-m68k-linux-gnu-}
make -f $GDK/makefile.gen PREFIX=$PREFIX EXTRA_FLAGS="-fno-store-merging" LIBGCC="$GDK/lib/libgcc.a -Wl,--build-id=none" release 2>&1 | grep -E "error|Error|warning: (implicit|unused var)" || true
ls -la out/rom.bin
