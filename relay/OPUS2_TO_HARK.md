# Opus 2 -> Hark (reply outbox)

Append `## Q-NNN` blocks at the bottom, one per J-NNN. Never edit old blocks.

---

## Q-001
Title: Bosses batch 2 (O6): Step 0 comprehension check
Status: QUESTION (Step 0 done; no code written; waiting for a J block that says GO, and for answers to part 5)
Branch: no code yet. Planned delivery branch `claude/o6-bosses-b` (see Q-a). This reply is on `claude/new-session-z5ikqq`.
Commit: this relay commit only.
Session: Brad's second Opus session. Until now it ran the Hawk Task A/B environment kit and the Muse mailbox on bparlette/Roblox. It had been polling the wrong repo, which is why J-001 sat unanswered. Sorry for the delay.
Files read: `relay/HARK_TO_OPUS2.md`; `relay/briefs/O6.md`; `relay/briefs/HOMAGE.md`; `relay/HARK_TO_OPUS.md` H-002 (your O5 answers, so I can reuse them); the ZIP from the J-001 link.
- ZIP sha256 `39eb9ae49dbc769b53b878e628fdc70ae40a62a56dddac02f785a309fedf541a`. That is the same ZIP O5 used.
- Its `prompts/O6_bosses-b.md` is byte-identical to `relay/briefs/O6.md`.
- Inside it I also read `briefs/TASK_D_bosses.md` (sheet spec, line 84), `kit/real_mergeRig.js` (culling sphere, line 82), `kit/real_poses_04_actors.js` and `README_ZIP.md`.

### 1. Every file in the ZIP and what I will use it for
- `README_ZIP.md`: the ZIP index and the setup (`npm i` at the root, three 0.160.0).
- `package.json`: pins three 0.160.0 for the Node harness.
- `kit/toadcity_kit.js`: the real kit. I ship it byte-identical in `kit/`, and every boss reaches it only through `K`.
- `kit/real_mergeRig.js`: the game's `mergeRig()`. Every boss is passed through it explicitly, for merged draw calls, flash and the culling sphere.
- `kit/real_poses_04_actors.js`: the game's pose code. It is my model for boss `POSES` (`HERO_POSES` attack style, `down(u, ground)`, `getup`).
- `kit/real_viewer.html`: the real-pose viewer. My `viewer.html` is a copy of it extended with `?show=<boss>&pose=atk1…`. It is my renderer for every preview (`&cam=phone`, `&merge=1`, `&flash=0.85`, `&seq=knockdown`).
- `kit/viewer.html`: the kit's original bench, for reference only.
- `kit/example_gull_thug.js`: the gang interface example, for reference.
- `kit/example_bench.js`: the non-gang module example (`META` plus one build function). Boss files follow its shape.
- `harness/realK.mjs`: the real game `K` for Node. My boss measuring script imports it unchanged.
- `harness/fakedom.mjs`: a canvas stand-in, so mapped textures (labels, seasoning-tin lettering) draw in Node.
- `harness/measure_gang.mjs`: Hark's gang harness. It drives `GANG.members` through `THUG_POSES`, so for bosses I need a boss variant on the same `realK`/`fakedom` (Q-e).
- `reference/harbor_rats/` (`gang_harbor_rats_v1_bbad681.js`, `gang_harbor_rats_v2_FIXED.js`, `harbor_rats_v1_to_v2.diff`, `README_harbor_rats_v2.md`): the before and after of every §2A fix. I copy the techniques: flat-on-back blending for things behind the hips, proud details, `shadow: false` on thin parts, the cache key, and a measured README.
- `reference/pier_gulls_v1/` (`README_pier_gulls.md`, `gang_pier_gulls.js`, `qa.html`, `qa.js`): round-1 gulls and their QA page, for the three §2B gaps.
- `reviews/harbor_rats_review.md`, `reviews/TASK_C_review_lessons.md`: the full review and the lessons list. I check every boss against them before its §7 row.
- `previews/before_after/` (39 PNGs: `before_*`/`after_*` pairs, `after_real_*`, `harbor_rats_fixes_compare.png`): what "fixed" looks like under the real poses and merge.
- `previews/style/heroes_day.jpg`, `heroes_night.jpg`, `thugs_day.jpg`, `thugs_night.jpg`: the game's look and scale. I match boss style and proportion to these.
- `briefs/TASK_D_bosses.md`: the full boss contract (`META`, `ATTACKS`, `POSES`, `animateBoss`, model sheet, checklist). O6 overrides it where they differ.
- `briefs/TASK_C_thug_gangs.md`: the round-1 gang brief, for context.
- `prompts/O1…O5`, `O7`: the other sessions, so batch 2 doesn't collide with batches 1 and 3. `prompts/O6_bosses-b.md` is this brief.

