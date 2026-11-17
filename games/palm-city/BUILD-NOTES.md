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

## 7B — the siege bake-off pick is live (Nov 16 2026)

The owner picked Gemini's AFTER interiors. `node tools/siege_pick.mjs after` copied the eight
sheets in `shots/siege-interiors-bakeoff/after/` over the files of the same name in
`assets/siege/` — `motel_color.webp`, `motel_night.webp` (both 1664×1105), `barricade_desk_intact`,
`barricade_desk_damaged`, `barricade_dresser`, `barricade_mattress`, `prop_roof_hatch_closed`,
`prop_roof_hatch_open`. A filename-level swap: `assets/siege.json`, the character and trap sheets
and all code are untouched. `prop_ext_ladder` and `prop_neon_motel_sign` had no AFTER candidate and
stay as shipped. The script refuses any sheet whose pixel size differs from the live one, because
the cutaway's geometry is pixel-locked to these sheets.

Revert: `node tools/siege_pick.mjs before` (the shipped originals are kept byte-identical in
`shots/siege-interiors-bakeoff/before/`). `node tools/siege_pick.mjs status` shows which set each
live file matches. Round 2 (the character overhaul) may change frame counts: that needs
`assets/siege.json` updated to its SIEGE-OVERHAUL.md layout as well as the files dropped in.

Proof: `node tools/siege_check.mjs` green on the new sheets;
`CHROME=… node tools/siege_pick_shots.mjs <label>` → `shots/siege-pick-{before,after}-{golden,dusk}.png`
(entered through the JUMP + a real touch on ENTER, t = 0.25 and 0.68).


## Watercraft — jetski, cigarette boat, police boat (`src/watercraft.js`, Nov 16 2026)

The fourth way to move, skateboard-scoped: ONE module, moored at the pier's south side (clear
of the three boats baked into the pier sprite — those are scenery and solid; their centres are
in the module as `BAKED_BOATS`, read off `assets/pier.webp`). Walk the deck, action button hops
on (nearest-thing wins in `stepPlayerFoot`, after the board); ride out; action again alongside
the pier at low speed hops off onto the deck. On a craft the A button is **TURBO** — the same
`stepTurbo` hold-to-boost as a car (`controls.buttonA` returns `turbo` in the new `water` mode;
the HUD gauge reads the craft).

Physics is heading + velocity with drift: thrust along the heading, the velocity vector bends
toward it at each craft's carve rate, drag makes terminal = top speed. The **jetski** (30×14,
top 240) carves (carve 5.5, turn 3.3 — r≈66); the **cigarette boat** (76×18, top 400) winds up
slowly and slides wide (carve 1.7, turn 1.45 — r≈250). Hulls stay on the water: land, the pier
deck and the world edge are hard stops (axis-slide, bump + speed loss); round things (baked
boats, the other craft) push the centre out radially, speed cost once per contact — per-frame
damping grinds a hull to a stop against a circle, and axis-sliding alone wedges in a circle's
margin (both learned from the checks).

The spray is the headline: painted foam dabs (the shoreline palette — foam white, aqua) thrown
off the stern with an arc (z + gravity, drawn raised), spreading and fading; rate and height
scale with speed, double on turbo. The boats' plume reaches ~3× the jetski's height — the
rooster tail. Three buoys float out in the bay to round. Craft are drawn in the colour pass
(canvas-painted hulls: shading, stripe, cockpit, ink outline — no baked sprite) before the peds,
so the rider stands on the deck.

The **police boat** (white hull, blue stripe, strobing light bar) is AI on the same physics:
it spawns along the bay from your side of the pier when you're on the water at **2+ stars**,
top speed 470 — above the cigarette boat's cruise (400), below its turbo top (560), so a held
turbo is a clean getaway and anything sloppier gets run down. It steers at your predicted
position, eases off alongside, and shoulders you on contact. Stay within 64 units at matched
speed and the shared `sim.bustT` meter fills on the car timing (2.8 s — `stepWanted` leaves
the meter to this module in `water` mode) → the ordinary busted flow, respawn on foot at the
station. Step ashore (or cool below 2 stars) and it breaks off east and despawns; land cops
are the land system's job. Anti-wedge: full throttle and no motion for 0.8 s = pressed against
the pier or a hull, so it breaks east into open water and comes again. Follow-up owed: engine
sound (skipped by design — no new synth; sea ambience carries the sample).

