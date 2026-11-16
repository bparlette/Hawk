# DUSTLINE — Off-Road Arcade

A bake-off of a top-down off-road circuit racer inspired by Jussi Kemppainen's
"Drivers of the Apocalypse Arcade" thread: ONE engine, THREE switchable looks,
so the look can be compared and picked.

**Play:** open `index.html`. Whole "Greybox Loop" track on one screen, 4 trucks
(player red + blue/green/yellow AI), 4 laps. Surfaces matter: dirt / sand
(draggy) / mud (slippery) / gravel / rock / water (big slowdown, splashes,
wake) / ribbed jump section. Persistent tire tracks, breakable tire stacks,
nitro + repair pickups (respawn ~20 s), damage + repair, nitro boost.

**Modes:** RACE (4 laps vs 3 AI) and TIME ATTACK (solo, 3 laps, best lap kept
in localStorage). Demolition derby is NOT built (out of scope for v1).

**The three looks** (switch in the menu or mid-race with keys 1/2/3 or the
A/B/C buttons — same physics, track and AI in all three):

- **A · REPLICA** — Amiga-500-style limited palette, 4 px/m chunky buffer,
  Bayer-dithered terrain, deep-water shading, flat pixel trucks, Courier HUD.
- **B · PAINTED** — Palm City / GTA-remake house style: 12 px/m smooth buffer,
  thousands of visible brush strokes + broken-colour blotches, painted water
  with foam strokes, warm sun wash + vignette, painted trucks with brush
  highlights, rounded UI.
- **C · SPRITE PIXEL** — pre-rendered truck sprites: a code box-model truck
  rendered at 16 directions with voxel-style flat face shading, on a 6 px/m
  pixelfx-crunched world with a cooler, darker grade and crisp tape shadows.

**Controls:** arrows / WASD (steer + throttle), Space = nitro, Shift =
brake/reverse, P/Esc pause, R restart. Touch (gamepress standard): floating
joystick anywhere on the left half (x = steer, y = throttle/brake), round
NITRO (A) and BRKE (B) buttons bottom-right. Landscape-first; portrait shows
a letterbox + rotate hint. Audio is synthesized WebAudio (engine, skid,
water, pickups) — no audio files. All art is generated in code at load;
there are no binary assets.

**Files:** `index.html` (page, menu, touch UI, gesture guard) · `track.js`
(centreline, surface grid, pickups) · `sprites.js` (truck art ×3 looks) ·
`render.js` (world painters ×3, tire-track layer, particles) · `game.js`
(sim, AI, HUD, input, `window.__dust` test hooks) · `audio.js`.

**Verify:** `node tools/verify.mjs` — headless Playwright bot run asserting
laps increment, overtakes happen, nitro pickup works, water slows the truck
vs dirt (7.0 vs ~19 m/s coast-down), and the tire-track layer accumulates;
captures menu / mid-race ×3 looks / water crossing / portrait screenshots
into `shots/`.

**Honest approximations:** the thread's fluid simulation and global
illumination are approximated (splash particles + wakes; consistent fixed
sun shading). Phone feel is unverified — the owner's phone is the real gate.
