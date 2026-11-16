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
