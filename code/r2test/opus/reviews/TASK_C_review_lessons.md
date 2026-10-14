# Task C: review lessons for gangs 2–5 (standalone copy)

## Lessons from Harbor Rats review (2026-10-11)

Gang 1 (Harbor Rats) passed every hard rule and every budget, but the in-house review against the **real game code** found problems that the delivered viewer could not show. The appendix kit's `HERO_POSES.down` is a stand-in. The real one raises the arms overhead and lays the rig flat on its back. Gangs 2–5 must meet the requirements below as well as everything in `TASK_C_thug_gangs.md` (this section is also appended to that brief). Where a line here is stricter than the brief, this section wins.

### 1. Test against the real `down` pose (arms overhead, rig flat on its back)

The game's `THUG_POSES.down` is `HERO_POSES.down` with a lower `ty`. These are the real values from `04_actors.js`. Paste them into your kit's `HERO_POSES` / `THUG_POSES` before you self-test, replacing any stand-in:

```js
// HERO_POSES (04_actors.js)
down(u, ground) {
  const p = blank(); p.tilt = [-Math.PI / 2 + 0.08, 0, 0]; p.ty = ground ? 0.3 : 0.6;
  p.lgL = [-0.6, 0, 0.3]; p.knL = [0.9, 0, 0]; p.lgR = [-0.2, 0, -0.2]; p.knR = [0.4, 0, 0];
  p.shL = [-2.6, 0, 0.6]; p.shR = [-2.4, 0, -0.9]; p.elL = p.elR = [-0.4, 0, 0]; p.neck = [0.4, 0, 0];
  p.swL = [Math.PI / 2, 0, 0]; p.swR = [Math.PI / 2, 0, 0];
  if (!ground) { p.tilt = [-Math.PI / 2 * clamp(u * 2.2, 0, 1), 0, 0]; }
  return p;
},
// THUG_POSES (04_actors.js)
down(u, ground) {
  const p = HERO_POSES.down(u, ground); p.ty = ground ? 0.2 : 0.5; return p;
},
```

- **Arms overhead:** `shL` −2.6 and `shR` −2.4 rad. The armed member's `windup` also raises the right arm to `shR` [−2.9, 0, −0.3].
  - Your shoulder pivot (`d.shX`) must sit close enough to the torso surface that the upper arm still touches the torso there.
  - **Requirement:** a gap of no more than 1 cm between the torso parts and the `shL`/`shR` parts in `down(1, true)` and in `windup(0.6, J)`, measured by sampling their surfaces.
  - Harbor Rats had 3 cm at `shX` 0.30; 0.27 fixed it. A fur shoulder ball also works, but it costs a part.
- **Flat on the back:** `tilt` reaches −π/2 + 0.08, so everything behind the hips (tails, back patches, hoods, packs) ends up pointing at the floor.
- **How the game reaches `down` (`06_game.js`):**
  1. A knock-down hop: `vy` 4.2, gravity 22, airborne about 0.38 s.
  2. The pose damps in at rate 13.
  3. After 1.25 s it switches to `getup` (rate 14, 0.5 s), or to `dying`, which holds `down(1, true)`.

  Test the end pose and the blend: `down(u, false)` for u 0.1–1, `down(1, true)`, and a frame-by-frame hurt → down → getup → idle run at 60 fps with those rates.

### 2. Tails, ears and back parts must not go through the ground in any real pose

- **Requirement:** in every real pose (idle, run, windup, attack, hurt, `down` falling and grounded, getup) and through the blend above, no vertex of a non-hull mesh goes below y = −0.03. The only exceptions are the feet, which the stock thugs also sink 4–8 cm, and the weapon in `down`, which the stock thugs sink about 0.2 m. Report the measured lowest point for tails and ears in the README.
- **First choice:** design the rest pose so it passes **without** `animateGang`, because the brief says the rig must look fine if it is never called. A tail that curls up behind the hips does not pass; it goes 0.66–0.79 m through the floor when the rig lies down.
- **If a long tail cannot pass at rest:**
  - `animateGang` must handle `'down'` by laying the whole tail flat toward the feet. Harbor Rats uses tail −0.15, tail1 0.1, tail2 0.15 rad with a small side swish.
  - In the other states the tail must follow `J.tilt.rotation.x`, so the damped getup blend never points a half-curled tail straight down.
  - Map the game's states: `down`/`dying` → `'down'`, `getup` → `'idle'`, `chase` → `'run'`, `windup` → `'attack'`, `dizzy` → `'hurt'`.
  - The README must then say plainly that **`animateGang` is required every frame (after `applyPose`) whenever `down` is used**, and give the measured clearance with and without it.

