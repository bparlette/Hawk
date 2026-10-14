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

| Boss | Parts | Tris | Mats | Merged calls (real `mergeRig`) | Height (idle t = 0) vs META | Lowest point, all poses + blends | Cull radius (rig space) | Idle reach beyond `META.radius` | 3 attacks: strike peak u (active) | Flash merged | Console errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `admiral_redclaw` | 58 | 14,672 | 2 (toon + toon) | 3 (2 toon + 1 ink) | 3.135 m vs 3.1 m (+1.1 %) | +0.003 m | 2.430 | 0.272 m (haL) | atk1 0.45 (0.42–0.74); atk2 0.46 (0.36–0.58); atk3 0.60 (0.55–0.70) | yes | 0 in 20 renders |
| `big_jimmy` | 45 | 14,364 | 3 (toon + toon + toon) | 4 (3 toon + 1 ink) | 2.246 m vs 2.3 m (-2.3 %) | +0.042 m | 2.339 | 0.151 m (elL) | atk1 0.48 (0.42–0.60); atk2 0.47 (0.34–0.66); atk3 0.66 (0.60–0.74) | yes | 0 in 20 renders |
| `voltage_vic` | 50 | 9,572 | 2 (toon + basic) | 3 (2 toon + 1 ink) | 2.517 m vs 2.5 m (+0.7 %) | +0.013 m | 2.289 | 0.102 m (haR) | atk1 0.55 (0.50–0.66); atk2 0.53 (0.50–0.75); atk3 0.53 (0.33–0.67) | yes | 0 in 20 renders |
| `chef_crabcake` | 41 | 11,416 | 3 (toon + toon + mapped) | 4 (3 toon + 1 ink) | 2.966 m vs 2.95 m (+0.5 %) | +0.027 m | 2.397 | 0.312 m (haR) | atk1 0.50 (0.42–0.66); atk2 0.44 (0.40–0.76); atk3 0.52 (0.40–0.62) | yes | 0 in 20 renders |
| `arabber_al` | 58 | 14,452 | 1 (toon) | 2 (1 toon + 1 ink) | 2.066 m vs 2.1 m (-1.6 %) | +0.000 m | 2.227 | 0.218 m (ponyHead) | atk1 0.53 (0.46–0.64); atk2 0.44 (0.40–0.72); atk3 0.56 (0.45–0.70) | yes | 0 in 20 renders |
| `pool_shark` | 40 | 8,934 | 2 (toon + mapped) | 3 (2 toon + 1 ink) | 2.639 m vs 2.7 m (-2.2 %) | +0.017 m | 2.227 | 0.057 m (haR) | atk1 0.48 (0.44–0.60); atk2 0.51 (0.40–0.62); atk3 0.59 (0.56–0.72) | yes | 0 in 20 renders |
| **Threshold** | ≤ 63 | ≤ 19,800 | ≤ 4 | report | ±10 % | ≥ −0.030 m | ≤ 2.6 (pass), 1.9 info | ≤ 0.35 m | peak inside active | yes | 0 |

Lowest point per sequence (60 fps, real damping, `animateBoss` on; feet and weapon groups excluded as the brief allows), with the state and part that set it:

