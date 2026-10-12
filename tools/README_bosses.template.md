# Toad City Baltimore — Task D bosses, batch 2 (O6)

Six bosses, one ES module each in `src/`, built on the round-2 ZIP kit (`kit/toadcity_kit.js`, byte-identical to the ZIP) and tested
with the real poses and the real `kit/real_mergeRig.js` (byte-identical). Branch `claude/o6-bosses-b`.

| Boss | id | Landmark | File | Build function | Live-mode hook (J-003) |
|---|---|---|---|---|---|
| Admiral Redclaw | `admiral_redclaw` | `fort` | `src/boss_admiral_redclaw.js` | `buildAdmiralRedclaw(K, opts)` | `window.boss_admiral_redclaw.buildAdmiralRedclaw` / global `buildAdmiralRedclaw`, callable with `{ THREE, toonMat, outlineMat, scale }` |
| Big Jimmy | `big_jimmy` | `aquarium` | `src/boss_big_jimmy.js` | `buildBigJimmy(K, opts)` | `buildBigJimmy({ THREE, toonMat, outlineMat, addOdir, QUAL })` → `{ root, body, soft, mouth, claws[2]{arm, top, bot, tip}, legs[2], flash[], J }` |
| Voltage Vic | `voltage_vic` | `powerplant` | `src/boss_voltage_vic.js` | `buildVoltageVic(K, opts)` | `buildVoltageVic({ THREE, stage: true })` (adds the DJ booth) and `J.pose(name, u)` |
| Chef Crabcake | `chef_crabcake` | `fourseasons` | `src/boss_chef_crabcake.js` | `buildChefCrabcake(K, opts)` | — |
| Arabber Al | `arabber_al` | `fells` | `src/boss_arabber_al.js` | `buildArabberAl(K, opts)` | `buildArabberAl()` / `buildArabberAl(deps)` → `{ root, update(dt, { t, state, throwK }), J }` |
| The Pool Shark | `pool_shark` | `pendry` | `src/boss_pool_shark.js` | `buildPoolShark(K, opts)` | — |

Every module exports `META`, `ATTACKS` (exactly 3), `POSES` (idle, run, hurt, down, atk1–atk3), one build function and `animateBoss`
(optional; every boss stays inside every limit with it skipped, see "Known issues"). `J.setAngry(0..1)` is on the three crabs
(steamed red). Each file loads as its own ES module, has no `import`, and line 2 is the canary comment.

## How to view
```
python3 -m http.server 8000          # from the repo root (or the zip root)
open "http://localhost:8000/viewer_bosses.html?show=big_jimmy&pose=all"     # in the zip the same page is viewer.html
```
`viewer_bosses.html` (from `kit/real_viewer.html`): `?show=<id>` · `&pose=idle|run|hurt|down|atk1|atk2|atk3|all` · `&u=<0..1>` freezes the
pose parameter · `&turn=1` · `&sheet=1` (model sheet) · `&strip=atk1|atk2|atk3|knockdown|hurt|run` (60 fps simulation with the real damping,
frozen at `&n=` samples; red labels = frames inside the `active` window) · `&seq=<same>|chain` (live) · `&cam=three|front|side|back|phone`
(phone: Harold 6 m in front, chase camera) · `&night=1` · `&merge=1` (real `mergeRig`) · `&flash=0.85` · `&angry=1` · `&ui=0`.

## Measured (every number below is printed by `tools/readme_tables.mjs` from `tools/results_boss_<id>.json`)
Measured with the root scaled by `META.scale`. Parts and tris exclude ink hulls; materials exclude the shared `K.OUT_CHAR`. "Lowest point"
is the lowest vertex of any non-hull part except the feet (`ftL`/`ftR`) and weapon (`swL`/`swR`) groups, over the static poses AND every
boss sequence of `tools/boss_seq.js` simulated at 60 fps with the real `applyPose` damping, the knock-down hop and `animateBoss`. The
strike peak is the frame where the attack's `strike` joint moves fastest when the attack plays at rate 30 from idle.

<!--TABLES-->

## Boss state timings (stated assumptions)
The game's boss branch of `06_game.js` was not available; per H-002 / J-003 the tests use (`tools/boss_seq.js`): idle and run at rate 14
(`run(t, 5)`); attack N = `POSES.atkN(st / dur)` at rate 30 for `ATTACKS[N].dur`; hurt = `hurt(min(st / 0.32, 1))` at rate 22 for 0.34 s;
knock-down = hop vy 4.2, gravity 22 (root y), then `down(st / 1.25, grounded)` at rate 14 for 1.25 s; getup = `idle` blended from
`down(1, true)` by damping at rate 14 over 0.5 s (`animateBoss` gets `'idle'`, lesson A9). Root scale = `META.scale`; the culling pass line
is 2.6 in rig space (1.9 reported for information). `animateBoss(J, t, state, u)` receives the pose name as the state.

