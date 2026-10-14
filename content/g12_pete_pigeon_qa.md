# G12 · QA of Pit Beef Pete and the Penthouse Pigeon (P-018)

Method: G3 QA template (content/g3_qa_template.md), one section per branch. Both branches checked out read-only in temp worktrees (removed after). Judged against relay/briefs/DESIGN.md (D:line) and the wired GR4/GR6 lines.
Runtime evidence: headless Chrome (swiftshader) at 390x844, touch on, `&sim=3`, served from each branch's `site/` (the live bundle). Screenshots: content/g12_shots/.
Measured: every run had 1 console error, a 404 on a resource load (same on both branches; file not identified, UNVERIFIED cause), and 0 page errors.

## A. review/pete @ e39289b (src/09d_pete.js, 458 lines)
Intake: I3 branch/commit Y. The bundle contains the mode (`site/game.js` ~line 8413 carries the 09d_pete header). ZIP/kit items n/a.

| Check | Result |
|---|---|
| `?pete=1&peteauto=win` | WIN in 83 s wall (sim=3). End card: "PIT BEEF PETE WADDLED OFF … Lexington Market is clear. Crime at Lexington Market: 0." `localStorage.tcb_boss_clear` = `["lexington"]` → **BOSS_CLEAR fires** (via clearLex, :440-449, which also dispatches `tcb:bossclear` :449). |
| `?pete=1&peteauto=lose` | Lose path reached; the duel bot retries once, loses again, then leaves (09a_duel_core.js:189). It ended back on the city street with no console error. RETRY is reachable (P.retry :242 resets to course 1). |
| `?petecourse=N` | Clamped 1–5 (:237). Y |
| Entry ring | ACT "EAT-OFF PETE" at night and "PETE: AFTER DARK" by day (:434-437). The ring stays lit for rematches (:438). Placed at TEMP_ANCHOR (-118, -41) north of Oriole Park until the market exists (:423). |
| Rules vs D:86 | Mash/fullness, lemonade, hiccup prompts, Pete's cheat + swat, and the Mavis purse fan are all present (:7-17, :269, :312-320). |
| GR4 lines | The embedded GR4_PETE equals content/gr4_new_content.json `modes.pete_eating` exactly (script compare). All lines ≤ 54 chars. |

