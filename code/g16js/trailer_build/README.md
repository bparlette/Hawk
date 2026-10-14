# SHELL SHOCK 16-BIT trailer / home page (shellshock16bit-trailer.surge.sh)

Deploy folder: `/workspace/work/g16js/trailer/` (copy of the Live page `/workspace/work/trailer_v2/site_final/`, taken Oct 9 ~11:45 ET,
before the Live sprite sections were added; `index.html.bak*` not copied; CNAME = shellshock16bit-trailer.surge.sh).

## Videos (identical edit, 16-bit look)
`render16.py game N | screen | full` re-runs the trailer_v2 editor (`build2.py`, same `raw_final` captures, same timeline code)
with monkeypatches, so the cut is frame-identical (every `*_inputs.json` matches the Live originals byte for byte):
- every raw game frame -> `conv16.conv` (Lanczos to 384 px across the game canvas, octree 31 colours, 9-bit snap, nearest back up)
- screen/game modes: each finished frame (cards + overlays included) goes through `conv16.conv` again; letterbox bands forced to pure black
- cabinet cut (`full_trailer.mp4`): cabinet art untouched, only the game inside it is 16-bit
- slam cards: SHELL SHOCK LIVE -> SHELL SHOCK 16-BIT, URL -> shellshock16bit.surge.sh
- audio copied from the Live file (`orig/v/`), H.264 yuv420p at the original bitrate, +faststart; webm = VP9 from the 16-bit mp4 + original opus
Why re-render instead of converting the finished Live MP4s: those have SHELL SHOCK LIVE / shellshock-live.surge.sh baked into every
title/end card, and the cabinet cut has the cabinet baked in (converting it would have quantized the cabinet art).
`conv16.py video SRC DST` (plain frame-by-frame conversion of a finished video) is kept as a fallback.
Stills: `stills16.py` (img/*.jpg converted; img/t thumbs re-made from the converted still).
Batch: `run_all.sh` (resumable) and `run_screen.sh`. Outputs in `r16/out/`. Originals in `orig/`.

## Sprite sections
THE CAST (bit16 only, pixelated) + 16-BIT VS LIVE (link to shellshock-live.surge.sh), from the shared code in
`/workspace/work/trailer_v2/sprites_patch/` with 16-bit tweaks in `sprites16/`. Data: `trailer/sprites.json` (copy of /workspace/work/sprites/out/sprites.json).
Test: `spritetest2.js URL OUTDIR` (390x844, chromium-1134 via ss_trailer playwright 1.47; LD_LIBRARY_PATH=/workspace/work/ss_trailer/libs/aarch64-linux-gnu;
local runs serve with `rangeserve.py PORT DIR` and route sprite PNGs from /workspace/work/sprites/out; live runs use the env proxy).

## Deploy
export SURGE_LOGIN=rbparle@gmail.com SURGE_TOKEN=$(cat /workspace/work/.surge_token); npx -y surge@0.24.6 /workspace/work/g16js/trailer shellshock16bit-trailer.surge.sh