### 2. Hard rules and §2 lessons, in my own words
Hard rules:
1. Build only these six bosses, each as its own ES module `src/boss_<id>.js`.
2. No `import` in a boss file; everything comes from `K`. Materials come only from `K.toonMat`, `K.basicMat` and `K.makeAtlas`; the only outline is `K.OUT_CHAR`.
3. No `Math.random()` during a build. Randomness comes from a seeded LCG `s = s * 16807 % 2147483647` started from `opts.seed`.
4. `kit/toadcity_kit.js` ships byte-identical, never edited, never rewritten from memory.
5. All testing uses the real game poses and the real `kit/real_mergeRig.js`. No stand-ins.
6. Each boss stays at or under 63 parts, 19,800 tris and 4 materials. The hard caps are 70, 22,000 and 4.
7. `ATTACKS` has exactly 3 entries with three different silhouettes, and each `active` window covers the frame where the strike visibly lands.
8. No non-hull vertex dips below y = −0.03 m in any real pose or in any blend between poses. Only feet and the weapon are exempt.
9. Every `outline: false` part and every part thinner than 4 cm in two dimensions gets `shadow: false`.
10. Texture caches use a stable key (`K.QUAL || K.THREE || K`) and store only a texture that actually drew.
11. In idle, nothing except the weapon sticks out more than 0.35 m horizontally past `META.radius`. I report the measured number.
12. Every README number is measured, with its pose and time. No "about", and never a claim that the game swaps in a LOD.
13. Every boss gets day and night 390×844 renders with real poses, both merged and unmerged.
14. One boss at a time, in this order: design note → build and idle → attacks → hurt/down/run → sheet and previews → self-check row. Push after each boss to the §6 branch.
15. Step 0 first, then stop until GO. For this relay, GO means a J block from Hark that says GO.

§2A Harbor Rats fixes:
- A1. Anything behind the hips lies flat in `down`. In other states it blends flat as `J.tilt.rotation.x` tips the rig back (smoothstep from 0.5 to 1.2 rad). The tails went from −0.67/−0.80 m to +0.054/+0.065 m. For bosses this applies to claws, coat tails, the eel tail and the shark tail.
- A2. Shoulder pivot `shX` 0.30 → 0.27, so arms overhead leave a gap of 1 cm or less (it was about 3 cm). The bruiser kept 0.30 because shoulder balls cover the gap.
- A3. The neckerchief diamond moved proud of the belly (z +0.02 → +0.04, tilt −0.25 → −0.45) so its hull no longer draws a line across it. Every `outline: false` part also gained `shadow: false`.
- A4. The fur cache is keyed on `K.QUAL || K.THREE || K`, and a texture is stored only after a successful draw.
- A5. LOD 1 keeps the gang colour on every member, follows the HD sleeve and colour choices, and keeps the depth scale. The armed LOD dropped the hips sphere instead of the diamond.
- A6. Ears moved from (±0.155, 0.33) to (±0.17, 0.35) to stop cutting through the hat cuff and do-rag.
- A7. Choose materials by the look flag (`L.sleeves`), never by comparing colour values.
- A8. README numbers come from scripts, with pose and time. Known issues carry their measured size. The zip ships what the README lists, `tools/` included.
- A9. The viewer maps the game's `getup` state to `'idle'`, not `'down'`.
- A10. Leave headroom under every cap. The v2 reference at 40/40 parts is a technique to copy, not a count to copy.

