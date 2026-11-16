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
into `shots/`. `node tools/shots2.mjs` captures the v2 set into `shots2/`.

**v2 base rebuild (Nov 16):** v1's base — tape lines on a flat uniform field —
was rejected by the owner ("the base is bad so all the others are bad"). The
ground is now a baked scene built on a centreline distance field: the road is
a real surface (pale worn dirt, twin wheel bands, corner wear pooled by
curvature, dusty shoulders) carved through textured scrub, with a banked
river (shallows, sandy rims), sand traps, a corrugated rib section, rocks,
bushes, scenery tire stacks, a start gantry + grid slots, and slightly larger
trucks. All three looks re-render that same base in their own medium. Engine,
physics, AI and track data are unchanged from v1; verify still passes 10/10.

**v3 (round 3, owner: "getting closer — keep pushing"):** the terrain now has
a real heightfield — procedural dunes plus authored masses (NE dune, banked
sand bowl in the hairpin, corrugated mound under the ribs, carved river
channel) — hillshaded from a fixed NW sun. The road is graded to a smoothed
elevation profile along the centreline, so the course reads carved through
the dunes with cut banks; the infield scrub sits darker so the road pops; the
river runs a darker deep channel with current streaks and foam churn at the
ford. Render-only again (`render.js`); verify still 10/10.

**v4 (round 4, owner: "the left one looks great — keep making it better"):**
the procedural field alone read as soft sculpted masses, so the big features
are now hand-authored to echo the reference's composition: a dune ridge
chained along the top with one smooth planar face falling to the river, the
NE mud bowl raised into a dark earthwork, the hairpin bowl and the rib mound
scaled up into true earthworks (taller rim + deep dish; taller mound, deeper
ribs, longer cast shadow). The hillshade swings harder (gain 4.3, range
0.50–1.55), height also reads in colour (dark red-brown lows, pale crests —
mud exempt: his high mud stays dark), and the river sparkles with fine
flecks + flow glints over a bright shallow lip. Look B gets a wider shade
swing so the relief survives its smoothed upscale. `node tools/shots4.mjs`
captures the v4 set into `shots4/`. Render-only again; verify still 10/10.

**Honest approximations:** the thread's fluid simulation and global
illumination are approximated (splash particles + wakes; consistent fixed
sun shading). Phone feel is unverified — the owner's phone is the real gate.