| Boss | knockdown | hurt | run | atk1 | atk2 | atk3 | chain (every state back to back) |
|---|---|---|---|---|---|---|---|
| `admiral_redclaw` | +0.034 m @ 2.32 s (idle:knR) | +0.035 m @ 1.35 s (idle:knR) | +0.011 m @ 1.90 s (idle:knR) | +0.014 m @ 2.02 s (idle:knR) | +0.010 m @ 1.88 s (idle:knR) | +0.003 m @ 0.78 s (atk3:knR) | +0.003 m @ 4.72 s (atk3:knR) |
| `big_jimmy` | +0.042 m @ 2.65 s (idle:lgL) | +0.071 m @ 0.00 s (idle:lgL) | +0.059 m @ 2.00 s (idle:lgR) | +0.053 m @ 2.10 s (idle:lgR) | +0.059 m @ 2.00 s (idle:lgR) | +0.045 m @ 2.40 s (idle:lgL) | +0.071 m @ 0.00 s (idle:lgL) |
| `voltage_vic` | +0.014 m @ 2.60 s (idle:knR) | +0.014 m @ 1.20 s (idle:knR) | +0.014 m @ 0.28 s (idle:knR) | +0.014 m @ 0.28 s (idle:knR) | +0.014 m @ 0.28 s (idle:knR) | +0.014 m @ 0.28 s (idle:knR) | +0.013 m @ 7.67 s (idle:knR) |
| `chef_crabcake` | +0.036 m @ 3.00 s (idle:knR) | +0.027 m @ 1.35 s (idle:knR) | +0.038 m @ 1.68 s (idle:knL) | +0.031 m @ 1.60 s (idle:knR) | +0.033 m @ 1.63 s (idle:knR) | +0.031 m @ 1.60 s (idle:knR) | +0.029 m @ 7.10 s (idle:knR) |
| `arabber_al` | +0.000 m @ 0.00 s (idle:vehicle) | +0.000 m @ 0.00 s (idle:vehicle) | +0.000 m @ 0.00 s (idle:vehicle) | +0.000 m @ 0.00 s (idle:vehicle) | +0.000 m @ 0.00 s (idle:vehicle) | +0.000 m @ 0.00 s (idle:vehicle) | +0.000 m @ 0.00 s (idle:vehicle) |
| `pool_shark` | +0.021 m @ 2.42 s (idle:knR) | +0.035 m @ 0.00 s (idle:knR) | +0.019 m @ 2.00 s (idle:knR) | +0.021 m @ 1.90 s (idle:knR) | +0.020 m @ 1.97 s (idle:knR) | +0.018 m @ 2.30 s (idle:knR) | +0.017 m @ 7.88 s (idle:knR) |

Cull radius per sequence (max distance of any part from the rig-space centre (0, 0.95, 0)), and where it peaks:

| Boss | knockdown | atk1 | atk2 | atk3 | chain |
|---|---|---|---|---|---|
| `admiral_redclaw` | 2.430 @ 1.98 s (down:head) | 1.495 @ 0.40 s (idle:head) | 1.690 @ 0.68 s (atk2:haL) | 2.013 @ 1.05 s (atk3:haL) | 2.430 @ 7.22 s (down:head) |
| `big_jimmy` | 2.336 @ 1.02 s (down:haL) | 2.227 @ 0.88 s (atk1:haL) | 2.252 @ 0.78 s (atk2:haL) | 2.276 @ 1.55 s (atk3:haL) | 2.339 @ 6.15 s (down:haL) |
| `voltage_vic` | 2.289 @ 1.75 s (down:swL) | 1.515 @ 0.83 s (atk1:swL) | 1.205 @ 0.88 s (atk2:swR) | 1.304 @ 1.28 s (atk3:swL) | 2.288 @ 6.57 s (down:swL) |
| `chef_crabcake` | 2.397 @ 1.98 s (down:head) | 1.487 @ 0.40 s (idle:head) | 1.487 @ 0.40 s (idle:head) | 1.487 @ 0.40 s (idle:head) | 2.397 @ 6.72 s (down:head) |
| `arabber_al` | 2.220 @ 1.75 s (down:ponyHead) | 2.220 @ 1.75 s (idle:ponyHead) | 2.227 @ 1.28 s (atk2:ponyHead) | 2.220 @ 1.75 s (idle:ponyHead) | 2.227 @ 0.72 s (run:ponyHead) |
| `pool_shark` | 2.227 @ 1.98 s (down:head) | 1.998 @ 1.12 s (atk1:swR) | 1.844 @ 1.38 s (idle:swR) | 2.170 @ 1.65 s (atk3:head) | 2.227 @ 6.97 s (down:head) |

Builds on the game's own code (`harness/realK.mjs`, which has no `basicMat` / `makeAtlas`): parts / tris, and the determinism and cache checks:

