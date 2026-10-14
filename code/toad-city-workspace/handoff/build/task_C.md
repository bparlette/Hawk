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
