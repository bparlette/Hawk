# Shell Shock 16 (Sega Genesis / Mega Drive)

This is a real 16-bit cartridge build of Shell Shock Level 1: one wave of street punks in the burning lobby, then the Ramrod boss fight.
It's written in C with SGDK 2.11, and the result is a standard 256 KB `.bin` ROM.

- Play in a browser: https://shellshock16.surge.sh (Genesis Plus GX compiled to WebAssembly, drawn to a plain 2D canvas, with touch, keyboard, and gamepad controls; no WebGL needed)
- ROM: `shellshock16.bin`. It runs in RetroArch (Genesis Plus GX or PicoDrive), BlastEm, Kega, on a flash cart (Mega EverDrive), or on a Raspberry Pi.

## Controls (3-button pad)
D-pad moves. **B** attacks with a 3-hit combo, and the third hit knocks the enemy down. **C** jumps, and **B** in the air does a jump kick.
**A** is the spin special, which hits everything around you and costs 2 HP. **START** starts and pauses.

## What's inside
| Path | What |
|---|---|
| `src/main.c` | The whole game: player, punk AI, Ramrod AI, wave/scroll/boss flow, HUD, PSG music and SFX |
| `res/` | Genesis-legal assets (indexed PNG, 15 colours + transparent per palette, 9-bit colour) and `resources.res` |
| `tools/build_assets.py` | Regenerates `res/` from the painted Shell Shock art (the "Auto 16-bit" look) |
| `tools/sprite15.py` | Alternative 15-colour sprite process (flood-fill background, tone pass, 12 learned + 3 anchor colours) |
| `test/lr.py`, `test/bot.py` | Headless libretro frontend plus an autoplay bot that plays the ROM in Genesis Plus GX and screenshots it |
| `web/` | Web player: `web.c` (a tiny libretro frontend), `gx.js`/`gx.wasm` (built with emcc from Genesis Plus GX `platform=emscripten` plus libretro-common streams/vfs), and `index.html` |

## Hardware budget
- Palettes:
  - PAL0 holds the walls (12 colours) plus HUD black, yellow, and white.
  - PAL1 holds the floor (15 colours).
  - PAL2 is Lenny (15).
  - PAL3 is shared by the punks and Ramrod (15).
- Background: two screens (640x224), reduced to about 880 unique tiles with k-means tile clustering. It's streamed with `MAP_scrollTo`.
- Sprites:
  - Cell sizes: Lenny 80x64, punks 72x72, Ramrod 80x80, spin 128x56.
  - VRAM is streamed by the SGDK sprite engine (`SPR_initEx(480)`).
  - At most 3 punks are on screen at once, to stay under the scanline sprite limit.
- Sound: PSG only. There are two music voices (separate stage and boss loops), a tone SFX channel, and a noise SFX channel. No YM2612 or VGM yet.

## Building
1. Get SGDK 2.11 (https://github.com/Stephane-D/SGDK).
   - On Windows, use its bundled toolchain: `%GDK%\bin\make -f %GDK%\makefile.gen`.
   - On Linux or macOS, use `m68k-elf-gcc` (via Docker `ghcr.io/stephane-d/sgdk`) or Debian's `gcc-m68k-linux-gnu`.
2. With `gcc-m68k-linux-gnu`, you have to:
   - build the host tools from `SGDK/tools`: `bintos`, `sjasm` (`make` in `tools/sjasm/src`), and `xgmtool`;
   - rebuild `libmd.a` once: `make -f makelib.gen PREFIX=m68k-linux-gnu- EXTRA_FLAGS=-fno-store-merging release`;
   - link with SGDK's own `lib/libgcc.a` and `-Wl,--build-id=none`. `build.sh` does this.
3. Gotcha: always build with `-fno-store-merging`. GCC 14 otherwise merges byte stores into a 16-bit write at an odd address, which raises an ADDRESS ERROR on a real 68000.

## Testing headless
`test/lr.py` loads `genesis_plus_gx_libretro.so` via ctypes. Build it from https://github.com/libretro/Genesis-Plus-GX with `make -f Makefile.libretro`.
`python3 test/bot.py shellshock16.bin` plays through to STAGE CLEAR. The current build clears the wave and beats Ramrod in about 4,400 frames.
Note: GPGX exposes 68k RAM byte-swapped per 16-bit word.

Fan-made and non-commercial. Characters are original designs inspired by 80s/90s turtle cartoons.
