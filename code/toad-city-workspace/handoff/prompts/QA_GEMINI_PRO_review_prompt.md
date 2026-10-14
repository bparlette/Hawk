# QA review prompt: Gemini Pro (thinking: high)

## Copy-paste review prompt
```
ROLE: You are the QA reviewer for Toad City Baltimore game assets. You do not build assets; you judge them and write
precise fixes. Other models (Claude Opus: thug gangs + bosses; Claude Sonnet: rowhouse kit + props/vehicles) deliver
zips. You receive one delivery at a time: its README.md, LICENSES.md, src/*.js and previews/*.png.

INPUTS I WILL PASTE / ATTACH:
  1. The task letter (A, B, C or D) and its acceptance checklist (from this brief).
  2. The delivery's source files and preview PNGs (day, night, phone 390x844, model sheets for bosses).
  3. Optional: the viewer readout text (draw calls / tris / meshes) for each asset.

DO, IN ORDER:
  A. Interface check (gate): every export name, signature and return shape matches the task's Interface section exactly.
     No import statements; materials only via K.toonMat / K.basicMat / K.makeAtlas; outlines only the shared K.OUT_* hulls;
     no Math.random at build time; no image/model files; no lights; three.js r160 API only; toadcity_kit.js unchanged.
  B. Budget check (gate): compare the README's measured numbers AND your own estimate from the code
     (count K.part / out.* calls, segment counts of K.G primitives) against the task's budget table. Flag any number
     that is missing, implausible, or over budget.
  C. Originality / licence check (gate): CHARACTERS (Tasks C, D) must be original: no real people, likenesses,
     official mascots, real gang symbols or brand logos on them. ENVIRONMENT (Tasks A, B) MAY use real Baltimore
     business names and sign styles where they really exist (Phillips Seafood, Barnes & Noble, Hard Rock Cafe at the
     Power Plant, water-taxi branding, Natty Boh-style bar signs, Utz, Old Bay): pass if redrawn on canvas / geometry,
     FAIL if a logo image file, photo or traced artwork is embedded, or a real name is put somewhere implausible.
     LICENSES.md present; any third-party code is MIT or CC0 with a URL.
  D. Style check from the PNGs against the Style Guide: ink outlines present on major masses and ~constant width;
     three hard cel bands (no smooth gradients, no PBR shine); palette fit (INK #14101f for black, no pure #000/#fff
     bodies); silhouette readable at phone scale; night preview readable (glows where required, nothing pitch black).
  E. Function check: rig joint names / poses (C, D), hooks (manhole / climb / seat / lamp) (A, B), night glow
     through out.glow or a NIGHT-driven basic material, colliders and camera boxes present, deterministic seeds.
  F. Score every asset with the rubric. PASS only if all three gates pass AND total >= 75 / 100 AND no category scores 0.

OUTPUT FORMAT (markdown, nothing else):
  ## Delivery: <zip name> (Task <X>)  — overall PASS | FAIL
  | Asset id | Gates (I/B/O) | Style | Read | Night | Func | Code | Docs | Total | Verdict |
  then, per asset that is not a clean PASS:
  ### <asset id> — FAIL (or PASS with notes)
  1. [severity: blocker|major|minor] <file>:<line or function> — <what is wrong> → <exact fix, with numbers>
  ...
  End with "Top 3 fixes for the next session" so the builder can act immediately.
RULES: Be specific (name the part, colour hex, budget number, pose name). Never rewrite whole files; give targeted
fixes. Do not invent requirements beyond this brief. If you cannot verify something from the inputs, say "UNVERIFIED"
and say what evidence you need.
```

## Scoring rubric (100 points per asset, plus 3 pass/fail gates)
| Category | Points | 0 | Half marks | Full marks |
|---|---|---|---|---|
| **Gate I: Interface** | pass/fail | Wrong names, imports, own materials or outlines | n/a | Exact signatures and return shapes; kit unchanged |
| **Gate B: Budget** | pass/fail | Over budget, or numbers missing | n/a | Every number measured and inside budget |
| **Gate O: Originality and licence** | pass/fail | Real person or likeness, logo on a character, embedded logo file, or unclear licence | n/a | Characters original; real signs redrawn in code; LICENSES.md correct |
| Style match | 25 | No outlines, smooth or PBR shading, off-palette | Outlines and bands present, palette drifts | Reads as the same game as Harold and Mavis in the reference renders |
| Silhouette and readability | 20 | Mush at 8 m on a phone | Readable but generic | Instantly identifiable at phone scale; gang or boss reads at a glance |
| Day and night | 15 | Night is black or has no glows | Glows exist but are weak or misplaced | Both presets look intentional; glows exactly where the brief asks |
| Function and hookup | 20 | Breaks poses, hooks or colliders | Works with glitches (clipping, a missing hook) | All poses clean; hooks, colliders and animate() correct |
| Code quality | 10 | Unreadable, nondeterministic | Works but messy | Clear, seeded, commented where non-obvious |
| Deliverables and docs | 10 | Missing previews or README | Partial | Every required PNG, README table, LICENSES.md |

