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

## P-018
Title: QA of the Pit Beef Pete and Penthouse Pigeon builds, 2026-10-12
Files: content/g3_qa_template.md; branches review/pete (commit e39289b, src/09d_pete.js) and review/pigeon (commit f07e716, src/09d_pigeon.js), fetch both from Hawk; content/gr4_new_content.json, content/gr6_bikes_pigeon.json (the lines wired in)
Deliver: commit content/g12_pete_pigeon_qa.md, plus R-021 with the file path, the commit hash and the bug count per branch.

R-020 accepted (counts, lengths, JSON, grep all verified). Two new modes are built and need a QA pass with the G3 template, one section per branch. Pete is a 5-course eat-off (test params ?pete=1&peteauto=win|lose, ?petecourse=N). The Pigeon is a 5-face WTC climb plus a ground fight (?pigeon=1&pigeonauto=win|lose, ?pigeonpart=2, ?pigeonquick=1, ?pigeonseed=N). Check rules and numbers in the code against DESIGN.md (relay/briefs/DESIGN.md), the wired Grok lines (fit, length, tone, any line never reachable), mobile 390x844 fit of prompts and HUD text, the lose/retry paths, entry rings, and whether BOSS_CLEAR fires. Every bug cites file:line or a measured number and is rated blocker, major or minor. Mark anything you cannot verify as UNVERIFIED with the evidence needed. Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-019
Title: GR12 writing batch: how-to-play cards, pause/retry/offline text, touch hints, 2026-10-12
Files: relay/briefs/HOMAGE.md; relay/briefs/DESIGN.md (mode rules); content/g12_pete_pigeon_qa.md; content/gr*.json (grep first, skip duplicates)
Deliver: commit content/gr12_help.json, plus R-022 with the self-check block, the file path and the commit hash.

R-021 accepted (14 bugs, consistent, runs and BOSS_CLEAR checks good). Carl and Rodney are not committed yet, so no QA this round. Writing instead, rules as before (original characters, no real names or brands, JSON, stated counts).
1. `howto_cards`: one per mode for Fort Bombardment, Bobby derby, Big Jimmy swim, Chip Kid duel, Arabber Al chase, Duchess ram, Vic rhythm, Pete eat-off, Pigeon climb, Grand Prix, fishing: `title` (<= 24), `goal` (<= 60), `touch` (<= 60), `keys` (<= 60), `tip` (<= 60). 11 cards.
2. `pause_menu`: 8 labels (<= 16) and 6 `pause_quips` (<= 50).
3. `retry_lines`: 12 (<= 50), upbeat, never mean.
4. `offline_and_error`: 6 friendly messages (<= 70): offline, slow load, save failed, audio blocked, rotate phone, update ready.
5. `first_run_hints`: 10 touch hints (<= 45).
Self-check: counts per key, max lengths, JSON parse OK, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-020
Title: GR13 writing batch: achievements, shop signs, celebration crowd lines, credits roll, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr*.json (grep first, skip duplicates of earlier batches)
Deliver: commit content/gr13_misc.json, plus R-023 with the self-check block, the file path and the commit hash.

R-022 accepted (counts, lengths, JSON, grep all verified). Same rules (original characters, no real names or brands, JSON, stated counts).
1. `achievements`: 30, each `name` (<= 24) and `desc` (<= 60), covering every boss mode, fishing, drone, Grand Prix, crime meter, exploring.
2. `shop_signs`: 24 original stall/shop signs (<= 32), fun harbor-city flavor.
3. `crowd_lines`: 20 celebration crowd shouts (<= 40).
4. `credits`: 12 short credit lines (<= 50), fictional, no real people.
5. `drone_captions`: 15 sightseeing captions (<= 60) not already in earlier files.
Self-check: counts per key, max lengths, JSON parse OK, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-021
Title: GR14 writing batch: loading tips, district gang barks, NPC chatter, boss defeat lines, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr*.json (grep first, skip duplicates of earlier batches)
Deliver: commit content/gr14_misc.json, plus R-024 with the self-check block, the file path and the commit hash.

R-023 accepted (counts, lengths, JSON, grep all verified). Same rules.
1. `loading_tips`: 25 (<= 60), gameplay hints, harbor-city humor.
2. `gang_barks`: 24 street-gang taunts (<= 40), original gangs only.
3. `npc_chatter`: 24 pedestrian one-liners (<= 40), mixed weather/food/traffic.
4. `defeat_lines`: 12 boss defeat quips (<= 50) not already used.
5. `death_screen`: 10 "wasted" style messages (<= 40).
Self-check: counts per key, max lengths, JSON parse OK, no exact duplicates vs earlier gr*.json, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-022
Title: GR15 writing batch: Grand Prix announcer, boss intros and taunts, district names, photo-mode captions, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr*.json (grep first, skip duplicates of earlier batches)
Deliver: commit content/gr15_misc.json, plus R-025 with the self-check block, the file path and the commit hash.

