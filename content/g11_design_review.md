# G11 · Design and balance review: DESIGN.md vs what is built (P-016)

Read-only review. Sources: `relay/briefs/DESIGN.md` (142 lines, cited as D:line + heading); `review/integration` @ 5f3b4de (cited `src/file:line`); `claude/o8-new-content` @ 05d3361 and `grok/opus-standin` @ 0da1fad (rigs, cited `branch:path`); content/g3, g8, g10, gr1–gr10 JSON. Nothing was run in a browser; runtime-only claims are UNVERIFIED with the evidence needed. Balance numbers are constants read from code, not playtest data.

## Part 1 · Coverage (26 sections)
| # | DESIGN.md section (D:line) | Status | Evidence |
|---|---|---|---|
| 1 | Preamble: engine, world, 16 landmarks (D:2-7) | PARTLY | Fork of J Cinema, HD default, Harold+Mavis: src/07_main.js:71, src/06c_partner.js:2. Landmark plots src/03_city.js:89-95, HD models 03b/03c. Crime goal only stubbed (src/06g0_boss_clear.js:3 "per-district crime HUD is phase 6"). |
| 2 | Landmark set pieces (D:8-17: Fed Hill, Domino, UA, M&T, Oriole, Aquarium, Science Ctr, Fells, Pendry) | PARTLY | Only set pieces delivered as boss modes: Oriole (derby, src/06g_derby.js), Aquarium (Jimmy swim, src/09b_jimmy.js), Fells (Al chase, src/06h_racers.js). Fed Hill, Domino, UA, M&T, Science Ctr, Pendry: no mode file. |
| 3 | Phases 1–6 (D:18) | PARTLY | 1 (day/night 600 s, src/07_main.js:81-82) and 3 (HD landmarks) built; 2 boat: water taxi/paddle rides only (src/06h_racers.js:3); 4 sewers: `MANHOLES = []` empty (src/06b_cine.js:82); 6 crime HUD not started (06g0:3). |
| 4 | Music (D:26) | BUILT | Original procedural club beat (src/06v_vic_rhythm.js:25); radio slots in src/08_radio.js. UNVERIFIED: Vic song list c1 "Dance My Pain Away" (06v:22) plays via YouTube, which D:27 says won't ship as a file; embed-only so likely OK, Brad to confirm. |
| 5 | Bosses, 17 landmark (D:29-30) | PARTLY | 7 modes built (Part 2). |
| 6 | Controls / ACT button (D:32-34) | PARTLY | ACT context POWER/SEWER/CLIMB/RIDE (src/06b_cine.js:79-94, src/07_main.js:136); panel src/06d_panel.js. SEWER never fires (MANHOLES empty, 06b:82). |
| 7 | Night radio (D:36-39) | BUILT | src/08_radio.js (497 lines). |
| 8 | Overrides: Domino sign, harbor KO (D:41-43) | BUILT | Splash KO src/06_game.js:85; Domino neon src/03_city.js:540,650. |
| 9 | Real signage rule (D:45) | PARTLY | Landmark HD models 03b/03c; Barnes & Noble / Hard Rock / Phillips UNVERIFIED (need 390x844 shots of Power Plant). |
| 10 | Radio stations dial (D:49-54) | BUILT | src/08_radio.js; G10 confirms ticker in shots (content/g10_integration_qa.md). |
| 11 | Homage bosses: Brewmaster, Chip Kid, Duchess (D:56-59) | PARTLY | Chip Kid duel src/09c_chipkid.js, Duchess src/06h_racers.js:689-806; Brewmaster: no rig, no mode (O7 open). |
| 12 | Fort McHenry Bombardment (D:61-69) | BUILT | src/09_fort.js (740 lines), 4 waves (09_fort.js:126-129). |
| 13 | Game-style fights: Vic, Bobby, Al, Jimmy, Chip Kid, Duchess (D:71-80) | BUILT | 06v, 06g_derby, 06h_racers, 09b, 09c. Raven King kick return / others "wait on Brad's pick" (D:76): NOT STARTED. |
| 14 | New landmark: Lexington Market (D:83-84) | NOT STARTED | `rg -i lexington src/` → 0 hits outside GR1 data. |
| 15 | New bosses Pete / Carl / Rodney (D:85-88) | PARTLY | Rigs only: claude/o8-new-content:src/boss_pit_beef_pete.js, boss_kingpin_carl.js, boss_riptide_rodney.js. No eating/bowling/lacrosse mode in src/. |
| 16 | Side missions: Poe night, harbor fishing (D:89-91) | NOT STARTED | No mode file; Chompy rig only (grok/opus-standin:src/npc_chompy.js); writing in gr7_events.json. |
| 17 | Sixth gang: Fells Point Phantoms (D:92-93) | PARTLY | Rig grok/opus-standin:src/gang_phantoms.js; not in src/ of integration. |
| 18 | Roster numbering (D:94-95) | PARTLY | See Part 2. |
| 19 | Fit tweaks (D:96-105) | NOT STARTED | Depend on 14–17; none present in src/. |
| 20 | Lexington model ref (D:106-107) | NOT STARTED | No model in 03b/03c. |
| 21 | Drone camera (D:110-111) | NOT STARTED | `rg -i drone src/` → 0 code hits. |
| 22 | Brewmaster 3-part finale (D:112-115) | NOT STARTED | No rig/mode; lines exist (gr2, gr10). |
| 23 | Celebration + drone unlock (D:116-117) | NOT STARTED | Boss-clear banners only (src/06g0_boss_clear.js). |
| 24 | Harbor Grand Prix (D:118-119) | NOT STARTED | No mode; announcer lines in gr7/gr10. |
| 25 | Hooters storefront (D:120-125) | NOT STARTED | `rg -i hooters src/` → 0. |
| 26 | Pigeon climb + ground fight (D:128-132) | PARTLY | Rig grok/opus-standin:src/boss_penthouse_pigeon.js (39 parts, 7,580 tris); no climb mode. |
| 27 | Bike Life (D:134-142) | NOT STARTED | No mode; writing gr6_bikes_pigeon.json. |
Totals: BUILT 6 · PARTLY 12 · NOT STARTED 9 (27 rows: 26 sections + the "Phases" roadmap row 3 counted as a section).

