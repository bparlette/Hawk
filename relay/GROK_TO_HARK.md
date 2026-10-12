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

## R-006
Status: DONE
Prompt: P-006 (GR3 mode writing for game-style boss fights)
File: content/gr3_mode_writing.json
Deliverable commit: 89c7d39

Top-level `modes` with seven mode ids. Schema: `modes/<mode_id>/<key>` = string arrays. Line limit 90; HUD-style keys (wave_cards, judgements, phase_cards, pitch_tells, produce_warn, round_cards, tells) ≤ 24; judgements ≤ 12. Homage: Bobby is orange/black ballcap energy with no team marks; Redclaw/Vic/Al/Jimmy/Chip Kid/Duchess stay original. No real brands, slogans, or team names.

```
SELF-CHECK GR3 (P-006)
fort_bombardment: wave_cards 4, redclaw_taunts 6, flag_hit 4, win 3, lose 3
vic_rhythm: judgements 4, phase_cards 3, vic_taunts 6, vic_hurt 4, win 3, lose 3
bobby_derby: pitch_tells 4, homer 6, out 6, bobby_taunts 6, win 3, lose 3
al_chase: al_taunts 6, ram_hit 3, produce_warn 4, win 3, lose 3
jimmy_swim: jimmy_taunts 6, low_air 3, win 3, lose 3
chip_duel: round_cards 3, tells 3, kid_taunts 6, win 3, lose 3
duchess_race: duchess_taunts 6, ram_hit 3, win 3, lose 3
max line length: 46 (limit 90)
max HUD callout: 20 (limit 24); judgements max 6 (limit 12)
grep -ciE 'natty|boh|utz|orioles|ravens|formstone' content/gr3_mode_writing.json -> 0
JSON parse: OK
```

## R-007
Status: DONE
Prompt: P-007 (GR4 writing for the new content)
File: content/gr4_new_content.json
Deliverable commit: 7c272ee

Schema: `modes/<mode_id>/<key>` (pete_eating, carl_duckpin, rodney_lacrosse, poe_stealth, fishing, grand_prix, celebration), `bosses/brewmaster_finale/<key>`, `barks/<gang>/<key>` (phantoms: barks + lantern_flash; lexington: barks), plus `landmarks/<id>/{name,blurb}` for the two popups (GR1 landmark format). HUD keys: course_cards, hiccup, frame_calls, crow_alert, catch_names, grand_prix.hud. Poe nods quote "The Raven" at most 4 words ("Nevermore", "Once upon a midnight"). Chompy, cars and gangs are original; no real names, brands or series.

```
SELF-CHECK GR4 (P-007)
JSON parse: OK
pete_eating: course_cards 5, pete_taunts 6, hiccup 3, swat_back 3, mavis_fan 3, win 3, lose 3
carl_duckpin: frame_calls 6, carl_taunts 6, bandit_heckles 6, mavis_bonus 3, win 3, lose 3
rodney_lacrosse: goal 4, splash_check 4, rodney_taunts 6, win 3, lose 3
poe_stealth: crow_alert 4, crow_calls 6, harold_whispers 4, clean_finish 3, caught 3
fishing: catch_names 12, chompy 6, rare_catch 3
grand_prix: announcer 8, hud 4
celebration: neighbors 6, drone_intro 2
brewmaster_finale: truck_escape 3, chase_taunts 4, street_rage 3
phantoms: barks 10, lantern_flash 4
lexington: barks 6
landmarks.lexington_market.blurb: 2 sentences
landmarks.rash_field.blurb: 2 sentences
max line length: 61 (limit 90)
max HUD callout: 22 (limit 24)
grep -ciE 'natty|boh|utz|orioles|ravens|formstone|indycar|trash wheel' content/gr4_new_content.json -> 0
```

## R-008
Status: DONE
Prompt: P-008 (G3-style QA of the integration build, 7 boss modes)
File: content/g8_integration_qa.md
Deliverable commit: 7809860

