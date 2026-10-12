# G13 · Design and balance re-review: DESIGN.md vs review/integration-pete (P-036)

Read-only review. Sources: `relay/briefs/DESIGN.md` (D:line), `relay/briefs/HOMAGE.md` (H:line); `review/integration-pete` @ 0c44dfb, checked out in a temporary detached worktree that was removed afterwards (cited `src/file:line`). The base is content/g11_design_review.md (review/integration @ 5f3b4de). `git diff --stat 5f3b4de 0c44dfb` shows only 2 changed files: `src/09d_pete.js` (+458) and its bundled copy `site/game.js` (+458). Every other g11 citation still points at unchanged code. This review applies g3_qa_template.md where it fits: file:line on every claim, UNVERIFIED with the evidence still needed, and severity 0 = blocker, 1 = major, 2 = minor. Nothing was run in a browser, and the balance numbers are code constants, not playtest data.

## g11 carry-over: what is fixed
| g11 item | Status @0c44dfb | Evidence |
|---|---|---|
| R-1 Fort ✕ during the win forfeits the clear | NOT FIXED | src/09_fort.js:82 still calls `leave(false)` |
| R-2 iOS radio duck is a no-op | NOT FIXED (UNVERIFIED on device) | 08_radio.js unchanged |
| R-3 Touch targets under 44 px | NOT FIXED | #fexit is still 30×30, src/09_fort.js:58; #dbQ is still 9 px font, src/06g_derby.js:319 |
| R-4 No final boss | NOT FIXED | `rg -i brewmaster src/` finds 0 code hits |
| R-5 No crime-meter HUD or win state | NOT FIXED | src/06g0_boss_clear.js:3 still says "phase 6" |
| R-6 Difficulty ramp inverted | NOT FIXED | no gating in src/06g0_boss_clear.js |
| R-7 Raven King gated behind the unbuilt Poe night | NOT FIXED | `rg -i poe src/` finds 0 mode hits |
| R-8 Screen crowding | NOT FIXED | the Pigeon climb is still not built |
| R-9 Rig budgets for Carl and Rodney | NOT FIXED (not merged) | `rg -i carl src/` finds 0 hits |
| R-10 Al `first` is always true, and Vic has no ✕ | NOT FIXED | src/06h_racers.js:438 reads the return of `BOSS_CLEAR.clear`, which always returns true (src/06g0_boss_clear.js:19) |
| Part 1 #15 Pete/Carl/Rodney had rigs only | PARTLY FIXED | Pete's eating contest is built: src/09d_pete.js:1-458 |
| Part 1 #14 Lexington Market | PARTLY FIXED | Only a temporary anchor and a district id exist: src/09d_pete.js:423-425 |
Fixed: 0 fully, 2 partly, 10 still open.

## 1 · DESIGN.md coverage (only rows whose status changed since g11; the other 25 g11 rows are unchanged, see g11 Part 1)
| # | Section (D:line) | g11 | G13 | Evidence |
|---|---|---|---|---|
| 14 | Lexington Market landmark (D:83-84) | NOT STARTED | PARTIAL | No model or LANDMARKS entry. Pete's ring sits at TEMP_ANCHOR (-118,-41) north of Oriole Park, src/09d_pete.js:423. A procedural "LEXINGTON" sign exists inside the contest scene only, :60. The day snack hub (D:84, D:105) is MISSING. |
| 15 | New bosses Pete/Carl/Rodney (D:85-88) | PARTLY | PARTIAL (1/3 modes) | Pete: 5 courses, :40-46. Sip, hiccup, swat and Mavis fan are all present, :6-17 and :288-312. Carl's bowling and Rodney's lacrosse are MISSING (`rg -i "carl|rodney" src/` finds 0 hits). |
| 19 | Fit tweaks (D:96-105) | NOT STARTED | PARTIAL | Pete's contest is night-only, matching D:105, at :432-434. Lexington is its own district id, D:98, at :425 and :444. The map placement, Chompy, the lantern and Cobblestone's night lock are MISSING. |
| 20 | Lexington model ref (D:106-107) | NOT STARTED | PARTIAL (sign only) | Only the in-scene "LEXINGTON" lettering, src/09d_pete.js:60. No hall, wings, globe seal or canopy. |
| 18 | Roster (D:94-95) | PARTLY | PARTLY | Modes are now 8/21 (g11 had 7, plus Pete). Pete uses a procedural stand-in hog with an Opus hook, :25-33 and :116-150. |
Totals across 27 rows: BUILT 6 · PARTIAL 15 · MISSING 6. In g11 that was 6 · 12 · 9. Rows 14, 19 and 20 moved from missing to partial.

