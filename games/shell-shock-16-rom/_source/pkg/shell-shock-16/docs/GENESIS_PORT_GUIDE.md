SHELL SHOCK: LIVE ACTION -> SEGA GENESIS / MEGA DRIVE PORT GUIDE
(Handoff for another AI. How the Level 1 sample ROM "Shell Shock 16" was made, and how to take it to the full game.)

GOAL
Build one real Genesis ROM (.bin) of the full game that runs:
- on real hardware: Genesis / Mega Drive through a flash cart (Mega EverDrive, Mega Pro and similar)
- in RetroArch: Genesis Plus GX core (main target), PicoDrive, and BlastEm for an accuracy check
The ROM is a rewrite in C. The JavaScript game is the design reference: copy its behaviour, numbers and art, not its code.

1. SOURCE OF TRUTH
- Game: shell-shock-live/game/index.html (engine, Level 1, menus, modes) plus levels/levelN.js (levels 2-15) plus the atlases and backgrounds next to them. assets.json lists every file.
- From the JS, take: frame coordinates in each atlas (x, y, w, h, anchor x), move speeds, attack ranges and damage, enemy HP, wave tables, boss state machines, level order and names, and the zone 1 -> twist -> zone 2 -> boss structure.
- The sample ROM (rom/src/main.c, about 420 lines) shows the target architecture: one punk wave, then Ramrod.

2. TOOLCHAIN (what worked)
- SGDK 2.11 (github.com/Stephane-D/SGDK). Set GDK to its folder.
- Compiler: m68k-elf-gcc. Debian's m68k-linux-gnu-gcc 14 also works, but ALWAYS pass:
  - -fno-store-merging. GCC 14 merges byte stores into unaligned word writes, which crash a real 68000 with an ADDRESS ERROR.
  - -Wl,--build-id=none. Otherwise a .note section shifts the ROM layout.
  - Rebuild libmd.a with those same flags, and link SGDK's own libgcc.a.
- Java 11+ (rescomp.jar converts PNGs into tiles, maps, palettes and sprites).
- Build:
  make -f $GDK/makefile.gen PREFIX=m68k-linux-gnu- EXTRA_FLAGS="-fno-store-merging" LIBGCC="$GDK/lib/libgcc.a -Wl,--build-id=none" release
  Output: out/rom.bin. Edit the game name in src/boot/rom_head.c. Keep the region set to all regions.

3. HARDWARE BUDGET (design to these limits from day one)
- Screen: 320x224 (H40 mode), 60 fps NTSC.
- Colour: 4 palettes x 15 colours + transparent, picked from the 9-bit master palette (each channel is one of 0, 36, 73, 109, 146, 182, 219, 255).
- VRAM: 64 KB. After the planes and sprite table, about 1,400-1,500 8x8 tiles are free. This is the hardest limit.
- Sprites: 80 on screen, 20 per scanline, 320 sprite pixels per scanline. A brawler crowd flickers past that, so cap at 4 enemies plus the player.
- RAM: 64 KB. CPU: 68000 at 7.67 MHz. Z80 for the sound driver.
- ROM: up to 4 MB with no mapper. The full game should fit if the backgrounds reuse tiles.

Palette plan used in the sample (keep it for the full game):
- PAL0 + PAL1: background (31 colours, one tileset)
- PAL2: the player character (each brother gets his own 15 colours)
- PAL3: shared by that level's enemies AND its boss (build one joint palette per level)
Text and HUD use PAL0 on the WINDOW plane.

4. ART PIPELINE: "AUTO 16-BIT" (rom/build_assets.py)
This is the automatic conversion of the painted art that the user chose. No hand redraw.
Sprites:
  a. Crop each frame out of the painted atlas using the JS frame coordinates.
  b. Lanczos downscale to on-screen Genesis size: k = 0.41 for brothers and bosses, 0.38-0.40 for foot soldiers (big guys 0.40).
  c. Alpha threshold at 110 gives hard 1-bit edges.
  d. Joint palette: pool every opaque pixel of every frame that shares a palette, then quantize (octree + k-means, no dither), snap to the 9-bit levels, and keep the 15 most-used colours.
  e. Map each pixel to its nearest palette colour. Index 0 = transparent (store it as magenta).
  f. Pack frames into a fixed-cell sheet. Cell size must be a multiple of 8 px (Lenny 80x64 = 10x8 tiles, specials 128x56, punks 72x72, Ramrod 80x80). Feet sit on the cell's bottom edge and the anchor x on the cell centre, so a flipped sprite stays in place.
  g. Save an indexed PNG with at most 16 entries.
Backgrounds:
  a. Resize to 224 px tall (Lanczos). The Level 1 lobby becomes 640x224.
  b. Quantize to 31 colours with no dither, snap to 9-bit, and split across PAL0/PAL1.
  c. Count the unique 8x8 tiles (flips count as duplicates). Keep each loaded tileset under about 1,100 tiles. Painted art is busy, so a long level must either repeat sections (tile reuse) or be split into sections that reload tiles at the twist, zone 2 and the boss arena.
Title: same process. The logo is an IMAGE at 16 colours.