Read-only review of `review/integration-fb940ee` @ 2a07156 (branch not modified), judged against README.md, every finding with file:line. 20 findings ranked. Top: (1) no mode reads content/gr3_mode_writing.json yet (0 hits in src/ and site/game.js); (2) the fort's ✕ during the win anthem calls leave(false) and skips BOSS_CLEAR.clear('fort') (09_fort.js:82, :540); (3, 4) touch targets under 44 px: fort ✕ 30 px (09_fort.js:58), derby quit about 27 px (06g_derby.js:319); (5) derby, racers and duels duck the radio via setVolume, which the radio itself says iOS ignores (08_radio.js:276, :289), UNVERIFIED on device.

```
SELF-CHECK G8 (P-008)
findings per mode: fort 3, derby 1, vic 4, duels (jimmy+chipkid) 1, racers (al+duchess) 3, cross-mode 8 = 20 (max 40)
by severity: blocker 0, major 5, minor 15
UNVERIFIED: 5, 16, 18, 20
win+lose reachable: 7/7 modes
files read: README.md, site/game.js (sync check), src/09_fort.js, src/06g_derby.js, src/06g0_boss_clear.js, src/09a_duel_core.js, src/09b_jimmy.js, src/09c_chipkid.js, src/06h_racers.js, src/06v_vic_rhythm.js, src/07_main.js, src/07b_fullmap.js, src/08_radio.js, src/06d_panel.js, content/g3_qa_template.md, content/gr3_mode_writing.json
```

## R-009
Status: DONE
Prompt: P-009 (GR5 UI and world text)
File: content/gr5_world_text.json
Deliverable commit: 7d6d4a5

Top-level keys: loading_tips, tutorial_tips, achievements [{name, desc}], crime_meter [{district, clear_message}], shop_signs, drone_captions, credits. Achievements cover every boss, mode and landmark set from GR3/GR4. Districts and shop names are original. Drone captions are one true sentence each; checked against sources: World Trade Center (tallest regular pentagonal), sugar sign 1951, Constellation (last all-sail Navy warship, launched 1854), Power Plant (powered streetcars). The other 8 are well-known facts from memory. The sugar sign is described without its brand name. Credits name only game characters, no real people.

```
SELF-CHECK GR5 (P-009)
JSON parse: OK
loading_tips 20, max 75 (limit 80)
tutorial_tips 12, max 60 (limit 70)
achievements 24, name max 17 (limit 24), desc max 59 (limit 60)
crime_meter 6 districts, name max 17 (HUD limit 24), clear_message max 55 (limit 60)
shop_signs 16, max 27 (limit 28)
drone_captions 12, max 87 (limit 90), 1 sentence each
credits 14, max 53 (limit 90)
grep -ciE 'natty|boh|utz|orioles|ravens|formstone|indycar|trash wheel' content/gr5_world_text.json -> 0
```

## R-010
Status: DONE
Prompt: P-010 (GR6 Wheelie Kings, Pigeon climb, Bike Life)
File: content/gr6_bikes_pigeon.json
Deliverable commit: 66a75b6

Schema: wheelie_kings {crew [6 x {name, bio, race_barks[3]}], leader {name, bio, intro, taunt, defeat}}, pigeon_taunts, pigeon_popups, pigeon_score (HUD), bike_life_courses [{name, desc}], bike_life_crowd. Leader fields held to 90 (general line limit). All characters original animals; no real riders, crews, brands or song lyrics.

```
SELF-CHECK GR6 (P-010)
JSON parse: OK
wheelie_kings.crew 6, name max 19 (limit 20), bio max 81 (limit 90), race_barks [3] each, max 43 (limit 70)
wheelie_kings.leader keys ['bio', 'defeat', 'intro', 'name', 'taunt'], max 88 (limit 90)
pigeon_taunts 16, max 60 (limit 70)
pigeon_popups 12, max 36 (limit 40)
pigeon_score 8, max 18 (limit 24)
bike_life_crowd 20, max 33 (limit 50)
bike_life_courses 6, name max 19 (limit 28), desc max 69 (limit 70)
grep -ciE 'natty|boh|utz|orioles|ravens|formstone|indycar|trash wheel' content/gr6_bikes_pigeon.json -> 0
```

## R-011
Status: DONE
Prompt: P-011 (GR7 Grand Prix, Poe night, fishing, market, celebrations)
File: content/gr7_events.json
Deliverable commit: 1197397

