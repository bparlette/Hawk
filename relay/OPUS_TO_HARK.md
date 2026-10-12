# Opus -> Hark (reply outbox)

Opus appends `## O-NNN` blocks at the bottom, commits and pushes to `claude/new-session-z5ikqq`.
Each O-number answers the H-number with the same digits in `relay/HARK_TO_OPUS.md`. O-000 is for anything sent before the relay existed.
Status lines: DONE, BLOCKED (needs Brad, reason given), or QUESTION (need info from Hark).

---

## O-000
Title: Key Highway Otters v1.0.1 (sash) and QA refresh for gangs 2-4 at the game's down timings
Status: DONE
Branch: `claude/o4-key-hwy-otters` (code, zips, QA). This relay file is on `claude/new-session-z5ikqq`.
Commits (on `claude/o4-key-hwy-otters`):
- `5dbaf97` Re-run QA for Pier Gulls v1.1.2, Catfish v1.1, Bandits v1 at the game's down timings
- `6d854217d230c5f1f4115314fbc01fe3feadecf9` Key Highway Otters v1.0.1: bruiser sash as its own torus part
- (earlier, already seen: `c3697bc24eb6c4f64947c4ca61b73992cfa2bdc2` Key Highway Otters v1)
Zips:
- `dist/toadcity_taskC_key_hwy_otters_v1.0.1.zip` (113 files; `kit/` and `harness/` byte-identical to the round-2 ZIP; README ends `## Otter Check 410`)
- `dist/toadcity_taskC_key_hwy_otters_v1.zip` (kept, history)

Full reply text (as sent to Brad):

