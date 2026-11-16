# Palm City — build notes

An original top-down 2D open-city crime game for phones: walk, jack cars, drive the loop, earn
wanted stars, get chased, get busted, respawn at the police station. Everything (city, hero,
cars, name) is original.

Play: `games/palm-city/` · auto-play: `games/palm-city/?demo` · pin the light: `?t=0` (golden
hour) … `?t=1` (blue dusk) · static camera: `?cam=x,y`.

## The look and where it comes from

Golden hour sliding into dusk, painted. The look comes from four layers working as one lighting
system:

1. **Painted ground** (`src/ground.js`): no tiles. The world is painted at runtime in 256-unit
   chunks (512×512 px canvases, LRU-cached, ~40 max). Each chunk gets
   - a base colour per surface type (asphalt, sidewalk, paving, plaza, grass, sand, promenade,
     water), modulated by low-frequency fbm noise and a large warm/cool drift;
   - ~5,000 brush dabs, oriented per surface (along the road, across the sand, swirling on grass),
     seeded per *world* cell rather than per chunk, so dabs cross chunk edges with no seams;
   - painted details: curb lips + shadow lines, hand-painted lane dashes, crosswalks, oil, cracks,
     manholes, flowers, wet gutter patches, shoreline foam.
2. **Baked sprites from Blender** (`tools/bake_sprites.py`): cars, people, buildings and props are
   modelled in code and rendered **straight down, orthographic**, with the golden-hour sun baked
   in (sun azimuth 255°, elevation 30°, warm `(1.0, 0.74, 0.50)`, cool violet sky fill). Every
   asset gets up to three passes:
   - `color` — the object, transparent background, then a Kuwahara filter (paint) and an ink pass
     (soft plum outline + watercolour edge darkening);
   - `shadow` — Cycles shadow catcher only, object invisible → alpha = shadow density
     (normalised so a full cast shadow = 1);
   - `night` — sun off, black sky, emissive windows / lamps / neon / headlights lighting a ground
     plane → an additive light sprite, with the ambient floor removed and edges faded to black.
   Things that rotate are rendered at many angles so the baked light stays fixed in the world:
   cars 32 angles, people 16 angles × 3 stride poses.
3. **Shadow layer** (`src/render.js`): every shadow sprite in view is drawn into one view-sized
   layer, tinted deep violet with `source-in`, and multiplied onto the frame **once** — so
   overlapping shadows never double-darken. Its strength follows the sun (0.92 → 0.24).
4. **Grade + light layer**: a time-of-day multiply (warm cream → rose → blue-violet), a soft-light
   warm push while the sun is up, then an additive light layer: building night sprites (window
   spill, skylights, neon), lamp pools, neon reflections streaking on wet asphalt, headlight cones
   (rotated per car), police flashers — plus a two-step downsample bloom. Windows come on first
   (t 0.22–0.8), street lamps after (t 0.45–0.92). Last, a world-anchored brush-grain soft-light
   pass so sprites and ground share one painted surface, and a vignette.

The ocean is painted ground plus an animated layer: a sky-reflection gradient that drifts
gold → rose → violet, slow swell lines, ~1,400 twinkling glints, and a pulsing foam line.

### Phone rules followed
- Biggest offscreen canvas: the shadow and light layers, view-sized at DPR ≤ 2 (840×1720).
  Ground chunks 512². Largest baked sprite: the hotel shadow (≈ 810×400). Nothing ≥ 2048.
- No fallback render path. A missing/undecodable sprite, a missing manifest entry or a runtime
  error is shown on screen in red (`index.html` error banner) and `tools/shot.mjs` exits non-zero.

## v2 step 1 — paint pass

- **Roofs**: every flat roof gets a pastel deco palette (cream, mint, pink, peach, lilac, sky)
  chosen per block, a painted roof shader (brushed streaks via a stretched noise, low-frequency
  water stains, grit), worn stains, and taller parapets with a lighter coping lip that throws a
  shadow onto the roof.
- **Night light discipline**: lamp pools at 70 %, bloom alphas lowered (0.2 / 0.32) so streets
  don't white out. **Wet reflections**: every lamp and neon sign throws a broken, rippling vertical
  streak of its colour across the asphalt, fading with distance (`drawWetReflections`).
- **Ground**: sidewalks are cool cream with joints, plaza is laid pavers (running bond, odd tiles
  tinted), parking is dark asphalt with stalls, sand has wind ripples + shells, promenade has planks.
- **Vegetation**: 4 baked bush variants (different sizes, greens, flower colours) placed in seeded
  clusters of 1–4 at varied scale; palms vary in scale too.
- **Cars**: a glossy sun-glint panel on each roof so cars read at game zoom.
- **Life**: 40 pedestrians, 40 % of them on the promenade.

## v2 step 2 — skateboard (`src/skate.js`)

A board lies by the spawn (`layout.spawn.board`). Action button: **BOARD** (pick up, when it's at
your feet and nearer than any car) → **OLLIE** while rolling → **POP** off a grind → **DROP**
when nearly stopped.

