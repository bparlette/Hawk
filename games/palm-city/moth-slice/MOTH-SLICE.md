# Palm City — MOTH SLICE (paint-everything comparison)

A playable copy of Palm City (`games/palm-city/`, Hawk main 9dac79b8) with
exactly three paint changes and everything else identical — same framing,
scale, grade keyframes, gameplay and feel-pass features. Built so the owner
can judge Moth's "paint everything, not just the ground" pass against the
Gemini-directed look in the main game.

## The three changes

1. **Buildings painted** — `tools/paint_postprocess.py` re-bakes the 15
   building colour sprites (and, lightly, their night overlays): Kuwahara
   flattening + impasto dabs oriented by the sprite's structure tensor
   (roof edges / wall direction), plum ink inside the silhouette edge.
   Alpha is byte-identical to the originals — silhouettes, colours and
   skylight positions do not move. Zero runtime cost.
2. **Water calms near shore** — `src/ground.js` exports `shoreCalm()`
   (0 at the shoreline or the pier's edge → 1 about 170 units offshore):
   water dabs get shorter/thinner/fainter toward shore and most are
   skipped in the shallows (decided after the seeded randoms are drawn, so
   chunk borders stay seamless); the base water colour also lightens into
   pale shallows. In `src/render.js` the two animated stroke sheets and
   the sparkle glints fade by the same shore distance.
3. **Characters painted in** — ped + player colour sheets get the same
   stroke pass, lighter (smaller radius, shorter dabs). Their shadow
   sheets get an alpha-only treatment: a stroke-textured contact patch at
   the feet anchor and streak breakup along the cast direction, so figures
   sit in the painting instead of floating over it.

## What is NOT copied

Unchanged binary assets are referenced from the main game via
`../../assets/…` paths in `assets/manifest.json` (all cars, all props, and
the building shadow sprites). Only the 44 re-baked sprites live in this
folder's `assets/`. Game code is a verbatim copy except `src/ground.js`,
`src/render.js`, `index.html` (title/marker) and `assets/manifest.json`.

## Rebuild the sprites

```
python3 tools/paint_postprocess.py --src ../assets --dst assets
```

## Checks

`tools/sim_run.mjs` (DEMO OK), and the game's `touch_check.mjs` /
`profile.mjs` / `shot.mjs` are carried in `tools/` unchanged.