## 2 · Balance: top 10 numbers to change
| # | Mode | Now (file:line) | Proposed | Why |
|---|---|---|---|---|
| B1 | Vic | note-damage floor 0.62 of perfect, src/06v_vic_rhythm.js:384 | 0.55 | It is the hardest mode and has no gate (g11 R-6). Going to 0.55 gives about 11% more slack for phone players using 3 tap zones. |
| B2 | Vic | attack-note miss 9, src/06v_vic_rhythm.js:386 | 7 | Today 12 attack misses kill you. At 7 it takes 15, which matches Jimmy's tolerance. |
| B3 | Jimmy | air in phase 3: 21 s, src/09b_jimmy.js:17-19 | 25 s | Phase 3 also needs 5 belly hits at ≤2 per rear. 21 s leaves about one rear cycle of margin. |
| B4 | Jimmy | claw snap 22, src/09b_jimmy.js:240 | 16 | Five snaps is a KO, on top of drowning at 9/s, :302. 16 matches the duel slam curve after the heal. |
| B5 | Chip Kid | jab 4 vs 100 HP per round, src/09c_chipkid.js:276 and :174 | jab 6 | 75 jabs is grindy. At 6 it is 50 jabs, which keeps rounds at about 60-75 s. |
| B6 | Derby | fence 98–120 m with 10 HR before 10 outs, src/06g_derby.js:17 and :23 | 8 HR before 10 outs | A 50% HR rate against an escalating mix is too high for the first boss many players meet, since Oriole Park is next to spawn. |
| B7 | Al chase | 90 s timer, src/06h_racers.js:399 | 75 s | Al has no player HP and is the easiest fight (g11). Tightening the clock adds tension. |
| B8 | Duchess | no timer and hull 100, src/06h_racers.js:689 | add a 120 s clock | With no timer she can't really be failed except by a slow hull death. |
| B9 | Pete | Pete's eating rate 5.0→6.4 bites/s, src/09d_pete.js:41-45 | 4.2→5.6 | Harold must press faster than 6.4/s to win course 5, but any gap under 0.11 s is a GULP (+3.6 fullness), :47 and :290. The safe window is 6.4–9 presses/s, which is a narrow band on touch. UNVERIFIED: phone tap rate needs ≥10 runs with `peteauto` disabled. |
| B10 | Pete | cookie course 38 bites × 2.5 fullness = 95, src/09d_pete.js:45 | 2.1 | Even with 2 sips (−52, :47) and drain 1.6/s, one hiccup miss (+6, :305) plus a landed cheat (+6 bites, :47) pushes past 100. That makes the last course nearly unwinnable if it is reached at 2–2. |

## 3 · Top 5 missing features by player impact
1. **The Brewmaster 3-part finale and the celebration** (D:112-117): there is still no ending. src/ has 0 hits.
2. **The crime-meter HUD and win state** (D:6): the goal is invisible. src/06g0_boss_clear.js:3.
3. **The Lexington Market landmark and day snack hub** (D:84, D:105): Pete is fought on a temporary street corner, and there are no health purchases. src/09d_pete.js:423.
4. **Sewers, metro and boat docking** (D:7, D:20): MANHOLES is empty, so the SEWER action never fires. src/06b_cine.js:82 and :94.
5. **Drone camera and mode** (D:110-111, D:117): it is the post-game reward and has 0 code hits.