- **Carve physics**: the stick turns the deck (3.4 rad/s grounded, 1.4 in the air); pushing only
  adds speed when the stick is roughly along the deck; velocity bends toward the deck heading and
  keeps most of its speed, so lines carry momentum. Grass and sand drag hard; water bails you.
- **Grinds**: land an ollie within 9 units of a rail (`layout.rails`: both promenade rails, the plaza
  edges) with the deck along it → locked grind that ticks points; or on the fountain rim
  (`layout.rims`) — the pool-edge grind. Pop out with the button.
- **Ollies**: bench ollies (`layout.benches`), curb hops (crossing the kerb line in the air),
  **hood ollies** (crossing a car in the air: +300, a **cop** car +900, and it kicks you higher).
  **Near-misses**: a fast car passing within ~16 units while you're grounded.
- **Bails**: a wall above 140 u/s, a bench or a car while grounded, water, or a cop grabbing you
  → on foot, 1.1 s stun, board skitters on, the combo is lost.
- **WANTED LINE**: every trick feeds one combo (points × multiplier, +1 per trick, max ×12) with a
  2.6 s fuse that pauses while you're grinding or in the air; it cashes out when the fuse burns
  down, and is labelled WANTED LINE while you have stars.
- **HOT ENTRY**: a cop-hood ollie that lands within 70 units of the motel door
  (`layout.motelDoor`) at 3+ stars sets `sim.hotEntry` (+1500) — the siege (step 3) reads it.
- `node tools/skate_check.mjs` — 9 headless rule checks (pickup, push, momentum, rail grind, combo,
  cop hood, near-miss, wall bail, drop).

## Feel pass (Nov 16 2026 — owner's phone notes)

Five fixes from hands-on play of the merged build. Rules are checked by `tools/feel_check.mjs`
(38 headless checks); captures are `shots/feel-before-*.png` / `shots/feel-after-*.png`.