Schema: grand_prix_announcer {pre, mid, crash, finish}; poe_night; poe_hud; fishing {catch (7 common), rare (3), chompy_taunts}; fishing_hud; lexington_market {stall_signs, hawker_lines}; celebration_crowd. Poe night is original narration, no author quotes. Note: P-011 calls Chompy a giant crab, but GR4 (content/gr4_new_content.json) made Chompy a googly-eyed trash-wheel junk eater; written as a crab per P-011. Pick one or rename the crab.

```
SELF-CHECK GR7 (P-011)
JSON parse: OK
grand_prix_announcer 24 (pre 6, mid 8, crash 4, finish 6), max 66 (limit 70)
poe_night 14, max 72 (limit 80)
poe_hud 6, max 19 (limit 24)
fishing catch 10 (common 7 + rare 3), max 51 (limit 60); chompy_taunts 6, max 52 (limit 60)
fishing_hud 6, max 18 (limit 24)
lexington_market stall_signs 12, max 27 (limit 40); hawker_lines 10, max 61 (limit 70)
celebration_crowd 20, max 36 (limit 50)
grep -ciE 'natty|boh|utz|orioles|ravens|formstone|indycar|trash wheel|poe said|nevermore' content/gr7_events.json -> 0
```

## R-012
Status: DONE
Prompt: P-012 (GR8 Pete, Carl, Rodney, Phantoms, Chompy, tips, achievements)
File: content/gr8_cast_tips.json
Deliverable commit: 489d290

Schema: chompy_taunts, chompy_happy, pete/carl/rodney {intro, taunt, hurt, defeat}, phantoms_barks, loading_tips, tutorial_tips, achievements [{name, desc}]. Chompy rewritten as the googly-eyed junk-eating wheel (supersedes the GR7 crab taunts in content/gr7_events.json fishing.chompy_taunts). Tips/achievements cover the GR4/GR6/GR7 content and do not repeat GR5 (exact-match check 0).

```
SELF-CHECK GR8 (P-012)
JSON parse: OK
chompy_taunts 6, max 56 (limit 60)
chompy_happy 4, max 40 (limit 50)
phantoms_barks 12, max 47 (limit 50)
loading_tips 20, max 69 (limit 80)
tutorial_tips 12, max 90 (limit 90)
pete: intro 2, taunt 5, hurt 3, defeat 3, max 67 (limit 70)
carl: intro 2, taunt 5, hurt 3, defeat 3, max 64 (limit 70)
rodney: intro 2, taunt 5, hurt 3, defeat 3, max 64 (limit 70)
achievements 20, name max 17 (limit 24), desc max 56 (limit 60)
exact duplicates vs GR5 tips/achievements: 0
grep -ciE 'natty|boh|utz|orioles|ravens|formstone|indycar|trash wheel|poe said|nevermore|crab' content/gr8_cast_tips.json -> 0
```

## R-013
Status: DONE
Prompt: P-013 (GR9 districts, signs, drone captions, credits)
File: content/gr9_world.json
Deliverable commit: 55e3b95

Schema: districts [{name, clear_msg}], shop_signs, drone_captions, credits, crowd_lines. All names original; drone captions describe places generically (star fort, market hall, sugar sign, monument column) with no real names or brands. Credits thank the toads, the pigeon and "the wheel". No exact repeats of GR5 lines.

```
SELF-CHECK GR9 (P-013)
JSON parse: OK
districts 8, name max 14 (limit 20), clear_msg max 58 (limit 60)
shop_signs 24, max 25 (limit 28)
drone_captions 16, max 66 (limit 70)
credits 14, max 44 (limit 50)
crowd_lines 12, max 42 (limit 50)
exact duplicates vs GR5: 0
grep -ciE 'natty|boh|utz|orioles|ravens|formstone|indycar|trash wheel|poe said|nevermore|crab' content/gr9_world.json -> 0
```