## 4 · Findings (new since g11)
| ID | Sev | Finding | file:line | Fix |
|---|---|---|---|---|
| F1 | 0 | The game has no ending yet: the final boss and celebration are absent. This repeats g11 R-4 and is re-raised because it is still the top blocker. | DESIGN D:112-117; src/ 0 hits (`rg -i brewmaster src/`) | Build the O7 rig plus the rooftop part 1 next. |
| F2 | 1 | Lexington is added to `crime` only when Pete is cleared, so before that its 100 is not in the city average. Clearing him then adds a 0, which lowers city crime for a district that was never counted. | src/09d_pete.js:444-446; src/06g0_boss_clear.js:9-10 | Seed `C.crime.lexington = 100` in setupTrigger, :427. |
| F3 | 1 | Pete's mode adds its own PointLight (26, 14 m). The template I7 says no lights. | src/09d_pete.js:158 | Use the duel-core hemisphere or emissive instead. |
| F4 | 1 | `Math.random` in the cheat taunt and `rnd()` timers make the bot runs irreproducible (template I7/I9). | src/09d_pete.js:37, :221, :277, :312 | Use a seeded PRNG keyed by `?seed`. |
| F5 | 1 | The touch rate is too narrow. Pete eats up to 6.4/s while GULP triggers below 0.11 s per press. | src/09d_pete.js:45, :47, :290 | See B9: either GULP 0.09 or a lower Pete rate. |
| F6 | 1 | Pete's arena is a temporary street north of Oriole Park, not the downtown-west district. It will clash with D:97's placement once that is built. | src/09d_pete.js:423 | Export `LEX_ANCHOR` from the Lexington build, which :431 and :454 already accept. |
| F7 | 2 | `st.pRem = C.bites * 1.15 / 1.15` is a no-op, so the intended 15% Pete handicap is lost or dead code. | src/09d_pete.js:220 | Pick one value, `C.bites` or `C.bites * 1.15`. |
| F8 | 2 | Asymmetric cheat economy: a landed cheat gives Harold +6 bites, but a swat sends only +4 back to Pete, and Pete loses just 1 bite when he cheats. | src/09d_pete.js:47, :274, :278 | Make the swat-back +6 for symmetry. |
| F9 | 2 | The rematch ring is forced lit by overriding `cleared` to always false. That hides Pete's cleared state from the duel core beam logic. | src/09d_pete.js:437 | Add a `rematch` flag to the beam instead. |
| F10 | 1 | HOMAGE risk: the Lexington sign is drawn with real wording. That is allowed by the D:45 signage rule and D:84. The "WORLD FAMOUS / SINCE 1782" lockup and red globe seal (D:107) are not built yet, so they need a check against H:148 (no copied image) when they are. | src/09d_pete.js:60 | Keep it procedural canvas only and never trace the refs. |
| F11 | 2 | HOMAGE risk: Pete's stand-in is a generic hog in a butcher's apron, so it is original (H:154). The course list uses only generic foods ("fudge-topped cookies", no brand), :3 and :64. OK. Watch the future Opus rig for any real pit-beef stand mascot likeness. | src/09d_pete.js:116-150 | Run the B4 originality check when the rig lands. |

Severity counts: 0 → 1 (F1); 1 → 6 (F2, F3, F4, F5, F6, F10); 2 → 4 (F7, F8, F9, F11). Total 11.

## HOMAGE risks (H:143-156)
- **Pete (F11):** OK as built. Generic hog, no real stand mascot.
- **Lexington signage (F10):** real wording is allowed, but the seal and lockup must be procedural.
- **Still open from g11:** Bobby has only a stand-in, so the real rig must avoid the Oriole Bird face (H:148, H:151). The Brewmaster must avoid the Natty Boh face (H:148, D:57). Chip Kid must not use the Utz look (H:148, D:58); the in-mode rig at src/09c_chipkid.js:125 is UNVERIFIED and needs a 390x844 model sheet.

## SELF-CHECK G13 (P-036)
```
g11 items: 12 checked, fixed 0, partly 2, open 10
coverage: 27 rows, BUILT 6 + PARTIAL 15 + MISSING 6 = 27 (changed rows 5)
balance: 10 (B1-B10), each with file:line + proposed value + reason
missing features: 5
findings: 11 = sev0 1 + sev1 6 + sev2 4; every finding has file:line: yes (11/11)
HOMAGE risks listed: yes (F10, F11 + 3 carried)
UNVERIFIED: phone tap rate for Pete (B9), win rates per mode, Chip Kid likeness, iOS duck
worktree: /tmp/pete detached @0c44dfb, removed after review; branch not modified
```