## Part 2 · Roster (21 bosses, D:94-95 numbering)
Rig = file on any reviewed branch; Mode = playable in review/integration; Lines = id present in content/gr*.json (rg).
| # | Boss | Rig | Mode | Lines | Gap |
|---|---|---|---|---|---|
| 1 | Admiral Redclaw | o8:src/boss_admiral_redclaw.js (+stand-in 09_fort.js:177) | Fort (09_fort.js) | gr1, gr3, gr10 | real rig not wired (fort uses buildAdmiral) |
| 2 | Voltage Vic | o8:src/boss_voltage_vic.js (stand-in 06v:111) | Rhythm | gr1, gr3, gr4, gr5, gr10 | real rig not wired |
| 3 | Bird Brain Bobby | stand-in only (06g_derby.js:139) | Derby | gr1, gr3, gr10 | **no real rig** |
| 4 | Arabber Al | o8:src/boss_arabber_al.js | Chase | many | — |
| 5 | Big Jimmy | o8:src/boss_big_jimmy.js | Swim | gr1, gr3, gr10 | — |
| 6 | Chip Kid (swap, D:58) | in-mode only (09c:125 buildKid) | Duel | gr2, gr10 | no kit rig; no gr3 key (G8 #1) |
| 7 | Dragon Boat Duchess (roaming, D:59) | in-mode (06h_racers.js) | Boat ram | gr1, gr2, gr3, gr10 | not landmark-tied: OK per D:59 |
| 8 | Raven King | none | none | gr1, gr4, gr7, gr10 | **rig + mode missing**; gated by Poe night (D:91) which is NOT STARTED |
| 9 | Dr. Shellacious | none | none | gr1, gr10 | rig + mode |
| 10 | Hon Queen | none | none | gr1, gr10 | rig + mode |
| 11 | Sugar Rush | none | none | gr1, gr10 | rig + mode |
| 12 | Compression King | none | none | gr1, gr10 | rig + mode |
| 13 | Chef Crabcake | o8:src/boss_chef_crabcake.js | none | gr1 only | mode; no gr10 taunt/hurt/banner (banned-word id) |
| 14 | Pool Shark | o8:src/boss_pool_shark.js | none | gr1, gr10 | mode |
| 15 | Captain Cobblestone | none (Phantoms gang rig exists) | none | gr1, gr3, gr10 | rig + mode; night-only (D:103) |
| 16 | Penthouse Pigeon | standin:src/boss_penthouse_pigeon.js | none | gr1, gr8, gr10 | climb mode |
| 17 | Stoop Scrubber | none | none | gr1, gr10 | rig + mode |
| 18 | Pit Beef Pete | o8:src/boss_pit_beef_pete.js (38p/10,524t) | none | gr4, gr8, gr10 | mode + Lexington district |
| 19 | Kingpin Carl | o8:src/boss_kingpin_carl.js (41p/12,224t) | none | gr4, gr8 | mode; no gr10 taunt/hurt; **zipKit over budget** (see R-9) |
| 20 | Riptide Rodney | o8:src/boss_riptide_rodney.js (42p/10,532t) | none | gr4, gr8 | mode; no gr10 taunt/hurt; **zipKit 42 parts > 40** |
| 21 | One-Eyed Brewmaster (final, D:57/112) | none | none | gr2, gr4, gr8, gr10 | **rig + 3-part mode** |
Swaps: Chip Kid replaces Duchess at Harborplace (D:30) ✔ in code (09c bossCleared('harborplace')); Brewmaster replaces Mister Formstone (D:30) ✔ no Formstone code; Duchess roaming on first boat ride (D:59) ✔ 06h_racers.js:3. Counts: rig 12/21 (kit rigs 10 + in-mode Chip Kid, Duchess; Bobby stand-in excluded), mode 7/21, lines 21/21 (any file). No rig: Bobby(real), Raven, Shellacious, Hon Queen, Sugar Rush, Compression, Cobblestone, Scrubber, Brewmaster (9). No mode: 14. Thin lines (no taunt/hurt in gr10): Crabcake, Carl, Rodney (3).

## Part 3 · Balance (7 built modes, constants from code)
| Mode | Player HP | Boss HP | Damage to player | Player damage | Timer | Win / Lose |
|---|---|---|---|---|---|---|
| Fort (09_fort.js) | flag 100 (:24) | sloop 3, ketch 4, rocket 9, flagship 22, Redclaw 3 (:126-129, :183) | ball 7, rocket 8, shell 10 (:642) | 1 per shot | none; design 3–4 min (D:69) | last ship sinks / flag 0; retry restarts *current wave* with flag 100 (:529) |
| Derby (06g_derby.js) | 10 outs (:17) | 10 homers (:17) | 1 out per miss/fail | fence 98–120 m (:23) | none | 10 HR / 10 outs |
| Vic (06v_vic_rhythm.js) | 100 (:294) | 300, floors 200/100 after phases 1-2 (:401) | miss 4, attack-note miss 9 (:386) | unit=100/(0.62·notes) × (perfect 1, good 0.6) × combo ≤1.5 (:384, :392-393) | 3 phases, ~24 bars each (:25) | vhp ≤0.5 by set end / hp 0 or "outlasted" (:344, :389) |
| Jimmy (09b_jimmy.js) | 100 (:194) | 300, 100/phase (:21) | snap 22 (:240), bubble 12 (:256), drown 9/s (:302) | 20 per belly hit, ≤2 per rear (:21) | air 30/25/21 s per phase (:17-19) | bhp 0 / hp 0 |
| Chip Kid (09c_chipkid.js) | 100, +35 per round (:234) | 3 rounds × 100 (:174, :234) | cloud 10 + blind 2.2 s, jab 9, slam 22 (:219-230) | jab 4, uppercut 16 (:276) | none | 3 knockdowns / T.K.O. (:200) |
| Al (06h_racers.js) | none (no HP) | 3 rams (:511) | produce slows only | ram = 1 | 90 s (:399) | 3 rams / clock 0 (:453) |
| Duchess (06h_racers.js) | hull 100 (:689) | 3 crashes (:779) | swing 14 (:764), wave 12 (:794), obstacle ≤8 (:751) | 1 per pier/buoy crash | none | 3 crashes / hull 0 (:801) |

Difficulty rank (hardest → easiest), from the numbers above:
- **5 hardest:** 1 **Vic** – two lose paths; need ~62% perfect-equivalent note damage per phase (0.62 in :384) and only 25 plain misses (12 attack misses) of slack. 2 **Jimmy** – boss needs 15 belly hits but only ≤2 per rear window while air falls to 21 s in phase 3; a snap costs 22% HP. 3 **Derby** – 10 HR at 98–120 m vs 10 outs is a 50% HR rate against an escalating mix (D:75). 4 **Chip Kid** – 300 mech HP at 4 per jab = 75 jabs (or ~19 uppercuts); slam 22 = 5 slams KO. 5 **Fort** – 41 ship HP (3·n sloops + … + 22 flagship + 3 Redclaw) while 10–15 hits drop the flag.
- **5 easiest:** 1 **Al** – no player HP; only failure is 90 s for 3 rams. 2 **Duchess** – no timer; hull needs 7–8 swings (14) to sink. 3 **Fort** – wave-retry with flag reset to 100 (:529) removes the run-length risk. 4 **Chip Kid** – +35 heal between rounds (:234) means only round 3 is truly lethal. 5 **Derby** – no player damage; only out count.
(Only 7 modes exist, so ranks 3–5 overlap between lists. UNVERIFIED: real win rates; need ≥10 bot/human runs per mode logging F.stats / V.counts / st.stats.)

## Part 4 · Ten design risks
| # | Risk | Severity | Evidence | Fix (one line) |
|---|---|---|---|---|
| R-1 | Fort ✕ during win music forfeits the clear | major | 09_fort.js:82, :540 (G8 #2) | `leave(F.phase==='win'||F.phase==='done')` at :82. |
| R-2 | iOS radio duck no-op in 5 modes (D:36-54 radio) | major | 08_radio.js:276, :287-292 (G8 #5); UNVERIFIED on device | Use `hold()` (pause) in derby/racers/duels. |
| R-3 | Phone 390x844 touch targets <44 px (D:32 Controls) | major | #fexit 30 px 09_fort.js:58; #dbQ ~27 px 06g_derby.js:319 | Set min 44×44 px on all mode exits. |
| R-4 | Final boss (D:112) has no rig or mode; the game has no ending | blocker | Part 2 #21; D:116 celebration also NOT STARTED | Prioritize O7 Brewmaster rig + rooftop part 1 next. |
| R-5 | Crime-meter win state missing (D:6 Goal, Phase 6) | blocker | 06g0_boss_clear.js:3 "phase 6" | Ship the per-district crime HUD + all-clear check before more side quests. |
| R-6 | Difficulty ramp inverted: Vic/Jimmy hardest yet unlockable early; no ordering | major | Part 3 ranks; no gating in BOSS_CLEAR (06g0:4-8) | Gate Vic/Jimmy behind ≥2 clears or add an easy setting (Vic floor 0.55). |
| R-7 | Raven King gated by Poe night, neither built (D:91, D:104) | major | Part 1 #16, Part 2 #8 | Build Poe night before Raven King, or drop the gate until it exists. |
| R-8 | Screen crowding: radio ticker + mode HUD at 390x844 (Pigeon climb D:130 lists ~11 simultaneous things: Pigeon, poop shadows, heli, live wires, boats, washers, 5 crack meters, thugs, Mavis, score, window pops) | major | G8 #20 (Fort/duels no body.radio offset, 09_fort.js:46/58); climb UNVERIFIED (not built) | Cap climb hazards to 2 active at once; add body.radio offset to Fort/duels. |
| R-9 | Rig budgets: Carl 41 parts/12,224 tris, Rodney 42 parts in the zipKit measure exceed the 40/12,000 contract | minor | o8:tools/results_boss_kingpin_carl.json, results_boss_riptide_rodney.json; UNVERIFIED whether merged count is the one gated | Merge 2 accessory parts each or confirm the budget applies to merged meshes. |
| R-10 | Missing win/lose path outs: Vic has no mid-song exit; Al `first` always true | minor | 06v_vic_rhythm.js:419 (G8 #9); 06h_racers.js:438 (G8 #10) | Add a ✕ during play; check `cleared.has('fells')` before `clear()`. |
Severity: blocker 2, major 6, minor 2 = 10.

## SELF-CHECK G11 (P-016)
```
sections: 27 coverage rows (BUILT 6, PARTLY 12, NOT STARTED 9 = 27)
bosses: 21 (rig 12, mode 7, lines 21; no rig 9, no mode 14, thin lines 3)
modes: 7 in balance table; hardest 5, easiest 5 (overlap 3: Derby, Chip Kid, Fort)
risks: 10 = blocker 2 + major 6 + minor 2
UNVERIFIED: D:27 Vic YouTube song choice; real-signage shots (Power Plant); win rates per mode; iOS duck (R-2); climb crowding (R-8); merged vs zipKit rig budget (R-9)
files read: relay/briefs/DESIGN.md; review/integration@5f3b4de src/{01-09c}*.js (rg + targeted lines), PROGRESS.md; claude/o8-new-content@05d3361 src/boss_*.js list, tools/results_boss_*.json; grok/opus-standin@0da1fad tools/results_{boss_penthouse_pigeon,gang_phantoms,npc_chompy}.json; content/g3_qa_template.md, g8_integration_qa.md, g10_integration_qa.md, gr1–gr10 *.json (id grep)
worktrees: temp, removed after review
```