### 3. Shadows: `shadow: false` on thin parts and on every no-outline part

- `K.part` turns on `castShadow` whenever the bounding radius is above 0.1. A 0.5 m whisker box (9 mm thick) therefore casts a shadow, and in the game's 512 px shadow map that shimmers.
- **Requirement:** every part with `outline: false` also gets `shadow: false`, and so does any part thinner than about 4 cm in two of its dimensions (whiskers, barbels, straps, antennae, thin rods), even if it is outlined.
- **Related:**
  - Do not sink an outlined decorative part mostly inside another outlined part. Its ink hull crosses the outer surface and draws a stray ink line. The Harbor Rats neckerchief knot did this across every rat's belly.
  - Keep such parts sitting on top of the surface, or give them `outline: false`.
  - Check a close front view in daylight for lines that follow no edge.

### 4. Texture caches: key on a stable object and never cache a failure

- **Requirement:** a module-level texture cache (for example a `WeakMap`) must be keyed on a stable shared kit object, `K.QUAL || K.THREE || K`, never on `K` alone. Integration may pass a fresh `{ ...K }` wrapper per spawn, and keying on `K` would redraw the canvas and add a texture to `QUAL.texs` for every thug.
- **Never cache "no texture":** if `document` is missing or the canvas fails, return no map for that build and draw it on the next build.
- Keep the canvas drawing seeded and deterministic, as gang 1 did.

### 5. LOD 1 must keep the gang colour and match the HD proportions

- **Requirement:** every member's LOD 1 keeps the gang's signature accent part (the neckerchief, bandana or patch), the armed member included. Free a slot elsewhere: a hips sphere hidden by the torso and legs at distance is the usual candidate.
- **Match HD:**
  - LOD 1 colours match HD part by part (sleeve and forearm colours included), so nothing pops when a rig swaps.
  - LOD 1 proportions match HD: apply the same per-member width and depth scales, such as a bruiser's ×1.28 width and ×1.22 depth.
  - Compare the HD and LOD 1 silhouettes side by side from the front, ¾ and side.

### 6. Budget headroom: stay at 37 parts or fewer per HD member

- **Requirement:** leave **at least 3 parts of headroom** under the 40-part cap (≤ 37 per HD member). Every Harbor Rat sat at exactly 40/40, so any fix (a shoulder ball, a strap) needs a matching removal.
- Keep the triangle total at or under 12k (hulls excluded) and materials at 3 or fewer, as before.

### 7. The README must report measured numbers only

- **Requirement:** every number in the README comes from a measurement in the delivered viewer or `tools/` script, stated with its pose and time (idle at t = 0):
  - parts, tris, hull tris, materials, height and feet min y per member at HD and LOD 1;
  - hulls and shadow casters per member;
  - whole-frame draw calls and tris;
  - the tail and ear clearance in `down`.
- No "about" figures. Gang 1's README said "about 34 hulls + about 23 shadow casters"; the measured counts were 28–29 and 27–30.
- Describe known issues with their measured size: say "the tail clips 0.66 m", not "clips slightly".
- Make sure the zip contains everything the README lists, `tools/` included.

### 8. Integration facts: write the README to match the real game

- **No LOD swap:** the game has none. `rigLod` in `06_game.js` only hides ink hulls and stops shadow casting beyond 24 m.
  - Ship `opts.lod === 1` as specified, but do not write that "the game swaps it in".
  - Swapping needs both rigs per thug with pose sync, which is in-house integration work.
- **`mergeRig`:** gang rigs must be run through the game's `mergeRig()` (`04b_rig_merge.js`). It only wraps `buildThug` and `buildHero` automatically.
  - Unmerged, an HD gang member costs about 95 draw calls (40 meshes + ~28 hulls + ~28 shadow casters). Merged it costs 3 plus 2 for shadows.
  - Build so a merge works: plain groups only, every extra group (tail, ears, weapon) parented under a skeleton joint, and at most one mapped sub-material that shares `flash`/`flashC`.
  - Check that `animateGang` still moves the merged bones and that the hit-flash still covers the mapped part.
- **Separate modules:** each gang file is loaded as its own ES module. Do not rely on being concatenated into `game.js`, because five files exporting `GANG`, `META` and `animateGang` would collide.
