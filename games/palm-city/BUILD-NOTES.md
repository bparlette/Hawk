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
| `input.js` | floating joystick (left half, base follows the thumb), round action button bottom-right, keyboard for desktop |
| `hud.js` | stars, clock (6:38 → 7:48 PM), messages, BUSTED card + fade, controls |
| `audio.js` | WebAudio only: engine (detuned saws through a speed-driven lowpass), city hum + ocean swell (brown noise), siren, jack/door thunk, crash, star ping, busted sting |
| `demo.js` | `?demo` autopilot that drives the real input path: walk to a parked convertible, jack it, drive north along the ocean and round the loop (weaving round traffic), pull over, get boxed in, busted, respawn — then it restarts |

Touch controls on foot: the stick direction is where you walk (run past 65 %). In a car: point
the stick where you want to go — the car steers toward it, throttle = stick distance; pull the
stick opposite your heading at low speed to reverse. Action button: JACK near a car, EXIT when
slow. Keyboard: arrows/WASD, Space/E.

## Scripts

All run from `games/palm-city/`:

| command | does |
| --- | --- |
| `blender -b -P tools/bake_sprites.py -- all` | re-bakes every sprite + `assets/manifest.json` (~12 min on an M4; GPU/Metal) |
| `blender -b -P tools/bake_sprites.py -- buildings hotel` | one group / one asset (`cars`, `peds`, `buildings`, `props`); `--quick` for low samples |
| `node tools/sim_run.mjs 34` | runs the real sim + demo autopilot headless; exits 0 only if the demo jacks a car and gets busted |
| `node tools/shot.mjs out.png "demo" --seq 8 --every 4000` | phone-size (420×860, touch, iPhone-like) screenshots in real Chrome; non-zero exit on any page error |
| `node tools/touch_check.mjs [prefix]` | drives the controls with real CDP touch events: joystick walk → button jack → stick drive → button exit |
| `node tools/profile.mjs` | CPU ms per render section (`?prof`) and per ground-chunk paint |
| `cd tools && npm install` | installs `playwright-core` for `shot.mjs` (uses the system Chrome) |

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