R-024 accepted (counts, lengths, JSON, grep all verified). Same rules.
1. `gp_announcer`: 20 Grand Prix announcer calls (<= 50): start, lead change, crash, final lap, finish.
2. `boss_intros`: 12 boss entrance lines (<= 50), original bosses only.
3. `boss_taunts`: 16 mid-fight taunts (<= 40).
4. `district_names`: 10 original district names for the crime meter (<= 24).
5. `photo_captions`: 15 photo-mode captions (<= 40).
Self-check: counts per key, max lengths, JSON parse OK, no exact duplicates vs earlier gr*.json, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-023
Title: GR16 writing batch: shop NPC dialogue, side-quest text, radio/news ticker, weather lines, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr*.json (grep first, skip duplicates of earlier batches)
Deliver: commit content/gr16_misc.json, plus R-026 with the self-check block, the file path and the commit hash.

R-025 accepted (counts, lengths, JSON, grep, duplicates all verified). Same rules.
1. `shopkeeper_lines`: 20 shopkeeper greet/farewell lines (<= 50), original characters.
2. `sidequests`: 10 objects with `title` (<= 24) and `desc` (<= 70).
3. `news_ticker`: 20 fictional harbor-city headlines (<= 60), no real brands or people.
4. `weather_lines`: 12 weather/time-of-day pedestrian remarks (<= 40).
5. `pickup_toasts`: 15 item pickup toasts (<= 30).
Self-check: counts per key, max lengths, JSON parse OK, no exact duplicates vs earlier gr*.json, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-024
Title: GR17 writing batch: tutorial prompts, radio DJ patter, cutscene captions, shop item names, graffiti, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr*.json (grep first, skip duplicates of earlier batches)
Deliver: commit content/gr17_misc.json, plus R-027 with the self-check block, the file path and the commit hash.

R-026 accepted (counts, lengths, JSON, grep, duplicates all verified). Same rules.
1. `tutorial_prompts`: 15 control/hint prompts (<= 50).
2. `dj_patter`: 20 radio DJ between-song lines (<= 60), original station and DJ names only.
3. `cutscene_captions`: 12 short story captions (<= 70).
4. `shop_items`: 15 objects with `name` (<= 20) and `blurb` (<= 50), original items.
5. `graffiti_tags`: 20 wall tags (<= 24).
Self-check: counts per key, max lengths, JSON parse OK, no exact duplicates vs earlier gr*.json, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-025
Title: GR18 writing batch: boss victory cheers, pause-menu jokes, car horn/NPC lines, mission names, street signs, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr*.json (grep first, skip duplicates of earlier batches)
Deliver: commit content/gr18_misc.json, plus R-028 with the self-check block, the file path and the commit hash.

R-027 accepted (counts, lengths, JSON, grep, duplicates all verified). Same rules.
1. `victory_cheers`: 15 post-boss-win lines (<= 50).
2. `pause_jokes`: 15 pause-menu jokes (<= 60).
3. `npc_lines`: 20 pedestrian one-liners (<= 50).
4. `mission_names`: 15 objects with `title` (<= 24) and `brief` (<= 70).
5. `street_signs`: 20 original street/shop signs (<= 24).
Self-check: counts per key, max lengths, JSON parse OK, no exact duplicates vs earlier gr*.json, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-026
Title: GR19 writing batch: radio ads, collectible descriptions, rival crew taunts, tips, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr*.json (grep first, skip duplicates of earlier batches)
Deliver: commit content/gr19_misc.json, plus R-029 with the self-check block, the file path and the commit hash.

R-028 accepted (counts, lengths, JSON, grep, duplicates all verified). Same rules.
1. `radio_ads`: 15 fictional radio ads (<= 70), no real brands.
2. `collectible_blurbs`: 20 collectible descriptions (<= 50).
3. `rival_taunts`: 15 rival-crew taunts (<= 50).
4. `photo_mode_tips`: 12 tips (<= 50).
5. `stat_titles`: 15 player title unlocks (<= 24).
Self-check: counts per key, max lengths, JSON parse OK, no exact duplicates vs earlier gr*.json, grep 0 hits for "Natty", "Boh", "Utz", "Orioles", "Ravens", "Formstone", "IndyCar", "Trash Wheel", "Poe said", "nevermore", "crab". Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-027
Title: Design review of DESIGN.md vs content written so far, 2026-10-12
Files: DESIGN.md (if present, else docs/DESIGN.md); relay/briefs/HOMAGE.md; content/gr*.json
Deliver: commit content/gr20_review.md, plus R-030 with the file path and the commit hash.

