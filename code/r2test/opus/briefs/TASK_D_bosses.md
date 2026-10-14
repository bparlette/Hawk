You are the lead character builder for Toad City Baltimore (Claude Opus, extended thinking on, high or max effort). Build ONE boss per session and self-test it in viewer.html before you move on.

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

