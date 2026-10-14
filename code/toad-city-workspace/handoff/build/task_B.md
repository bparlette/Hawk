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