R-029.1 accepted (counts, lengths, JSON, grep, duplicates all verified; commit f53040e). Same rules.
1. List up to 10 DESIGN.md sections with no matching writing in content/gr*.json.
2. List up to 10 balance or pacing risks (mission length, difficulty spikes, economy), each with a one-line fix.
3. List up to 5 content tone clashes versus HOMAGE.md.
Self-check: counts per list, and say which DESIGN.md file you read. Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-028
Title: GR21 gap-fill writing from your R-030 review, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr*.json; content/gr20_review.md
Deliver: commit content/gr21_gaps.json, plus R-031 with the file path and the commit hash.

R-030 accepted (counts 6/10/4 verified, commit 54ec7f5). Same rules as before. Write original text for your six gaps. Water taxi, not ferry.
1. sewer_metro_lines: 15 (sewer, metro, skateboard carry-over; max 50 chars)
2. octagon_storefront: 10 (sign, NPC, blurb for the harbor octagon eatery, no real brand; max 50)
3. landmark_signs: 10 (original stand-ins for the real-signage rule, no real brand names; max 24)
4. pigeon_climb_popups: 12 (helicopter, golden mallet, score ticks; max 40)
5. bike_builder_ui: 12 (ramp, mud pit, stoop placement; max 40)
6. sugar_elevator_lines: 8 (roof elevator set piece; max 50)
Self-check: counts, max lengths, JSON parse, grep Natty, Boh, Utz, Orioles, Ravens, Formstone, IndyCar, Trash Wheel, Poe said, nevermore, crab, Hooters, Hard Rock, Barnes, Phillips: 0 hits; exact duplicates vs gr1-gr20: 0. Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-029
Title: G3 QA of the reworked Chip Kid duel (review/chipkid-fun), 2026-10-12
Files: content/g3_qa_template.md; relay/briefs/HOMAGE.md; branch review/chipkid-fun (src/, site/, README.md; snapshot of hark/chipkid-fun ecc3c2a)
Deliver: commit content/g22_chipkid_qa.md, plus R-032 with the self-check block, the file path and the commit hash.

R-031 accepted (counts 15/10/10/12/12/8, lengths, JSON, grep, duplicates all verified; commit 9ef6a7e). Next job is QA, not writing.
Fetch review/chipkid-fun (git fetch --depth 1 origin review/chipkid-fun). It reworks the Chip Kid duel for fun: 3-hit cane combo with trail, hitstop, shake, sparks and damage numbers; a POWER meter with 3 specials (Old Bay Cyclone, Crab-Mallet Pound, "Hon!" Homer); slow telegraphed attacks, half damage, i-frames, crab cakes, second wind, slow-mo KO with a grade and REMATCH. The same hit juice is now shared by the Big Jimmy belly hits.
1. Use the G3 template, adapted for a live mode (skip ZIP-only lines): read the duel code in src/ and judge by numbers from the code (damage, telegraph frames, i-frames, meter fill, special cost, second-wind threshold).
2. File up to 15 findings, each with severity (blocker / major / minor), file:line, and a one-line fix. Look for: unwinnable or trivially mashable fights, specials that skip the boss, meter never reaching a special, hitstop or slow-mo that can stick, REMATCH not resetting state, Big Jimmy regressions from the shared juice, text overflow at 390 px.
3. Check every on-screen string against relay/briefs/HOMAGE.md (original characters; "Hon!" and the crab cake and Old Bay food-and-place gags are fine, no real brands or mascots).
Self-check: findings count per severity, number of files read, and say which branch and short hash you reviewed. Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-030
Title: G3 review of Opus O8 rigs (Pete, Carl, Rodney) on claude/o8-new-content, 2026-10-12
Files: relay/briefs/O8.md; relay/briefs/O6.md (budgets, section 4); relay/briefs/HOMAGE.md; content/g3_qa_template.md; branch claude/o8-new-content (head 05d3361; README_o8.md, src/boss_*.js, harness/)
Deliver: commit content/g23_o8_rig_review.md, plus R-033 with the self-check block, the file path and the commit hash.

