# College Park — the L4 second-city proof + G4 proof review (task M-F, Nov 18, 2026)

**The proof:** the same factory pipeline that built Laurel/Fulton from a spec of statements
(`games/laurel-fulton/tools/factory/`, spec: `tools/factory/examples/college-park.spec`) built a
second real city with **zero code changes** — College Park, MD, with the University of Maryland
dorms and the Route 1 / Baltimore Ave bars as the hero POIs (owner's pick, Nov 18). This file is
Moth's G4 proof review (the §2 gate in the G4 style spec): adversarial, judged at phone size from
the five stills.

## What the build contains

- **Roads (real, from OSM via the factory):** bbox 38.978–39.004 / −76.958–−76.922 ·
  2,793 drivable edges · 147.6 km · 3,115 × 2,874 m extent · 179 speed bumps ·
  3,804 real building footprints (245 parking, 369 green) in `data/areas.json`.
- **Hero POIs (20, all anchored to real OSM buildings):** the bars — R.J. Bentley's, Looney's Pub,
  Cornerstone Grill & Loft, Terrapin's Turf · the dorms — Montgomery, Washington, Frederick,
  Johnson-Whittle, Cambridge Halls + Cambridge Community Center · dining — The Diner, South Campus,
  Yahentamitsi · engineering — A. James Clark Hall, Jeong H Kim, Glenn L. Martin Hall ·
  homes — Dre (Lehigh Rd), Tess (Regents Dr), Juno (Baltimore Ave), the Knox Road house (Moe + Pike).
- **Crew (fictional, from the spec):** 5 people, era cars baked from the shared fleet library —
  '89 Accord (bass), '88 Escort (yellow headlights), '87 Camaro two-tone (blue underglow),
  '90 Astro, '89 Brougham (sputter). Mission: pick your player → rally → meet at R.J. Bentley's.
- **Hero art (this pass):** `data/heroes.json` — all 20 heroes authored in the L11 vocabulary
  (lf_heroes.js): brick + windowband + HVAC for the dorms/dining/engineering, parking lot +
  storefront + neon name sign for the four bars, and an identity budget for the homes
  (Knox: cobalt shutters, two-car garage, navy door, basketball hoop). No engine files changed.

## Functional proof (run at production path depth, 420×860, headless Chromium)

- Boots with **zero page errors** in every run; every 404 is an optional file the engine
  handles (no painted ground tiles, no interiors, no places — see "still owed").
- **The rally completes end-to-end:** pick Dre → convoy assembles (CREW 3/5 at Knox Rd & Yale Ave,
  65 mph, traits live: bass rings, two-tone, blue underglow) → **"THE CREW IS ASSEMBLED"** at
  R.J. Bentley's. The run crossed the whole day cycle (6:38 PM golden → 7:45 PM night).
- **Day-to-night parity with Palm City:** same clock and curve — golden hour at `?t=0`,
  blue dusk at `?t=0.92` (7:42 PM): lamp pools on, hero signs glow, labels stay readable.
- **Laurel regression:** Laurel/Fulton boots and rallies on the same engine tip (CREW 3/9,
  convoy barks live), zero errors — the shared engine is unchanged by this pass.

## The five stills (captures held with this review; binary upload pending)

- **A — Golden-Hour Cruise:** Lehigh Rd at Baltimore Ave — Dre's hero home, parked Accord,
  player car with bass rings, Terrapin's Turf below.
- **B — POI Approach:** Baltimore Ave & Hartwick Rd — Cornerstone + Bentley's: lots, storefront
  awnings, neon BENTLEY'S sign, corner banner.
- **C — Resident House Close-Pass:** the Knox Road house — gable roof, cobalt shutters, garage,
  hoop; Moe's two-tone Camaro + Pike's Brougham at the kerb, player idling at the door.
- **D — Multi-Car & Ember Stress:** the live rally on Knox Rd — three trait cars in deepening
  dusk (bass rings, two-tone, underglow). No fire trait exists in this spec; the only emitter is
  Pike's sputter (dark plum puffs — the Palm City preset; the engine has no flame-tongue path).
- **E — Quarter-Zoom Overview:** Cambridge Community Center + Cambridge Hall over Farm Dr —
  heroes read instantly against ghosted filler; Valley Dr / Farm Dr labeled.

## The 9-point checklist (G4 §2)

- [x] **Outline presence** — every car and hero roof edge carries the crisp plum ink (A–E).
- [x] **Value & hue separation** — Band 3 cars pop off the dark asphalt; heroes separate from
      ground and filler in every still, shaded blocks included.
- [x] **Light & shadow consistency** — all car/building shadows fall lower-right; dusk lamp
      pools are warm plum; zero black shadows.
- [x] **Era consistency — cars** — five era-true library bodies, era paints; nothing post-era
      exists anywhere in the build.
- [x] **Era consistency — dressing** — no modern leaks from the OSM data: no solar panels,
      LED bars, billboards, chain logos or EV chargers render.
- [x] **Trait readability** — two-tone, bass rings and blue underglow are unmistakable in
      Stills A, C and D without squinting.
- [x] **House identity** — the Still C house reads as a specific home in a one-second glance
      (shutters, garage, door, hoop, the owners' two cars); the filler around it stays quiet.
- [x] **Landmark legibility** — the Still B bars read by lot + heavy outline + neon sign in
      B and E, no UI labels needed; at dusk the signs are the brightest things on Route 1.
- [x] **Fire & smoke rule** — no flame tongues anywhere; the single exhaust emitter uses the
      ember-era dark-smoke preset (see Still D note).

> **VERDICT:** `PASS` — `College Park` (`Hawk main + data/heroes.json, Nov 18`)

## Still owed (not proof blockers)

1. **Painted ground pass.** The procedural grass is louder and more saturated than the
   GOLDEN_COAST band targets — Laurel got painted tiles; College Park awaits its own pass.
2. **Laurel fiction leaks through the shared engine:** the dusk banner announces a night party
   at "KOSACK" (a Laurel person) and the party crowd sprites 404 in this city's root.
   Content/city separation is factory-level work, flagged — not touched here (lf_party.js is
   another lane's file).
3. **Sign orientation** follows the hero frame's nearest road: Bentley's sign fronts its back
   lot rather than Baltimore Ave. Readable from play; a front override is an lf_heroes feature.
4. **Pick-screen text overflow:** Moe's long car line clips its card (shared UI; also in Laurel).
5. **No logo sign / interiors / places** in this city: the loading screen is text-only and the
   dorms are exterior heroes — enterable dorms were never in the proof's scope.
6. The Knox hoop sits at the roof's front edge — the footprint nearly reaches its road, so the
   renderer's room clamp parks it there.
