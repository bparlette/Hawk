# Task D: The 17 bosses

## Goal
Build the 17 approved bosses: one per landmark district plus the final boss. Each one needs a **model sheet** (front, side, back and three-quarter views, plus the three attack poses on one image) and a **drop-in rig module** in the Toad City style, with **three attack poses** each. Every boss is original: no real people, official mascots, team marks or brand logos on the characters (real signage belongs to the environment, not the bosses).

## The roster (approved; keep the names and concepts)
| # | id | Boss | Landmark district | Concept |
|---|---|---|---|---|
| 1 | `bird_brain_bobby` | Bird Brain Bobby | Oriole Park | A rogue bird mascot (orange-and-black songbird, original design) who pitches fastballs down a brick warehouse hallway |
| 2 | `raven_king` | The Raven King | M&T Bank Stadium | A giant raven linebacker in shoulder pads (original colours) with a "Nevermore" blitz charge |
| 3 | `dr_shellacious` | Dr. Shellacious | Science Center | A mad snapping-turtle scientist in a lab coat and goggles who fights in the IMAX theatre |
| 4 | `hon_queen` | The Hon Queen | Federal Hill | Beehive hair, cat-eye glasses and leopard-print capris; throws hairspray clouds and shoves you down the hill |
| 5 | `sugar_rush` | Sugar Rush | Domino Sugar | A sugar-crystal golem, faceted and glittering, glowing at night beside the neon sign |
| 6 | `compression_king` | The Compression King | Tide Point (sports store) | An athleisure mannequin brute in blank, unbranded gear |
| 7 | `admiral_redclaw` | Admiral Redclaw | Fort McHenry | A redcoat crab admiral from 1812 with a cannon arm firing rocket barrages |
| 8 | `big_jimmy` | Big Jimmy | National Aquarium | A giant blue crab (a male "jimmy") fought underwater |
| 9 | `voltage_vic` | Voltage Vic | Power Plant | An electric-eel DJ whose attacks drop on a Baltimore club beat |
| 10 | `chef_crabcake` | Chef Crabcake | Four Seasons | A chef who throws blinding seasoning and swings two crab mallets |
| 11 | `arabber_al` | Arabber Al | Fells Point | A street-produce arabber on a souped-up horse-cart that runs a car chase |
| 12 | `pool_shark` | The Pool Shark | Pendry (pier pool deck) | A shark hustler in a cabana shirt and sunglasses, with a pool-cue attack and a belly-flop splash |
| 13 | `dragon_boat_duchess` | Dragon Boat Duchess | Harborplace | Rides a giant dragon paddle boat; regal and tiara'd, with a paddle-sceptre |
| 14 | `captain_cobblestone` | Captain Cobblestone | USS Constellation | A ghost privateer: translucent glow at night, cutlass and lantern |
| 15 | `penthouse_pigeon` | The Penthouse Pigeon | World Trade Center (roof deck) | A rich pigeon in a smoking jacket on a rooftop deck |
| 16 | `stoop_scrubber` | The Stoop Scrubber | Washington Monument (Mount Vernon) | A marble-step matriarch with a scrub brush, a bucket and slippery suds |
| 17 | `mister_formstone` | **Mister Formstone** (final boss) | City-wide | A crime lord whose face and body are fake-stone (Formstone) armour plates that crack off in phases to reveal the creature beneath |

Pool Shark has no further brief, so the line above is the approved direction. Keep the rest of each design consistent with its concept line.