1. **No player ring.** The yellow marker ring is gone in every mode.
2. **Bump physics** — nothing ghosts through people or palms.
   - *People.* On foot: walking nudges a pedestrian aside, running into one makes them stumble and
     costs you a beat (0.25 s at 35 % speed). Car: under 45 u/s a bumper shoves them stumbling and
     the car loses 20 %; faster is a knockdown (slide, lie, get up over the last half second, run)
     that sheds 12 % of the car's speed and feeds wanted exactly as before. Board: 25–110 u/s
     staggers them (you keep 75 %), faster knocks them down (you keep 55 %); an ollie clears them.
   - *Palms.* `world.trunks` (radius 5.5 × the palm's scale) are solid for walkers, the board —
     in the air too — and every car. A hit calls `sim.shakeTree`: the trunk jolts along the
     impact, the crown twists, leaves fall (`sim.leaves`), all dying away in about a second.
     Skater above 90 u/s bails and the board bounces back; a car stops dead (and crashes above 60).
   - Cosmetic randomness uses its own generator (`sim.fxr`) so effects never disturb the seeded run.
3. **Living water** (`Renderer.drawOcean` / `drawSurf`).
   - *Shoreline:* each wave runs up the sand fast (first 32 % of a 6.4 s cycle) and drains back
     slowly; the cycle travels down the beach, so different stretches are at different points.
     Scalloped foam lip, paler leading edge, lace left at the high-water mark, and a wet-sand band
     that darkens as the wave reaches it and dries until the next. Drawn as 5-unit strips.
   - *Open water:* two tileable 256 px brush-stroke sheets slide shoreward at different speeds
     over the painted sea; shore-parallel crest lines roll in and sharpen near the sand; glints.
   - Cost: the ground + ocean render section went from 0.4 ms to about 1.4 ms in headless Chrome's
     software rasteriser (`tools/profile.mjs`, 420×860 @2x) with the shore in view, and is skipped
     entirely when the sea is off screen. No new view-sized canvases. Not yet measured on a phone.
4. **Walkable pier, and the audit of things you expect to use.**
   - *Pier:* `world.onPier` makes the deck standable — walk or roll out to the very end. Side rails
     and an end rail hold you in (drawn with posts); the side rails grind; two people stroll it
     (`path.type === 'pier'`); cars cannot drive on it.
   - *Benches:* solid slats on foot (walk round); still an ollie target, and a wall for a slow board.
   - *Fountain basin, lifeguard towers:* solid for walkers, a grounded board and cars.
   - *Promenade and plaza rails:* low rails — on foot you hop them (a short vault and a beat of
     slowdown), so the beach stays one step away; still grindable.
   - *Loose board:* never rolls off into the sea or through a rail.
   - *Reads as scenery, on purpose:* bushes (walk through), lamp posts, the moored boats, roofs.
5. **Fight button.** A second round button left of the action button, shown on foot (`PUNCH`).
   One tap = one punch: snaps to whoever is roughly in front within reach, short lunge, hit flash.
   First hit staggers (most then run), a second — or one on someone already reeling — puts them
   down; they get up and run. Bystanders within 150 units run (60 %) or stop and stare. If a cop
   can see it (`sim.copSees`: a patrol or pursuit car within 300, or an officer on foot within
   240, with no building between) wanted goes up a star; punching an officer always does. One
   patrol car now cruises the loop so that can happen at zero stars, and it joins the chase when
   you become wanted nearby. On the board the same key/button is the ollie; in a car it does
   nothing. Desktop: **F / X / J**.

## Destruction pass (Nov 16 2026 — fable.md task 1, owner: "make everything more destructive")

One system, `src/destruct.js`, that everything breakable runs on (the base for step 5's
smash-throughs and step 7's WRECK IT!). Look: Gemini's spec `shots/DESTRUCTION-DELTA.md` and stage
sprites, installed as `assets/destruct/` with their own manifest `assets/destruct.json` (a Blender
re-bake of `manifest.json` never drops them).

- **Stages, never binary.** One damage number (0..1) per object; per-kind thresholds (cars
  0.25 / 0.60 / 1.0) map it to intact → scuffed/dented → cracked/bent → destroyed.
- **Hit by:** the fist (`PUNCH` on foot: a punch with no person in reach lands on the nearest
  breakable thing in front, with no lunge through it), car impacts scaled by speed
  (`impactDamage`: a slow nudge only scuffs, ~290 u/s crumples a car in one go), and a falling palm.
- **Cars:** dents on the struck panel (painted scuffs below 0.25), then the stage sprites: dented
  with cracked glass → bent chassis with dark hood smoke → crumpled smoking wreck with soot stain and
  an engine ember that glows at dusk, wheels and trim on the ground. Crash energy is shared by mass;
  the car you drive takes 60 %. A battered car is slower; a wreck is dead for the session (its
  driver bails — a cop chases on foot if you're wanted; yours won't drive; nobody can jack it).
- **Palms:** crack and lean away from the blows, crack deeper, then snap: fall away from the hit
  (0.55 s, crown sweeping out from a split stump), land with a thud, crush what's under them (cars,
  people, bushes, props), and lie there as a log (hop it on foot, cars bump over). Cars crack a palm
  from ~160 u/s and snap it from ~210, then plough on.
- **Bushes:** now shared world data (`World.buildBushes`, the same seeded 141). Leaves and petals
  burst clear of the canopy; sheared → flattened (spread, bruised, tyre tracks if a car did it) →
  torn out (root pit). Cars plough through, scaled by speed; still walk-through.
- **Benches:** crack → snap in half → plank pile (stops blocking and counting for bench ollies).
  **Street lamps:** skew and flicker → bend → down (light pool and wet reflection go dead).
  **Lifeguard towers:** skew → roof caved → plank pile. **Rails** (the fence line), a ~64-unit
  section at a time: bent → snapped → scrap; a section bent past 0.6 can't be grinded, a snapped one
  isn't hopped. Solid props stop a slow car and break under a fast one, which carries on.
- **Debris and smoke** come from fixed pools (180 / 56 slots, allocated once; the oldest slot is
  reused), so no per-hit allocation and a hard cap. Debris slides, settles and stays; broken objects
  themselves stay broken for the session.
- **Score and wanted:** player-caused breakage scores (popups like `TIMBER +500`); in view of a cop
  it's a star (2.5 s cooldown); in a witness's view they run or stare, and three reports are a star.
- `node tools/destruct_check.mjs` — 51 headless rule checks. `node tools/destruct_shots.mjs
  <before|after> [scene]` — staged action captures through the real input path (keyboard driving,
  touch fight button) → `shots/destruct-<before|after>-<scene>.png` (before = clean main).

## Layout (`layout.json`)

1 world unit = 10 cm. World 1800 × 2200. One drivable loop (rounded rectangle, 96 wide) with three
cross streets making five blocks inside, a villa strip to the west, a promenade + beach + ocean to
the east, and a pier with moored boats. Building footprints, palms, lamps, neon puddles, props and
spawn points live here and are read by **both** the game and the Blender baker.

## Game (`src/`)

| file | what |
| --- | --- |
| `main.js` | boot, DPR-aware view sizing (420 wide, height follows the phone), fixed 60 Hz sim step, camera with lead + speed zoom, time of day |
| `world.js` | layout queries: surface type, road distance/direction, solids, loop path + lane offsets |
| `ground.js` | painted ground chunks |
| `assets.js` | loads `assets/manifest.json` + every sprite; hard error on failure |
| `render.js` | the lighting system above |
| `sim.js` | player on foot / in car, arcade car physics, traffic AI on the loop, pedestrians on the sidewalks/promenade (flee, get knocked down), police (spawn behind you, follow the loop, ram, cops jump out for foot chases), wanted stars (jack +1, cop car +2, hit ped +1, ram police +1; lose a star per 14 s out of sight), busted + respawn |
| `input.js` | floating joystick (left half, base follows the thumb), round action button bottom-right, fight button beside it (on foot), keyboard for desktop |
| `hud.js` | stars, clock (6:38 → 7:48 PM), messages, BUSTED card + fade, controls |
| `audio.js` | WebAudio only: engine (detuned saws through a speed-driven lowpass), city hum + ocean swell (brown noise), siren, jack/door thunk, crash, star ping, busted sting |
| `demo.js` | `?demo` autopilot that drives the real input path: walk to a parked convertible, jack it, drive north along the ocean and round the loop (weaving round traffic), pull over, get boxed in, busted, respawn — then it restarts |

Touch controls on foot: the stick direction is where you walk (run past 65 %). In a car: point
the stick where you want to go — the car steers toward it, throttle = stick distance; pull the
stick opposite your heading at low speed to reverse. Action button: JACK near a car, EXIT when
slow. Fight button (on foot): PUNCH. Keyboard: arrows/WASD, Space/E for action, F/X/J to punch.

## Scripts

All run from `games/palm-city/`:

| command | does |
| --- | --- |
| `blender -b -P tools/bake_sprites.py -- all` | re-bakes every sprite + `assets/manifest.json` (~12 min on an M4; GPU/Metal) |
| `blender -b -P tools/bake_sprites.py -- buildings hotel` | one group / one asset (`cars`, `peds`, `buildings`, `props`); `--quick` for low samples |
| `node tools/sim_run.mjs 34` | runs the real sim + demo autopilot headless; exits 0 only if the demo jacks a car and gets busted |
| `node tools/shot.mjs out.png "demo" --seq 8 --every 4000` | phone-size (420×860, touch, iPhone-like) screenshots in real Chrome; non-zero exit on any page error |
| `node tools/touch_check.mjs [prefix]` | drives the controls with real CDP touch events: fight button punch → joystick walk → button jack → stick drive → button exit |
| `node tools/feel_check.mjs` | 38 headless rule checks for the feel pass: bumps (people, palms), the pier and other interactables, the punch |
| `node tools/feel_shots.mjs [pier bump punch]` | staged phone-size captures of those, driven through the real touch path → `shots/feel-after-*.png` |
| `node tools/profile.mjs` | CPU ms per render section (`?prof`) and per ground-chunk paint |
| `cd tools && npm install` | installs `playwright-core` for the browser tools (they use the system Chrome, or the binary named by the `CHROME` env var) |

`tools/reference_frames.jpg` is the art-direction anchor the screenshots were judged against.

## Status against the reference frames (honest read, Nov 15 2026)

`shots/compare.jpg` puts the reference sheet next to four 420×860 captures (golden hour, mid,
dusk, demo at 15 s). Where it matches: violet painted streets, warm low sun with long cast
shadows from towers and palms, neon spilling and streaking on wet asphalt, warm window spill and
glowing glass roofs at dusk, headlight cones. Where it does **not** yet match:

- **Brushwork is too timid.** The references are dense, swirling, saturated paint; ours reads as
  soft gouache. Next: bigger, curl-following dabs on the ground and a stronger stroke pass on the
  sprites (Kuwahara r=3 + oriented strokes), skies-in-puddles swirls.
- **Roofs are the weakest asset.** Straight-down roofs carry little story; they need richer
  rooftop dressing (gardens, laundry lines, tiled terraces, rooftop signage) and more colour
  variety between buildings.
- **Dusk is hazy rather than deep.** The references get their punch from near-black blues against
  hot yellow windows; our dusk grade is still too grey-lavender.
- Not yet verified on a physical iPhone. Headless Chrome composites canvas in software, so its
  frame times (50–80 ms) are not representative; CPU work is ~2 ms/frame + one 6–13 ms
  ground-chunk paint when streaming (M4).

## Motel Siege (v2 step 3)

Walk up to the motel door (layout `motelDoor`) on foot: the action button reads **ENTER**. The
game cuts (0.35 s) to a side-view cutaway of the motel's three floors.

**Play.** Joystick left/right walks; up/down at a stair foot/head or the ladder takes it (or the
action button: UP / DOWN / CLIMB). Fight button punches cops (2 hits, SWAT 3; they get back up)
and springs traps. Action: PUSH a barricade into its choke point, PRY the roof hatch (or two
punches), LEAP off the balcony rail. Cops whose hands are on you fill a red ring; full ring =
BUSTED (normal respawn). Escape = hatch → roof → off the east edge onto the fire escape → down the
flight → LEAP: you land on your board in the east alley rolling out at 210 u/s, +1500 (+100 per
KO), one star shed.

**Escalation** (siege.js `WAVE_T`, starting wave from your stars): 3 s two cops through the lobby;
18 s the pool doors smash, three more (both sides); 33 s an extension ladder onto the balcony;
53 s SWAT rappel onto the roof under the chopper's spotlight; then a pair every 13 s. Stars climb
with the waves.

**Barricades** (desk, mattress, dresser) slide into the lobby door / stair heads; cops stop and
slam them (one slam / 1.5 s each; desk 3, mattress 3, dresser 4). **Traps**: vending machine
tips onto the cops in its fall zone (+300 each, then blocks for 3 s of bashing); CRT TV flies off
the dresser and stuns 1.6 m around where it lands (+250 each); linen cart bowls the corridor
(+200 each); fuse box blacks out the top floor 2.5 s and stuns within 1.8 m; window AC drops
three storeys onto the street (+500, KOs below, caves in the cruiser).

**Code.** `src/siege.js` (sim; metres, building-local; surfaces F0/F1/F2/R/E2 joined by stair,
ladder and fire-escape links, BFS routing for the cops), `src/siege_render.js` (camera 34 units/m,
street line at 76%), hooks in `sim.js` (`nearMotelDoor`, `P.mode === 'siege'`, wanted logic
paused while inside), `main.js` (render switch), `hud.js` (labels), `assets.js` (`siege.json`).
Geometry is shared with the baker through `layout.json` → `siege`.

**Art.** `tools/bake_side.py` (Blender or pip `bpy` 5.x: `python3 tools/bake_side.py -- all`)
bakes, with the street sprites' own models, Cycles light, Kuwahara paint and plum ink:
side-view sheets for the player, cop and SWAT (14 poses: 6-frame walk, idle, wind-up, punch,
2 climb, hurt, down, jump) and the whole cutaway (`motel_color` + additive `motel_night`) at
68 px/m; the `props` group runs Gemini's barricade/trap sprites (shots/siege-sprites) through the
same paint filter. Render order: sky → cutaway → the real painted road south of the motel,
squashed into the foreground with the cruisers on it → the day grade (multiply) → the night light
layer → props and people from copies pre-multiplied by the grade (so the light never washes
them out) → siren washes, neon glow, spotlight → vignette.

**Checks.** `node tools/siege_check.mjs` (28 rule checks through the real input object: entry,
barricade + bashing, every trap, hatch/ladder, cops routing up two flights, the full escape to
the board, the arrest, the wave schedule). Captures: `node tools/siege_shots.mjs [scene]` →
shots/siege-{door,lobby,vend,tv,ac,roof,escape}.png, entered by a real touch on ENTER.

**Below the bar / still needs:** owner play on a phone (captures are staged headless runs);
Gemini's props are still flatter than the baked cutaway even after the paint filter; the
foreground cruisers are top-down sprites squashed into the street (no side-view car bake) and
there's no chopper body, only its spotlight; the cop's grab reuses the punch pose.

## Sky + Street Pressure (v2 step 4)

**Chopper** (`src/pressure.js`, 3★+): flies in, holds station up-left of its beam. The beam's
ground pool (r 70) slews at a capped speed — 120/175/225 u/s at 3/4/5★ — on a figure-8 around
where it last saw you (3★) or leading your velocity (4–5★). In the pool you're *seen*: the heat
timer can't run down. A car at speed outruns the 3★ beam; inside the motel it leaves. Render:
altitude shadow (shadow pass), body ×1.7 + spinning rotor above the roofs, and in the additive
light layer a feathered cone, pool and 170 hashed dust motes (champagne by day, ice-cyan after
dusk). Rotor thump + lock beep in `audio.js`.

**Street** (4★+, driving): `spawnRoadblock` picks a straight stretch 500–800 units ahead on the
loop: two cruisers nosed into a V (the second is the SWAT van at 5★), two sawhorses in the
kerb-side gap, a spike strip on the approach. Sawhorses shatter above 130 u/s (−8% speed, +60,
zoom-punch) and stop you short below it. Spikes blow any car's tyres (cops too): 150 u/s limp
and a fighting wheel. Edge grade at 4–5★: amber rim by day, alternating red/blue washes at dusk.

**2D camera feel** (`main.js` → `cam.kick`, `cam.roll`, applied in `render.js` worldTf only —
HUD, grade and light composite stay level): zoom-punch ×1.06 on wrecks / hood landings / felled
palms / smashed barricades; roll clamped to ±1.5° from yaw rate × speed, with ×1.055 overscan
while tilted so corners never show. At 4–5★ a wreck or barricade smash also buys ~0.4 s at 0.35×.

**Auto-director** (`src/director.js`): records the run as seed + per-step input log + weighted
event marks. When BUSTED fades out it picks the best 20 s window (max summed weight), builds a
fresh sim from the seed, fast-forwards the log to the window (2400 steps/frame) and plays it
letterboxed with its own camera — cuts between follow / wide / tight-lead shots every 3.5–5 s,
0.35× around the single heaviest mark. Any touch skips. Off under `?t=`/`?cam=`/`?nodirector`;
`?demo&highlight` shows the demo run's highlight.

**Tools.** `node tools/import_pressure.mjs` (Gemini's shots/pressure-sprites → assets/pressure/ +
pressure.json); `node tools/pressure_check.mjs` (15 rules); `node tools/director_check.mjs`
(10 rules, incl. re-simulation landing on exactly the live state); captures
`node tools/pressure_shots.mjs <before|after> [scene]` → shots/pressure-*-{chopper,roadblock}-
{golden,dusk}.png and `node tools/director_shots.mjs` → shots/director-{cut,slowmo}.png.

**Below the bar / still needs:** owner play on a phone; no SWAT officers on foot at the block
(the top-down SWAT sheets exist in shots/siege-sprites, not yet wired); the roadblock capture
is staged on a bend (the live trigger only uses straights); the replay uses the current time of
day, not the time the moment happened; input logs grow for the whole session (a very long run
makes the fast-forward longer); smash-through café fences/crates/tables from the spec are not
placed — sawhorses are the only new smashable.

## Jobs Board (v2 step 5)

`src/jobs.js`, one job slot (`sim.job`). Jobs start from their marked vehicle — taxi (816,1000),
getaway van (640,836), tow truck and bus at the Garage kerb (860/1010,1456): get in and the
fight button becomes the **job button** (cyan `$`): START, then HOOK / UNHOOK / SLING (tow),
DECOY / BAIL (getaway). EXIT stays on the action button; getting out, BUSTED, a wreck or the
clock ends the job. HUD: job card (title, clock, objective, mood / dwell / cable-tension bar)
and an arrow + distance to the target; the target wears a pulsing cyan halo. All job points are
kerb-side on the road grid (`PLACES`) — the spec's coordinates were up to 230 units off-road.

- **TAXI** — fare at a landmark → drop at another. Three moods: Speed Freak (+ above 220 u/s,
  − below 80), VIP (+ cruising, −18 per crash), Chaos Tourist (+15 per hit/score, decays).
  Pay (150 + distance) ×2 if mood ≥ 80, × streak (to ×5). Mood 0: fare bails. At ≥3★ 35% of
  fares are feds: cover blown after 5–8 s → 4★, wheel jitter, stop 1.5 s = BUSTED; over 260 then
  under 110 within 1.2 s throws them (FED SHOOK +600). Roof sign shows free / fare / panic / fed.
- **TOW** — HOOK a marked car within cable reach of the boom. Payload is a body on a spring-damper
  cable (rest 44, max 74, k 28): it trails, whips on turns and hits at 2.2× — cars (+250 a
  cruiser, 400 slung), people, palms (through the task-1 damage calls). SLING above 140 u/s
  releases it with the truck's velocity. Two over-tensions within 5 s snap the cable. Payload on
  the Garage apron with the truck slow: +400, next contract (4 rotating targets).
- **BUS** — six stops (SOLANA → TACOS → PLAZA → PIER → NOVA → GARAGE); under 35 u/s in the halo
  for 1.8 s boards the riders (+120), pulling out early pays 60; full loop +500, +200 under 75 s;
  splits tighten per lap (36/30/24 s). The bus is heavy: 235 top speed, 72% steering.
- **GETAWAY** — to the OFFICE kerb, 1.5 s for the crew: alarm, ≥3★, a spike strip ahead. DECOY
  (3) throws bills: cruisers within 160 brake for 3 s (+200 each). Safe house (1232,1350): +1000,
  −2★. Spiked or battered within 350 of it and slow: BAIL puts you and the crew on the board
  (crewmate drawn behind you) — skate in for +400.

Sprites: Gemini's, `node tools/import_jobs.mjs` (shots/jobs-sprites → assets/jobs/ + jobs.json;
bus and tow truck join `M.cars`, fares join `M.peds`). Checks: `node tools/jobs_check.mjs`
(36 rules). Captures: `node tools/jobs_shots.mjs` → shots/jobs-{taxi-pickup,taxi-fed,tow-swing,
bus-stop,getaway-decoy}.png (job started by a real touch on the job button).

