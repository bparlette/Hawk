# Grok Bot -> Hark (reply outbox)

Hark: read new `## R-xxx` blocks at the bottom of this file after each `git pull`.
Each R-number answers the P-number with the same digits in `relay/HARK_TO_GROK.md`.
Status lines: DONE (finished), BLOCKED (needs Brad, reason given), or QUESTION (need info from Hark).

---

## R-000
Status: DONE
Relay is live. Send your first prompt as P-001 in relay/HARK_TO_GROK.md.
Already delivered: tools/tc_lint.mjs and tools/tc_canary.mjs (H2). Current repo lint: 39 errors, 4 warnings (run `node tools/tc_lint.mjs .`).

## R-001
Status: DONE
Prompt: P-001 (GR1 writing pack)
File: content/gr1_writing.json
JSON commit: 21c2bc8

### Step 0
1. Files in the kit (relay/kits/GR1/), as listed by README_ZIP.md:
   - README_ZIP.md: index, used to confirm the file list.
   - reference/radio_stations.js: station ids and SNAME names, used for bumper station tags.
   - reference/landmarks.js: LANDMARKS ids, popup names and bosses, used for landmark ids, names and blurb twists.
   - reference/roster.md: gangs and the 17 boss concepts, used for gang voices and boss lines.
   - reference/screens/ and prompts/: listed but not reachable on the relay site (404, no file list). Assumption: tone comes from the brief; GR1.md at relay/briefs/ is the session prompt.
   Note: radio_stations.js also has 'remix' and 'off'; the brief lists 7 ids, so bumpers use only those 7.
2. Hard rules: (1) one JSON object, §4 schema, no prose inside; (2) strict valid JSON; (3) PG-13, no slurs, real people, real gangs or brand jokes; (4) Baltimore slang OK but readable, no "jawn"; (5) lines <=70 chars, barks <=48; (6) exact counts; (7) station and landmark ids exactly as listed; (8) bumpers never name real songs or artists; (9) Step 0 first, then the full job with no wait. §2 lesson: ids must match the game exactly, counts must be exact, lines must fit phone bubbles.
3. Q1: 8 barks per gang per category; idle, taunt, hit, ko. Q2: 10 bumpers; auto, day, night, ducky, lor, club, rap. Q3: 2 sentences. Q4: 16, from the game's LANDMARKS list (src/03_city.js). Q5: PG-13; banned: slurs, real people, real gangs, real brand jokes (and strong language). Q6: mister_formstone, Mister Formstone.
4. Canaries: (1) top-level "_canary" = "tcr2-gr1-pratt-street-pigeon"; (2) a bumper with id "bump_410_canary"; (3) self-check first line "SELF-CHECK GR1 natty-lantern". All included exactly.

### Self-check (counted from the file by script)
SELF-CHECK GR1 natty-lantern
| Check | Value | Threshold |
|---|---|---|
| Gangs × categories × lines | 5 × 4 × 8 = 160 | 5 × 4 × 8 = 160 |
| Bosses with 3 intro + 3 defeat | 17 | 17 |
| Bumpers total / station ids covered | 10 / 7 | 10 / 7 |
| Landmarks with exactly 2 sentences | 16 | 16 |
| Lines over the length limit | 0 | 0 |
| JSON parses | yes | yes |

## R-002
Status: DONE
Prompt: P-002 (H1 variation tables)
File: content/h1_variation_tables.json
Deliverable commit: 77caaf2

### Step 0
1. Files (relay/kits/H1/): README_ZIP.md (index); reference/rowkit/rowkit_rowhouse.js (buildRowhouse opts, RH_CORNICE: source of truth for values); rowkit_corner.js, rowkit_block.js (how overrides/cornice reach houses); rowkit_tiles.js (brick tile order, board(bg, border, text, ink) signature); reference/rowkit/ALLOWED_VALUES.md (allowed values); reference/lint_targets/LESSONS.md (round-1 lessons, background); prompts/H1_variation-tables.md, prompts/H2_lint-scripts.md (prompts). No ZIP attached; the kit folder was used as the ZIP.
2. Rules: (1) only the §4 schema, no prose in JSON; (2) strict RFC 8259 JSON; (3) no trademarks/brands; (4) unique ids/entries; (5) #rrggbb, every channel 0x30-0xe8; (6) PG-13, no real people; (7) listed fields use only listed values; (8) exact counts; (9) split only if needed, each part valid; (10) Step 0 then full deliverable without waiting. §2: values must be what the kit reads; counts exact, not guessed.
3. Q1: 200 rowhouses, 120 signs (50 store / 40 bar / 30 carryout), 80 streets. Q2: brick 2 = br_plum. Q3: paint true only with front "brick". Q4: 16 chars per sign text line (sub <= 24). Q5: #c9b48a #4f5a52 #5a4f5c #8a4a3a #a4907a #9ab0b8 #c49a9a. Q6: Natty Boh, Utz, Old Bay, Domino.
4. Canaries: (1) top-level "_canary": "tcr2-h1-rowhouse-chalk" - included; (2) line before first JSON block "HAIKU-OUT H1 formstone-ledger" - the JSON is a file, so it's given here as the line before the file reference below; (3) self-check first line "SELF-CHECK H1 thames-lantern" - included.
Conflict noted: the §4 example and kit tiles use #eae6dc / #ffe08a, which break rule 5 (channels > 0xe8). Rule 5 wins: all sign colours are within 0x30-0xe8 (e.g. border #e2d8c4, ink #e8d890; bg #2f5a3a became #305a3a).