**Verdict:** PASS when all three gates pass, the total is ≥ 75 and no category scores 0. Otherwise FAIL, with the numbered fixes.
**Severity:** a *blocker* is a gate failure or a crash; *major* is a checklist item missed or a category under half marks; *minor* is polish.


## Acceptance checklist and budgets: Task A: Baltimore rowhouse and city-block kit
## Performance budget

- **One house ≤ 2,500 triangles**, a corner building ≤ 3,500, and **one full block ≤ 30,000**.
- Materials: only what `out` uses (`K.CITY_MAT`, the glow material and **one** kit atlas for the whole task). A full block must build to **≤ 4 draw calls** (plus the shadow pass).
- Outline hulls only on major masses (house box, stoop, cornice, bay edges). Use `outline: false` for anything under about 6 cm (mullions, bricks, trim strips).

## Acceptance checklist

- [ ] All five pieces exist with the exact signatures. `viewer.html?show=street` shows two facing blocks across a 10 m street with a pavement, in day and night.
- [ ] Formstone, white marble stoops, bracketed cornices, painted screens, corner bar and corner shop are all present and recognisable.
- [ ] Both 3- and 4-storey variants exist, with at least 3 front types and at least 4 painted screen designs.
- [ ] Budgets are measured: house ≤ 2.5k, corner ≤ 3.5k and block ≤ 30k triangles; a full block uses ≤ 4 draw calls; there is one atlas in total.
- [ ] Night: about 45% of windows lit (seeded, stable on rebuild), with shop glass and neon glowing.
- [ ] Colliders, camera boxes and climb hooks are written. Nothing floats and nothing sinks below `CURB`.
- [ ] Same seed gives the same block; a different seed gives a visibly different mix.
- [ ] Signs read as real Baltimore: real names and sign styles only where they really exist or are typical, all drawn on canvas or built from geometry (no logo image files). `LICENSES.md` is present.


## Acceptance checklist and budgets: Task B: Street props and vehicles
## Performance budget

- Static props: the per-prop triangle budgets in the table above. They add **no draw calls**, because they merge into the chunk.
- Vehicles: the triangle and mesh budgets in the table. Use at most 2 materials per vehicle (the `out` materials plus one shared `toonMat` for moving parts), and no textures beyond the shared prop atlas.
- Use **one 1024² atlas for the whole of Task B** (`src/props_tiles.js` exporting `PROP_TILES`) for signs, menus, livery text and the manhole ring.

## Acceptance checklist

- [ ] Every prop and vehicle in the two tables exists with the exact signature and return shape.
- [ ] `viewer.html?show=props` shows all static props in a row on a pavement strip; `?show=vehicles` shows every vehicle with `animate()` running (wheels spin, paddles stroke, the pony walks, boats bob on a water plane at `WY`).
- [ ] Budgets are measured and written in the README (triangles per prop; triangles, meshes and draw calls per vehicle). There is one atlas in total.
- [ ] Hooks are present: manhole → `'manhole'`, ladders → `'climb'`, benches → `'seat'`, lamps → `out.lamp`.
- [ ] Night previews show the lamp globes, headlights and signs glowing and readable.
- [ ] Seats line up with the hero rig (Harold is about 1.6 m tall), and the `collider` box matches the visible hull.
- [ ] Liveries and signs use real Baltimore names and styles where they really exist, all redrawn on canvas or built from geometry (no logo image files). `LICENSES.md` is present.


## Acceptance checklist and budgets: Task C: Thug gangs (5 district gangs)
## Performance budget (per member, HD, `opts.lod = 0`)

- **≤ 40 parts** (meshes, not counting hulls), **≤ 12,000 triangles**, ≤ 3 materials (one `toonMat` plus at most one canvas-mapped `toonMat` sub-material, plus the shared outline).
- LOD 1: ≤ 14 parts, ≤ 3,000 triangles.
- Up to 31 thugs exist at once, so keep the budget.

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


## Acceptance checklist and budgets: Task D: The 17 bosses
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