**Below the bar / still needs:** owner play; no kiosk board (jobs start from the vehicles only);
tow contracts 3+ are parked cars, not the spec's live cruiser / courier van; bus laps don't add
double-parked vans or rush-hour traffic; getaway has one difficulty tier and the crew are drawn
only at pickup and on the board; fares/riders are drawn, not simulated pedestrians; vox_* hooks
fire but play nothing until task 8.

## City map (task 5B)

MAP button under the wanted stars (canvas HUD, 58×28 at top-right — clear of the stick's left
half and the bottom buttons; `M` on a keyboard). `src/map.js` paints the whole city from
layout.json: every pixel's surface from `world.surfaceAt` in a painted palette with brush
variation, buildings in roof colours with the plum ink line, palms, the pier — built once on
first open. Labels: SOLANA, TACOS, DINER, NOVA, MOTEL (a pink dot on `motelDoor`, the siege
entrance), GARAGE, POLICE, PIER, BEACH, SKATE PARK; cyan dots for the job vehicles and the active
job/event target; police cars blink when you're wanted. The player is a gold arrow (position +
facing). **The map is LIVE**: the game keeps running under it and the stick still moves you.
`CHROME=… node tools/map_check.mjs`: 26 rules — POIs present and inside the frame, the marker
tracking a scripted walk, and in the real page a touch opening it, a live walk under it, a touch
closing it — and writes shots/map-{spawn,motel}.png.

