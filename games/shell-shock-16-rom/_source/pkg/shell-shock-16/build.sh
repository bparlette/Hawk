#!/bin/bash
# Build shellshock16.bin. Needs: SGDK 2.11 at $GDK, an m68k gcc, Java 11+.
#  Debian/Ubuntu (incl. ARM): apt install gcc-m68k-linux-gnu openjdk-21-jre-headless
#  then rebuild SGDK's libmd.a once with the same compiler (see README) and build bintos/sjasm/xgmtool from SGDK/tools.
set -e; cd "$(dirname "$0")"
: "${GDK:?set GDK to your SGDK folder}"
PREFIX=${PREFIX:-m68k-linux-gnu-}
make -f $GDK/makefile.gen PREFIX=$PREFIX EXTRA_FLAGS="-fno-store-merging" LIBGCC="$GDK/lib/libgcc.a -Wl,--build-id=none" release
cp out/rom.bin shellshock16.bin && ls -la shellshock16.bin
