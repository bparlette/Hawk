# ROADKILL RIG — Hark Original (id `wasteland-van`) — progress

Live: https://bparlette.github.io/Hawk/brad-demos/#wasteland-van (game: .../brad-demos/g/wasteland-van/index.html)
Shipped commit on bparlette/Hawk main: 018bddf184d79b47edfc4305fdcd41d316123ae7 (only g/wasteland-van/, thumbs/wasteland-van.webp, games.json entry).

## Layout
- `src/01..10_*.js` -> `./build.sh` -> `site/index.html` (inline ES module, imports `./three.module.min.js` = three r160, same pinned copy as Cel City). `head.html` holds CSS + DOM.
- QA: `./qrun.sh <log> <w> <h> <steps>` (detached; Chrome under the shared flock; local server :8761). Steps in `qa.js`: smoke, cards, fps, drive, jump, b16, evo, boss, win, die, full, route, thumb. Logs in `T/*.log`, shots in `T/qa/`.
- Short: `cap.js` (deterministic 540x960 bot capture, 30 fps game time via `__wv.manual/frame`) -> `shorts/f/*.jpg` -> ffmpeg -> `shorts/roadkill_rig_short.mp4` (1080x1920, 20.5 s, silent track).
- Publish: `flock /workspace/work/demos/.edit.lock python3 publish.py` (re-reads games.json from Hawk main, additive, pushes only this game). Hawk sparse clone at `hawk/`.

## Design
- Cel City look: 3-band toon ramp + screen-space halftone in shadow band, mitred inverted-hull outlines (also on instanced horde/gibs/pickups via instanceMatrix-aware outline shader). Painted sky dome with banded cel clouds, mesas, wrecks (cars, bus, tanker, plane, gas station, water tower), the Rift trench + MEGA JUMP ramp pair, kickers, barrels.
- Van: raycast suspension rigid body (4 rays, spring/damper, tyre friction circle, drift = rear grip drop, air control, hull penalty contacts, self-right), 2 substeps inside a 60 Hz fixed step, render interpolation.
- Horde: 1,800-slot SoA pool, one InstancedMesh (+ outline) with vertex-shader limb animation (walk/run/bite/ragdoll), counting-sort spatial hash (3 m), ragdoll corpses, gib InstancedMesh, splatter decal InstancedMesh, blob shadows. Outline hull culled beyond 70 m.
- Weapons: roof MG, flamethrower, side saws, harpoon, spike ram (speed-based); passives armor/nitro/magnet/engine; evolutions TWIN MINIGUN, DRAGON BREATH, BUZZ HALO, WHALER. XP shards -> level-up cards; scrap -> SCRAP FORGE card + small heal.
- Run: SURVIVE 6:00 (extraction opens) or kill GRAVEMAW (spawns 4:30, phase 2 at 50%) to open it early; drive into the beam to win. Bruisers at 2:10/3:40, surges, BLOOD MOON at 3:00. Telegraphed slam rings, charge lanes, thrown rocks; nitro gives brief i-frames vs big hits.

## QA results (headless SwiftShader, CPU-rendered; absolute fps is not representative of a GPU)
- 0 console errors / page errors in every run, both sizes.
- 1,122-1,363 live zombies reached; sim cost 1-3 ms/step, render-prep 6-12 ms; 50-85 draw calls.
- Win (extraction), death, 10x retry, cards (keys + pointer), 16-bit toggle, evolutions, boss kill + slow-mo all exercised.

## Log
- 2026-10-13 21:30 start. 22:10 first build. Fixed: zombie tri count (1.9k -> 412 tris), ramp side-wall winding, card level overflow, boss death when HP hits 0 from any source, bite damage per-step, ram slowdown scaled by impact, portrait HUD overlaps, result title overflow, Rift bot routing.
- 2026-10-14 00:41 published (018bddf).