| Boss | realGame parts / tris | LOD 1 parts / tris (zip kit) | Same seed → same rig | Independent of `Math.random` | Canvas: first build ops / 2nd / `{...K}` wrapper / no-document build ok |
|---|---|---|---|---|---|
| `admiral_redclaw` | 58 / 14,672 | 48 / 11,344 | yes | yes | 0 / 0 / 0 / yes |
| `big_jimmy` | 45 / 14,364 | 39 / 14,112 | yes | yes | 0 / 0 / 0 / yes |
| `voltage_vic` | 50 / 9,572 | 46 / 9,524 | yes | yes | 0 / 0 / 0 / yes |
| `chef_crabcake` | 41 / 11,416 | 41 / 11,416 | yes | yes | 17 / 0 / 0 / yes |
| `arabber_al` | 58 / 14,452 | 58 / 14,452 | yes | yes | 0 / 0 / 0 / yes |
| `pool_shark` | 40 / 8,934 | 38 / 8,910 | yes | yes | 340 / 0 / 0 / yes |

Live-mode hooks (J-003), called with the game's own partial deps (`tools/check_hooks.mjs`):

- `admiral_redclaw` **globals**: ok, window.boss_admiral_redclaw true, global true
- `admiral_redclaw` **setPiece**: ok, 58 parts / 14,672 tris, 2 mats, bounds y -0.025 … 2.492 m, merged 3 calls, returns J (J.root is the Object3D)
- `big_jimmy` **swimFight**: ok, 45 parts / 14,364 tris, 3 mats, bounds y 0.047 … 1.504 m, returns { root, body, soft, mouth, claws, legs, flash, J }, shape ok
- `voltage_vic` **rhythmStage**: ok, 58 parts / 9,972 tris, 2 mats, bounds y -0.080 … 2.104 m, booth true, 12 J.pose calls
- `voltage_vic` **brawlWithGameKit**: ok, merged 3 calls
- `arabber_al` **carChaseNoArgs**: ok, returns { root, J, update }, after a 2.5 s simulated chase y 0.003 … 2.037 m
- `arabber_al` **carChaseWithDeps**: ok, 58 parts / 14,452 tris, 1 mats, bounds y 0.008 … 2.059 m
- `arabber_al` **noThreeThrows**: ok, message "buildArabberAl(): pass { THREE } (or the kit K), or expose window.THREE"

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

## Design notes

### Admiral Redclaw (`admiral_redclaw`, Fort McHenry)
A cooked-orange crab admiral of 1812, broad as a cannon carriage. Silhouette: an oversized black bicorne worn athwart (it is the shape
that reads from the far flagship deck), a wide flat carapace with two side spikes that becomes his shoulders, a crimson tailcoat with
split tails, white breeches and black riding boots, and two very different arms: a giant pincer on the left and a brass rocket-cannon
for a right forearm. Palette: shell orange (steamed red when angry), crimson coat, white facings and cross-belts, gold epaulettes and
cockade, black hat and boots. Attacks: **rocket barrage** (plants, swings the cannon to a firing line, three recoil kicks: a ranged
volley), **claw sweep** (coils the pincer over the shoulder, then a flat 170° sweep that snaps shut), **broadside slam** (hops with the
cannon raised and drives it muzzle-first into the deck: a ground ring). No flag, regiment, insignia or real person.

### Big Jimmy (`big_jimmy`, National Aquarium tank)
A giant Maryland blue crab, a male "jimmy", 3.6 m across the spines. Silhouette: a wide, flat, dusky blue-olive carapace with the long
lateral spines and a row of front teeth, stalk eyes, two big azure claws held up in front of his face with cream fingertips (a male's
claws are blue, no red tips), eight legs (three walking pairs and the flat swimmer paddles at the back) and a white belly with the
male's narrow T-shaped apron. He hovers a hand's width off the tank floor (underwater). Steamed red when angry. Attacks: **pincer
crush** (both claws swing wide open, then clamp together at full reach), **sideways rush** (swings half side-on and charges crabwise,
the leading claw sweeping across), **belly slam** (rears up on the back legs showing the soft belly, claws high, then drops his whole
body flat: a bubble ring). Knock-down: the crab flip, rolled over the tail onto his back with the legs folded up and pedalling.