## 7D — the A button is TURBO in a car (Nov 16 2026)

`src/controls.js` is the one place that decides what the smaller round button (A) is: `buttonA(sim)`
returns PUNCH on foot and in the siege; in a car the armed job or event action if there is one
(START TAXI, HOOK, DECOY…), otherwise TURBO; nothing in a wreck or on the board. The HUD, the touch
layer (`input.fightOn`) and the checks all read it, so the button can never show a dead action.
The big button (B) is unchanged in a car: EXIT below 60 u/s.

Turbo is hold-to-boost (`stepTurbo`): top speed ×1.4 (290 → 405 u/s) and acceleration ×1.6 while
held, eased in over 0.2 s and back out over ~0.6 s so speed never snaps. Limit, to keep chases a
contest: 3 s of boost, then a 2 s lockout (the button reads COOLING); letting go early recovers at
the same rate. There is no separate meter — the ring round the button burns down and refills. The
press has to start on TURBO, so the tap that starts a job does not also fire the boost. Sold by:
engine note up 32 % with the filter opened, a whoosh, painted speed streaks and a tail glow under
the car (`render.js`), a camera kick and 5 % extra zoom-out. Bust rules untouched. Keyboard: hold
F / X / J.

Proof: `node tools/turbo_check.mjs` (13 rules: label flips on enter/exit through the real action
button, job action wins, wreck shows nothing, 289 → 405 u/s, burn/lockout/recovery, no snap);
`CHROME=… node tools/turbo_shots.mjs` → `shots/turbo-foot-punch.png`, `shots/turbo-car-turbo.png`
(A held with a real touch). `sh tools/check_all.sh` runs every check in one go.

