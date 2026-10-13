# G16: QA of the second-wave boss modes (P-052)

Build: review/integration-4d14075 (worktree HEAD 0857471, snapshot of hark/integration 4d14075), site/ served locally.
Method: headless Chromium + Playwright (SwiftShader GL), same harness as G15. Every command was capped at 120 s. Win and lose used the test-bot hooks; where the spec allowed it, phase and HP hooks shortened runs. Win = `exit:<id>:win` in `__duels.log`. Lose + retry = the lose screen appeared and the bot pressed RETRY (`retry` in the log, `retries`=1). Desktop runs were at 640x360 or 320x180 to keep SwiftShader inside the cap. Mobile ran at 390x844 with touch, 60 s after load.
Template: g3_qa_template.md cells (start, win, lose, retry, mobile 390, controls, softlock, ACT-ring city entry).

## Results per mode

| Mode (file) | Hook used | Start | Win | Lose | Retry | Mobile 390 | Controls | Softlock | ACT ring |
|---|---|---|---|---|---|---|---|---|---|
| Kingpin Carl (09k_carl.js) | carl=1&carlauto=win/lose | PASS | PASS (89 s) | PASS (89 s) | PASS | PASS | UNTESTED | PASS | UNTESTED |
| Riptide Rodney (09m_rodney.js) | duel=rodney&duelbot=win/lose | PASS | PASS 5-2 (93 s) | PASS 0-5 (47 s) | PASS (score reset to 0-0) | PASS | UNTESTED | PASS | UNTESTED |
| Raven King (09v_ravenking.js) | ravenking=1&ravenkingauto=win (phase 3) / lose | PASS | PASS (58 s) | PASS (103 s) | PASS | PASS | UNTESTED | PASS | UNTESTED |
| Compression King (09q_compking.js) | compking=1&compkingauto=win (phase 3) / lose&compkinghp=5 | PASS | PASS grade S (74 s) | PASS lose:squeeze (53 s) | PASS | FAIL (B1) | UNTESTED | PASS | UNTESTED |
| Hon Queen (09n_honqueen.js) | honqueen=1&honqueenauto=win&honqueenphase=3 / lose&honqueenhp=5 | PASS | PASS grade S (44 s) | PASS lose:flam (81 s) | PASS | PASS | UNTESTED | PASS | UNTESTED |
| Shellacious (09t_shellacious.js) | shellacious=1&shellaciousauto=win/lose&shellaciousphase=3 | PASS | PASS grade S (50 s) | UNTESTED | UNTESTED | PASS | UNTESTED | PASS | UNTESTED |
| Sugar Rush (09o_sugarrush.js) | sugarrush=1&sugarrushauto=win/lose | PASS | PASS neon+boost specials, ko (110 s) | PASS lose:dash (85 s) | PASS | PASS | UNTESTED | PASS | UNTESTED |

Notes:
- Shellacious lose: the lose bot stands still, and Harold's HP drained (one run reached 5 HP) but didn't hit the lose screen inside 120 s in 4 tries. There's no shellacioushp hook. I didn't force state, so lose and retry are UNTESTED.
- Mobile 390: scrollWidth was 390 in all 7 modes, and the only off-screen element was the B1 one. `__celErr` was 0 and there were no page errors.
- Softlock: no run stalled except the Shellacious lose, which was still slowly progressing. Every win exited to the city (`cur` null), and every lose offered RETRY and restarted.
- Controls: there's no key or input log for these modes, so they stay UNTESTED as in G14/G15.
- ACT-ring city entry: I couldn't reach the rings headlessly inside the cap, so all UNTESTED. Rodney's ring falls back to a TEMPORARY anchor when LANDMARKS 'rashfield' is missing (09m_rodney.js:325-328).
- No page errors or console errors in any run.

## Signage check (HOMAGE / no-real-brands)
HOMAGE.md isn't in this branch. I checked against the rule in earlier prompts (no real brands on signs).
- S1 Compression King store sign reads UNDER ARMOUR, with "LOCUST POINT · BALTIMORE · EST. 1996" under it (09q_compking.js:39, :54-55). The file header (09q_compking.js:3) says this is intentional per a "DESIGN.md real-signage rule, Brad 2026-10-11". That conflicts with the no-real-brands rule, so Hark needs to decide. The city has it too: 02_atlas.js:140 (ath sign), 03_city.js:559, 07b_fullmap.js:33.
- S2 Sugar Rush roof sign is the "Domino Sugars" script wordmark (09o_sugarrush.js:81 plus the 'Sugars' word call). The city landmark is also 'DOMINO SUGARS' (03_city.js:554).
- S3 Raven King: the banner reads "M&T STADIUM" (09v_ravenking.js:207), and the end zone and scoreboard read "NEVERMORE" (09v_ravenking.js:126, :199, line :373 taunt). NEVERMORE is on the R-052 banned list. The city landmark is 'M&T BANK STADIUM' (03_city.js:522, 02_atlas.js:139).
- Clean: Carl (DUCKPIN DEN / KINGPIN CARL'S), Rodney (RASH FIELD, a public place name), Shellacious (original movie poster text), Hon Queen (no sign text).

## Bugs
- B1 (minor) Compression King, mobile 390. Steps: `?compking=1` at 390x844, wait 60 s. The `#duel .dtell` tell box measures left -32 / right 422, so long tell text is clipped at both edges. Cause: `white-space: nowrap` with no max-width (09a_duel_core.js:41), plus the bottom-tell position in this mode. Fix: add `max-width: 92vw; white-space: normal` or shorter tells.
- N1 (note) S1 UNDER ARMOUR real-brand sign, file:line above. This needs a policy call, and it's major if no-real-brands stands.
- N2 (note) S2 Domino Sugars wordmark on the Sugar Rush sign. Same policy call.
- N3 (note) S3 M&T STADIUM and NEVERMORE on the Raven King arena. Same policy call.
- N4 (note) `honqueenhp=5` still triggered `honqueen:secondwind` (log), unlike `compkinghp`, which turns off second wind. This may be by design, but the README doesn't say so.

## Self-check
- All 7 modes covered: Carl, Rodney, Raven King, Compression King, Hon Queen, Shellacious, Sugar Rush.
- Signage check done: 3 real-brand findings (S1-S3), 4 modes clean.
- Bugs by severity: blocker 0, major 0, minor 1, note 4.
- Cells: 56 in total (7 modes x 8). 39 PASS, 1 FAIL, 16 UNTESTED (ACT ring x7, controls x7, Shellacious lose+retry).