resources.res (sample):
  PALETTE bg_pal "bg_lobby.png"
  TILESET bg_tiles "bg_lobby.png" BEST ALL
  MAP bg_map "bg_lobby.png" bg_tiles BEST 0
  IMAGE title_img "title.png" BEST ALL
  SPRITE spr_lenny "spr_lenny.png" 10 8 FAST 0
  SPRITE spr_ramrod "spr_ramrod.png" 10 10 FAST 0
  (the size after SPRITE is in tiles: width, then height)

5. ENGINE STRUCTURE (copy from rom/src/main.c, then generalize)
- Main loop: read JOY_1 -> update player -> update enemies -> level flow -> camera (MAP_scrollTo) -> set sprite positions and frames -> HUD -> SPR_update() -> soundTick() -> SYS_doVBlankProcess().
- Entity struct: x and y in world space (y is depth on the floor band 150-214), z for jump height, facing, hp, state, timer, anim, cell size, and a Sprite*. Enums for the states: walk, wind-up, attack, hurt, down, get-up, dead, and boss-only telegraph, charge, kick and fire states.
- Hits: same lane when |dy| <= about 14, reach measured from the facing side, i-frames after a hit, knockdown on heavy hits or the 3rd combo hit.
- Controls (match the cabinet): D-pad move, B = attack (3-hit combo), C = jump, B in the air = jump kick, A = spin special (costs HP, like the JS), START = pause.
- Sprite engine: SPR_initEx(480) (480 tiles reserved for sprite frames streamed by DMA). Use SPR_setHFlip for facing and SPR_setAnim / SPR_setFrame for animation. Sort depth by y (SPR_setDepth(-y)).
- HUD on the WINDOW plane (top 2 rows): name, a health bar from 4 custom tiles, score, lives, and a boss bar.
- Level flow: a wave table -> clear -> "GO -->" -> camera scrolls -> lock -> boss spawn -> STAGE CLEAR / GAME OVER.

Scaling to the full game: make it data-driven.
- One const LevelDef per level: background sections (tileset, map, palette), the wave tables for zone 1 and zone 2, the twist type, the boss id, its palette and its music track.
- Load and unload per section. Fade out, swap the tileset, map and palettes, then fade in. Never hold two backgrounds in VRAM at once.
- One update function per boss, ported from that boss's state machine in levelN.js: telegraph frames, attack windows, HP and phases.
- Four brothers: a select screen, one sprite sheet and palette each, and the speed / power / reach stats from the JS.
- Modes: Arcade, Speed Run (one wave, then the boss, straight on to the next level), Boss Rush (boss to boss), and Level Select.
- Save progress to cartridge SRAM (SGDK SRAM_enable / SRAM_writeByte / SRAM_readByte, with SRAM declared in rom_head.c). Most flash carts and RetroArch keep it as a .srm file.

6. SOUND
- The sample uses the PSG only (square tones + noise), driven from soundTick() for music and SFX.
- For the full game, use SGDK's XGM2 driver: FM music written in Furnace or Deflemask and exported as VGM (resources: XGM2 track "file.vgm"), plus PCM samples for hits and voices (WAV 8-bit 13-32 kHz).

7. WHAT CAN'T PORT 1:1 (and the Genesis-correct substitute)
- Alpha blending, glows, dynamic lights -> palette cycling for fire, shadow/highlight mode, or flicker.
- Canvas tint and hit flash -> swap in a white palette or a flash palette for a few frames.
- Many-layer parallax -> 2 planes (BG_A, BG_B) plus line or column scroll (VDP_setScrollingMode).
- Big screen-filling bosses -> build them from several sprites, or put part of the boss on BG_A as tiles.
- More than about 5 large fighters on one line -> cap the spawns. The JS waves must be re-tuned to 3-4 enemies at a time.

8. TESTING (do this every level)
- Headless harness (test/lr.py): Python ctypes loads genesis_plus_gx_libretro.so, feeds the ROM, steps frames, injects joypad bits, grabs frames to PNG, and reads work RAM.
  Joypad bit map: b=0, a=1 (Y), start=3, up=4, down=5, left=6, right=7, c=8 (A).
- Autoplay bot (test/bot.py): it finds the player and enemies from RAM, walks into range and attacks. It must reach STAGE CLEAR with no crash, address error or hang. Save screenshots at each phase.
- Watch for: VRAM overflow (corrupt tiles), sprite flicker, DMA overruns (slowdown), palette mistakes.
- Accuracy pass in BlastEm, then on real hardware via EverDrive before calling a level done.

9. MILESTONES
  1. Engine generalized (LevelDef, section loading, 4 brothers, select screen). Level 1 matches the JS.
  2. Art pipeline batch-converts every atlas and background in assets.json and reports tile and colour budgets per section.
  3. Levels 2-15 one at a time: zone 1, twist, zone 2, boss. Run the bot test after each.
  4. Modes, level select and SRAM save.
  5. XGM2 music and SFX.
  6. Hardware and BlastEm pass. Final ROM padded to a power-of-two size.

Reference files in the package: rom/src/main.c, rom/build_assets.py, rom/res/resources.res, rom/build.sh, test/lr.py, test/bot.py, web/ (an optional browser player: Genesis Plus GX compiled with emscripten).
