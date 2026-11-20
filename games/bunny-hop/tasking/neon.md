# NEON TASKING — Bunny Hop: the world

You own ONE thing: the world module for **Bunny Hop**, a third-person BMX web game (Three.js, hosted at Hawk `games/bunny-hop/`). Moth owns the game loop, bike, camera, and swimming. Opus owns the physics. You build the place — and the place is the screenshot: a dusk neighbourhood canal crossing that looks like the GTA VI bike clips it was inspired by.

## Deliverable

- `src/world/buildWorld.js` — pure ESM, imports three only. Exports `buildWorld(scene)` returning the data contract below.
- `src/world/world-preview.html` — a standalone page that loads three from the same CDN as the game, builds your world, and orbits a free camera slowly. This is how Moth reviews your work — it must run by just opening the page.
- Do not modify any other file. No external assets, no image files, no model files: everything procedural in code (geometry + materials). Text files only.

## The place

Golden-hour-into-dusk, one canal neighbourhood, roughly 220 m × 160 m:

- **The canal** runs the length of the map, ~14 m wide, water surface at y = 0 with a visible current shimmer (animated material offset is fine — cheap). Banks slope down to the water on both sides, with **two climb-out spots** (steps or a ladder) — mark them in the data contract.
- **The bridge** crosses mid-map: rideable deck ~4 m above the water, low rails a bunny hop can clear, streetlights on both ends. The bridge is the money shot — underside structure, posts into the water, the lot.
- **Streets** on both banks with sidewalks, curbs, painted lines worn thin, a few parked cars (simple but shaped: body, cabin, wheels — not boxes on cylinders), fences, hedges, palms or shade trees.
- **Trash bins**: a run of 5–6 bins along one street (the hop line), plus a few singles and one dumpster. Every bin is a landable platform ~1.1 m tall.
- **Houses**: one row of simple dressed houses (roof lines, porches, AC units, a lit window or two) — silhouettes against the dusk matter more than detail.
- **Sky & light**: gradient dusk sky (deep blue up top, orange-pink at the horizon), one warm low sun, blue-hour ambient, streetlights and windows emissive as the scene darkens. Fog for depth, tuned so the far bank fades.

## Data contract (fixed — physics and gameplay code against this)

```js
buildWorld(scene) -> {
  colliders: [ { min: [x,y,z], max: [x,y,z], type: 'bin'|'wall'|'rail'|'car'|'tree' } ],
  surfaces:  [ { min: [x,y,z], max: [x,y,z], type: 'ground'|'bin'|'deck' } ], // landable tops incl. every bin top + bridge deck
  water:     { level: 0, rect: [minX, minZ, maxX, maxZ] },
  climbOut:  [ { x, z } ],   // points where a swimmer can exit
  spawn:     { x, z, heading }
}
```

**What you see must be what you hit.** Every visible bin, rail, car, and wall appears in `colliders`; every landable top appears in `surfaces` at its true height. If a prop is decorative-only, it must be obviously non-interactive (e.g. behind a fence) — no invisible walls, no visible-but-ghost bins.

## Performance rules (phone-first)

- Reuse geometries and materials; merge static geometry where you can. Target < 150 draw calls for the whole world and say the actual count in your report.
- No per-frame allocations in any animation you add; water shimmer via texture-offset or shader time uniform only.
- Keep the module self-contained: no changes to the game's main loop to accommodate you.

## Report (Moth audits against the build, not your numbers)

Report: draw-call count, the screenshot from your own preview page at the bridge looking down the canal at dusk, and anything you simplified. Expect the audit to open the preview page and check the bin line and the bridge first.
