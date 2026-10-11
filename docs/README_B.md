# Toad City Baltimore — Task B: street props and vehicles (v1)

Static street props that merge into the chunk (no draw calls of their own) and rideable vehicles (their own small Groups): 9 props + 3 parked cars, 3 boats, 2 cars, a box truck, an arabber cart with a walking pony and a skateboard.
One 1024² atlas for the whole task (`PROP_TILES`, 13 tiles, 23.8 % of the atlas, 400 px high).

## Contents

```
src/props_tiles.js        PROP_TILES: bench plates and ads, crab-shack sign and chalkboard menu, manhole cover, recycling sticker, number plate, vehicle liveries
src/props_street.js       buildLampAcorn, buildLampCobra, buildBenchPark, buildBenchBus, buildTrashCan, buildManhole, buildLadderWall, buildLadderDrop
src/props_crab_shack.js   buildCrabShack
src/veh_cars.js           buildCarSedan, buildCarHatch, buildBoxTruck + the static buildParkedCarSedan / buildParkedCarHatchback / buildParkedCarPickup
src/veh_boats.js          buildWaterTaxi, buildPaddleBoat, buildDragonBoat
src/veh_carts.js          buildArabberCart, buildSkateboard
toadcity_kit.js           the kit (rebuilt from Appendix A, see "Kit")
viewer.html  previews/  README.md  LICENSES.md
```
(The parked cars live in `veh_cars.js` because they share the drivable cars' model.)

## How to view

```
python3 -m http.server 8000      # in this folder; the viewer loads three.js r160 from unpkg
http://localhost:8000/viewer.html?show=props            every static prop in a row on a pavement strip (Harold dummy for scale)
                                ?show=vehicles          every vehicle, animate() running: boats bob on the water plane (WY), wheels spin, paddles stroke, pony walks
                                ?show=<id>              one asset: lamp_acorn lamp_cobra bench_park bench_bus trash_can crab_shack manhole ladder_wall ladder_drop
                                                        parked_car_sedan parked_car_hatchback parked_car_pickup water_taxi paddle_boat dragon_boat car_sedan car_hatch box_truck arabber_cart skateboard
                                &night=1  &seed=n  &recycling=1 (trash can)  &collider=1 (green collider box)  &group=water|land (vehicles)  &cam= &yaw= &pitch= &zoom= &t=  &hud=0
```
Keys: **N** night/day, **C** camera, **Space** pause animation, **H** readout. Vehicles are shown with a Harold-sized dummy at every seat anchor. `window.__ready === true` after the first frames; `window.__errors` is empty when clean.

## Contracts

**Static props**: `buildXxx(K, out, x, z, ang = 0, opts = {})`, returns its `META.pieces[id]` entry (`{ id, kind, footprint, height }`). Base on `K.CURB` (the manhole at y 0.005, the parked cars on the road at y 0). Facing +Z rotated by `ang`.
`opts.atlas` = the shared `K.makeAtlas(PROP_TILES)`; if omitted the `PROP_TILES` global of the concatenated game build is used (cached on `K.makeAtlas._props`, so all files share one atlas).
Hooks: benches `out.hook('seat', {x, y, z, ang})`, manhole `out.hook('manhole', {x, z})`, ladders `out.hook('climb', {x, z, ang, top})` (`opts.top` = roof height), lamps `out.lamp(x, y, z)`. Colliders through `out.coll`.

**Vehicles**: `buildXxx(K, opts = {})` returns
`{ root, kind: 'boat' | 'car' | 'cart' | 'board', seats: [{ x, y, z, ang, pose: 'stand' | 'sit' | 'lean_out' }], collider: { w, l, h }, waterline, animate(v, dt, speed, steer, t) }`.
* Facing +Z, wheels / base on y = 0, units in metres. The vehicle is centred on its bounding box along Z, so `collider` is a **centred** box along +Z with its base at y = 0 (the viewer draws it with `&collider=1`).
* `root` belongs to the game (position, yaw). `animate` only moves inner groups (`bob`, wheels, paddles, legs): speed in m/s, `steer` in -1..1 (positive = left, towards +X), `t` in seconds. It is cheap (no allocation).
* Boats: `waterline` is the local y that sits on the water plane, so `root.position.y = K.WY - waterline`. Everything else (bobbing, pitch) is done inside `animate`.
* Seat anchors: `'stand'` = the rider's feet point; `'sit'` and `'lean_out'` = the rider's hips (seat surface). `ang` is the rider's facing about Y (0 = looks along +Z). The driver of the cars sits on +X (left). `'lean_out'` (cars) is a label for the game's lean pose: the front side windows are open (dark cut-outs) so Harold and Mavis can lean out.
* Night: head / tail lights, cabin and cabin windows, nav lights, masthead, lanterns and the crab-shack sign glow through `out.glow` (the shared `K.GLOW_MAT`). Vehicles add no lights.
* Materials: the merged body uses the kit's `out` materials; the moving parts share **one** `K.toonMat()` per vehicle. No other material is created.

## Measured budgets (`window.__api.measure(id)`; ink hulls are counted in "tris (incl. hulls)")

### Static props (merge into the chunk: 0 draw calls of their own)

| prop | tris (incl. hulls) | tris (no hulls) | budget | result | coll | hooks | lamps |
|---|---|---|---|---|---|---|---|
| `lamp_acorn` | 310 | 268 | <= 350 | pass | 1 | - | 1 |
| `lamp_cobra` | 200 | 152 | <= 250 | pass | 1 | - | 1 |
| `bench_park` | 150 | 110 | <= 250 | pass | 1 | seat x1 | 0 |
| `bench_bus` | 126 | 76 | <= 300 | pass | 1 | seat x1 | 0 |
| `trash_can` | 88 | 72 | <= 250 | pass | 1 | - | 0 |
| `trash_can_recycling` | 188 | 156 | <= 250 | pass | 1 | - | 0 |
| `crab_shack` | 1208 | 920 | <= 2500 | pass | 1 | - | 1 |
| `manhole` | 50 | 50 | <= 120 | pass | 0 | manhole x1 | 0 |
| `ladder_wall` | 206 | 190 | <= 300 | pass | 0 | climb x1 | 0 |
| `ladder_drop` | 124 | 98 | <= 300 | pass | 0 | climb x1 | 0 |
| `parked_car_sedan` | 618 | 522 | <= 1500 | pass | 1 | - | 0 |
| `parked_car_hatchback` | 610 | 518 | <= 1500 | pass | 1 | - | 0 |
| `parked_car_pickup` | 634 | 504 | <= 1500 | pass | 1 | - | 0 |

### Vehicles

| vehicle | kind | tris (incl. hulls) | tris (no hulls) | budget | meshes | budget | ink hulls | draw calls | materials | seats | collider w x l x h | waterline | result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `water_taxi` | boat | 1118 | 1012 | <= 4000 | 4 | <= 8 | 1 | 5 | 5 | 4 | 3 x 9.1 x 2.75 | 0.35 | pass |
| `paddle_boat` | boat | 1212 | 880 | <= 2500 | 4 | <= 6 | 1 | 5 | 4 | 2 | 1.99 x 4.2 x 2.48 | 0.28 | pass |
| `dragon_boat` | boat | 1975 | 1703 | <= 6000 | 4 | <= 10 | 1 | 5 | 5 | 4 | 1.28 x 14.45 x 2.34 | 0.22 | pass |
| `car_sedan` | car | 922 | 826 | <= 2000 | 7 | <= 7 | 1 | 8 | 5 | 2 | 1.9 x 4.67 x 1.5 | 0 | pass |
| `car_hatch` | car | 914 | 822 | <= 2000 | 7 | <= 7 | 1 | 8 | 5 | 2 | 1.85 x 4.11 x 1.5 | 0 | pass |
| `box_truck` | car | 840 | 774 | <= 2500 | 7 | <= 7 | 1 | 8 | 5 | 2 | 2.6 x 6.97 x 3.07 | 0 | pass |
| `arabber_cart` | cart | 2869 | 2615 | <= 5000 | 10 | <= 12 | 1 | 11 | 5 | 2 | 1.8 x 6.27 x 3.52 | 0 | pass |
| `skateboard` | board | 376 | 328 | <= 600 | 3 | <= 3 | 1 | 4 | 3 | 1 | 0.34 x 0.92 x 0.16 | 0 | pass |

* "meshes" are renderable meshes **not counting the ink hulls** (the brief's own reference counts "a mesh plus an ink hull" as one part). Draw calls = meshes + hulls.
* "materials" = distinct materials in the vehicle: the shared kit `out` materials (toon, ink hull, glow, atlas) + the one `toonMat` for the moving parts.
* `trash_can_recycling` is `buildTrashCan(..., { recycling: true })`; the plain can is 88 tris.
* The dragon boat's 20 paddles are one mesh whose vertices are rotated per frame about each paddle's shoulder (about 500 vertices); `v.parts.paddles.visible = false` switches it off if the game prefers no CPU vertex work.

## Self-test results

| check | result |
|---|---|
| every prop and vehicle exists with the exact signature and return shape | all 12 static props (plus the recycling variant) and the 8 vehicles load and build with zero console errors |
| `?show=props` / `?show=vehicles` | pavement row with all 12 static props; vehicles with animate running |
| budgets | tables above, all pass |
| hooks | manhole -> `'manhole'`, ladders -> `'climb'`, benches -> `'seat'`, lamps -> `out.lamp` (counts in the first table) |
| night previews | lamp globes, headlights / tail lights, cabin windows, crab-shack neon, lanterns glow (`previews/*_night.png`) |
| seats line up with the hero rig | Harold dummy (1.6 m, kit rig) at every anchor in `?show=<vehicle>`; hips on the seat, feet on the deck |
| collider matches the visible hull | `&collider=1` overlay; box = the vehicle's bounding box (mast / mirrors excluded from width / height where noted in code) |
| one atlas | `PROP_TILES` -> one `K.makeAtlas` (13 tiles) for all props and vehicles |

## Kit

`toadcity_kit.js` was rebuilt from Appendix A (the starter zip was missing); the rig, pose tables and lighting presets that the appendix elides were re-created from the brief's numbers.
The modules use `K.THREE`, `K.place`, `K.makeOut`, `K.makeAtlas`, `K.toonMat` and `K.CURB` (fallback 0.16). Nothing else. Replace the file with the game's own kit and they keep working.

## Known issues / decisions

1. Livery details are recreations from memory (the harbour water-taxi's white / navy / gold scheme with blue lettering, the Utz-style truck, arabber red / yellow / green): the wording and shapes are original canvas drawings, not a verified match of the real vehicles.
2. Vehicle meshes are counted without ink hulls (see above). With hulls the car body adds one draw call, the sedan reads 8 draw calls.
3. The cars' `lean_out` is only a label for the game's pose; the viewer leans its dummy by about 55 degrees so the anchor can be checked against the open window.
4. Wheels, paddles, pony legs and tail are moving parts and have **no ink hull** (the dark tyres and thin parts do not need one); the pony's body, the dragon head and everything merged do.
5. `animate` assumes `dt` in seconds and a speed in m/s; the pony's walk, wheel spin and paddle rate scale with `speed`; at `speed = 0` boats still bob and the pony stands.
6. The crab shack's neon CRABS is geometry (dull tube by day); the painted STEAMED CRABS board is a canvas decal and does not glow (a glow layer would hide it). One `out.lamp` lights the front.
7. Parked cars stand on the road (y 0). Place them with `ang` = the lane direction; the viewer's props row turns them by 90 degrees to line up.
8. Helper names are namespaced per file (`PS`, `CS`, `VC`, `VB`, `VT`, `vcFit`, ...) and `PROP_TILES` lives in a closure, so concatenating the files does not collide (only `META` is repeated, as required).