§2B Pier Gulls gaps:
- B1. Use the real `mergeRig` from `kit/real_mergeRig.js`. Never emulate it.
- B2. Use the game's real timings, not guesses. The thug table: idle/chase at 14; windup at 12 for 0.5 s (bruiser 0.7 s); attack `attack(st/0.3)` at 26, with a 4 m/s lunge for the first 0.12 s and back to chase at 0.55 s; hurt `hurt(st/0.32)` at 24, back to chase at 0.34 s; dizzy at 10; knock-down hop vy 4.2 with gravity 22, then `down(st, grounded)` at 13 and getup after 1.25 s; getup `getup(st/0.5)` at 14 for 0.5 s. Bosses are tested at the §4 hero rates.
- B3. Margins were too thin: 36 parts / 11,656 tris against a 12,000 cap, and the far LOD dipped to −2.1 cm. Leave real headroom.

### 3. Questions
- **Q1.** Exactly **3** `ATTACKS`. Each `active: [a, b]` window must sit on the **visible strike frame** of that attack's pose.
- **Q2.** The game applies hero poses at **rate 30 for attacks, 22 for hurt, and 14 for down/getup**. I test boss poses at those rates.
- **Q3.** **2048×1024**, from TASK_D_bosses.md line 84. It holds the turnaround (**front, ¾, side, back**) plus **atk1, atk2 and atk3**, rendered in the day preset on a neutral grey background with a name label under each view.
- **Q4.** **Within 10 %** of the measured bounding box. §7 says "±10 %".
- **Q5.** **`K.NIGHT.value`**. Glow parts are `K.basicMat({ transparent: true })` with `outline: false, shadow: false`, and `animateBoss` sets their opacity from it. No lights. This applies to Voltage Vic's sparks in this batch.
- **Q6.** **`mergeRig()`** from `kit/real_mergeRig.js`, called explicitly, because it only auto-wraps `buildThug` and `buildHero`. **≤ 5 merged draw calls** are expected and reported. Gangs merge to 3 (+2 shadow), down from about 95 unmerged.
- **Q7.** **`claude/o6-bosses-b`** on `https://github.com/bparlette/hawk`.
- **Q8.** **Fix 3** (stray ink line across every belly). The mustard neckerchief diamond moved proud of the belly, from **z +0.02 to +0.04**, and its tilt from **−0.25 to −0.45** rad:
  `part(J.torso, G.box(.17,.17,.045), C.mustard, 0, .47, .17*sz + .04, { rot: [-0.45, 0, PI/4] })`.
  Its ink hull no longer crosses the belly surface.

### 4. Canaries (I will include each string exactly)
- Canary 1 of 3: "README_bosses.md: the last section heading, exactly: `## Pier Boss Check 410`"
- Canary 2 of 3: "Every src/boss_<id>.js: line 2, exactly: `// tcr2 o6 redclaw-rocket`"
- Canary 3 of 3: "Final message: the first line of the filled self-check block, exactly: `SELF-CHECK O6 jimmy-lantern`"

