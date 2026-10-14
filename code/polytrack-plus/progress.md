# PolyTrack Remake — Hark Edition (fan remake) · progress

Ship target: Brad's demos (bparlette/Hawk main → brad-demos/g/polytrack-plus/), id `polytrack-plus`.
Source of truth: `/workspace/work/polytrack-plus/game/` (copied verbatim into the demos folder).

## Files
- `game/index.html` — DOM shell (cards, corner buttons, touch pads, builder bar), CSS. No web fonts, no Tailwind.
- `game/main.js` — game: state machine (attract / ready / race / finish / build + paused), 60 Hz fixed-step loop with
  render interpolation, chase cam, HUD canvas, ghost record/playback, builder, input (keys, pointer touch, gamepad).
- `game/carphys.js` — **reusable raycast-suspension car** (no render code). See header comment for the API.
  `new RaycastCar(THREE, overrides)`, `reset(p,q,v)`, `step(1/60, {throttle, brake, steer}, world)`; world needs
  `raycast(o, d, maxT, hit)` + `sphere(c, r, cb)` (TriGrid in track.js implements both). 2 substeps (120 Hz) per step,
  progressive bump stop (survives 9 g loop entries), friction circle, speed-sensitive steering, downforce, air pitch/yaw,
  chassis contact spheres with impulse + friction. Sibling agents (vanzombie) may borrow it.
- `game/track.js` — grid pieces (S = 12 m cells, H = 4 m levels, road W = 9 m): straight, start, finish, checkpoint,
  turn (r 6 m), banked turn (r 18 m, 26° bank), ramp up/down, jump kicker, loop (r 8 m helix that drifts one cell sideways —
  a helix is a geodesic on the cylinder so the car needs ~no steering in it), gap. Ribbon extrusion → triangle soup →
  TriGrid (3D hash, 4 m cells) for raycasts + sphere contacts. `MAIN_LAYOUT` = the shipped circuit.
- `game/race.js` — checkpoints (any order), finish / lap (start line doubles as finish on a circuit), respawn pose,
  and the Autopilot (Stanley-style steering in the road frame + braking-envelope speed plan) used for attract mode + medal timing.
- `game/gfx.js` — cel look: 3-band toon ramp, screen-space halftone dots in the shadow band, inverted-hull ink outlines
  (mitred `odir`), hero car model, sky, scenery, pooled particles, gate label textures.
- `game/audio.js` — procedural Web Audio (engine gears, tyre screech, wind, chime, land, scrape, splash, fanfare, music layers).
- `game/three.module.min.js` — three.js r160, pinned local copy (same file as Cel City).
- `sim/*.js` — headless node sims (`node sim/drive.js '{"log":1}'`, `sim/sweep.js` param sweeps, `sim/looptest.js`, `sim/solve*.js` layout closure search).
- `qa/` — `run.sh` (env + :8811 server + chrome.flock), `bg.py` (detached runs), `shot.cjs`, `lap.cjs` (full autopilot lap in the page + retry x10 + pause).

## Track: "Harbor Loop" (Hark original)
start → ramp up → jump over a 2-cell gap (elevated) → CP1 → banked right → chicane → ramp down → loop → CP2 →
long straight with a second jump → CP3 → banked right → long straight → chicane → finish line (= start line).

## Medals
Autopilot sweep in node (same physics code, fixed 60 Hz): best clean lap 27.65 s (dec 28, vBank 32, vTurn 16);
safe attract config 29.9 s. Medals: AUTHOR 27.65 · GOLD 29.00 · SILVER 32.00 · BRONZE 37.00. (Author = Hark autopilot, not a human.)

## Lessons
- Loop: chassis spheres too low scraped the concave loop entry and killed ~15 m/s; raised spheres + bump stop fixed it.
- Ramp crests launch the car above ~32 m/s; kept as a stunt feature, but never put a kicker right after a crest.
- Bot heading error must drop the component along the road normal, or it steers wildly inside the loop.

## QA (2026-10-13, headless swiftshader under chrome.flock)
- Full autopilot lap in the real page at 1280x720 and 390x844: 29.88 s (identical to the node sim: deterministic), 0 console errors/warnings.
- Retry (R) x10: 10/10 back to the start line, timer 0, checkpoints cleared, card hidden. Pause/resume (Esc) OK. Blur clears keys.
- 390x844 real touch (CDP touch events): tap = handover from attract, GAS hold accelerates, stick drag steers, ⚑ respawn (no CP => restart).
- Builder: palette tap + canvas tap places START, test drive start→kicker→finish finishes, Esc back to builder, delete-mode tap removes, EXIT → attract.
- Draw calls ~25, ~37k tris.

## Short
- `qa/cap.cjs [startFrame]` = deterministic 30 fps capture (`?cap&nointro&auto&dpr=2`, page advances only via `__ptp.advance`) at 1080x1920.
  Resumable (deterministic) — the first run was killed at frame 785 and resumed from 780.
- `tools/short.py` → `shorts/polytrack_short.mp4` (33.6 s, 1080x1920, H.264 + AAC; soundtrack synthesized in Python: beat, CP chimes, loop whoosh, fanfare).
- Thumbnail: `shorts/thumb.webp` (320x200 from the finish shot).

## Ship
- `tools/entry.json` (manifest entry), `tools/push-hawk.sh` (additive: only g/polytrack-plus, thumbs/polytrack-plus.webp, and our games.json entry, re-read from main each try). Run under `flock /workspace/work/demos/.edit.lock`.