## 7E — skid marks (Nov 16 2026)

One system, `src/skid.js`, in two halves.

**Sim half (headless).** `slipOf()` decides how hard the tyres are slipping from what the car is
actually doing: cornering load (speed × yaw rate above 430 u/s², all four tyres above 600), hard
braking above 90 u/s (all four), a hard launch (throttle > 0.7 below 70 u/s), a burnout / donut
(full lock under power between 12 and 130 u/s), and soft ground (sand, grass) above 60 u/s. Calm
straight driving — at any speed — returns 0. `layMarks()` runs from `Sim.driveCar` for the player
and for police cars: it remembers each wheel's last position on the car and writes one segment per
slipping wheel per step into a fixed ring of 2048 segments (`sim.skid.buf`, a Float32Array;
x0,y0,x1,y1,width,strength,surface), so marks follow the car's real path. A coarse coverage grid
(8-unit cells) is kept alongside for the checks.

**Render half.** `TrackLayer` owns a fixed pool of **24 tiles of 256×256 px** (1 px per world unit,
6.3 MB total, least-recently-touched tile reused). Each new segment is stamped ONCE as a wide soft
pass under a darker core — dark rubber on pavement, carved brown ruts with a pale lip on sand,
dirt on grass. Per frame the layer only blits the tiles in view, right after the ground and before
shadows, so marks sit under cars, people and their shadows. One tile is faded 3.5 % every 0.12 s in
rotation (each tile every ~2.9 s), so a mark is down to about a quarter after two minutes. A new
run starts with clean ground.