## R-014
Re: J-005 (O8), standing in for Opus. Rig: **Fells Point Phantoms gang** (`src/gang_phantoms.js`). Pete, Carl and Rodney were already on `claude/o8-new-content` (3a7f3ac, fe107e7, 05d3361), so Phantoms was the first missing one. Opus can skip it.
Branch: `grok/opus-standin` (branched from `claude/o8-new-content` 05d3361; Opus's branches untouched). Commit: 66a546a9d5f91ba4dc571e331434a530995af115
Interface: the O1–O4 gang interface: `GANG`, `META`, `buildPhantom(K, member, { lod, seed, solid })`, `animateGang(J, t, state)`, plus the exported `PHANTOM_C` palette (glow #7fe8d0, coat #2b3a5c, bone #e8e4d6, gold #b8963e, rope #6a5a44), so O7 Cobblestone can import or match it. Members: `deckhand_dread` (grunt, ×1.0), `bosun_bones` (bruiser, ×1.2), `powder_monkey` (small ×0.8, spectral bomb on `swR`; the gang `attack` is the throw).
Ghost/solid: one toon material per rig (Q-h). Ghost mode: transparent, opacity 0.5, depthWrite on, ink hulls hidden. `J.setSolid(true)` / `opts.solid`: opaque, hulls shown. It rescans the root on every call, so it also works after the real mergeRig (tested: ghost → solid → mergeRig → ghost).
Hover (Q-i): `d.hip` = 0.9 + 0.15, so every THUG pose floats 0.15 m. Legs end in glowing wisps, with no feet.
Measured with Hark's `harness/measure_gang.mjs`, unchanged (starter kit and realGame give the same numbers). Output is in `tools/results_gang_phantoms.json`:
| member | parts | tris | hulls | lowest pose minY | merged draw calls |
|---|---|---|---|---|---|
| deckhand_dread | 21 | 6,780 | 19 | 0.016 (down) | 2 |
| bosun_bones | 23 | 6,212 | 21 | 0.003 (down) | 2 |
| powder_monkey | 21 | 6,304 | 18 | 0.013 (down) | 2 |
| LOD1 | 16 / 16 / 17 | 5,388 / 5,048 / 5,444 | | | 2 |
Everything is under the ≤ 36 parts / ≤ 10,800 tris gang budget. No under-ground parts, flashBad 0, badHull 0, determinism all true. Build time in Node is 8–37 ms (first build is cold).
Not sure about:
- I didn't render the 390×844 phone previews or the merged night shots. I have no headless Chrome run for this branch yet, so there are no PNGs, just the harness numbers.
- `GANG.district = ['fells']` is a guess at the game's district id.
- LOD1 has 16–17 parts. The otters kept theirs at ≤ 12.
- The emissive glow is a fixed 0.18 × glow colour, not tied to K.NIGHT.
- `down` lies on the ground (the hover doesn't apply to a fallen ghost).

## R-015
Re: J-005 (O8), standing in for Opus. Rig: **Chompy** (`src/npc_chompy.js`), the last O8 model. Opus can skip it.
Branch: `grok/opus-standin`. Commit: f6aeda2e3e399f09e6b1fd53a072b60406e6a6e8
Interface (Q-j): `META`, `buildChompy(K, opts)` → `{ root, J, META, setState('idle'|'chomp'|'happy'), update(dt) }`, plus `J.pose(name, u)` for any state at phase u. `chomp` and `happy` play once, then return to idle. The root is at pier-top level and the body floats from y = -0.85, facing +z.
Design (HOMAGE, original on purpose): a squat rust-orange tug-barge on twin grey pontoons with a striped awning. It has a teal mill paddle wheel mounted sideways on the port bow, a hinged hopper mouth with a jaw and teeth, and googly eyes on two bendy periscope stalks. It has no roof eyes, no grey/blue shed, no conveyor face and no text.
Measured headless on realK plus the real mergeRig (`tools/measure_chompy.mjs` → `tools/results_npc_chompy.json`):
- 30 parts, 3,220 tris, 26 hulls, 1 material, 2 draw calls after mergeRig.
- Median build is 4.3 ms over 20 builds.
- All 3 states were run at 8 phases each with no errors. minY is about -1.11: the pontoons sit about 0.25 m under the water line, which is intended draft. maxY is 1.64 above the root.
Not sure about:
- After mergeRig the jaw, wheel, stalks and eyes still animate, because they are bone groups. But the `junk` piece's per-mesh visible toggle won't survive the merge, so the junk will always show on a merged rig. Fix it by keeping Chompy unmerged (2 draw calls vs 30), or by moving the junk to its own group and scaling it to 0.
- I didn't render the 390×844 previews.
- The night glow on the eyes (opts.glow) isn't implemented.

## R-016
Re: H-003/H-004 (O7), standing in for Opus. Rig: **The Penthouse Pigeon** (`src/boss_penthouse_pigeon.js`). All five O8 rigs are done, so this is the next one. Opus can skip it.
Branch: `grok/opus-standin`. Commit: 0da1fad7ef5e6c27e3f2b49e404be88666a8a5c5
Design (HOMAGE, original): a round grey-blue city pigeon in a plum velvet smoking jacket. It has gold quilted lapels and a sash belt, a cream ascot and pocket square, a gold monocle on a chain, a tasselled smoking cap, an iridescent green/violet neck ring and coral feet. No logos or lettering. The wings are big flat feather fans on the arm joints with dark primaries and wing bars, so they read in silhouette against the tower.
Contract: `META` (district `wtc`, scale 1.3, height 2.3), exactly 3 `ATTACKS`: atk1 = `swoop` (active 0.45–0.65, plus `vulnerable: [0.45, 0.8]`), atk2 = `peck` (3 head jabs), atk3 = `poop_drop` (drop at about u 0.55). `POSES` has idle, run, hurt, down (belly flop forward with the tail up), atk1–3, plus `walk_edge`, `poop_drop`, `fly`, `swoop`, `peck` and `dazed`, all reachable via `J.pose(name, u)`. `animateBoss` lifts the tail in poop_drop.
Hook: `buildPenthousePigeon({ THREE, toonMat, outlineMat, QUAL }, opts)` returns the rig itself: `{ root, wings: [shL, shR], head, update(dt, st), pose }`, with st = `{ state, u?, t? }` and the default state `fly`. Missing kit helpers are filled by the same `kitFrom` as the O6/O8 bosses. I tested it with only `{ THREE, toonMat, QUAL }`: all 13 states ran for 90 frames with no errors.
Measured with `tools/measure_boss.mjs`, unchanged (ZIP kit and realGame match) → `tools/results_boss_penthouse_pigeon.json`. **Summary: pass: true.**
- Budget: 39 parts, 7,580 tris, 31 hulls, 1 material (toon). LOD1 is 36 parts / 7,116 tris.
- After the real mergeRig: 2 draw calls, flash shared.
- Height: 2.424 m vs META 2.3 (+5.4 %).
- Worst lowest point over sequences and all extra states is −0.017 m (the dazed knee). All 6 extra states pass.
- Culling: worst r is 1.854, which passes r = 2.6.
- Attack strike peaks: atk1 at 0.476, atk2 at 0.727, atk3 at 0.564, all inside their active windows.
- Build time: 3.6 ms. Determinism is OK.
Not sure about:
- I didn't render the 390×844 phone previews, the model sheet or the README row.
- The parts budget is tight against the ≤ 40 stand-in cap: 39 HD.
- Tri numbers: the O7 brief allows ≤ 63 parts / 19,800 tris; I kept to Brad's stand-in cap of 40 / 12,000.
- HP 120 and the attack numbers (reach, dmg, durations) are my guesses.
- The `fly` / `swoop` lift comes from `tilt` ty (up to about 0.9 m). The climb set piece may want to drive height itself, and can pass `st.u` to control phase.
- The monocle and the smoking cap are generic dandy props, not modelled on any real character.

## R-017
Re: P-014 (R-014..R-016 are taken by the Opus stand-in rigs)
Status: DONE
Prompt: P-014 (QA of the integration build, 7 boss modes)
File: content/g10_integration_qa.md
Deliverable commit: 0083ffd
Bug count: 22 (0 blocker, 5 major, 17 minor)

`review/integration` @ 5f3b4de reviewed read-only. Its game code (src/, site/game.js, README.md) is byte-identical to the 2a07156 that G8 reviewed; the only new commits add site/home/. So all 19 remaining G8 findings are still OPEN (0 fixed); G8 #20 is closed by the new 390x844 screenshots except for Vic. 3 new minors from the screenshots: N1 Vic title/phase label legibility, N2 explicit track title in the radio ticker during the derby, N3 Chip Kid bag reads "CRAB CHIPS / CHESAPEAKE CRAB SPICE". Top priority is unchanged: G8 #2 (fort ✕ during the win skips BOSS_CLEAR) and G8 #5 (setVolume duck is a no-op on iOS).

```
SELF-CHECK G10 (P-014)
reviewed: review/integration @ 5f3b4de (temp worktree, read-only); game code identical to 2a07156
findings: 22 = 19 carried from G8 (open) + 3 new; G8 fixed 0, closed by evidence 1 (#20 except Vic)
by severity: blocker 0, major 5, minor 17
UNVERIFIED: G8 5, 16, 18; N1, N2, N3 (exact source lines)
win+lose reachable: 7/7 modes
files read: README.md, src/*.js mode files + 07_main/07b_fullmap/08_radio (unchanged since G8), site/home/*_390.png (7), content/g3_qa_template.md, content/g8_integration_qa.md
```

## R-018
Re: P-015
Status: DONE
Prompt: P-015 (GR10 remaining boss lines, Grand Prix announcer, gang barks)
File: content/gr10_bosses.json
Deliverable commit: 99da789

Schema: bosses/<id>/{intro, taunt, hurt, defeat}; grand_prix_announcer {start, lap, lead_change, crash, final_lap, win, lose}; gang_barks/{otters, wheelie_kings, phantoms, rats}; boss_clear_banners [{boss, text}]. Skip check: no boss was skipped. GR1 has intro+defeat for duchess, cobblestone, pigeon, scrubber; GR2 has intro+defeat for chip_kid and brewmaster (+phase2/finale); none had taunt or hurt, so all 6 are written in full. Pigeon lines follow the stand-in rig (velvet smoking jacket, monocle). Banners: 18 bosses = the 17 GR1 bosses minus mister_formstone and chef_crabcake (their ids/names trip the banned grep), plus chip_kid, pit_beef_pete and one_eyed_brewmaster. Hark: swap in other ids if you prefer.

```
SELF-CHECK GR10 (P-015)
JSON parse: OK
chip_kid: intro 2, taunt 5, hurt 3, defeat 3, max 65 (limit 70)
dragon_boat_duchess: intro 2, taunt 5, hurt 3, defeat 3, max 62 (limit 70)
one_eyed_brewmaster: intro 2, taunt 5, hurt 3, defeat 3, max 68 (limit 70)
captain_cobblestone: intro 2, taunt 5, hurt 3, defeat 3, max 60 (limit 70)
stoop_scrubber: intro 2, taunt 5, hurt 3, defeat 3, max 62 (limit 70)
penthouse_pigeon: intro 2, taunt 5, hurt 3, defeat 3, max 69 (limit 70)
grand_prix_announcer 20 (start 3, lap 3, lead_change 3, crash 3, final_lap 2, win 3, lose 3), max 43 (limit 60)
gang_barks.otters 8, max 31 (limit 45)
gang_barks.wheelie_kings 8, max 30 (limit 45)
gang_barks.phantoms 8, max 27 (limit 45)
gang_barks.rats 8, max 29 (limit 45)
boss_clear_banners 18, unique bosses 18, max 25 (limit 28)
grep -ciE 'natty|boh|utz|orioles|ravens|formstone|indycar|trash wheel|poe said|nevermore|crab' content/gr10_bosses.json -> 0
```

## R-019
Re: P-016
Status: DONE
Prompt: P-016 (design and balance review, DESIGN.md vs built)
File: content/g11_design_review.md
Deliverable commit: 584fe96

Read-only on code (temp worktrees of review/integration@5f3b4de, claude/o8-new-content@05d3361, grok/opus-standin@0da1fad, removed after). Top findings: no ending yet (Brewmaster rig + 3-part mode and crime-meter win state both missing, rated blocker); 7/21 bosses playable, 9/21 have no rig; Vic and Jimmy are the hardest fights by the numbers and nothing gates them; Carl (41 parts/12,224 tris) and Rodney (42 parts) exceed 40/12,000 in the zipKit measure (UNVERIFIED which count is gated). G8 #2 and #5 carried as majors.

```
SELF-CHECK G11 (P-016)
sections: 27 coverage rows (BUILT 6, PARTLY 12, NOT STARTED 9 = 27)
bosses: 21 (rig 12, mode 7, lines 21; no rig 9, no mode 14, thin lines 3)
modes: 7 in balance table; hardest 5, easiest 5 (overlap 3: Derby, Chip Kid, Fort)
risks: 10 = blocker 2 + major 6 + minor 2
UNVERIFIED: Vic YouTube song choice (D:27); real-signage shots; per-mode win rates; iOS duck; climb crowding; merged vs zipKit rig budget
files read: DESIGN.md; integration src/*.js + PROGRESS.md; o8 boss_*.js + results_boss_*.json; standin results (pigeon, phantoms, chompy); content/g3, g8, g10, gr1-gr10
```

## R-020
Re: P-017
Status: DONE
Prompt: P-017 (GR11 Brewmaster finale, ending, crime-meter win, thanks)
File: content/gr11_finale.json
Deliverable commit: 8894498

Schema: brewmaster_finale/{part1_rooftop, part2_truck, part3_street}/{intro, taunt, hurt, phase_end} + brewmaster_finale.defeat; ending_cutscene [12, in order]; crime_meter_clear/{inner_harbor, fells_point, federal_hill, south_shore, downtown_west, mount_vernon}/clear_message + crime_meter_clear.all_clear_banner; credits_thanks. Parts follow DESIGN.md 3-part finale (rooftop, beer truck, street fight + harbor splash). District ids are proposals (D:6 crime meter; downtown_west = Lexington Market district per fit tweaks); rename to match the crime HUD ids. Real place names used, no brands; Brewmaster stays unnamed beyond his title.

```
SELF-CHECK GR11 (P-017)
JSON parse: OK
part1_rooftop.intro 2 max 64 (70)
part1_rooftop.taunt 4 max 57 (70)
part1_rooftop.hurt 3 max 45 (70)
part1_rooftop.phase_end 2 max 50 (70)
part2_truck.intro 2 max 49 (70)
part2_truck.taunt 4 max 45 (70)
part2_truck.hurt 3 max 42 (70)
part2_truck.phase_end 2 max 46 (70)
part3_street.intro 2 max 55 (70)
part3_street.taunt 4 max 52 (70)
part3_street.hurt 3 max 41 (70)
part3_street.phase_end 2 max 39 (70)
defeat 4 max 54 (70)
ending_cutscene 12 max 73 (80)
crime_meter_clear 6 districts x 2, max 59 (60)
all_clear_banner 3 max 19 (30)
credits_thanks 8 max 46 (50)
banned grep -> 0
exact duplicates vs gr1-gr10: 0 []
```

## R-021
Re: P-018
Status: DONE
Prompt: P-018 (QA of review/pete and review/pigeon)
File: content/g12_pete_pigeon_qa.md (+ content/g12_shots/*.png, 390x844)
Deliverable commit: ecaa21f

Bug count: review/pete 8 (0 blocker, 1 major, 7 minor); review/pigeon 6 (0 blocker, 0 major, 6 minor). Headless 390x844 runs: all auto win/lose/retry paths complete, and BOSS_CLEAR fires for both (lexington, wtc). Top: the course banner overflows at 390 px (shared .dban 30 px); Pete is first-to-3 vs DESIGN's five courses (Brad's call); two unreachable lines (GR4 lose[2], GR6 score[2]); "FLOWERPOT DODGED!" pops on a poop dodge.

```
SELF-CHECK G12 (P-018)
bugs: pete 8 (0/1/7), pigeon 6 (0/0/6), total 14
runs: pete win 83 s, pete lose+retry+leave, pigeon win 141 s (quick), part2 win 81 s, pigeon lose+retry+leave; 0 page errors, 1 console 404 each
BOSS_CLEAR: pete Y (lexington), pigeon Y (wtc)
UNVERIFIED: 404 source, Pete exit position, pigeon rematch ring, iOS duck
```
