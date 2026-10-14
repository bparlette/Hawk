You are the props and vehicles builder for Toad City Baltimore (Claude Sonnet, extended thinking on, medium effort; use high effort for the first prop and the first vehicle, because they set the pattern). Self-test every piece in viewer.html before you move on.

## Context (read first)

You are making game assets for **Toad City Baltimore**, a browser open-world brawler set on Baltimore's Inner Harbor. The heroes are Harold, an elderly toad with a cane, and his wife Mavis, who has a grey afro and fights with her handbag. They clean the crime out of each district. Everything is built in code and cel-shaded with ink outlines. The game uses **three.js r160** with plain ES modules: no bundler, no image files, no model files. Every texture is drawn on a canvas at load time.

You were given the **starter kit**: `toadcity_kit.js` (the game's own materials, outline method, rig and pose code, plus the prop collector), `viewer.html` (a standalone test bench), `example_gull_thug.js` (character interface) and `example_bench.js` (prop interface). If the files did not come with this brief, rebuild them from the appendix of the PDF. Your modules must run against the kit unchanged, because the game passes the same `K` object to them.

**Conventions (all units are metres):**

- Y is up, X is east and Z is south (north is −Z). Facing for a character or vehicle at yaw 0 is **+Z**, and its feet or base sit at y = 0.
- Pavement top (kerb) `CURB = 0.16`. Ground floor height `GF = 4.4`, upper floors `FH = 3.4`, parapet `PAR = 1.3`. Harbour water surface `WY = −0.85`.
- City block: 24 × 24 m. Street: 10 m wide (grid period 34 m). Brick promenade on every water edge: 6 m. Render chunks are 64 m and the collision grid is 16 m.
- Character scale: Harold is about 1.6 m tall, Mavis about 2.0 m to the top of her afro, and a standard thug about 2.0 m. The bruiser is the thug rig scaled ×1.2.

**Hard rules for every delivery:**

1. **No `import` statements in your modules.** Everything comes in through the `K` argument. Each file has one `export const META` and one or more `export function buildXxx(K, …)`.
2. **Materials:** create them only through `K.toonMat()`, `K.basicMat()` or `K.makeAtlas()`. Outlines must use the shared `K.OUT_CHAR`, `K.OUT_PROP` or `K.OUT_CITY` hulls (which `K.part()` and `out.build()` add for you). Do not use PBR materials, post-processing, edge-detection passes or lights inside assets. Lamps go through `out.lamp()`.
3. **Textures:** draw them on canvas only. Use at most one 1024² atlas per task family and at most 256² per character map. Do not use image files, web fonts or network fetches. Text uses font stacks such as `Impact, "Arial Black", Georgia, serif`.
4. **Deterministic:** do not call `Math.random()` at build time. Use a seeded LCG (`seed = seed * 16807 % 2147483647`) taken from `opts.seed`.
5. **Do not edit `toadcity_kit.js`.** If you need something it lacks, add the helper inside your own module and say so in the README.
6. **Real signage, original characters:** storefronts, signs and props in the Inner Harbor area **may use real Baltimore businesses' names and sign styles where they really exist there**. Examples: Phillips Seafood, Barnes & Noble and Hard Rock Cafe at the Power Plant, the harbour water-taxi branding, Natty Boh-style corner-bar signs, Utz, Old Bay. Recreate the lettering, colours and sign shapes **drawn on canvas or built from geometry**; never copy or embed logo image files, photos or traced artwork. Only put a real name where that business really is or is typical (a crab house, a corner bar, the Power Plant shops); fill everything else with plausible Baltimore signage. **Characters stay original:** no real people, likenesses, real gang colours or symbols, official mascots or film/game characters, and no brand logos on thugs or bosses. Third-party code is allowed only under MIT or CC0, credited with its URL in `LICENSES.md`.
7. Do **not** model landmark buildings (stadiums, the aquarium, the power plant, towers, the fort, the monument and so on). The in-house team builds those.
8. Use three.js r160 APIs only. The code must have no console errors in Chrome or iOS Safari.


# Task B: Street props and vehicles

## Goal
Build the street-level props and vehicles that make the harbour city feel alive. Static props merge into the city mesh through `out`. Vehicles and rideables are their own small Groups, because the heroes ride and drive them (the ACT button: RIDE, DRIVE, BOARD).

## Static props (merged; signature `buildXxx(K, out, x, z, ang = 0, opts = {})`)
| id | Prop | Notes | Tris budget |
|---|---|---|---|
| `lamp_acorn` | Historic acorn street lamp | Dark green cast-iron post with an acorn globe; globe through `out.glow`; calls `out.lamp(x, y, z)` at the globe | ≤ 350 |
| `lamp_cobra` | Modern cobra-head lamp | For avenues; head through `out.glow`, `out.lamp` | ≤ 250 |
| `bench_park` | Park bench | Wood slats on iron ends; `out.hook('seat', …)` | ≤ 250 |
| `bench_bus` | Bus-stop bench | Baltimore bus-stop sign style, drawn on canvas | ≤ 300 |
| `trash_can` | Public trash can | Plus a variant with an attached recycling bin | ≤ 250 |
| `crab_shack` | Crab shack / steamed-crab stand | Small wooden stand (about 4 × 3 m), counter, chalkboard menu, "STEAMED CRABS" sign that glows at night (real local flavour welcome: Old Bay tins, Utz, Natty Boh-style signs, drawn on canvas), crab-pot stack | ≤ 2,500 |
| `manhole` | Manhole cover | Flush with the road (y = 0.005), with a ring decal; `out.hook('manhole', {x, z})` | ≤ 120 |
| `ladder_wall` | Wall ladder | Fixed steel ladder from the ground to a roof height `opts.top`; `out.hook('climb', {x, z, ang, top})` | ≤ 300 |
| `ladder_drop` | Fire-escape drop ladder | Bottom section only, hanging at 1.6 m; `out.hook('climb', …)` | ≤ 300 |
| `parked_car_*` | Parked cars (sedan, hatchback, pickup) | Static versions of the drivable cars; any colour from the palette | ≤ 1,500 |

## Vehicles and rideables (own Group; signature `buildXxx(K, opts = {})`)
| id | Vehicle | Notes | Budget |
|---|---|---|---|
| `water_taxi` | Harbour water taxi | About 9 m covered launch, the real harbour water-taxi branding, lettering and colour scheme, recreated on canvas and in geometry (no copied logo files), bench seats, a pilot wheel. The player drives it | ≤ 4,000 tris, ≤ 8 meshes |
| `paddle_boat` | Two-seat pedal boat | Swan-ish or generic dragon-head pedal boat for 2 riders | ≤ 2,500 tris, ≤ 6 meshes |
| `dragon_boat` | Racing dragon boat | About 12 m long and narrow, dragon head and tail, 10 paddler benches and a drum; paddles animate | ≤ 6,000 tris, ≤ 10 meshes |
| `car_sedan`, `car_hatch` | Drivable cars | Wheels spin and steer; doors are not needed. Fells Point set piece: the heroes lean out of both windows | ≤ 2,000 tris, ≤ 7 meshes |
| `box_truck` | Box truck | "MOVING & STORAGE" or a real Baltimore delivery look (e.g. Utz), drawn on canvas; the roll-up rear door is optional | ≤ 2,500 tris, ≤ 7 meshes |
| `arabber_cart` | Arabber produce cart with pony | Painted wooden cart with a canopy, bells and fruit crates, pulled by a stylised pony with a simple walk cycle in `animate` | ≤ 5,000 tris, ≤ 12 meshes |
| `skateboard` | Skateboard | Deck, trucks and wheels; the rider stands on `seats[0]` | ≤ 600 tris, ≤ 3 meshes |

Vehicle return value (must match exactly):
```js
export function buildWaterTaxi(K, opts = {}) {
  const out = K.makeOut();             // build the static body with the same out.* calls as props, at the local origin
  /* … out.solid(…) … */
  const root = new K.THREE.Group(); root.add(out.build());   // body = 3-4 draw calls
  const wheels = []; /* moving parts: K.grp + K.part with a shared K.toonMat (set group.userData.mat) */
  return {
    root, kind: 'boat',                // 'boat' | 'car' | 'cart' | 'board'
    seats: [{ x: 0, y: 0.9, z: -1.2, ang: 0, pose: 'stand' }],   // local-space rider anchors; pose: 'stand' | 'sit' | 'lean_out'
    collider: { w: 2.6, l: 9.0, h: 2.4 },                         // local box, centred, along +Z
    waterline: 0.35,                   // boats: local y that sits on the water surface (WY = -0.85)
    animate(v, dt, speed, steer, t) { /* spin wheels / paddles, bob boats, pony walk; must be cheap */ },
  };
}
```

- Facing is +Z. Wheels sit on y = 0 (cars, carts, board) and boats float with `waterline` on the water plane.
- Night: headlights, tail lights, cabin lights and the crab-shack sign use `out.glow()`. Vehicles do not add lights.

## Performance budget

- Static props: the per-prop triangle budgets in the table above. They add **no draw calls**, because they merge into the chunk.
- Vehicles: the triangle and mesh budgets in the table. Use at most 2 materials per vehicle (the `out` materials plus one shared `toonMat` for moving parts), and no textures beyond the shared prop atlas.
- Use **one 1024² atlas for the whole of Task B** (`src/props_tiles.js` exporting `PROP_TILES`) for signs, menus, livery text and the manhole ring.

## Style

- Use chunky toy-like proportions with readable silhouettes at 10–20 m: slightly oversized lamp heads, wheels and cabins.
- Ink outlines on major masses only. Glass is a dark blue-grey (`#6a8a9a` by day) with no transparency.
- Real Baltimore flavour: real names and sign styles where they really exist (water-taxi branding, Old Bay, Utz, Natty Boh-style signs), arabber colour schemes (painted red, yellow and green wood with scrollwork), the crab-shack chalkboard, harbour-boat bunting.

## Acceptance checklist

- [ ] Every prop and vehicle in the two tables exists with the exact signature and return shape.
- [ ] `viewer.html?show=props` shows all static props in a row on a pavement strip; `?show=vehicles` shows every vehicle with `animate()` running (wheels spin, paddles stroke, the pony walks, boats bob on a water plane at `WY`).
- [ ] Budgets are measured and written in the README (triangles per prop; triangles, meshes and draw calls per vehicle). There is one atlas in total.
- [ ] Hooks are present: manhole → `'manhole'`, ladders → `'climb'`, benches → `'seat'`, lamps → `out.lamp`.
- [ ] Night previews show the lamp globes, headlights and signs glowing and readable.
- [ ] Seats line up with the hero rig (Harold is about 1.6 m tall), and the `collider` box matches the visible hull.
- [ ] Liveries and signs use real Baltimore names and styles where they really exist, all redrawn on canvas or built from geometry (no logo image files). `LICENSES.md` is present.

## Do NOT

- Do not embed logo image files or photos; recreate real lettering and liveries on canvas or in geometry.
- Do not model landmark buildings or piers. The in-house team does those.
- Do not use skinned meshes or GLTF. Do not add per-prop materials.

## Session plan
Do the lamp and bench first (the pattern piece: self-test it, then the hooks), then the other static props, then the car (the vehicle pattern piece), then the boats, then the cart and the skateboard, then the previews.


## Delivery and self-test

**Make one zip per task:** `toadcity_task<LETTER>_<short-name>_v<N>.zip`, laid out like this:
```
src/                  your modules (snake_case file names, e.g. gang_harbor_rats.js, boss_raven_king.js, rowkit_rowhouse.js)
toadcity_kit.js       the kit, byte-identical to the one you were given
viewer.html           your test bench (start from the kit's viewer.html): imports ./src/*.js, ?show=<id>, ?night=1, ?pose=…
previews/             <asset_id>_day.png and <asset_id>_night.png at 1280x720, plus <group>_phone_390x844.png
README.md             exports, how to view, the MEASURED budget table (parts, tris, draw calls, materials), known issues
LICENSES.md           "All original, procedural" or credits (name, URL, licence) for any MIT / CC0 source used
```

**Self-test loop** (run it for every asset before you move to the next):

1. Serve the folder (`python3 -m http.server 8000`) and open `viewer.html?show=<id>`. Check day, then press N for night, then P to cycle poses.
2. Read the corner readout. **Draw calls and triangles must be inside the budget** for the asset type. Count your materials too.
3. Look at the asset at gameplay distance in a 390×844 window, the iPhone portrait view. The silhouette must read at about 6–10 m away.
4. Take screenshots. Headless Chrome works with `--use-gl=swiftshader`; wait for `window.__ready === true`, then save the `previews/` PNGs.
5. The console must show zero errors. Fix the asset before you move on.

**Do not send:** model or image files (GLB, OBJ, FBX, PNG/JPG textures), minified code, copies of three.js, or anything with an unclear licence.