Proof: `node tools/watercraft_check.mjs` (in `check_all.sh`) — mounts, speed, turbo, turning
radii, a 60 s random run that never leaves the water, dismount, cop spawn/close/bust/break-off.
Shots: `node tools/watercraft_shots.mjs` → `shots/water-{moored,jetski,boat,cop}.png`.

## 7I — SPOTLIGHT RAVE (Nov 16 2026, owner mini-game slate)

A score-attack event in the same `sim.event` slot as WRECK IT!/VALET/BOARD CHASE. Verb:
STAY IN THE LIGHT — drift and stunt inside the police chopper's searchlight beam while a
crowd watches from the verges. All heat machinery is the REAL pressure system; the event
only pins the wanted level and reads the beam back out of `sim.chopper`.

**Files.** New: `src/spotlight.js` (the whole event: tuning table `SPOT`, `startSpot`,
`stepSpot`, `endSpot`), `tools/spotlight_check.mjs`, `tools/spotlight_shots.mjs`. Edited:
`src/events.js` (registry row `spot: { name: 'SPOTLIGHT RAVE', site: [1000, 560], time: 120 }`
— key order in `EVENTS` is the registry/`eventSites` order, so spot sits after valet;
`eventStats.spot`; a `kind === 'spot'` branch in `startEvent`, in the `stepEvents` dispatch,
in the busted branch (before the generic bust line, after BOARD CHASE's own line — the
event writes its own fail card `BUSTED` + `vox_evt_spot_busted`), and an `endSpot` cleanup
call in `endEvent` beside the wreck-anchor sweep), `src/activities.js` (`EVENT_HOW.spot`,
plus the tag/colour lookups factored out of the event row: `EVENT_TAG`/`EVENT_COL` — wreck
`#ff7a4a`, valet `#6ee2ff`, spot `#ffe95c`; tag `SPOTLIGHT`), `src/sim.js` (one new ped path
type, below), `src/events_render.js` (idle beacon colour for spot; the beam-pool stage ring;
the HYPE HUD card; a result-card third line), `src/director.js` (`rave: 3.5` in the WEIGHT
table). Registry-contract fallout, updated to match: `tools/activities_check.mjs` and
`tools/help_check.mjs` WANT lists gain `'spot'`; `tools/events_check.mjs` now expects three
ring events (`spot,valet,wreck`); `tools/check_all.sh` runs `spotlight_check.mjs`.

**The stage.** The start ring is at [1000, 560] — plaza paving 90 units south of the
fountain (a solid grind rim at [1000, 470], r ≈ 30: never stage anything on it). The ring
is on open plaza (surface probe: road-distance 200, no solid within ~70), with the plaza
rect x 700–1128, y 392–728 around it. Starting works like every event: the generic
`eventButton` (within 70 of the site, |v| < 140) arms `START SPOTLIGHT RAVE`; JUMP seats
the player in the nearest car at the site first. `startEvent` builds the shared ev template;
`startSpot` fills the rave fields and sets the wanted level DIRECTLY (`sim.stars = 3`,
`sim.lostT = 0`, one `star` fx event) — assignment, not `addStars`, because the pin is
re-asserted every tick (below) and addStars' decay bookkeeping fights it.

**Heat = tiers.** `ev.floor = 2 + tier` (3/4/5). Every `stepSpot` tick, before anything
else: if `sim.stars < ev.floor`, set stars to the floor and reset `lostT`. That one rule
drives all of pressure.js untouched: the chopper spawns at 3★, `stepWanted` targets
min(4, stars+1) cruisers — capped at 4, so tier-ups ALSO call `spawnBackup` (the stepWanted
spawn recipe verbatim: anchor at `sim.playerS` or `loopNearest`, one block back, placed
with `loopAt(s, 23·dir)`, ≥ 380 from the player, no car within 60, `addCar(..., 'police',
'police', { s, dir })`, v = 160, `siren` fx) to grow the fleet past the cap. Beam behaviour
comes from pressure.js's own star table: SLEW [120, 175, 225] at 3/4/5★ — tier 2 (hype ≥ 34)
gets slew 175, tier 3 (hype ≥ 67) gets slew 225 AND velocity lead, because at 5★ the beam
leads the player (`lead 0.55`) instead of searching a figure-8. Star decay can't undercut
the rave: in-beam the chopper's `lock` refreshes `seenT` every tick, and the floor catches
any out-of-beam decay after 22 s unseen.

