You are the lead character builder for Toad City Baltimore (Claude Opus, extended thinking on, high or max effort). Build ONE gang per session and self-test it in viewer.html before you move on.

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


# Task C: Thug gangs (5 district gangs)

## Goal
Build five original street gangs, one per district of the Inner Harbor. Each gang is made of anthropomorphic **Chesapeake animals** and modelled at **Harold-level detail** (the reference is `K.buildHero()`), not at the level of the current simple human thugs. Each gang must drop straight into the game's existing thug system: same skeleton, same poses, same hit-flash and the same outline LOD.

## The five gangs (names and animals are approved; looks are yours to design)
| id | Gang | Animal | District (landmarks) | Signature accent |
|---|---|---|---|---|
| `harbor_rats` | Harbor Rats | Norway rats | North shore: Harborplace, USS Constellation, World Trade Center, Washington Monument | mustard `#ffd23c` + navy |
| `pier_gulls` | Pier Gulls | herring gulls | Piers: Aquarium, Power Plant, Four Seasons | white + `#2f5bd3` blue |
| `cobble_catfish` | Cobblestone Catfish | channel catfish | Fells Point, Pendry | slate `#5f6688` + `#1fd3c6` teal |
| `masked_bandits` | Masked Bandits | raccoons | West side: Oriole Park, M&T Bank Stadium, Science Center | `#ff9f1c` orange + grey |
| `key_hwy_otters` | Key Highway Otters | river otters | South shore: Federal Hill, Domino Sugar, Tide Point, Fort McHenry | `#23c26b` green + brown |

Each gang has **4 members**: `grunt_a`, `grunt_b`, `armed` (carries an original improvised weapon: an oar, a crab mallet, a rolled newspaper, a fishing rod, a traffic cone and so on, held in `J.swR`) and `bruiser` (built big; the game scales it ×1.2 and gives it double HP). The members of a gang share a clear gang uniform motif (a jacket colour, bandanas, a patch shape) so the player can tell the districts apart at a glance. Do not use real gang colours or symbols.

## Interface (must match exactly)
File: `src/gang_<id>.js`
```js
export const GANG = { id: 'harbor_rats', name: 'Harbor Rats', animal: 'rat', district: ['harborplace', 'constellation', 'wtc', 'monument'],
  accent: '#ffd23c', members: ['grunt_a', 'grunt_b', 'armed', 'bruiser'] };
export const META = { grunt_a: { hp: 8, scale: 1, radius: 0.42, weapon: null }, /* … */ bruiser: { hp: 16, scale: 1.2, radius: 0.55, weapon: null, big: true } };
export function buildHarborRat(K, member = 'grunt_a', opts = {}) {   // opts: { lod: 0 | 1, seed, colors }
  const mat = K.toonMat(); const J = K.skeleton(K.THUG_D /* or your own d with the SAME keys */, mat);
  // … K.part(J.<joint>, K.G.<prim>(…), colour, x, y, z, { rot, outline, mat }) …
  J.head = /* group under J.neck */; J.kind = 'thug'; J.meta = META[member];
  return J;
}
```

- Use **the 18 joint names** from `K.skeleton()`: tilt, hips, torso, neck, shL/R, elL/R, haL/R, lgL/R, knL/R, ftL/R and swL/R. The game animates them with `K.THUG_POSES` (idle, run, windup, attack, hurt, down, getup) **without changes**, so the limbs must look right in every one of those poses.
- If you change proportions, pass your own `d` object with the same keys as `K.THUG_D`. Keep `hip` between 0.8 and 1.0.
- `armed` must create `J.swR = K.grp(J.haR, 0, -0.04, 0)` and build the weapon inside it along +Y, as `buildThug` does. The attack pose checks `J.swR`.
- Tails, ears and whiskers can go on extra groups (for example `J.tail`) with an optional `export function animateGang(J, t, state)`, which receives the state ids idle/run/attack/hurt/down. They must still look fine if it is never called.
- Every hull must be the shared `K.OUT_CHAR`; `K.part()` adds it. Use `outline: false` on parts thinner than about 4 cm (whiskers, eyelids, stripes).
- **Far LOD:** `opts.lod === 1` builds the same character with at most 14 parts and no fine details. The game swaps it in beyond 24 m.

## Performance budget (per member, HD, `opts.lod = 0`)

- **≤ 40 parts** (meshes, not counting hulls), **≤ 12,000 triangles**, ≤ 3 materials (one `toonMat` plus at most one canvas-mapped `toonMat` sub-material, plus the shared outline).
- LOD 1: ≤ 14 parts, ≤ 3,000 triangles.
- Up to 31 thugs exist at once, so keep the budget.

## Style

- Match Harold's construction: chunky primitive shapes (spheres, capsules, cylinders, boxes) built with `K.G`, vertex colours from the palette, cel bands from the kit's toon ramp and ink hulls.
- Big readable heads, a clear facial expression and a gang-specific silhouette (a rat's long snout and tail, a gull's beak, a catfish's barbels, a raccoon's mask, an otter's sleek body).
- Use mid-value base colours. Avoid pure black and white: use `K.INK` (`#14101f`) for black and at most `#f2f2f2` for white. Characters must stay readable under the night preset.
- Skin texture is optional: one canvas map drawn in code (fur flecks, scales), ≤ 256², in the style of the kit's `WARTS` map.

## Acceptance checklist

- [ ] `src/gang_<id>.js` for all 5 gangs, each exporting `GANG`, `META` and one build function that takes `member` and `opts`.
- [ ] Every member renders in `viewer.html` in all 7 thug poses with no detached or inverted limbs, and the weapon follows the right hand.
- [ ] Each member measures ≤ 40 parts and ≤ 12k triangles; LOD 1 measures ≤ 14 parts and ≤ 3k triangles; there are ≤ 3 materials.
- [ ] All outlines use the shared `K.OUT_CHAR`; thin parts use `outline:false`; the hulls are BackSide ShaderMaterial children, so the game's distance LOD finds them.
- [ ] The rig faces +Z, the feet touch y = 0 in idle, and the height is 1.8–2.2 m (×1.2 for the bruiser).
- [ ] Hit-flash works: setting `J.mat.userData.flash.value = 0.85` turns the whole rig white, including any sub-materials, which must share `mat.userData.flash` and `flashC`.
- [ ] The four members of a gang read as one gang, and the five gangs read as different from each other at 8 m on a 390×844 screen.
- [ ] Day and night previews for every member, plus a lineup of each gang.
- [ ] Original designs, with no real people, no brand logos on clothing and no real-gang references. `LICENSES.md` is present.

## Do NOT

- Do not use skinned meshes, SkinnedMesh/Bone, GLTF, morph targets or mixers. The rig is plain groups posed by code.
- Do not create materials per part. Do not add lights or shadows-only meshes.
- Do not make humans. Every gang member is an animal.
- Do not model the heroes, bosses or landmarks.

## Session plan
Build **one gang per session**: one grunt first (self-test it), then the other members, then LOD 1, then the previews. Finish and pass the checklist before you start the next gang.


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


## Lessons from Harbor Rats review (2026-10-11)

Gang 1 (Harbor Rats) passed every hard rule and every budget, but the in-house review against the **real game code** found problems that the delivered viewer could not show. The appendix kit's `HERO_POSES.down` is a stand-in. The real one raises the arms overhead and lays the rig flat on its back. Gangs 2–5 must meet the requirements below as well as everything above. Where a line here is stricter than the brief, this section wins.

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