### Voltage Vic (`voltage_vic`, Power Plant)
An electric-eel DJ. Silhouette: a long olive-green eel head on a long neck, pale yellow underjaw and a wide grin, a fin crest and a
dorsal fin, magenta headphones and a cyan LED visor; a purple track suit with electric-yellow stripes, an original lightning-bolt
pendant on a gold chain, white high-tops with neon soles. Sparks crackle round both hands: glow parts (`K.basicMat`, transparent) whose
opacity follows `K.NIGHT.value` and flares on every attack's active beats. Attacks sit on whole beats at 130 BPM: **bass drop**
(2 beats: fists high on beat 1, both slam down on beat 2: a shock ring), **zap scratch** (2 beats: the left hand scratches while the right
cocks back, then fires straight at the target on beat 2: a lightning bolt), **club spin** (3 beats: a crouch on beat 1, a full
electrified spin over beats 2–3, the hips carry the turn so no tilt wrap is involved). Rhythm-mode hook: `buildVoltageVic({ THREE,
stage: true })` adds a DJ booth (58 parts with it) and `J.pose(name, u)` snaps idle / atk1–3 at any tempo.

### Arabber Al (`arabber_al`, Fells Point)
A street-produce arabber and his souped-up horse-cart, in one module (`J.vehicle` under `J.root`, merged with him). Al: flat cap,
dark shades, a handlebar mustache, rolled shirt sleeves and a green apron, seated on the bench. The wagon: red side boards, three
crates heaped with strawberries, oranges and melons, red-rimmed wheels with gold discs and chrome hubs, chrome side pipes. The pony: a
stocky dappled original pony with a dark mane and a red plume. Attacks: **melon lob** (half-stands, cocks a melon behind his head and
lobs it overhand: ranged), **rein-snap ram** (stands in the footboard and cracks the reins two-handed while the pony rears; the cart
rams forward: `move: 8`), **strawberry shower** (twists back to the crates and flings a 180° arc of fruit). `run` is the cart driving
(pony gallop and wheel spin in `animateBoss`); `down` knocks him flat on his back into his own produce. `META.radius` (2.0 m) covers the
whole rig, pony to tailboard. Car-chase hook: `buildArabberAl()` (THREE from `window.K` / `window.THREE`) or `buildArabberAl(deps)`
returns `{ root, update(dt, { t, state, throwK }), J }`; `throwK` drives the lob.

### Chef Crabcake (`chef_crabcake`, Four Seasons kitchen)
A classic Maryland blue crab in chef's whites (HOMAGE: blue crab, steamed red when angry, a mallet and an original seasoning tin).
Silhouette: the wide bright-blue carapace is his face, with the lateral spines and stalk eyes, under a tall toque; a round
double-breasted chef coat with two button rows, a red neckerchief and a cream apron; blue crab forearms and claws gripping a wooden
crab mallet each; and one little walking leg out of his left side holding his seasoning tin. The tin is original: forest green with a
cream band and red/green lettering "CHEF'S CRAB DUST", drawn on a 256×128 canvas (the one mapped material, cached per kit, never on a
failed draw). Nothing in it echoes a real seasoning brand's colours or layout. Angry: blue goes through a cooking brown to steamed red.
Attacks: **seasoning blind** (twists the tin leg back, then lunges and fans a blinding cloud with the left mallet), **mallet drumroll**
(both mallets high, then alternating overhead smashes, right then left), **sidestep sweep** (a crabwise sidestep, then a flat
190° backhand sweep).

### The Pool Shark (`pool_shark`, Pendry pier pool deck)
A big grey-blue shark hustler. Silhouette: a heavy shark head with a long snout, white underjaw and a toothy grin, black shades and a
straw porkpie with a navy band; an open teal cabana shirt with a palm-and-hibiscus print (drawn on a 128² canvas: the one mapped
material) over a white belly, a gold chain, coral swim trunks, flip-flops; a dorsal fin up the back and a tail fin flat at the small
of it; a long pool cue (thin, no shadow). Attacks: **break shot** (bends over a bridge hand with the cue level, draws back and jabs:
`move: 1.5`), **cue sweep** (cocks the cue over the shoulder like a bat, then a flat 180° swing), **belly flop** (crouch, a leap with the
arms spread, and a face-down flop with the head turned: the splash ring). In the knock-down and the flop the cue lies back along the
arm, which keeps him inside the 2.6 culling sphere.

## Pier Boss Check 410
Canary heading (O6 brief, canary 1 of 3). Nothing follows it.