Cost: the ground + ocean + tracks section measured 0.73 → 0.86 ms in `tools/profile.mjs` (headless
software raster, 420×860 @2x). No per-frame allocation: segments and tiles are both fixed pools.

Proof: `node tools/skid_check.mjs` (10 rules — donut ring with all 12 directions covered and a
hollow middle, drift marks that turn with the car, zero marks in 10 s of straight driving up to
289 u/s, short launch marks, four-tyre braking, sand ruts, both caps).
`CHROME=… node tools/skid_shots.mjs [donut drift sand]` → `shots/skid-*.png`, driven with the
keyboard in the real page.

## 7F — activity indicators (Nov 16 2026)

`src/activities.js` is the one registry of things to do: `initActivities(sim)` builds
`sim.activities` — MOTEL SIEGE, TAXI, TOW, BUS, GETAWAY, WRECK IT!, VALET, plus the Garage's JOBS
signpost (group `hub`: a marker, not a startable row). Each entry carries `name`, `tag`, a one-line
`how`, `live()` and `pos()`. Adding an activity is one more entry there; markers, map and (7G) HELP
pick it up.

- **Street markers** (`Renderer.drawActivityMarkers`): one painted language — cream plaque, plum ink
  line, a colour band per kind, a stem down to the thing, a gentle bob. World-anchored, no HUD
  furniture. Job tags ride on the parked vehicle and step aside while you drive it or work the job;
  event tags sit over the existing rings and hide while an event runs. After dark each plaque
  carries its own glow in the light layer.
- **Motel door** (`Renderer.drawMotelDoor`): warm glow spilling from the doorway and chevrons
  marching into it on the pavement, so it reads ENTERABLE from the street. The ENTER prompt is
  unchanged (the confirmation).