> Both cleanups are done and pushed to `claude/o4-key-hwy-otters`. QA passes for all four otters and for gangs 2–4, with no console errors in the otters runs.
>
> **Commits**
> - Gangs 2–4 QA refresh: `5dbaf97`
> - Otters v1.0.1: `6d854217d230c5f1f4115314fbc01fe3feadecf9`
> - Zip: `dist/toadcity_taskC_key_hwy_otters_v1.0.1.zip` (113 files). The v1 zip is kept. `kit/` and `harness/` are still byte-identical to the ZIP, and `README.md` still ends with `## Otter Check 410`.
>
> **1. Bruiser sash (v1.0.1)**
> - **What changed:** the sash is now its own thin torus part on the vest, not painted sphere faces. The LOD keeps it as painted faces, matched to the new position.
> - **Look:** it now reads as a clean band, but it is a tilted ring round the vest, so it looks more like a sash-belt than a chest-to-hip diagonal. The README says so.
> - **Counts:** the bruiser goes from 32 to 33 parts and from 9,400 to 9,592 tris, under your 36-part cap.
> - **QA:** the full QA is re-run on the ZIP kit and all four members pass. The worst stray ink is 5 px (grunt_b's towel) and the worst buried share is 49.1%.
> - **First attempt failed:** I placed the ring higher and steeper and it crossed the shoulder ball (59.6% buried, 15 px stray ink on the vest). I moved it lower and flatter, and the README records this.
> - **Moves over 0.5 cm (bruiser):**
>   - The lowest non-hull point in `down(1,true)` went from 4.5 to 0.5 cm above ground, because the sash is now the lowest part there. It is still above ground and passes.
>   - Knock-down `seq.minY` is 0.8 cm, against 0.5 cm in v1. Both are above ground.
>   - LOD IoU against HD fell by 0.014 (front), 0.019 (three-quarter) and 0.033 (side), to 0.913, 0.897 and 0.902.
>
> **2. QA re-run for Pier Gulls v1.1.2, Catfish v1.1 and Bandits v1**
> - I re-ran each at down rate 13 in seconds form, with getup 0.5 s at rate 14, then compared the old and new reports value by value.
> - **Nothing moved:** the largest difference is 0.0 cm, so there is no version bump. I committed the refreshed `qa/` reports and regenerated the READMEs, each with a short re-run note.
> - **New checks:** the refreshed reports also carry checks that did not exist when gangs 2–4 were measured: windup(0.6) shoulder gaps, idle reach, the determinism hash and ear clearance. All pass, and the README tables show the values.
> - **Culling:** for information against the ZIP's r = 1.9, the worst reach is 2.46 m for Bandits' armed member. The check itself passes at 2.6.
>
> I also added `?only=<members>` to `tools/qa.js` so a single member can be re-run quickly.

Notes for Hark:
- Earlier replies in this series (Key Highway Otters v1 with the filled §7 self-check starting `SELF-CHECK O4 ramrod-lantern`, commit `c3697bc`) reached you via Brad, not through the relay.
- Gangs 2–4 code is unchanged by the QA refresh; only `qa/*_report.json` and the READMEs changed.

## O-001
Title: Bosses batch 1 (O5): Step 0 comprehension check
Status: QUESTION (Step 0 done; no code written; waiting for an H block that says GO, plus answers to the questions in part 5)
Branch: no code yet. Planned delivery branch `claude/o5-bosses-a` (see Q-a). This reply is on `claude/new-session-z5ikqq`.
Commit: this relay commit only.
Files read: `relay/briefs/O5.md`; the ZIP from the H-001 link (sha256 `39eb9ae49dbc769b53b878e628fdc70ae40a62a56dddac02f785a309fedf541a`, byte-identical to the O4 ZIP; its `prompts/O5_bosses-a.md` is identical to `relay/briefs/O5.md`); `briefs/TASK_D_bosses.md`; `kit/real_mergeRig.js`; `kit/real_viewer.html`.

### 1. Every file in the ZIP and what I will use it for
- `README_ZIP.md`: the index and the `npm i` setup.
- `package.json`: pins three 0.160.0 for the Node harness.
- `kit/toadcity_kit.js`: the real kit. I ship it byte-identical and every boss gets everything through its `K`.
- `kit/real_mergeRig.js`: the game's `mergeRig()`. Every boss is passed through it for merged draw calls, flash and culling checks.
- `kit/real_poses_04_actors.js`: the game's pose code, for reading (`HERO_POSES.atk1–3` style, `down(u, ground)`).
- `kit/real_viewer.html`: the real-pose viewer. My `viewer.html` starts from it and adds boss `POSES` (`&pose=atk1…`).
- `kit/viewer.html`: the kit's original test bench (reference only).
- `kit/example_gull_thug.js`: interface example for gangs (reference).
- `kit/example_bench.js`: interface example for a non-gang module (`META` + one build function), the shape a boss uses.
- `harness/realK.mjs`: the real game K for Node. My boss measurement script imports it unchanged.
- `harness/fakedom.mjs`: canvas stand-in, so mapped textures draw in Node.
- `harness/measure_gang.mjs`: Hark's gang harness. It is gang-shaped (`GANG.members`, `THUG_POSES`), so for bosses I run a boss variant built on the same `realK`/`fakedom` (see Q-e).
- `reference/harbor_rats/gang_harbor_rats_v1_bbad681.js`, `gang_harbor_rats_v2_FIXED.js`, `harbor_rats_v1_to_v2.diff`, `README_harbor_rats_v2.md`: the before/after of every lesson in §2A. I copy the techniques (flat-on-back tail, cache key, proud details).
- `reference/pier_gulls_v1/README_pier_gulls.md`, `gang_pier_gulls.js`, `qa.html`, `qa.js`: my own round-1 gulls and QA, for the §2B gaps.
- `reviews/harbor_rats_review.md`, `reviews/TASK_C_review_lessons.md`: the full review and the lessons list, to check myself against.
- `previews/before_after/` (39 PNGs): `before_`/`after_` pairs for `down_side_{grunt_a,bruiser}`, `ears_side_{grunt_a,bruiser}`, `ears_turn_{grunt_a,bruiser}`, `lod_lineup`, `lod_turn_bruiser`, `lod_vs_hd_armed`, `poses_{grunt_a,bruiser}`, `shoulder_down_grunt_a`, `shoulder_down_grunt_a_ink`, `shoulder_windup_armed`, `whisker_chest_{grunt_a,bruiser}`; after-only `real_armed_poses`, `real_flash_unmerged`, `real_merged_attack_night`, `real_merged_down`, `real_merged_flash`, `real_merged_lineup`; and `harbor_rats_fixes_compare.png`. Visual reference for what "fixed" looks like.
- `previews/style/heroes_day.jpg`, `heroes_night.jpg`, `thugs_day.jpg`, `thugs_night.jpg`: the game's look, to match boss style and scale.
- `briefs/TASK_C_thug_gangs.md`: round-1 gang brief (context).
- `briefs/TASK_D_bosses.md`: the full boss contract (`META`, `ATTACKS`, `POSES`, `animateBoss`, sheet, checklist). O5 overrides it where they differ.
- `prompts/O1_pier-gulls-v1-1.md` … `O4_key-hwy-otters.md`, `O6_bosses-b.md`, `O7_bosses-c.md`: the other sessions, so batch 1 doesn't collide with batches 2–3. `prompts/O5_bosses-a.md` is this brief.

### 2. Hard rules and §2 lessons, in my own words
Hard rules:
1. Build only the six bosses named here, one ES-module file each in `src/`.
2. No `import` in boss files; materials only through `K.toonMat`/`K.basicMat`/`K.makeAtlas`; every outline is `K.OUT_CHAR`.
3. No `Math.random()` while building; a seeded LCG (`s = s * 16807 % 2147483647`) from `opts.seed`.
4. `kit/toadcity_kit.js` stays byte-identical; never edit or rebuild it.
5. Test only with the real poses and the real `kit/real_mergeRig.js`; no emulation.
6. Per boss ≤ 63 parts, ≤ 19,800 tris, ≤ 4 materials (hard caps 70 / 22,000 / 4).
7. Exactly 3 `ATTACKS`, three distinct silhouettes, each `active` window on the visible strike frame.
8. No non-hull vertex below y = −0.03 m in any real pose or blend; only feet and the weapon are exempt.
9. `shadow: false` on every `outline: false` part and every part under 4 cm in two dimensions.
10. Texture caches keyed on a stable kit object (`K.QUAL || K.THREE || K`); never cache a failed draw.
11. In idle, nothing (weapon aside) reaches more than 0.35 m horizontally beyond `META.radius`; report the measured value.
12. README numbers are measured only, with pose and time; no "about"; never claim an LOD swap.
13. Day and night 390×844 renders with real poses, merged and unmerged, for every boss.
14. One boss at a time (note → build+idle → attacks → hurt/down/run → sheet+previews → self-check), pushing to the §6 branch.
15. Step 0 first, then stop until GO (now: an H block from Hark that says GO).

§2A Harbor Rats fixes:
- A1. Tails (and anything behind the hips) lie flat in `down` and blend flat as `J.tilt.rotation.x` tips the rig (smoothstep 0.5→1.2 rad), so they never stab the floor (was −0.67/−0.80 m, now +0.054/+0.065 m).
- A2. Shoulder pivot `shX` 0.30 → 0.27 (bruiser keeps 0.30 with fur shoulder balls) so arms overhead leave ≤ 1 cm gap (was ~3 cm).
- A3. The neckerchief diamond moved proud of the belly (z +0.02 → +0.04, tilt −0.25 → −0.45) so its ink hull no longer crosses the surface; every `outline: false` part got `shadow: false`.
- A4. Fur cache keyed on `K.QUAL || K.THREE || K`, and set only after a successful draw.
- A5. LOD 1 keeps the gang colour on every member, follows the HD colour choices and the ×depth scale; the armed LOD drops the hips sphere instead of the diamond.
- A6. Ears moved from (±0.155, 0.33) to (±0.17, 0.35) so they stop slicing the beanie cuff and do-rag.
- A7. Branch on the look flags (`L.sleeves`), never on colour equality.
- A8. README numbers come from scripts, with pose and time; known issues carry sizes; the zip holds what the README lists.
- A9. The viewer maps game state `getup` to `'idle'`, not `'down'`.
- A10. Leave headroom under every cap; the v2 reference's 40/40 parts is the technique to copy, not the count.

§2B Pier Gulls gaps:
- B1. `mergeRig` must be the real one (`kit/real_mergeRig.js`), never emulated.
- B2. Use the game's real timings (the thug table: idle/chase 14; windup 12 for 0.5 s, bruiser 0.7 s; attack `attack(st/0.3)` at 26, 4 m/s lunge for 0.12 s, chase at 0.55 s; hurt `hurt(st/0.32)` at 24, chase at 0.34 s; dizzy 10; knock-down hop vy 4.2, g 22, then `down(st, grounded)` at 13, getup after 1.25 s; getup `getup(st/0.5)` at 14 for 0.5 s), and for bosses the hero rates in §4.
- B3. Leave real margins (the gulls sat at 36 parts / 11,656 tris against 12,000, and the far LOD dipped to −2.1 cm).

### 3. Questions
- **Q1.** Exactly **3** entries. Each attack's `active` window must line up with **the visible strike frame** of its pose.
- **Q2.** The game applies hero poses at **rate 30 for attacks, 22 for hurt, 14 for down/getup**. I test boss poses at those rates.
- **Q3.** **2048×1024**, holding the turnaround **front, ¾, side, back** plus **atk1, atk2 and atk3**, on a neutral grey background in the day preset, with a name label under each view.
- **Q4.** `META.height` must be **within 10 %** of the measured bounding box (I measure with the root scaled by `META.scale`; see Q-c).
- **Q5.** **`K.NIGHT.value`**, set in `animateBoss` on `K.basicMat({ transparent: true })` glow parts (`outline: false, shadow: false`, no lights).
- **Q6.** **`mergeRig()`** from `kit/real_mergeRig.js`, called explicitly (`J = mergeRig(buildX(K, …))`). Expected **≤ 5** merged draw calls per boss, reported (gangs merge to 3, +2 shadow).
- **Q7.** **`claude/o5-bosses-a`**.
- **Q8.** **Fix 3:** the diamond knot moved proud of the belly, **z +0.02 → +0.04** and **tilt −0.25 → −0.45** (`part(J.torso, G.box(.17,.17,.045), C.mustard, 0, .47, .17*sz + .04, { rot: [-0.45, 0, PI/4] })`), so its ink hull stops drawing a line across the belly.

### 4. Canaries (I will include each string exactly)
- Canary 1 of 3: "README_bosses.md: the last section heading, exactly: `## Ballpark Check 410`"
- Canary 2 of 3: "Every src/boss_<id>.js: line 2, exactly: `// tcr2 o5 warehouse-fastball`"
- Canary 3 of 3: "Final message: the first line of the filled self-check block, exactly: `SELF-CHECK O5 nevermore-lantern`"

### 5. Questions for Hark before GO (my default in brackets if you don't answer)
- **Q-a. Branch base.** Create `claude/o5-bosses-a` from `claude/o4-key-hwy-otters` (it already holds `kit/`, `harness/`, my QA page, `tools/shoot.mjs` and the dizzy attach), or from `claude/new-session-z5ikqq`? [from `claude/o4-key-hwy-otters`]
- **Q-b. Boss state timings.** The brief gives boss pose *rates* (30/22/14) but not the boss state machine. Please paste the boss branch of `06_game.js`: hurt duration, how `down(u, ground, J)` is driven (u as a fraction over what duration, or seconds like the thug `down`), the knock-down hop, and what plays for getup (there is no boss `getup` pose). [hurt `hurt(st/0.32)` at 22 for 0.34 s; knock-down hop vy 4.2, g 22, then `down(u, grounded)` with u = st/1.25 at 14; getup = blend from `down(1, true)` to `idle` at 14 over 0.5 s; attacks `atkN(st/dur)` at 30]
- **Q-c. Scale and height.** Does the game set `J.root.scale = META.scale`, so `META.height` is the scaled height (the TASK_D example: scale 1.6, height 3.4)? [yes; I build at unit scale and measure height, radius, reach and the −0.03 m floor with the root scaled]
- **Q-d. Culling for bosses.** `real_mergeRig.js` sets a rig-space sphere centred (0, 0.95, 0) with r = 1.9 (ZIP) / 2.6 (fixed game). Root scale multiplies it in world space. Is 2.6 in rig space also the pass line for bosses, including attack poses (a 6 m/s charge or a long pitch)? [pass/fail at 2.6 in rig space over idle, run, hurt, down and atk1–3; report 1.9 as information]
- **Q-e. Harness.** `measure_gang.mjs` only drives gang members through `THUG_POSES`. May I add `tools/measure_boss.mjs` (same `realK`/`fakedom`, unchanged; boss `POSES` at the hero rates; same outputs: budgets, per-pose lowest point and gaps, real mergeRig, determinism) and ship `tools/results_boss_<id>.json`? Or do you have a boss harness you want me to run? [add `tools/measure_boss.mjs`]
- **Q-f. Dizzy.** Do bosses get the dizzy/QTE state (stars sprite)? [no; not tested]
- **Q-g. District ids.** Use the §3 "Landmark id" values as `META.district` (`orioles`, `ravens`, `science`, `fedhill`, `domino`, `underarmour`), not TASK_D's example `'mt_stadium'`? [yes, the §3 values]
- **Q-h. Team-colour line.** Bird Brain Bobby is orange-and-black by the approved concept. I keep that but add no cap logo, letters, numbers, "O" shapes or the official mascot's cartoon look. The Raven King gets original colours: black raven, with pads and jersey in a non-team scheme (no purple or gold). The Compression King is blank, unbranded athleisure with no Under Armour marks, colours or patterns, and the Hon Queen's hairspray can is plain. OK? [yes]
- **Q-i. Polling.** I poll this relay every 5 minutes with a session cron (`check relay`), which is equivalent to the `sleep 300 && git pull` loop and doesn't block the session. It runs while this session is open and auto-expires after 7 days. OK? [yes]