### 5. Questions for Hark before GO (my default in brackets)
I take your H-002 answers to Opus 1 as also applying to me unless you say otherwise:
- boss timings: hurt `st/0.32` at 22 for 0.34 s; hop vy 4.2, g 22, then `down(u, grounded)` at 14 with u = st/1.25; getup blends `down(1, true)` to idle at 14 over 0.5 s; `atkN(st/dur)` at 30. These go in the README as stated assumptions.
- root scale = `META.scale`, and height is the scaled height.
- culling pass/fail at 2.6 in rig space over idle, run, hurt, down and atk1–3, with 1.9 reported as information.
- a `tools/measure_boss.mjs` that ships `tools/results_boss_<id>.json`.
- no dizzy for bosses.
- the §3 landmark ids as `META.district`.
- HOMAGE.md first.
The questions below are only the ones specific to batch 2.
- **Q-a. Branch base.** `claude/o5-bosses-a` doesn't exist on the remote yet. I'd branch `claude/o6-bosses-b` from `claude/o4-key-hwy-otters` (accepted kit, harness, QA tooling, dizzy attach), and never touch `claude/o5-bosses-a`. If Opus 1 lands a `tools/measure_boss.mjs` first, should I reuse theirs so the two batches report identically? [branch from o4; write my own `measure_boss.mjs` now, and switch to Opus 1's if you name it]
- **Q-b. Arabber Al's car chase.** Is the chase a separate game mode with its own state set, as the One-Eyed Brewmaster's truck has `wrecked` in H-003? Or is it the normal boss state machine with `run` read as "cart driving"? Should the cart have a `wrecked` or `dismount` state so Al finishes on foot? [normal boss states. `run` drives the cart (wheels and horse gallop in `animateBoss`). `down` is Al thrown off and lying beside a tipped cart. The pony is a stylised original horse inside the part budget. No extra states unless you ask.]
- **Q-c. Big Jimmy underwater.** What does "fought underwater" change for the rig? Is the floor still y = 0 (the tank bottom), with the camera and the water tint left to the game? Does idle bob like swimming, or walk the floor? [y = 0 is the tank floor. Idle is a slow sideways crab-walk sway with a small vertical bob, and the bob keeps every non-hull vertex ≥ −0.03 m. No water effects on the rig. The extra legs sit on groups under `J.hips` as §3 says.]
- **Q-d. Voltage Vic "drops on a Baltimore club beat".** Does the game have a beat clock I should sync to, or do I time the attacks myself? [I set each `ATTACKS[i].dur` and `windup` to whole beats at 130 BPM (0.4615 s a beat), so the strike lands on a beat when the fight starts on one. A small DJ booth prop goes inside the budget, with sparks as `K.NIGHT.value` glow parts.]
- **Q-e. "Steamed-red when angry"** (HOMAGE, crab characters). This touches three of my six bosses: Admiral Redclaw, Big Jimmy and Chef Crabcake. How does the game tell a boss it is angry? Is there a hp fraction or phase passed to `animateBoss`, or should anger only show in attack poses? [an optional `J.setAngry(0..1)` that tints the shell material's colour toward steamed-red, plus the same tint during atk windups via `animateBoss(J, t, state, u)`. If the game never calls it, the boss stays blue. Admiral Redclaw is red by concept; he gets a deeper red when angry.]
- **Q-f. Three crabs, one batch.** To keep the silhouettes apart:
  - Redclaw: upright admiral, with a bicorne, a long redcoat and a cannon claw.
  - Big Jimmy: wide, low, blue, 8 legs, two huge claws, no clothes.
  - Chef Crabcake: upright, with a toque, apron, two mallets and an original seasoning tin with original lettering. No Old Bay look-alike, per HOMAGE.
  OK? [yes]
- **Q-g. Polling.** I'll poll this relay every 10 minutes with a session cron, the same cadence Hark checks at. It runs while this session is open and expires after 7 days. That replaces the blocking `sleep 300 && git pull` loop. OK? [yes]

## Q-002
Title: O6 bosses batch 2: delivered (all six bosses, previews, measured README, zip)
Status: DONE
Branch: `claude/o6-bosses-b` on https://github.com/bparlette/hawk (branched from `claude/o4-key-hwy-otters`, as in Q-a)
Commit: `f507212` (delivery). The per-boss commits are listed below.
Zip: `dist/toadcity_taskD_batch2_v1.zip` (163 files). Contents: `src/` (6 boss modules); `kit/` and `harness/` (byte-identical to the
round-2 ZIP); `viewer.html` (the boss viewer); `previews/` (20 per boss); `tools/` (harness, hooks check, results and render
reports); `README_bosses.md` (+ `README.md` copy); `LICENSES.md`; `package.json`.

Commits, one boss at a time, pushed after each, in the J-003 order (the four live-mode bosses first):
- `7b789af` Admiral Redclaw, plus the boss tooling
- `386f2d7` Big Jimmy
- `02e932c` Voltage Vic
- `f09dd92` Arabber Al
- `fc0659a` Chef Crabcake
- `b1fad31` The Pool Shark
- `f507212` README / LICENSES / zip, and the final re-render of every preview

SELF-CHECK O6 jimmy-lantern
| Boss | Parts | Tris | Mats | Merged calls (real `mergeRig`) | Height (idle t = 0) vs META | Lowest point, all poses + blends | Cull radius (rig space) | Idle reach beyond `META.radius` | 3 attacks: strike peak u (active) | Flash merged | Console errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `admiral_redclaw` | 58 | 14,672 | 2 (toon + toon) | 3 (2 toon + 1 ink) | 3.135 m vs 3.1 m (+1.1 %) | +0.003 m | 2.430 | 0.272 m (haL) | atk1 0.45 (0.42–0.74); atk2 0.46 (0.36–0.58); atk3 0.60 (0.55–0.70) | yes | 0 in 20 renders |
| `big_jimmy` | 45 | 14,364 | 3 (toon + toon + toon) | 4 (3 toon + 1 ink) | 2.246 m vs 2.3 m (-2.3 %) | +0.042 m | 2.339 | 0.151 m (elL) | atk1 0.48 (0.42–0.60); atk2 0.47 (0.34–0.66); atk3 0.66 (0.60–0.74) | yes | 0 in 20 renders |
| `voltage_vic` | 50 | 9,572 | 2 (toon + basic) | 3 (2 toon + 1 ink) | 2.517 m vs 2.5 m (+0.7 %) | +0.013 m | 2.289 | 0.102 m (haR) | atk1 0.55 (0.50–0.66); atk2 0.53 (0.50–0.75); atk3 0.53 (0.33–0.67) | yes | 0 in 20 renders |
| `chef_crabcake` | 41 | 11,416 | 3 (toon + toon + mapped) | 4 (3 toon + 1 ink) | 2.966 m vs 2.95 m (+0.5 %) | +0.027 m | 2.397 | 0.312 m (haR) | atk1 0.50 (0.42–0.66); atk2 0.44 (0.40–0.76); atk3 0.52 (0.40–0.62) | yes | 0 in 20 renders |
| `arabber_al` | 58 | 14,452 | 1 (toon) | 2 (1 toon + 1 ink) | 2.066 m vs 2.1 m (-1.6 %) | +0.000 m | 2.227 | 0.218 m (ponyHead) | atk1 0.53 (0.46–0.64); atk2 0.44 (0.40–0.72); atk3 0.56 (0.45–0.70) | yes | 0 in 20 renders |
| `pool_shark` | 40 | 8,934 | 2 (toon + mapped) | 3 (2 toon + 1 ink) | 2.639 m vs 2.7 m (-2.2 %) | +0.017 m | 2.227 | 0.057 m (haR) | atk1 0.48 (0.44–0.60); atk2 0.51 (0.40–0.62); atk3 0.59 (0.56–0.72) | yes | 0 in 20 renders |
| **Threshold** | ≤ 63 | ≤ 19,800 | ≤ 4 | report | ±10 % | ≥ −0.030 m | ≤ 2.6 (pass), 1.9 info | ≤ 0.35 m | peak inside active | yes | 0 |

Every number above is printed by `tools/readme_tables.mjs` from `tools/results_boss_<id>.json` (written by `tools/measure_boss.mjs`).
- Measured with the root scaled by `META.scale`.
- "Lowest point" covers the static poses and every boss sequence, simulated at 60 fps with the real `applyPose` damping, the
  knock-down hop and `animateBoss`. Feet and weapon groups are excluded, as the brief allows.
- The strike peak is the frame where the attack's strike joint moves fastest when the attack plays at rate 30.
- `README_bosses.md` also has the per-sequence lowest point and cull radius, the builds on the game's own K (`harness/realK.mjs`),
  determinism, and the texture-cache checks.
- The last heading of `README_bosses.md` is `## Pier Boss Check 410`.
- Line 2 of every `src/boss_<id>.js` is `// tcr2 o6 redclaw-rocket`.

Live-mode hooks (J-003). All are checked with the game's own code in `tools/check_hooks.mjs`; results are in the JSON.
- **Admiral Redclaw:** `window.boss_admiral_redclaw.buildAdmiralRedclaw` and the global `buildAdmiralRedclaw` are both registered at
  module load. Called with `{ THREE, toonMat, outlineMat, scale: 1 }`, it returns **J**, and `J.root` is the Object3D. That is an
  assumption: J-003 didn't name the return type. Say if the set piece wants the Object3D itself and I'll add a flag.
  Result: 58 parts, merges to 3 draw calls.
- **Big Jimmy:** `buildBigJimmy({ THREE, toonMat, outlineMat, addOdir, QUAL })` returns
  `{ root, body, soft, mouth, claws: [{ arm, top, bot, tip }] x2, legs: [left, right], flash: [3 materials], J }`.
  - It is posed in his idle stance (claws up), not the rest T-pose.
  - `soft` is the white belly he shows when he rears up in the belly slam.
  - `legs` are `J.lgL` / `J.lgR`, each holding one side's four legs.
- **Voltage Vic:** `buildVoltageVic({ THREE, stage: true })` works with THREE alone. The module supplies the kit's toon and outline
  materials, copied from `kit/toadcity_kit.js`.
  - It adds the DJ booth, for 58 parts.
  - `J.pose(name, u)` snaps idle and atk1–3 at any tempo.
  - The brawl ATTACKS sit on whole beats at 130 BPM.
- **Arabber Al:** `buildArabberAl()` returns `{ root, update(dt, { t, state, throwK }), J }`.
  - Wheels and feet are at y = 0, and it faces +z.
  - With no arguments it takes THREE from `window.K`, then `window.THREE`, and throws a clear error if neither exists. That is an
    assumption. It also accepts deps.
  - `throwK` 0..1 drives the melon lob.
  - `state` 'run' / 'drive' / 'chase' drives the cart: pony gallop and wheel spin.
  - Result: 58 parts. After a 2.5 s simulated chase the bounds are y 0.003 … 2.037 m.
- `J.setAngry(0..1)` is on all three crabs, with the windup flush in `animateBoss`. Redclaw goes to a deeper red. Blue shells pass
  through a cooking brown, never purple.

Notes and known issues. All are in `README_bosses.md` with their measured sizes.
- **Timings:** the H-002 defaults are stated in the README as assumptions (`tools/boss_seq.js`).
- **Culling:** all six pass at 2.6; the worst is 2.430. None is inside 1.9 (that number is for information only).
- **Arabber Al:**
  - The wheel rims touch the ground at exactly 0.000 m.
  - The knock-down hop lifts the whole cart 0.401 m.
  - `down` lays him back into his crates.
  - `META.radius` is 2.0 m, covering pony to tailboard.
- **Big Jimmy:**
  - He hovers +0.009 m off the floor; he is underwater.
  - On his back, the shell rests 0.333 m up, to keep the getup roll above the floor.
- **Skipping `animateBoss`:** these motions live only there:
  - Al's pony gallop and wheel spin;
  - Jimmy's per-leg ripple;
  - Chef's tin-leg shake;
  - Vic's glow fade.

  With it skipped every boss stays inside every limit; the motion just stops.
- **Admiral Redclaw:** the tightest floor margin in the batch, +0.003 m (a knee in the broadside-slam crouch).
- **Partial-deps hooks:** for these, every module carries `kitFrom()`, a line-for-line copy of the kit helpers. The kit itself is
  never edited.
- **The game's own K** has no `basicMat`. Voltage Vic then falls back to `THREE.MeshBasicMaterial`, which is what the kit's
  `basicMat` returns.

Next: J-002 (O8) waits until you accept O6. Then I post its Step 0 as a Q block, and stop until a J block says GO.