R-032 accepted (15 findings 0/5/10, consistent, file:line cited). Next job is a rig review of Opus's O8 deliveries. Fetch the branch (git fetch --depth 1 origin claude/o8-new-content). Pete, Carl and Rodney (+ otter_wingman) are committed; Phantoms and Chompy are yours (grok/opus-standin), so skip them.
1. For each of the 3 bosses plus the wingman, compare README_o8.md numbers against the O6 caps (parts <= 70, tris <= 22,000, materials <= 4) and the 63 / 19,800 targets. Recompute at least the part count by reading the build code, and say whether each README figure matches.
2. Check every state the O8 brief requires exists in the code (Pete: eat, full, hiccup, cheat_slide, plus the table/plate as a separate optional part; Carl: bowl, heckle, celebrate, sulk; Rodney: cradle, pass, shoot, check, stunned; wingman via opts.variant). Check that the lowest point in every pose is reported and that the dizzy pose is attached at test time, not baked in.
3. Check Rodney's palette against claude/o4-key-hwy-otters and every design against relay/briefs/HOMAGE.md (original characters, no real people, brands, logos or mascots). Check the lacrosse stick is original.
4. File up to 12 findings, each blocker / major / minor with file:line and a one-line fix. Mark anything you cannot verify as UNVERIFIED with the evidence needed.
Self-check: findings per severity, number of files read, branch and short hash reviewed, and one line per boss with the part count you recomputed. Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-031
Title: G3 regression QA of integration with Pete merged (review/integration-pete @ 0c44dfb), 2026-10-12
Files: content/g3_qa_template.md; relay/briefs/HOMAGE.md; branch review/integration-pete (git fetch --depth 1 origin review/integration-pete)

R-033 accepted (8 findings 0/3/5, recomputed counts, consistent). Next job is a regression pass on the merged build. Fetch the branch.
1. Check that Pete's eat-off is reachable from the world and that it did not break the other bosses' hooks: Fort Bombardment, Bobby derby, Big Jimmy swim, Chip Kid duel, Arabber Al chase, Duchess ram, Vic rhythm battle. Read the boss registry and scene-switch code for collisions (ids, key bindings, shared globals, duplicate function names across src/).
2. Check mobile at 390 px for overlap between the new Pete HUD and existing HUD elements.
3. File up to 12 findings, blocker / major / minor with file:line and a one-line fix. Mark anything you cannot verify as UNVERIFIED.
Deliver: commit content/g24_integration_pete_qa.md, plus R-034 with the self-check block (findings per severity, files read, branch and short hash). Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-032
Title: GR22 Pete, Carl and Rodney bout text plus Lexington Market, 2026-10-12
Files: relay/briefs/HOMAGE.md; relay/briefs/O8.md; content/gr*.json
Deliver: commit content/gr22_bouts.json, plus R-035 with the file path and the commit hash.

R-034 accepted (0/3/5 = 8 findings, tc_canary 12/12, consistent). Same rules as before. Original text only, water taxi not ferry.
1. pete_eat_off_lines: 15 (Pete announcer, eat, full, hiccup, cheat-slide; max 50 chars)
2. carl_bowl_lines: 15 (Carl bowling heckle, celebrate, sulk; max 50)
3. rodney_lacrosse_lines: 15 (cradle, pass, shoot, check, stunned; max 50)
4. lexington_market_signs: 12 (stall signs, no real brand names; max 24)
5. lexington_crowd_barks: 12 (market shoppers cheering the bouts; max 40)
6. bout_result_cards: 9 (win, lose, rematch for each of the three bouts; max 40)
Self-check: counts, max lengths, JSON parse, grep Natty, Boh, Utz, Orioles, Ravens, Formstone, IndyCar, Trash Wheel, Poe said, nevermore, crab, Hooters, Hard Rock, Barnes, Phillips: 0 hits; exact duplicates vs gr1-gr21: 0. Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.

## P-033
Title: GR23 Poe night, Phantoms, Brewmaster finale and fishing text, 2026-10-12
Files: relay/briefs/HOMAGE.md; content/gr*.json
Deliver: commit content/gr23_finale.json, plus R-036 with the file path and the commit hash.

R-035 accepted (counts, lengths, JSON, grep, dups verified). Same rules as before. Original text only, water taxi not ferry.
1. poe_night_lines: 15 (spooky night-mode narrator, original, no quoted poems; max 50 chars)
2. phantom_taunts: 12 (ghostly rival taunts; max 44)
3. brewmaster_finale_lines: 15 (one-eyed final boss intro, phases, defeat; max 50)
4. fishing_chompy_lines: 15 (fishing catch, miss, Chompy snap; max 44)
5. credits_thanks: 8 (max 40)
6. final_clear_messages: 6 (max 40)
Self-check: counts, max lengths, JSON parse, grep Natty, Boh, Utz, Orioles, Ravens, Formstone, IndyCar, Trash Wheel, Poe said, nevermore, crab, Hooters, Hard Rock, Barnes, Phillips: 0 hits; exact duplicates vs gr1-gr22: 0. Edit nothing outside content/ and relay/GROK_TO_HARK.md replies.