Bugs (8: 0 blocker, 1 major, 7 minor):
1. **MAJOR · 390x844 · course banner overflows the screen.** "COURSE 2: PIT BEEF" is clipped at both screen edges in `pete_win_mid.png` (measured). The banner is the shared `.dban` at 30 px with no phone rule (09a_duel_core.js:35), filled from 09d_pete.js:299/320. The longest card, "COURSE 5: COOKIE TOWER" (22 chars), will be worse. Fix: a `@media (max-width:480px)` .dban font-size of ~18 px, or line-break after "COURSE N:".
2. MINOR · rule vs D:86. DESIGN says "Five courses … Clear your plate first and he waddles off". The code is first to 3 courses (WIN_N = 3, :47, :266-267), so courses 4–5 only play at 2-1 or 2-2. The cookie-tower taunt (pete_taunts[5], COURSES[4].taunt :45) and course card 5 are reachable only at 2-2. This needs Brad's call (best-of-5 or all five).
3. MINOR · unreachable line. :259 `lose.find(/full|meter/)` always matches lose[1] ("Too full to croak…") before lose[2] ("The fullness meter pops…"), so GR4 lose[2] is never shown.
4. MINOR · Pete's lose speech is hardcoded (:260) instead of GR4, and "Pete don't lose at the counter" repeats pete_taunts[0].
5. MINOR · clearLex hand-rolls BOSS_CLEAR (:443-449: cleared set, crime 0, localStorage, event) when the landmark is missing, which duplicates 06g0_boss_clear.js (same pattern as G8 #11). Remove it once LEXINGTON lands in LANDMARKS.
6. MINOR · "CRAB CAKE" is on course card 1 (GR4 course_cards[0]) and on a hall stall sign (the "…RAB C…" sign in pete_win_mid.png). DESIGN D:86 names the dish, but the GR banned-word list and G10 N3 flag "crab". Brad to decide.
7. MINOR · test hooks ship live: `?pete`, `?petenight`, `?petecourse`, `?peteauto` (:434, :237, :456). ?pete=1 also skips the night-only rule. Gate behind a dev flag (G8 #14).
8. MINOR · radio duck uses the shared duel `fightDuck` (09a), so G8 #5 (no-op on iOS) applies here. UNVERIFIED on device.
UNVERIFIED: the exit lands next to a Harborplace info card (pete_lose run), not at TEMP_ANCHOR. Need a non-sim run logging hero x,z after LEAVE.

## B. review/pigeon @ f07e716 (src/09d_pigeon.js, 801 lines)
Intake: I3 Y.

| Check | Result |
|---|---|
| `?pigeon=1&pigeonauto=win&pigeonquick=1&pigeonseed=7` | WIN in 141 s wall through part 1 (climb), the collapse tally and part 2. `tcb_boss_clear` = `["wtc"]` → **BOSS_CLEAR fires** (DUELS.bossCleared :607). |
| `?pigeon=1&pigeonpart=2&pigeonauto=win` | WIN in 81 s; `["wtc"]`. |
| `?pigeon=1&pigeonauto=lose&pigeonseed=7` | Lose → bot RETRY (keeps wrecked faces, :281-283) → lose → LEAVE. Ends on the street at the WTC ring with ACT "CLIMB WTC" lit (pig_lose_end.png). Y |
| Entry ring | `DUELS.addTrigger('pigeon', L, -12, -30.3, …)`, labelled CLIMB WTC (:796-797). Seen in screenshot. Y |
| Rules vs D:130-132 | 5 faces with crack meters (:104, :268); window items cake/thug/pan/live-wire/mallet seeded per run (:238-241); golden mallet x<1/40, at most 1 per face, never on floor 0 (:241) ✔ D:132; heli, boats and washers (header :10-12); part 2 dive → tongue → slam → dazed → harbor finish (:558-607) ✔ D:131; city WTC untouched ✔ D:132. `?pigeonquick` uses window damage 0.22 vs 1/13 (:68). |
| GR6 lines | TXT.taunts/popups/score match gr6 pigeon_taunts (16), pigeon_popups (12) and pigeon_score (8) exactly; max 60/36/18 chars. |
| 390x844 HUD | Bars, score, face pips and the speech box fit (pig_win_mid.png). |

Bugs (6: 0 blocker, 0 major, 6 minor):
1. MINOR · unreachable line: pigeon_score[2] "NO-SLIP CLIMB!" is never used (TXT.score refs are indices 6, 3, 0, 4, 5, 1, 7 at :358, :393, :454, :465, :469, :500, :555).
2. MINOR · label mismatch: "FLOWERPOT DODGED!" (score[3]) pops when Harold dodges a *poop* drop (:393), and the taunt "Here comes a flowerpot. Duck!" (seen in pig_win_mid.png) refers to an item the mode doesn't have (:241). Fix: map score[3] to a pan dodge, or I can reword both lines to poop.
3. MINOR · pigeon HP is capped at 55 during part 1 (:305) and part 2 starts at max(55, pigHP) (:506), so swoop hits beyond 45 damage in the climb only score. It's undocumented; show the cap on the HP bar or note it in the README.
4. MINOR · no rematch after a clear: Pete keeps his ring lit (09d_pete.js:438), but the pigeon relies on the core, which hides cleared rings (comment at 09d_pete.js:438). UNVERIFIED: need a city screenshot after a win.
5. MINOR · tally text drops to 8 px at ≤480 px (:100), below phone legibility. Use ≥10 px.
6. MINOR · test hooks ship live: `window.__pigeon` (:800) and `?pigeon*` (:273-274, :799). Same as G8 #14. The radio duck shares G8 #5 (iOS, UNVERIFIED).

## SELF-CHECK G12 (P-018)
```
branches: review/pete @ e39289b, review/pigeon @ f07e716 (temp worktrees, read-only, removed)
bugs: pete 8 (blocker 0, major 1, minor 7); pigeon 6 (blocker 0, major 0, minor 6); total 14 = 0+1+13
headless 390x844 runs: pete win OK (83 s, clear lexington), pete lose+retry+leave OK; pigeon win quick OK (141 s, clear wtc), part2 win OK (81 s), lose+retry+leave OK
BOSS_CLEAR fires: pete Y (lexington), pigeon Y (wtc)
GR lines: GR4 pete 26/26 embedded identical, unreachable 1 (lose[2]); GR6 pigeon 36/36 identical, unreachable 1 (score[2])
UNVERIFIED: 404 resource source; Pete exit position; pigeon rematch ring; iOS duck
files read: src/09d_pete.js, src/09d_pigeon.js, src/09a_duel_core.js (both branches), relay/briefs/DESIGN.md, content/g3_qa_template.md, content/gr4_new_content.json, content/gr6_bikes_pigeon.json
```