**Scoring.** HYPE is 0–100 and is the score's spine. Per tick, in-beam only
(`ev.inBeam = chopper && chopper.lock && !chopper.leaving` — lock is pressure's own
inside-the-pool test, pool radius 70):
- score feed: `max(0, sim.score − ev.lastScore) × 0.04` — any points the base game awards
  (drift banks, destruction popups, trick lines) feed hype; the snapshot is taken at the
  END of the tick after the event's own pays, so the event never double-counts itself.
- drift: yaw rate from the car's heading delta; lateral slip `lat = |v · yaw|` against
  skid.js's own 430 mark threshold — `slip = lat > 430 ? min(1, 0.35 + (lat−430)/300) :
  (|yaw| > 1.7 && 14 < |v| < 170) ? 0.9 : 0` (the second clause is a held donut: full-lock
  yaw at parking-lot speed, where lat stays under the mark threshold); hype += 8·slip·dt.
- turbo: `c.turbo > 0.3 && |v| > 120` → 2.5/s.
- near-miss: no car near-miss scoring exists in the base game (it is board-only), so the
  event runs its own: AI-driven, unparked cars passing in the 20–38 unit band with
  relative speed > 100 (heading·v vectors) pay 40 (`NEAR MISS`, float text via the shared
  `pay`), +4 hype, a `trick` director mark, 3 s per-car cooldown in `ev.nearCd`.
- hype also banks as points continuously: `hypeGain × 10` into a float accumulator
  `ev.ptsF`; `bank()` moves whole points into `ev.pts` (the result card reads `ev.pts`).
Outside the beam (chopper present): hype decays 1.5/s, nothing is earned. Parked in the
beam earns exactly nothing — every feed needs motion or score.
Win at hype ≥ 100: bonus `ceil(timer) × 15` (`FULL HYPE BONUS`), card `FULL HYPE!` with
`{ hype: 100, tier }`. Clock-out at 120 s: `TIME UP`, ok = tier ≥ 2 (a tier-1 clock-out is
a fail card with the score still banked).

**The beam timer.** `ev.outT` accumulates only once the beam has locked once
(`ev.everLock`) or after a 5 s grace (`ev.armT`) — the chopper needs ~2–4 s to arrive and
find the player, and that search must not eat the fail budget. Warn at 2.5 s out
(`BACK IN THE LIGHT!` + `vox_evt_spot_beam`), fail at 5 s: `LOST THE LIGHT`. Any single
locked tick resets outT to 0. Bust is NOT handled in stepSpot: `stepEvents` checks
`sim.busted` before dispatch (a pinned car: |v| < 15 % vmax with a cruiser within 64 for
2.8 s — the base rule) and ends the event as a fail; the director still gets the bust
highlight, which is the clip. Leaving the car or mode changes end it as `ON FOOT`;
wrecking the car ends it as `WRECKED` (both mirror stepWreck's guards).

**Crowds.** `startSpot` gathers up to 17 peds from four verge clusters probed off the
driving surface — [790,470], [1090,420], [1020,640], [730,600] ± jitter (28/20): each
candidate is rejected if its surface is road/water or it sits inside a solid, then made
with `sim.makePed` and re-pathed to `{ type: 'crowd', x, y }` (the spawn point IS home),
flagged `p.crowd`, `p.cheer = 0`. A pathless ped would be swept as `gone`, and a 'loop'
ped would wander off — hence the new path type in `sim.stepPed`: mode 'return' folds back
to 'walk'; the ped faces `sim.focus()`; more than 7 units from home it walks home at
52 u/s; at home it bounces — `p.walk += (6 + cheer·15)·dt`, pose cycling [0,1,2,1] every
5 walk units, held via a new `p.holdPose` flag (reset at the top of stepPed; the shared
movement tail's `else p.pose = 1` became `else if (!p.holdPose) p.pose = 1` — the only
change to existing ped behaviour, and it only fires for crowd peds). The generic scare
rule still applies (a car over 150 u/s within 70 scatters them into flee; flee ends in
'return', which the crowd branch folds home). `ev.crowd` tracks the live peds; cheer is
set per tick from the rave: hype ≥ 20 → 1, tier 3 → 2. At tier 3, `crowdCloser` moves
every other crowd ped's home 30 % toward the fountain stage point [1000, 470] (re-probed:
never onto road/water/solid). `endSpot` filters crowd peds out of `sim.peds` — they exist
only for the rave. Voice: crowd/rave lines ride the existing vox hook system —
`vox_evt_spot_start`, `vox_evt_spot_beam`, `vox_evt_spot_tier2`, `vox_evt_spot_tier3`,
`vox_evt_spot_win`, `vox_evt_spot_busted` — all silent-safe until the wave-2 vox files
land (audio.play on a missing hook is a no-op).

**Director.** While in-beam and stunting (slip > 0.15 or turbo), stepSpot fires
`sim.ev('rave')` throttled to 0.5 s; `rave: 3.5` sits between `busted` (2) and `bail` (3)
in the WEIGHT table, so the highlight window centres on beam sequences and the bust at
the end still lands inside it.

**Render.** Idle: the shared beacon in spot yellow. During the event, `drawEventsGround`
draws the stage: a dashed ring (r 70 = the pool radius, dash offset scrolling) at the
beam centre `(chopper.bx, chopper.by)` — gold and pulsing while locked, red-flashing
while out — over a faint pool disc. No change to render.js's beam: the pool already
reads at golden hour (alpha 0.42 × a0, a0 = 0.62 + 0.24·dark), and the ring carries the
event read. HUD card (210×68, top centre): name + m:ss clock (red under 15 s), `TIER n`,
banked PTS, the HYPE bar with tier ticks at 34 %/67 %, and a state line — `IN THE LIGHT`
(green) / `BACK IN THE LIGHT 4.3` (red countdown) / `FIND THE LIGHT`; the 3-2-1 countdown
gets the big centre number like WRECK IT!. Result card third line for spot:
`<text> · HYPE n% · TIER n`.

**Proof.** `node tools/spotlight_check.mjs` — 29 rules on the real sim: marker + map POI
+ START armed at the ring; JUMP + A starts it (3★, chopper arrives, 17-ped crowd all on
verges within 420 of the site, start vox hook fired); parked in the beam for 3 s earns
hype 0 / pts 0 with outT held at 0; 5 s of donuts in the beam → hype 12.2 and points
banked; beam parked at [100,100] → hype decays (11.2 → 8.2 in 2 s) and 5.6 s out ends it
`LOST THE LIGHT` (that block drives with the cruisers filtered out — a wedged car would
be busted first, which is the next block's job); a cruiser placed 40 units off pins the
car → `BUSTED` fail card, event cleared; hype forced to 40 → tier 2 / 4★ / floor 4 /
+1 cruiser, stars forced to 1 → pin restores 4 next tick; hype 70 → tier 3 / 5★ / +1
cruiser, beam teleported 400 away closes to < 150 in 1.5 s (the 225 slew + lead, vs the
figure-8 search at 3★); hype 99.5 + donuts → `FULL HYPE!`, card pts 1806 (the ceil(117 s)
× 15 bonus dominates), stats counted, crowd gone; timer forced to 0.05 → `TIME UP` card.
Full suite: `sh tools/check_all.sh` green except `touch_check.mjs`, which fails with
`stick did not drive the car` — confirmed identical (same failure line, intermittently
passing) on the pristine base tree the same evening: a pre-existing headless-shell flake,
not a regression. `CHROME=… node tools/spotlight_shots.mjs` →
`shots/spotlight-rave.png` (freeze on the first step with hype > 18 in-beam: donuts in
the ringed pool, crowd bouncing, HYPE card up) and `shots/spotlight-tier3.png` (hype set
to 80 to cross tier 3 for real, freeze when a cruiser closes within 320 in-beam).

## 7I — the POLISH BUNDLE: six clip-facing upgrades (Nov 16 2026, staging tree palm-city-polish)

Built in a staging copy of Hawk main da74ffd6; integration is Moth's. All six were approved by
the owner Nov 16, plus her standing multi-pass license on art/camera/colour/shadows. Proof tool:
`tools/polish_check.mjs` (registered in check_all.sh) — Node parts A–C, browser parts D–F.

1. **Director two-angle impact splice (src/director.js).** The highlight's camera normally cuts
   on a 3.5–5 s timer through SHOTS[0..3]. Around the window's single heaviest mark the peak now
   overrides the timer: a state machine on the play object (`p.splice`: null → 'pre' → 'peak' →
   'done') forces SHOTS[1] (WIDE, zoom 0.8) once the peak is within `SPLICE_LEAD = 3.5*60` steps
   and more than 24 steps out, then cuts to SHOTS[2] (TIGHT lead, zoom 1.22) on the exact step
   the 0.35× slow-mo window opens (peak−i in (−24, 30)), and hands the timer back when slow-mo
   ends. If the peak is already inside the lead when playback starts, it cuts straight to TIGHT.
   Skips and all other marks are untouched. WEIGHT also gains `sling: 0.8` (item 4's mark).

2. **Channel 7 broadcast frame (src/record.js + src/main.js).** The recorder captures the game
   canvas, so the overlay is DRAWN INTO the canvas during playback/recording — never a
   post-process. `Recorder.drawBroadcast(g, vw, vh, dpr, sim, highlight)`: a lower-third bar
   (min(vw−24, 336) × 54, dark plum rgba(14,8,28,0.85), red top rule #e0232e) with a red ● LIVE
   chip, "PALM CITY NEWS / CHANNEL 7", the live SCORE · ×multiplier line, and the wanted stars
   in gold at the bar's right end. Highlight saves draw it at y = vh−118; live REC at vh−172
   (above the REC button row). Toggle: a `#pcNewsBtn` built by the same `mk` factory as REC /
   SAVE CLIP (including the touchstart stopPropagation shield — input.js's document gesture
   guard otherwise eats the click). Defaults: `newsHL = true`, `newsLive = false`; one tap
   flips both to the opposite of "any on", and the choice persists for the session. OFF =
   recordings stay pixel-clean.