## Implementation notes
- **Kit access.** On the normal path every module uses only the `K` it is given. The live-mode hooks are called with partial deps
  (`{ THREE, toonMat, outlineMat }`, or `{ THREE }` alone for Voltage Vic's stage, or nothing for Arabber Al's chase). For those, each
  module carries `kitFrom()`: copies, line for line, of the helpers in `kit/toadcity_kit.js` (`G`, `part`, `grp`, `skeleton`, `addOdir`,
  `bakeColor`, `blank`, `legsStance`, `runLegs`, `applyPose`, and `toonMat` / `outlineMat` / `basicMat` only when the caller passes none).
  The kit itself is never edited. The game's own K (`harness/realK.mjs`) has no `basicMat`; Voltage Vic's glow then uses
  `THREE.MeshBasicMaterial`, which is exactly what the kit's `basicMat` returns.
- **Materials.** Crab shells are a second toon material whose colour is the shell colour (parts baked white), so `J.setAngry()` and the
  windup flush can tint them; blue shells go through a cooking brown to steamed red. Chef Crabcake's tin label and the Pool Shark's shirt
  print are canvas textures (one mapped toon sub-material each), cached on `K.QUAL || K.THREE || K` and only after a successful draw.
  Every sub-material shares `flash` / `flashC`.
- **Spins.** Voltage Vic's club spin turns the hips (not `tilt`), so no tilt wrapping is involved at any damping rate.
- **Vehicle.** Arabber Al's wagon and pony are `J.vehicle` under `J.root` (merged by the real `mergeRig` with him: 2 draw calls). Al sits at
  `J.hips.position.z = 0.25` and the wagon is shifted so the whole rig is centred on the root for culling.

## Known issues (measured)
- **Arabber Al:** the wheel rims touch the ground exactly (lowest point 0.000 m, by design), and the knock-down hop lifts the whole cart
  0.401 m (vy² / 2g); `down` lays him back into his own crates rather than off the cart. `META.radius` is 2.0 m because it covers pony to
  tailboard. The pony gallop, rearing and wheel spin are in `animateBoss` only: skipped, the pony stands still while the cart moves.
- **Big Jimmy:** he hovers off the tank floor (lowest leg tip +0.009 m at idle t = 0, he is underwater); on his back (`down(1, true)`) the
  shell rests 0.333 m above the floor so the getup roll keeps its margin. The per-leg ripple is in `animateBoss` only (the leg sets still
  fold with the poses when it is skipped).
- **Chef Crabcake:** the seasoning-tin leg's shake is in `animateBoss` only; skipped, the tin stays at his side while he fans the cloud.
- **Admiral Redclaw:** the tightest floor margin of the batch, +0.003 m (knee in the broadside slam crouch).
- **Voltage Vic:** the glow parts use `MeshBasicMaterial`, which ignores the hit-flash uniform (they are transparent by day and flare
  only on active beats); the hook bounds include his feet.
- The attack frames on the model sheets carry the windup flush (crabs) at the active-window mid point.
- The game has no LOD swap; `opts.lod === 1` only trims small details (see the LOD 1 column).
- Hooks were checked against `harness/realK.mjs` with the deps J-003 lists; the real live modes were not available to run.

## Tools (all in this delivery)
- `viewer_bosses.html` (zip: `viewer.html`) — the boss viewer above.
- `tools/measure_boss.mjs` — the boss harness on Hark's `harness/realK.mjs` + `harness/fakedom.mjs` (unchanged); writes `tools/results_boss_<id>.json`.
- `tools/check_hooks.mjs` — calls each live-mode hook with the game's own partial deps; adds `hooks` to the same JSON.
- `tools/boss_seq.js` — the boss state timings, shared by the viewer and the harness.
- `tools/boss_jobs.mjs` + `tools/shoot.mjs` — render `previews/` (headless Chromium, SwiftShader GL); `tools/shots_<id>.json` keeps every
  render's console errors and report.
- `tools/readme_tables.mjs` / `tools/readme_build.mjs` — build the measured part of this README from the JSON.

## Previews (per boss, `previews/<id>_*.png`)
`sheet` (2048×1024: front, ¾, side, back, atk1–atk3 at the active mid point), `day` / `night` (1280×720), `phone_390x844` and
`phone_390x844_night` (Harold 6 m in front), `phone_390x844_merged` / `phone_390x844_night_merged`, `merged_day` / `merged_night`,
`merged_flash` and `flash_unmerged` (hit-flash 0.85), `turn`, `poses` (all seven poses), `poses_night_merged`, `angry`,
`atk1_strip` / `atk2_strip` / `atk3_strip` (red labels = active window), `knockdown_strip` and `knockdown_strip_merged`.

<!--NOTES-->

## Pier Boss Check 410
Canary heading (O6 brief, canary 1 of 3). Nothing follows it.