## Interface (must match exactly)
File: `src/boss_<id>.js`
```js
export const META = { id: 'raven_king', name: 'The Raven King', district: 'mt_stadium', hp: 120, scale: 1.6, radius: 0.9, height: 3.4 };
export const ATTACKS = [ // the game's combat reads these; times are fractions of the attack's duration
  { id: 'nevermore_blitz', pose: 'atk1', dur: 1.1, windup: 0.4, active: [0.4, 0.7], reach: 4.5, arc: 60, dmg: 14, move: 6, fx: 'dash' },
  { id: 'wing_clap',       pose: 'atk2', dur: 0.8, windup: 0.3, active: [0.3, 0.5], reach: 2.2, arc: 160, dmg: 10, fx: 'shockwave' },
  { id: 'talon_slam',      pose: 'atk3', dur: 1.3, windup: 0.6, active: [0.6, 0.75], reach: 3.0, arc: 360, dmg: 16, fx: 'ground_slam' },
];
export function buildRavenKing(K, opts = {}) {
  const mat = K.toonMat(); const J = K.skeleton(D /* same 18 joint keys */, mat);
  // … K.part(…) …   optional extra groups: J.extra = { wingL, wingR, tail, … }
  J.kind = 'boss'; J.meta = META; return J;
}
export const POSES = {             // each returns a K.blank()-format object: { y, ty, tilt:[x,y,z], hips:[…], …, swR:[…] } (radians)
  idle(t, J) { /* … */ }, run(t, speed, J) { /* … */ }, hurt(u, J) {}, down(u, ground, J) {},
  atk1(u, J) { /* u = 0..1 through the attack */ }, atk2(u, J) {}, atk3(u, J) {},
};
export function animateBoss(J, t, state, u) { /* optional: extra groups (wings, tails, suds, glow); must be safe to skip */ }
```

- Poses are applied with `K.applyPose(J, pose, rate, dt, snapTilt)`, exactly like the heroes. Build each pose from `K.blank()` and helpers such as `K.legsStance()` and `K.runLegs()`, and look at `K.HERO_POSES.atk1–atk3` for the style: anticipation, a fast strike and a held follow-through.
- **Three attack poses per boss** must read as three distinct silhouettes (for example a charge, a sweep and a slam) and match the concept. The hit window `active` must line up with the visible strike frame.
- Vehicle-bound bosses (Arabber Al's cart, the Duchess's dragon boat) put the rider and the vehicle in the same module: `J.vehicle` is a Group under `J.root`, built with the same material rules.
- Night: glowing elements (Sugar Rush's crystals, Voltage Vic's sparks, Captain Cobblestone's ghost glow) use `K.basicMat({ transparent: true })` parts whose opacity follows `K.NIGHT.value` in `animateBoss`. They must not add lights.
- Mister Formstone: `opts.phase` 0/1/2 removes armour plates in stages, or `J.plates` lists the plate meshes so the game can knock them off.

## Model sheet (per boss)
`previews/<id>_sheet.png` at 2048×1024 with turnaround views (front, ¾, side, back) plus atk1, atk2 and atk3, rendered from the viewer at a neutral grey background in the day preset. Add a name label under each view. Also deliver `<id>_day.png`, `<id>_night.png` and `<id>_phone_390x844.png` (the boss facing Harold at about 6 m).

## Performance budget (per boss)

- **≤ 70 parts**, **≤ 22,000 triangles**, ≤ 4 materials (toon plus up to 2 mapped toon sub-materials plus 1 basic glow material), and the shared `K.OUT_CHAR`.
- Only one boss is on screen at a time, but it fights alongside up to 6 thugs and the two heroes on an iPhone.

## Acceptance checklist

- [ ] `src/boss_<id>.js` for all 17 bosses, each exporting `META`, `ATTACKS` (exactly 3), `POSES` (idle, run, hurt, down, atk1–3) and one build function. `animateBoss` is optional.
- [ ] Model sheet plus day, night and phone previews for each boss.
- [ ] ≤ 70 parts, ≤ 22k triangles and ≤ 4 materials, measured and written in the README table.
- [ ] Faces +Z, feet on y = 0, `META.height` matches the measured bounding box within 10%.
- [ ] Hit-flash turns the whole boss white (every sub-material shares `mat.userData.flash`).
- [ ] The three attacks are visually distinct and the `active` windows match the strike frames.
- [ ] Every boss is an original design that matches the concept line, with no real people, likenesses, mascots, team marks or brands.
- [ ] No console errors. Poses never invert joints or detach parts.

## Do NOT

- Do not use SkinnedMesh, GLTF, morph targets, AnimationMixer or image files.
- Do not build landmark architecture for the boss arenas (the in-house team does that). A small boss-owned prop (a lectern, a DJ booth, a bucket) is fine and counts toward the budget.
- Do not make likenesses of real persons or official mascots.

## Session plan
Build **one boss per session**: (1) a written design note of about 120 words on silhouette, palette and the three attacks; (2) the build plus idle, self-tested; (3) the three attacks, self-tested; (4) hurt, down and run; (5) the model sheet and previews; (6) the checklist. Mister Formstone goes last.