3. **Rim-driving on spikes (src/pressure.js + src/destruct.js + src/sim.js + src/hud.js).**
   Spike strips used to set `c.spiked` instantly. Now, for the PLAYER's car only: contact sets
   `c.rims = RIMS_T = 8` (seconds) and says ON RIMS!. While rims > 0, stepStreet caps speed at
   lerp(RIMS_VMAX 210 → SPIKE_VMAX 150, elapsed/8), yanks the heading with a wander
   (sin(time·11 + id·2.7) · 0.55 · sway) plus a lateral fishtail slide (sin(time·6.3 + id·1.9) ·
   34 · sway, sway = min(1, |v|/140)), and streams sparks from both rear wheels — a fixed pool
   in destruct.js (`SPARK_CAP = 96`, `sim.sparks`, `spawnSpark(sim,x,y,vx,vy)`, life 0.35–0.75 s,
   drag exp(−3dt) + slight fall; rendered by render.js drawSparks as velocity streaks
   #fff3cf → #ffb84a, right after the smoke). At rims = 0 the existing blown-tyre limp takes
   over unchanged (cap 150, fighting wheel). Cop/traffic cars still spike instantly — the rim
   branch is gated on the car being the player's current car. HUD: an ON RIMS! pill under the
   stars with a burn-down bar (hud.js). jobs_check is unaffected (its BAIL test sets c.spiked
   directly), but in real play the getaway's spike moment now buys 8 s before BAIL can trigger.
   Side effect, handled: the ?demo pilot used to get busted at ~21.5 s because the instant limp
   stopped it near the roadblock; on rims it coasts ~350 units off-road to a spot squad cars
   can't box in, and the demo never busts. demo.js's 'stop' phase now BRAKES in place (full
   reverse input until |v| ≤ 8) — a real pull-over — and the bust lands again (seed sweep:
   18.8–39.3 s across five seeds, inside the demo's 40 s cap; seed 7 is the tight one).
   check_all.sh's demo soak window grew 34 s → 45 s for the same reason, and pressure_check's
   spike section now asserts the rim run (~8.0 s, then limp at exactly 150, measured pinned to
   the loop with crash damage cleared — the forced rim run otherwise wrecks the test car).

4. **Traffic slipstream (src/sim.js + src/render.js).** `sim.draft` (0..1) + `sim.draftCar`.
   stepDraft runs inside stepPlayerCar: the target must be a traffic car (driver 'ai', not
   parked/patrol/job/police — job vehicles and the bus excluded by construction). Player in the
   cone behind it (gap −4..60 behind its rear bumper, lateral ≤ wid/2 + 10, |v| ≥ 60) charges
   draft at dt/1.4; the bonus is +8% at full draft, applied to both top speed and throttle in
   stepPlayerCar. Leaving the cone decays draft at dt·2 — but if the player exits FULLY AHEAD
   (u > len/2 + len/2 + 6) with draft > 0.5, it pays instead: SLINGSHOT +50, a lastTrick popup
   and a small director mark (ev('sling'), WEIGHT 0.8). Render: while draft > 0.25 at speed,
   seven faint wind streaks (#eaf6ff, alpha draft·(1−phase)·0.38) stream past the player car,
   drawn with the turbo streaks.

5. **Light-tinted smoke (src/render.js).** drawSmoke now asks `smokeTint(S, p, time, G)` per
   puff: the strongest nearby light wins — police flashers within 110 (red/blue alternating on
   the same phase as drawSiren, floor(time·6)%2), headlight cones of non-parked cars within 55
   (warm, gated by G.heads), the chopper's beam pool within POOL_R+40 of (chopper.bx, by) (warm
   white), neon puddles within r+24 (their layout colour, gated by G.neon). The tint blends
   toward the light colour at strength min(0.6, best·0.62) over the existing dark/lite smoke
   greys — a tint, never a recolour; no light nearby = exactly the old grey.

6. **West light + ocean sheen (src/render.js).** All three ride the early window
   early = clamp01((0.30 − t)/0.30) unless noted. (a) WEST FLARE: after the bloom composite,
   before the vignette — facing/driving west (west = clamp01((−cos(heading) − 0.15)/0.85)) at
   strength early · west · (0.3 + 0.7·clamp01(G.glow + G.warm·0.5)), a screen-space warm
   gradient rgba(255,176,92, ≤0.5·flare) washes in from the west edge to 62% of the width.
   Probe value: `renderer.fxFlare`. (b) SUNBEAM SHAFTS: drawSunbeams in the light layer after
   the wet reflections — seven world-anchored quads slanting with the light (dx 0.86, dy 0.51,
   length 1050, hashed origins/widths, rgba(255,203,110) at alpha early·(0.05..0.095)) plus ~110
   golden motes drifting down-shaft on the chopper cone's sin-hash technique, alpha pulsing
   with sin(π·u). Probe: `renderer.fxBeams` (= early). (c) OCEAN DRIVE SHEEN: in
   drawWetReflections, reflectors east of shoreX(y) − 300 get their peak multiplied by
   1 + 1.1·pulse, pulse being the drawSurf wave phase at that reflector (6.4 s cycle, travel
   −y/1500, crest at u = 0.34, width 0.22) — the strip gleams as each wave lands. Probe:
   `renderer.fxSheen` (one fixed near-shore reflector's pulse). window.__palm now also exposes
   `renderer` for these probes.

**Verification state (Nov 16, staging):** polish_check parts A–C PASS (splice cuts wide→tight
on the slow-mo frame; rims 8.0 s with the spark pool saturated; cop blows instantly; draft
charges to 1.00 behind traffic, pays +50 on the pass, stays 0 behind a parked car). Full
Node-side suite green (pressure, director, jobs, destruct, sim_run 45, skate, feel, bust,
events, siege, map, turbo, skid, activities, help, chase, owner_tuning, voice_world).
**Browser parts D–F and tools/polish_shots.mjs are written but could not be run in this VM on
Nov 16: every browser binary (Playwright headless shell, /opt/meta-chromium, Firefox, WebKit)
dies at startup with SIGILL/SIGTRAP since a VM host change (~03:00) — record_check fails
identically on the pristine base tree, so it is the environment, not this bundle. Re-run
`node tools/polish_check.mjs` and `node tools/polish_shots.mjs before|after` once a browser
launches again; the before/after captures and the second visual tuning pass (first values to
review: flare alpha 0.5, beam alpha 0.05–0.095, sheen ×1.1, tint cap 0.6) are still owed.**