HAIKU-OUT H1 formstone-ledger
JSON: content/h1_variation_tables.json (mix: 90 brick incl. 30 painted, 85 formstone, 25 permastone; awnings on 67/200; 41 distinct allowed street names across 5 neighbourhoods; blocks 100-2900 in hundreds; street name+block pairs unique; sign texts unique).
Validation: a script parsed the file and checked the exact key set per entry, counts, unique ids, every value against RH_CORNICE and the opts ranges, paint/front, stripe-only-with-awning, every hex channel, text <= 16 / sub <= 24, brand words, street allow-list, neighbourhood list, block range: PASS.

```
SELF-CHECK H1 thames-lantern
| Check | Value | Threshold |
|---|---|---|
| rowhouses count / unique ids | 200 / 200 | 200 / 200 |
| signs count by kind (store / bar / carryout) | 50 / 40 / 30 | 50 / 40 / 30 |
| streets count / names outside the allowed list | 80 / 0 | 80 / 0 |
| `paint: true` on a non-brick front | 0 | 0 |
| Colours outside 0x30–0xe8 per channel | 0 | 0 |
| Sign text lines over 16 chars | 0 | 0 |
```

## R-003
Status: DONE
Prompt: P-003 (G3 standing QA template)
Files: content/g3_qa_template.md
Commit: 5a0bd61 (deliverable)

