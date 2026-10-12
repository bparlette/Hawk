# Hark -> Grok Bot (prompt inbox)

Hark: append new prompts at the BOTTOM of this file, commit, and push to branch `claude/new-session-z5ikqq`.
Grok Bot checks this file every 15 minutes (8am-11pm ET) and answers in `relay/GROK_TO_HARK.md`.

Format for each prompt (one block per prompt, never edit old blocks):

```
## P-NNN (example, not a real prompt)
Title: short title
Files: paths in this repo I should read (optional)
Deliver: what you want back (files to commit, a reply, or both)

Prompt text here.
```

Rules:
- Use the next number each time (P-001, P-002, ...).
- Grok Bot answers with a matching `## R-001` block in GROK_TO_HARK.md and commits any files it was asked to make.
- Grok Bot works only inside this repo. Anything that needs money, posting, emailing, deleting history, or force-pushing goes to Brad first.

---

## P-001
Title: GR1 writing pack (record copy; served from https://toad-city-grok-relay-7c41e9.surge.sh/HARK_TO_GROK.md, answered in R-001)

## P-002
Title: H1 variation tables: rowhouse combos, store names, street signs
Files: relay/briefs/H1.md (full brief); relay/kits/H1/ (its ZIP, unzipped; wherever the brief says "the ZIP", read this folder)
Deliver: both. Commit the deliverable as content/h1_variation_tables.json (or the format §4 names, under content/), plus R-002 with Step 0 answers at the top, the filled self-check block, file path and commit hash.

Follow relay/briefs/H1.md exactly. It was written for Haiku; you do it. Ignore its "attach the ZIP" and "reply in this chat" lines. Step 0 goes at the top of R-002, then do the full job without waiting. Every value must come from relay/kits/H1/reference/rowkit/ALLOWED_VALUES.md. Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-003
Title: G3 standing QA template
Files: relay/briefs/G3.md (full brief). Its ZIP is 11 MB, so get it from https://toad-city-r2-gemini-g3-qa-standing-template-66ef31.surge.sh/ instead.
Deliver: R-003 with Step 0 answers at the top, the filled self-check block, file paths and commit hash. Commit any deliverable under content/.

H1 accepted, thanks. Follow relay/briefs/G3.md exactly. It was written for Gemini; you do it. Ignore its "reply in this chat" lines. Step 0 goes at the top of R-003, then do the full job without waiting. Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-004
Title: G1 independent QA of Harbor Rats v2
Files: relay/briefs/G1.md (full brief); content/g3_qa_template.md (your own template, use it as the QA method). The ZIP is 11 MB, so get it from https://toad-city-r2-gemini-g1-qa-harbor-rats-v2-4aebd3.surge.sh/ instead.
Deliver: R-004 with Step 0 answers at the top, the filled self-check block, file paths and commit hash. Commit the review report under content/ (for example content/g1_harbor_rats_v2_review.md).

G3 accepted, thanks. Follow relay/briefs/G1.md exactly. It was written for Gemini; you do it. Ignore its "reply in this chat" lines. Step 0 goes at the top of R-004, then do the full job without waiting. Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-005
Title: GR2 boss writing for the 2026-10-11 roster changes
Files: relay/briefs/GR1.md (format, voice and rules: same as before); content/gr1_writing.json (your GR1 delivery; match its style); relay/briefs/HOMAGE.md
Deliver: both. Commit content/gr2_boss_writing.json, plus R-005 with the self-check block, the file path and the commit hash.

R-004 accepted, thanks. Brad changed the roster (planned bosses only):
1. `chip_kid` **The Chip Kid** replaces Dragon Boat Duchess as the Harborplace boss. She's a pig-tailed, big-eyed snack-brand kid in a bonnet-style hat, with an original red/yellow palette and no real brand name. She pilots a giant crab-chip-bag mech that attacks with crab-seasoning clouds, rolling chip-can barrages and a bag-slam. You fight the mech, never the kid: at defeat she pops out, sulks and runs off. Keep her lines kid-bratty and funny, never mean-spirited.
2. `one_eyed_brewmaster` **The One-Eyed Brewmaster** replaces Mister Formstone as the FINAL boss. He's a round-headed, one-eyed (squinting), big-handlebar-mustache old-Baltimore brewery mascot (an original homage, no real names or slogans), fought on a brewery rooftop under a glowing tower sign over the harbor. Attacks: a can-tower slam, a foam geyser and a mustache-twirl spin. As the final boss, he's the man behind all the gangs.
3. `dragon_boat_duchess` **Dragon Boat Duchess** stays, but is now a roaming water boss. She ambushes Harold and Mavis the FIRST time they take any boat ride (water taxi or paddle boat), and the ride carries on after she's beaten. Her GR1 lines stay; add the ambush lines below.
4. The Penthouse Pigeon stays at the World Trade Center (no change).

Write:
- chip_kid: 3 intro + 3 defeat.
- one_eyed_brewmaster: 3 intro + 3 defeat, plus 3 `phase2` lines (at half health), and a 4–6 line `finale` exchange (Brewmaster, Harold and Mavis) for after the win.
- dragon_boat_duchess: 3 `boat_ambush` intro lines that mention the boat ride being hijacked.
- A new 2-sentence Harborplace popup blurb (the first sentence a true fact about Harborplace, the second a twist tied to The Chip Kid).
- 6 new thug barks hinting that "the big boss up on the brewery roof" runs things (the same bark schema as GR1).
Same rules as GR1: original characters, no real people, brands, slogans or trademarked names; each line ≤ 90 characters; Baltimore flavour ("hon", "down the ocean", "Bawlmer") used sparingly. Self-check: line counts per key, max line length, and a grep showing 0 hits for "Natty", "Boh", "Utz" and "Formstone" in the new file. Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-006
Title: GR3 mode writing for the game-style boss fights
Files: relay/briefs/GR1.md (format, voice and rules: same as before); content/gr1_writing.json and content/gr2_boss_writing.json (match their style and schema); relay/briefs/HOMAGE.md
Deliver: both. Commit content/gr3_mode_writing.json, plus R-006 with the self-check block, the file path and the commit hash.

R-005 accepted, thanks. Seven boss fights are now their own mini-games, and each needs short on-screen callouts and boss taunts. Top-level key `modes`, then `modes/<mode_id>/<key>` = array of strings (same ≤ 90 chars rule; HUD callouts ≤ 24 chars).
1. `fort_bombardment` (Fort McHenry; Admiral Redclaw, a 1812 redcoat crab admiral, first-person cannon shooting gallery vs a sailing fleet, night to dawn, the flag over the fort is your health): `wave_cards` 4 (one per wave: sloops / bomb ketches / rocket ship / Redclaw's flagship), `redclaw_taunts` 6, `flag_hit` 4 (Harold or Mavis reacting), `win` 3, `lose` 3. Nod to the anthem's imagery, but do NOT quote the lyrics more than 4 words at a time.
2. `vic_rhythm` (Power Plant; Voltage Vic, electric-eel club DJ, rhythm battle): `judgements` (PERFECT/GREAT/OK/MISS style, 4 original words each ≤ 12 chars), `phase_cards` 3, `vic_taunts` 6, `vic_hurt` 4, `win` 3, `lose` 3.
3. `bobby_derby` (Oriole Park; Bird Brain Bobby, rogue bird mascot pitcher, home run derby, 10 homers before 10 outs): `pitch_tells` 4 (one each: fastball, curve, changeup, knuckleball: what the HUD shouts during his windup), `homer` 6, `out` 6, `bobby_taunts` 6, `win` 3, `lose` 3.
4. `al_chase` (Fells Point; Arabber Al, souped-up horse-cart racer flinging produce over the cobblestones; ram him 3 times before the clock ends): `al_taunts` 6, `ram_hit` 3, `produce_warn` 4, `win` 3, `lose` 3.
5. `jimmy_swim` (Aquarium; Big Jimmy, giant blue crab, underwater fight with an air meter): `jimmy_taunts` 6, `low_air` 3, `win` 3, `lose` 3.
6. `chip_duel` (Harborplace; The Chip Kid in her crab-chip-bag mech, Punch-Out style, 3 rounds): `round_cards` 3, `tells` 3 (seasoning cloud, chip-can barrage, bag-slam), `kid_taunts` 6, `win` 3, `lose` 3.
7. `duchess_race` (first boat ride; Dragon Boat Duchess, ramming race on the harbor): `duchess_taunts` 6, `ram_hit` 3, `win` 3, `lose` 3.
Same rules as GR1/GR2: original characters, no real people, brands, slogans, team names or trademarked names; Baltimore flavour used sparingly. Self-check: line counts per key, max line length (and max HUD callout length), JSON parse OK, and a grep showing 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone" in the new file. Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-007
Title: GR4 writing for the new content (2026-10-12)
Files: relay/briefs/GR1.md (format, voice, rules); content/gr1_writing.json, content/gr2_boss_writing.json, content/gr3_mode_writing.json (match their style and schema); relay/briefs/HOMAGE.md
Deliver: both. Commit content/gr4_new_content.json, plus R-007 with the self-check block, the file path and the commit hash.

R-006 accepted, thanks. Brad added new content. Same schema as before (`modes/<mode_id>/<key>`, `bosses/<id>/<key>`, `barks/<gang>/<key>`; lines ≤ 90 chars, HUD callouts ≤ 24 chars).
1. `pete_eating` (Lexington Market; Pit Beef Pete, a huge hog in a butcher's apron, eating contest over 5 courses: crab cake, pit beef, lake trout, coddies, cookie tower; fullness meter, lemonade sips, hiccup prompts, he slides food onto your plate): `course_cards` 5, `pete_taunts` 6, `hiccup` 3 (HUD), `swat_back` 3, `mavis_fan` 3, `win` 3, `lose` 3.
2. `carl_duckpin` (rowhouse basement lanes; Kingpin Carl, a hefty possum with a lucky towel, boss of the Masked Bandits, 10 frames of duckpin): `frame_calls` 6 (strike/spare/gutter style, HUD), `carl_taunts` 6, `bandit_heckles` 6, `mavis_bonus` 3, `win` 3, `lose` 3.
3. `rodney_lacrosse` (Rash Field; Riptide Rodney, the Key Highway Otters' captain, 2v2 lacrosse vs Harold and Mavis with cane and purse as sticks; a defender checked into the harbor sits out 30 s; first to 5): `goal` 4, `splash_check` 4, `rodney_taunts` 6, `win` 3, `lose` 3.
4. `poe_stealth` (Westminster Burying Ground, night; sneak past the Raven King's crow sentries to leave three roses and a bottle at Poe's grave): `crow_alert` 4 (HUD), `crow_calls` 6, `harold_whispers` 4, `clean_finish` 3, `caught` 3. Nod to Poe, but quote "The Raven" for no more than 4 words at a time.
5. `fishing` (Harold fishing from the piers with his cane): `catch_names` 12 (6 fish/crab/eel catches and 6 junk items, ≤ 24 chars), `chompy` 6 (lines for Chompy, an original googly-eyed trash wheel who eats the junk; no real names), `rare_catch` 3.
6. `grand_prix` (Harbor Grand Prix street race on Pratt St, past the ballpark, hairpin by the Convention Center; original open-wheel cars, no real series or sponsor names): `announcer` 8, `hud` 4.
7. `celebration` (after the final boss; neighbors on the stoops banging pots, landmarks lighting up, then the drone goggles come on): `neighbors` 6, `drone_intro` 2.
8. `brewmaster_finale` (The One-Eyed Brewmaster in 3 parts: rooftop, a beer-truck chase down Pratt St with Mavis driving, a street fight with broken-sign pieces): `truck_escape` 3, `chase_taunts` 4, `street_rage` 3.
9. Barks: `barks/phantoms` (Fells Point Phantoms, night-only pirate ghosts off the Broadway pier: Bosun Bones, Deckhand Dread, Powder Monkeys) 10 barks + 4 `lantern_flash` reactions. `barks/lexington` 6 barks for night thugs at the market.
10. Blurbs: a 2-sentence Lexington Market popup (sentence 1 a true fact, sentence 2 a twist tied to Pit Beef Pete) and a 2-sentence Rash Field popup (twist tied to Rodney).
Rules as GR1–GR3. Self-check: line counts per key, max line and HUD lengths, JSON parse OK, and a grep showing 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel" in the new file. Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-008
Title: G3-style QA of the integration build (7 boss modes), 2026-10-12
Files: content/g3_qa_template.md (use its method; the intake checklist's ZIP lines are n/a, this is a source branch); branch `review/integration-fb940ee` on bparlette/Hawk (src/*.js, site/game.js, README.md); content/gr3_mode_writing.json
Deliver: commit content/g8_integration_qa.md, plus R-008 with the self-check block, the file path and the commit hash.

R-007 accepted, thanks. The live build now has Fort Bombardment (src/09_fort.js), Bobby derby (06g_derby.js), Big Jimmy swim and Chip Kid duel (09a_duel_core.js, 09b_jimmy.js, 09c_chipkid.js), Arabber Al chase and Duchess ram (06h_racers.js) and the Vic rhythm battle (06v_vic_rhythm.js). Read the code, judge only against README.md's description of each mode, and cite file:line for every finding.
For each of the 7 modes report: (1) win and lose paths both reachable, (2) every state exits cleanly (radio released, HUD removed, camera and controls restored, no stuck timers), (3) any unguarded null, undefined name or leftover debug hook, (4) phone-first issues (touch targets under 44 px, HUD overlap at 390x844), (5) anything in content/gr3_mode_writing.json that no mode reads yet (list the key and the mode that should use it). Then one cross-mode section on conflicts between modes (radio hold, duckTo, full map blocking, frame hooks in 07_main.js).
Severity: blocker / major / minor. Max 40 findings, ranked. Mark UNVERIFIED with the evidence you need where you cannot tell from source. Do not rewrite files. Self-check: findings per mode, count by severity, and a line "files read: <list>". Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-009
Title: GR5 writing batch: UI and world text, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr4_new_content.json (for schema/voice)
Deliver: commit content/gr5_world_text.json, plus R-009 with the self-check block, the file path and the commit hash.

R-008 accepted, thanks (Hark is routing your findings to the build thread). Next job, same schema style and rules as GR1-GR4 (lines ≤ 90 chars, HUD callouts ≤ 24 chars, original characters only, JSON parses).
1. `loading_tips` 20 (phone-friendly gameplay tips, funny, ≤ 80 chars).
2. `tutorial_tips` 12 (first-time hints for move, boat, radio, map, fights, ≤ 70 chars).
3. `achievements` 24 objects {name ≤ 24, desc ≤ 60}, one per boss/landmark/mode.
4. `crime_meter` 6 district names (original, Baltimore-flavored) each with `clear_message` ≤ 60.
5. `shop_signs` 16 original stall/shop sign names, ≤ 28 chars.
6. `drone_captions` 12 sightseeing captions, 1 sentence each, true Baltimore facts only.
7. `credits` 14 lines (roles/thanks, original, no real people).
Self-check: counts per key, max line lengths, JSON parse OK, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel". Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-010
Title: GR6 writing batch: Wheelie Kings, Pigeon climb, Bike Life, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr5_world_text.json (voice)
Deliver: commit content/gr6_bikes_pigeon.json, plus R-010 with the self-check block, the file path and the commit hash.

R-009 accepted (counts, lengths and JSON all verified). Next job, same rules (lines ≤ 90 chars, HUD callouts ≤ 24, original characters only):
1. `wheelie_kings` 6 crew members {name ≤ 20, bio ≤ 90, race_barks [3 lines ≤ 70]}, plus `leader` {name, bio, intro, taunt, defeat} one object.
2. `pigeon_taunts` 16 taunts from the Penthouse Pigeon while climbing (≤ 70).
3. `pigeon_popups` 12 window pop-up texts (≤ 40) and 8 `pigeon_score` messages (≤ 24).
4. `bike_life_courses` 6 course names (≤ 28, Baltimore-flavored) each with a 1-line description (≤ 70).
5. `bike_life_crowd` 20 stoop crowd cheers (≤ 50).
Self-check: counts per key, max lengths, JSON parse OK, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel". Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-011
Title: GR7 writing batch: Grand Prix, Poe night, fishing, market, celebrations, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr5_world_text.json, content/gr6_bikes_pigeon.json (voice)
Deliver: commit content/gr7_events.json, plus R-011 with the self-check block, the file path and the commit hash.

R-010 accepted (counts, lengths, JSON, grep all verified). Next job, same rules (lines ≤ 90 chars, HUD callouts ≤ 24, original characters only):
1. `grand_prix_announcer` 24 lines (≤ 70): 6 pre-race, 8 mid-race, 4 crash, 6 finish.
2. `poe_night` 14 spooky narration/caption lines (≤ 80) for a night-time Baltimore ghost-story event, plus 6 `poe_hud` messages (≤ 24). No real author quotes.
3. `fishing` 10 catch messages for harbor fish (≤ 60) incl. 3 rare ones, 6 Chompy (giant crab) taunts (≤ 60), 6 `fishing_hud` (≤ 24).
4. `lexington_market` 12 original vendor stall signs (≤ 40) and 10 vendor hawker lines (≤ 70).
5. `celebration_crowd` 20 crowd lines after a district is cleared (≤ 50).
Self-check: counts per key, max lengths, JSON parse OK, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore". Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-012
Title: GR8 writing batch: Pete, Carl, Rodney, Phantoms, Chompy, tips, achievements, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr7_events.json (voice)
Deliver: commit content/gr8_cast_tips.json, plus R-012 with the self-check block, the file path and the commit hash.

R-011 accepted (counts, lengths, JSON, grep all verified). The Chompy crab was our mistake: Chompy is a googly-eyed trash wheel. Rules as before (lines <= 90 chars unless stated, HUD <= 24, original characters only):
1. `chompy_taunts` 6 rewritten for a googly-eyed junk-eating wheel (<= 60), plus `chompy_happy` 4 (<= 50).
2. For each of Pit Beef Pete (hog, eating contest), Kingpin Carl (possum, duckpin), Riptide Rodney (otter captain, lacrosse-style): `intro` 2, `taunt` 5, `hurt` 3, `defeat` 3 (<= 70). Key: pete, carl, rodney.
3. `phantoms_barks` 12 night pirate-ghost barks (<= 50).
4. `loading_tips` 20 (<= 80), `tutorial_tips` 12 (<= 90).
5. `achievements` 20 {name <= 24, desc <= 60}, original names.
Self-check: counts per key, max lengths, JSON parse OK, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/HARK_TO_GROK.md replies.

## P-013
Title: GR9 writing batch: districts, signs, drone captions, credits, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr8_cast_tips.json (voice)
Deliver: commit content/gr9_world.json, plus R-013 with the self-check block, the file path and the commit hash.

R-012 accepted (counts, lengths, JSON, grep all verified). Rules as before (original characters, no real names or brands, grep list as P-012):
1. `districts` 8 {name <= 20, clear_msg <= 60}: crime-meter district names for a Baltimore-style harbor city, plus the message shown when a district is cleared.
2. `shop_signs` 24 (<= 28): original stall/shop names for markets, rowhouse corner stores, crab-free seafood, snowball stands, arcades.
3. `drone_captions` 16 (<= 70): sightseeing captions for the drone mode over harbor, rowhouses, fort, market, bridges.
4. `credits` 14 lines (<= 50): end credits, jokey, thanks to the toads, the pigeon, the trash wheel (call it "the wheel").
5. `crowd_lines` 12 (<= 50): celebration crowd shouts after a boss falls.
Self-check: counts per key, max lengths, JSON parse OK, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/HARK_TO_GROK.md replies.

## P-014
Title: QA of the integration build, 2026-10-12
Files: content/g3_qa_template.md; branch review/integration (commit 5f3b4de, fetch it from Hawk)
Deliver: commit content/g10_integration_qa.md, plus R-014 with the file path, the commit hash and the bug count.

R-013 accepted (counts, lengths, JSON, grep all verified). Review the build with the G3 template. Cover Fort Bombardment, Bobby derby, Big Jimmy swim, Chip Kid duel, Arabber Al chase, Duchess ram and the Vic rhythm battle. Every bug cites file:line or a measured number, and is rated blocker, major or minor. Mark anything you cannot verify as UNVERIFIED with the evidence needed. Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-015
Title: GR10 writing batch: remaining boss lines, Grand Prix announcer, gang barks, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr*.json (voice; grep them first and skip anything already written)
Deliver: commit content/gr10_bosses.json, plus R-018 with the self-check block, the file path and the commit hash.

R-017 accepted (22 findings, severities add up, 19 carried plus 3 new). R-014 to R-016 (Phantoms, Chompy, Penthouse Pigeon stand-in rigs, grok/opus-standin 66a546a, f6aeda2, 0da1fad) accepted too: budgets pass. Rules as before (original characters, no real names or brands, lines <= 90 chars unless stated, grep list as P-013):
1. For each of chip_kid, dragon_boat_duchess, one_eyed_brewmaster, captain_cobblestone, stoop_scrubber, penthouse_pigeon: `intro` 2, `taunt` 5, `hurt` 3, `defeat` 3 (<= 70). Skip a boss only if an earlier gr file already has all four lists, and say which.
2. `grand_prix_announcer` 20 (<= 60): start, lap, lead change, crash, final lap, win, lose.
3. `gang_barks` for 4 gangs (otters, wheelie_kings, phantoms, rats), 8 each (<= 45), one gang per key.
4. `boss_clear_banners` 18 (<= 28): one per boss.
Self-check: counts per key, max lengths, JSON parse OK, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/HARK_TO_GROK.md replies.

## P-016
Title: Design and balance review: DESIGN.md against what is built, 2026-10-12
Files: relay/briefs/DESIGN.md (copied from Brad's design doc); branch review/integration (commit 5f3b4de, already on Hawk); claude/o8-new-content (Pete, Carl, Rodney rigs); grok/opus-standin (Phantoms, Chompy, Pigeon rigs); content/g3_qa_template.md
Deliver: commit content/g11_design_review.md, plus R-019 with the self-check block, the file path and the commit hash.

R-018 accepted (counts, lengths, JSON, grep all verified; your banner id swap is fine, I will wire it). Next job is a design review, read-only on the code. Rules as before: every claim cites a DESIGN.md heading and a file:line or measured number in the branches above; mark anything you cannot verify UNVERIFIED with the evidence needed; edit nothing outside content/ and relay/GROK_TO_HARK.md.
1. Coverage table: every DESIGN.md section (bosses, fort bombardment, game-style fights, drone, 3-part Brewmaster finale, Grand Prix, Hooters storefront, Pigeon climb, Bike Life, sixth gang, Lexington Market, side missions) marked BUILT / PARTLY / NOT STARTED, with the file or branch that shows it.
2. Roster check: the 21-boss list against DESIGN.md numbering and the 2026-10-11 swaps (Chip Kid, Brewmaster final, roaming Duchess). List any boss with no rig, no mode or no lines in content/gr*.json.
3. Balance: for each built boss mode, pull the numbers (player HP, boss HP, damage per hit, timers, win and lose conditions) into one table, and flag the 5 hardest and 5 easiest fights to win with a reason from the numbers.
4. Fit and risk: 10 concrete design risks (phone 390x844 controls, 11 on-screen things at once, radio ducking, difficulty ramp, missing win/lose paths), each rated blocker, major or minor with a proposed fix of one line.
Self-check: counts per section (sections, bosses, modes, risks), severities add up, UNVERIFIED listed, files read.

## P-017
Title: GR11 writing batch: Brewmaster 3-part finale script, ending, crime-meter win state, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/g11_design_review.md (the two blockers); content/gr*.json (grep first, skip duplicates)
Deliver: commit content/gr11_finale.json, plus R-020 with the self-check block, the file path and the commit hash.

R-019 accepted (27 = 6+12+9, 10 risks = 2+6+2, consistent). Your two blockers are text we can fill now. Rules as before (original characters, no real names or brands, JSON, stated counts).
1. `brewmaster_finale`: parts 1, 2, 3, each with `intro` 2, `taunt` 4, `hurt` 3, `phase_end` 2 (<= 70), plus `defeat` 4 (<= 70).
2. `ending_cutscene`: 12 captions (<= 80), toad skyline at dawn, in order.
3. `crime_meter_clear`: 6 districts x `clear_message` 2 (<= 60) and `all_clear_banner` 3 (<= 30).
4. `credits_thanks` 8 (<= 50).
Self-check: counts per key, max lengths, JSON parse OK, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/HARK_TO_GROK.md replies.
