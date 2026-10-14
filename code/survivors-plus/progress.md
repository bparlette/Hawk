# Vampire Survivors Remake — Hark Edition (fan remake) · progress

Ship target: Brad's Demos (bparlette/Hawk main:/brad-demos/), id `survivors-plus`, folder g/survivors-plus/,
title "★ Vampire Survivors Remake — Hark Edition (fan remake)". Live: https://bparlette.github.io/Hawk/brad-demos/#survivors-plus

## Source (/workspace/work/survivors-plus/game/)
- `index.html` — HUD/overlays (DOM, change-only writes), CSS, portrait rules.
- `game.js` — main: renderer/camera, impostor bake, world, state machine (attract/play/level/chest/pause/dead/win), sim step, boss, render, UI, bot, QA hooks (`window.__vs`).
- **Reusable modules (no three.js deps, zero per-frame allocation) — vanzombie may borrow:**
  - `spatial-hash.js` — `SpatialHash(cell, cols, rows, max)`: counting-sort uniform grid re-centred on the player each build; `query(x,y,r,out)`, `nearest(...)`, raw `start/items/cell` for tight loops.
  - `horde.js` — `Horde(max, coolSlots)`: swap-packed SoA enemies (x,y,kx,ky,hp,flash,phase,face,elite,uid,cool[]), `spawn/remove/push/update` (seek, line-swarm, wobble, knockback decay, hash separation on alternating halves, far relocation callback); `WaveDirector(phases, events)`: min-count + trickle-rate time table with one-shot events. `ENEMY_TYPES` table.
  - `weapons.js` — `Arsenal`: 8 weapons × 8 levels, 9 passives × 5, 6 evolutions (weapon max + paired passive, granted by a chest), level-up offer roller, chest upgrades, pooled SoA `Projectiles` with per-projectile uid hit memory + per-enemy cooldown slots. All hits are shape tests against the hash (nothing auto-hits).
  - `cel.js` — toon material (3-band + halftone + flash), mitred inverted-hull outline (instancing-aware), `InstLayer` (InstancedMesh + hull), `SpriteLayer` (instanced quads: billboard / ground decal; add / alpha / alpha-cut).
- `rigs.js` — procedural cel rigs (hunter, bat, ghoul, skeleton, wraith, gargoyle, werewolf, Reaper), props, pickups, projectiles, card icon models.
- `fxatlas.js` — canvas atlas for FX + comic digits/words; seamless painted flagstone floor.
- `audio.js` — procedural Web Audio (noise buffer, envelopes, compressor, rate-limited SFX, layered D-minor score, low-HP heartbeat).
- `three.module.min.js` — three r160 (local copy, same as Cel City).

## Rendering approach
Horde = ONE instanced draw of cel "impostors": at boot each creature rig is posed in 8 walk frames and rendered (toon + ink hull)
into a 2048×1024 mipmapped render target at the game camera's pitch; enemies are camera-facing quads (alpha-cut, depth-write).
Player, Reaper, props, gems, chests, projectiles are real 3D cel meshes (InstancedMesh + hull). Blob shadows/decals/fx are instanced quads.

## QA (qa/)
- `run.sh <cmd>` — local server :8745 + Chromium env + `flock /workspace/work/toad-city/locks/chrome.flock`.
- `smoke.js`, `look.js w h touch out evalJS advSec`, `botrun.js secs` (full autopilot run via ?bot=1), perf script (see below).
- URL params: `?bot=1` autopilot, `?play` skip attract, `?bench=N` (QA only: t=8:00, evolved build, invulnerable, horde topped up to N), `?t=sec`.

## Log
- 2026-10-13 night: built v1 (all modules), first smoke at 1280: loads, attract → play handover, level-up works. Fixes: sRGB RT mipmaps broke impostors in swiftshader → linear RT; darker floor; closer camera (pitch 50°); hero blink → white flash instead of invisibility; bot rewritten to orbit the crowd (lash is horizontal).
- Console: only swiftshader "GPU stall due to ReadPixels" driver notes from the one-time card-icon copy at boot.
- 2026-10-14 ship pass: qa/flow.js level-up test fixed (it set xp=xpNext, which never queues a level since gainXp only runs on pickup → now sets pendingLv).
  Damage-number clutter: DN_MAX 140→70 and hits landing within ~0.77 u of a fresh number merge into it (sum). flow 1280x720 20/20, 390x844 20/20, 0 console errors.
  Verified: single LEVEL UP (card title; in-world word debounced 1.2 s), LV label in XP bar, 390 HUD. Thumb from qa/shots/thumb-src.png (8:02 horde frame).
  Published: Hawk main 1eabfa3 (publish.py under demos/.edit.lock). qa/warn.js removed. No Short.