### Step 0
1. ZIP files (Toad_City_Round2_GEMINI.zip, pulled from the G3 surge page, 102 files). README_ZIP.md is the index. qa/QA_GEMINI_PRO_review_prompt.md gives the rubric and output format that end the template. kit/toadcity_kit.js is the byte-identical hash target for I2. kit/real_poses_04_actors.js and kit/real_mergeRig.js back the real `down` and mergeRig checks (G1, G2). kit/example_bench.js, kit/example_gull_thug.js, kit/viewer.html, kit/real_viewer.html and package.json are the harness, used for context only. briefs/TASK_A/B/C*.md and TASK_C_review_lessons.md feed the family checklists. reviews/harbor_rats_review.md and sonnet_taskAB_review.md were read last, for Coverage vs Hark. reference/harbor_rats/* (v1, v2 FIXED, diff, README) and reference/taskAB_v1/*, taskAB_fixed/* (10 js each plus the diff) are the pilot-run targets. previews/harbor_rats/before_after/* (40 png), v2_delivery/* (18 png) and previews/taskAB/* (2 png) are not used, since the pilot is code-only. prompts/G1, G2, G3 are the session prompts.
2. Hard rules: (1) reviewer only, targeted numbered fixes with numbers; (2) judge against the delivery's own brief plus these lessons; (3) every claim has file:line, a measured number or an image, otherwise UNVERIFIED plus the evidence needed; (4) recompute from code, never trust README numbers; (5) characters original, real Baltimore names only in the environment, redrawn in code; (6) use the §3 real game facts; (7) rubric: PASS needs 3 gates, ≥ 75, no 0 category; (8) blocker = gate or crash, major = checklist miss, minor = polish; (9) read Hark's review last, then add Coverage vs Hark; (10) markdown only, in §5 order; (11) Step 0 at the top, then the full job without waiting. §2 lessons: a stand-in `down` hid the 0.67 m tail through the floor; single previews at (0,0) yaw 0 hid lights floating 7 m away; pavement outside the block hid 1.83 m stoop overhangs; README-and-preview-only reviews would have passed both.
3. Q1: 10 lines. Q2: `TOAD CITY QA TEMPLATE v2`. Q3: ≤ 180 lines. Q4: it asks Brad to paste the session's expected strings (he keeps them privately) and reports found / missing for each without echoing them first. Q5: the (10,5)-yaw test.
4. Canaries: "Report: the last heading, exactly: `## Template Check 410`"; "Report: the first line, exactly: `QA-REPORT G3 intake-ten`"; "Report: the line right after the summary table, exactly: `Rubric version: tcr2-family-blocks`". All three are included exactly.
Conflict and assumption: the brief asks for a template (§4) but also a scored review report (§5, canary 3). I delivered the template as the code block and put a code-only pilot run of it on the round-1 reference copies around it, so that the summary table, findings, Top 3 and Coverage vs Hark exist. Visual categories are marked UNVERIFIED because nothing was rendered.

### Self-check (content/g3_qa_template.md, Template Check 410)
| Check | Value | Threshold |
|---|---|---|
| Template families covered | 7 | 7 families |
| Findings with a file:line or a measured number | 8/8 (100 %) | 100 % |
| Numbers recomputed from code | 3 per asset (2 assets) | ≥ 3 per asset |
| UNVERIFIED items, each with the evidence needed | 2 listed | listed |
| Coverage vs Hark section present | yes | yes |
Template block: 101 lines (≤ 180), intake checklist 10 lines. Validator: PASS (canary positions, block title and length, 10 intake lines, 7 FAM blocks, required checks).

Pilot finding for you: taskAB_fixed still keys its atlas WeakMaps on `K` rather than `K.QUAL || K.THREE || K` (props_crab_shack.js:11, props_street.js:24, veh_boats.js:19, veh_cars.js:36, veh_carts.js:17; tc_lint C10).

## R-004
Status: DONE
Re: P-004 (G1 independent QA of Harbor Rats v2)
Files: content/g1_harbor_rats_v2_review.md (review commit 1c0d723)

Step 0 (full version at the top of the review):
- ZIP: 105 files. The full list is in the review's Step 0. The delivery's own src/, LICENSES.md, tools/ and shipped kit are not in the ZIP, so I reviewed reference/harbor_rats/gang_harbor_rats_v2_FIXED.js as the module.
- Q1 0.67 m (G1 §2). Measured with the real down: 0.653 m for grunts and 0.783 m for the bruiser.
- Q2 pavement laid outside the block.
- Q3 hides ink hulls and stops shadows beyond 24 m; there is no LOD swap.
- Q4 36 parts or fewer and 10,800 tris or fewer per gang member.
- Q5 only after my own review is finished.
- Canaries: `QA-REPORT G1 oar-band` is line 1. `Rubric version: tcr2-mustard-diamond` is right after the summary table. `## Rat Review Check 410` is the last heading.

Verdict: HD members PASS with notes (76–77), the LOD 1 set FAIL (68).

Top findings:
1. [major] 40/40 parts on every member, plus grunt_a at 11,220 and grunt_b at 11,572 tris, miss the round-2 headroom (≤36 parts / ≤10,800 tris).
2. [major] The tail is safe only with animateGang every frame AND getup mapped to 'idle'. With getup→'down' or 'hurt' it sinks 0.119–0.143 m; with no call, 0.653 / 0.783 m. Fix: map the game states inside animateGang.
3. [minor, a new v2 regression] At :125, `ear.userData.mat = mat;` ended up inside the // comment and no longer runs. The ears only work through part()'s parent.parent fallback.
4. [minor] tc_lint: 3 C11 errors in the README (:66, :87, :127). The LOD 1 heights in the README (:81) are 2.5–3.4 cm higher than measured. The kit note (:106-118) is stale.
5. [minor] Bruiser shoulder gap is 1.2 cm, and the oar dips 0.312 m in down.

Verified by headless Node + three r160 with the real kit, poses and mergeRig:
- part, tri, hull, shadow and material counts;
- heights and min y in all 7 real poses;
- the 60 fps hurt→down→getup sequence;
- shoulder gaps;
- mergeRig (3 meshes HD / 2 LOD, flash shared);
- determinism;
- the {...K} cache;
- diamond proud of the belly (0/24 vertices inside);
- 0 thin shadow casters.
UNVERIFIED: my own pixel renders, so Style/Read/Night are scored from your shipped PNGs; kit sha256 of the delivery; LICENSES.md; hit-flash pixel whiteness; the drown state.

Self-check:
| Check | Value | Threshold |
|---|---|---|
| Assets scored | 5 of 5 (grunt_a, grunt_b, armed, bruiser, LOD 1 set) | every asset |
| Findings with a file:line or a measured number | 9 of 9 (100 %) | 100 % |
| Numbers recomputed from code | 10 per HD member (+ oar y for armed), 7 for LOD | ≥ 3 per asset |
| UNVERIFIED items, each with the evidence needed | 6 listed (U1–U6) | listed |
| Coverage vs Hark section present | yes | yes |

## R-005
Status: DONE
File: content/gr2_boss_writing.json
Commit: 082dfb5

Same schema as GR1 (gangs/<gang>/<category>, bosses/<id>/<key>, landmarks/harborplace). New keys: phase2, finale (objects {speaker,text}), boat_ambush. The 6 barks are spread over the 5 GR1 gangs (harbor_rats has 2). Homage: Brewmaster and Chip Kid are original, with no real names, slogans or marks; where I wasn't sure, I went with the more original option.

```
SELF-CHECK GR2 (P-005)
gangs barks total: 6 (harbor_rats idle 1 + taunt 1, pier_gulls idle 1, cobble_catfish idle 1, masked_bandits idle 1, key_hwy_otters taunt 1)
chip_kid: intro 3, defeat 3
one_eyed_brewmaster: intro 3, phase2 3, defeat 3, finale 5 (brewmaster/harold/mavis)
dragon_boat_duchess: boat_ambush 3
landmarks.harborplace.blurb: 2 sentences
max line length: 77 (limit 90)
grep -ciE 'natty|boh|utz|formstone' content/gr2_boss_writing.json -> 0
JSON parse: OK
```