- **Map**: `mapPOIs` takes its motel, job and event POIs from the same registry.

Note: the brief says the four job vehicles sit at the Garage kerb. In the game as built only the
tow truck and the bus do; the taxi and the getaway van are parked on the cross streets (jobs.js),
and their tags follow them there.

Proof: `node tools/activities_check.mjs` (27 rules — a marker, how-to and map POI for all seven);
`CHROME=… node tools/activity_shots.mjs [motel motel-dusk garage events]` → `shots/activity-*.png`,
keyboard-driven, frozen on the exact step the car passes.

## 7G — HELP button, start page, JUMP (Nov 16 2026)

`src/help.js` draws one panel in two dresses, both generated from `helpRows(sim)` (the 7F
registry): icon + name + one how-to line + a **JUMP** button per activity.

- **Start page** — up on load (title, the seven rows, a big PLAY button). The game is paused and
  dimmed behind it. Skipped for `?demo` and for staged captures (`?t=`, `?cam=`, `?prof`,
  `?nostart`).
- **HELP** — a `?` button top-left under the clock (`Input.helpBtn`, key H or `/`) opens the same
  rows plus a four-line controls recap. It pauses the game; BACK TO THE GAME, a tap outside, or Esc
  closes it.
- **Pause** is the main loop not stepping the sim while a panel is up (`panelMode()` in main.js);
  while it is up `input.panelTap` owns every touch, so nothing leaks into the game.
- **JUMP** (`jump(sim, id)` in activities.js) ends whatever is running exactly as getting out would
  (`quitJob`, `quitEvent`, dismount), then: MOTEL SIEGE → on foot at the door, ENTER armed; TAXI /
  TOW / BUS / GETAWAY → seated in that vehicle, START armed; WRECK IT! / VALET → in a car on the
  ring, START armed (your own car if you are in one, else the nearest that runs). Free: no score,
  no stars. The camera cuts. A jump is delivered to the sim as an input field (`inp.jump`) and
  recorded by the director, so highlight re-sims stay exact. Refused mid-siege and while busted.
- **Not-yet-startable rows**: a row whose `live()` is false right now (its vehicle is wrecked, a job
  or event is already running) stays listed but dimmed with BUSY instead of JUMP. Every registered
  activity is live in this build, so nothing is listed that cannot be started.
- `helpLayout()` is a pure function shared by drawing and hit-testing; rows shrink (54 → 40 px) to
  fit a 640-tall phone.

Proof: `node tools/help_check.mjs` (35 rules: rows = registry, layout fits 420×860 and 420×640,
tap resolution, every JUMP lands armed and free and starts with one press of A, a jump ends a
running job, refused mid-siege, a run with a jump re-simulates identically).
`CHROME=… node tools/help_shots.mjs` drives it with real touches and asserts pause / PLAY / ? /
JUMP in the page → `shots/help-start-page.png`, `help-panel.png`, `help-jump-tow.png`.
`tools/touch_check.mjs` now taps PLAY first, as a player must.

## 7H — BOARD CHASE (Nov 16 2026)

A third city event, on the skateboard (`src/chase.js`). It reuses the existing board and its
physics unchanged, runs in the same `sim.event` slot as WRECK IT! and VALET, and pays through the
same `pay()` / result card.

- **Start**: a green ring + BOARD CHASE plaque on the promenade at the foot of the pier
  (`CHASE.site`, 1296,1035). On the board there, the A button reads START BOARD CHASE
  (`buttonA` → `chaseArmed`); pressing it starts the event instead of an ollie. Registered in the
  activity registry, so it is on the map and has a HELP / start-page row whose JUMP puts you on the
  board at the marker with START armed.
- **Play**: the wanted level goes straight to three stars. Checkpoints in order — PLAZA → NOVA →
  VILLAS → SAFEHOUSE, the game's own named places (jobs.js `PLACES` and `SAFEHOUSE`). Each one fills
  a quarter of the escape meter, pays 400, and re-points the lit ring, the HUD card and the arrow.
  Out-of-order checkpoints do not count. 2:30 on the clock.
- **Win**: the safehouse with the meter full (1200 + 15 per second under 100 s; the heat drops to
  zero), or shaking the cops entirely before that (800).
- **Bust**: the 7C on-foot rule, unchanged — the meter only fills while the rider is not moving at
  arrest range (1.5 s). One change to make "moving play never busts" true on a board: officers on
  foot now only grab a board below 45 u/s; a faster board shoulders past (the officer stumbles, you
  lose 10 % speed). Before, any touch pulled you off.

Proof: `node tools/chase_check.mjs` (16 rules: starts from the marker with A; ordered checkpoints
at 25 % each; win at the safehouse with exact score; win by shaking; a pinned board busted in
1.53 s; 10 s moving alongside an officer with the meter at 0 and the rider never pulled off).
`CHROME=… node tools/chase_shots.mjs` → `shots/chase-start.png`, `shots/chase-mid.png`.

