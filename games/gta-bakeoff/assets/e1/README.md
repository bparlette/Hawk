# assets/e1 — asset list (published by Moth, per the round flow)

Era 1 = **GTA 1 (1997)**, Link as in **Link's Awakening**. The renderer (`play/eras/e1.js`) loads
exactly the files below, by these names, through `manifest.json`. Everything is drawn from the
real decoded data in `level/` — cleaned and organised, never redrawn from imagination.

## Files

| File | What | Spec |
|---|---|---|
| `manifest.json` | every file below, with tile/sprite index maps, frame counts, anchors | keys fixed by this list |
| `tiles.png` | the Vice Beach tile set rendered from `level/tiles.rgba` | 64×64 px per tile, atlas grid, no resampling, no palette changes |
| `sprites.png` | vehicle + object sprites from `level/sprites.rgba` | native size, pre-rotated headings as stored, transparent background |
| `peds.png` | pedestrian sprites from `level/sprites.rgba` | native size, walk frames grouped per variant, anchor = feet centre |
| `link.png` | **Link, Link's Awakening style** — the one new-drawn piece | top-down; idle + walk cycle, 4 directions × 4 frames, 16×16-class sprite scaled to match ped size on the tile grid; cap, tunic, shield, sword readable at native size; anchor = feet centre |
| `hud-font.png` | the era's HUD lettering as a glyph sheet | matched to `game/`'s on-screen text character |
| `audio/music.ogg` | music loop in GTA 1's character | 30–60 s, seamless loop |
| `audio/engine.ogg` | engine loop, pitch-shiftable | 2–4 s loop |
| `audio/footstep-a.ogg`, `audio/footstep-b.ogg` | footsteps, pavement + sand | short one-shots |
| `audio/door.ogg` | car door open/close | one-shot |
| `audio/ambience.ogg` | ocean/city bed | 20–40 s loop |
| `audio/jingle.ogg` | run-finish jingle | 2–4 s |

## Also in this folder (Gemini deliverables)

- `refs/LOOK.md` — the era research write-up (see `tasking/GEMINI-ASSETS.md`, Step 1).
- `contact-sheet.png` — real GTA 1 screenshots (left) · this asset set (middle) · level crop
  (right), labelled. Cherie approves the match against the real game.
- `README` notes inside `manifest.json` are not needed — production notes go in this file's
  "How it was made" section once the set lands.

## Anchors & scale

- Tile = 64×64 px in the source data; the level grid in `level/canonical/vice_beach.json` is the
  authority for which tile goes where.
- Vehicle and ped anchors = centre of the sprite's ground footprint, matching how
  `level/render_sprites.py` lays them out.

## How it was made & how to re-make it

All files in this folder (aside from `refs/LOOK.md` and this `README.md`) are generated deterministically by [build_e1_assets.py](build_e1_assets.py).

### Re-generate from scratch

```bash
uv run --with pillow,soundfile python3 assets/e1/build_e1_assets.py
```

`soundfile` bundles `libsndfile` with native `OGG/VORBIS` encoding (system `ffmpeg` on this host lacks `libvorbis`). Re-running overwrites all PNG spritesheets, `manifest.json`, `contact-sheet.png`, and `audio/*.ogg` identically.

### Pipeline & ground-truth sources

1. **`tiles.png` (`2048×832` RGBA, `64×64` grid)** — Copies slots `0..384` byte-for-byte from `level/tiles.rgba` (`sideN=198`, `lidN=149`, `auxN=37`) with zero palette or filtering changes. Slots `385..398` (row 12) re-decode the 14 Vice Beach `flat=1` overlay lids (`21, 47, 48, 49, 50, 51, 59, 68, 97, 100, 126, 127, 128, 129`) directly from `game/data/vice/style003.g24` with `palIndex == 0` alpha-transparent (palm fronds, bridge railings, drop shadows), indexed under `tiles.flatTransparentMap` in `manifest.json`. `tiles.usedViceBeachLids` records all `86` unique lid tiles referenced in `level/canonical/vice_beach.json`.
2. **`sprites.png` (`2048×2048` RGBA)** — Shelf-packs all `1049` native sprites from `level/sprites.rgba` + `level/g24.json` above `nativeBottomY=1002`. Starting at `y=1024`, packs `32`-heading (`k=0` north, clockwise) nearest-neighbour pre-rotated `80×80` frames (zero bilinear blur) for 9 Vice Beach vehicles (`taxi_white`, `convertible_blue`, `sedan_gold`, `muscle_purple`, `bug_aqua`, `classic_maroon`, `sport_red`, `police_cruiser`, `coupe_white`) in a `25`-column × `12`-row block indexed under `sprites.rotatedCarStrips`.
3. **`peds.png` (`624×480` RGBA)** — Groups `24×24` walk/run/punch/enter-exit cycles in 8 top rows (`yellow_ped`, `cop`, plus 6 civilian variants `cyan_ped`, `red_ped`, `blue_ped`, `green_ped`, `white_ped`, `lavender_ped` produced using real `style003.g24` remap CLUTs), followed by all `295` native `PED` sprites (`660..954`).
4. **`link.png` (`80×100` RGBA, `20×20` cells, `4 cols × 5 rows`)** — The one newly drawn asset (`Link's Awakening DX` (`1993/1998`) proportions, emerald cap/tunic, dark outline, Hylian shield, sword). Rows `0..3` cover `down`, `up`, `right`, `left` 4-frame walk cycles; row `4` covers `drive` / seated poses; feet-centre anchor is `(10, 15)` so Link sits cleanly at native GTA 1 pedestrian scale on the `64×64` tile grid.
5. **`hud-font.png` (`256×320` RGBA)** — Outlined gold-yellow ASCII `32..126` `16×24` bitmap glyph sheet paired with native GTA 1 HUD sprites (`copHead`, `copHeadSmall`, `arrowSmall`, `arrowLarge`, `armor`, `phone`, `mobile`, `pager`, `districtBar`) under `hudFont.hudSprites`.
6. **`audio/*.ogg` (7 × `44100 Hz` mono Vorbis streams)** — Synthesized deterministically in Python/NumPy (`music.ogg` `32.0s` `120 BPM` seamless loop, `engine.ogg` `3.0s` `66.0 Hz` base loop, `footstep-a.ogg` `0.16s` pavement, `footstep-b.ogg` `0.20s` sand, `door.ogg` `0.28s`, `ambience.ogg` `24.0s` loop, `jingle.ogg` `3.0s`).
7. **`contact-sheet.png`** — 3-panel visual comparison (`research/gta1/` refs left · `assets/e1/` assets & `1:1` Vice Beach tile-grid scale check middle · `refs/crop_vice_beach.png` & `level/canonical/vice_beach.png` right).

