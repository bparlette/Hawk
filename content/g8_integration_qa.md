# G8 · Integration QA, 7 boss modes (P-008)

QA-REPORT G3 method, source branch. Reviewed `review/integration-fb940ee` at 2a07156a7916a296b8fc94443e07509f7aadb31c (read-only; not modified).
Judged only against README.md's mode descriptions. Every finding cites file:line on that branch. Not run in a browser: anything needing runtime is marked UNVERIFIED.

## Intake (G3 STEP 1, adapted)
- I1 Layout: README.md, site/game.js, src/*.js present. ZIP-only lines (LICENSES, previews, kit hash) n/a: this is a source branch.
- I3 Branch/commit: `review/integration-fb940ee` → 2a07156. Y
- Build sync: each of src/09_fort.js, 06g_derby.js, 09a/09b/09c, 06h_racers.js, 06v_vic_rhythm.js, 07_main.js, 07b_fullmap.js, 08_radio.js is found verbatim inside site/game.js (8392 lines). Y, so the live bundle matches the source.
- I2, I4, I5, I8–I10: n/a (no ZIP, no kit, no previews in scope).

## Ranked findings (20: 0 blocker, 5 major, 15 minor)
1. **MAJOR · all modes · GR3 pack not wired.** `rg "gr3_mode_writing|redclaw_taunts|vic_taunts|bobby_taunts|al_taunts|jimmy_taunts|kid_taunts|duchess_taunts|fort_bombardment" src/ site/game.js` gives 0 hits. Modes still use GR1 boss lines or hardcoded strings: 06g_derby.js:337 (GR1 bird_brain_bobby), 06v_vic_rhythm.js:39 (LANDMARKS boss.lines), 06h_racers.js:20 (GR1.bosses), 06h_racers.js:441 and :717 (hardcoded lose lines), 09_fort.js:387-512 (hardcoded WAVES names/banners). See section 5 for the keys.
2. **MAJOR · Fort · ✕ during the win sequence forfeits the clear.** `#fexit` click always calls `leave(false)` (09_fort.js:82). It stays live in phase `win` (anthem, ~16 s caption, 09_fort.js:520-524) and `done`, and only `leave(true)` runs `BOSS_CLEAR.clear('fort')` (09_fort.js:540). Fix: `leave(F.phase === 'win' || F.phase === 'done')` at :82, or hide #fexit once phase is `win`.
3. **MAJOR · Fort · phone touch target.** `#fexit` is 30×30 px (09_fort.js:58), under 44 px. It is the only touch exit mid-wave (README: "Leave: ✕").
4. **MAJOR · Derby · phone touch target.** Quit button `#dbQ` is 9 px font with 7 px padding and a 2 px border, about 27 px tall (06g_derby.js:319, phone rule :321).
5. **MAJOR · cross-mode · iOS radio duck is a no-op.** Derby (06g_derby.js:428/437), racers (06h_racers.js:144/149) and duels (09a_duel_core.js:165/175 via fightDuck) duck by scaling setVolume (08_radio.js:287-292). The radio's own comments say iOS ignores setVolume and pausing is the only dependable duck (08_radio.js:276, :473). Fort (hold) and Vic (lend) pause correctly. On iPhone the radio likely plays at full volume under 5 of 7 modes. UNVERIFIED on device; need an iPhone run of `?derby=1` with the radio on. Fix: use `hold(true/false)` (or pause on IOS) for these modes.
6. MINOR · Fort · end-card buttons are 9 px font with 9 px padding, about 31 px tall (09_fort.js:61).
7. MINOR · Vic · card buttons (DROP THE NEEDLE / NOT NOW / RETRY) are about 35 px tall (06v_vic_rhythm.js:64-65).
8. MINOR · Duels · over-screen buttons are about 42 px tall (09a_duel_core.js:54), just under 44.
9. MINOR · Vic · no way out mid-song. Esc only works in intro/win/lose (06v_vic_rhythm.js:419), and the only exit buttons are on cards (:290). A phone player must lose to leave. README does not promise a mid-fight exit.
10. MINOR · Al · `first = BOSS_CLEAR.clear(...)` (06h_racers.js:438), but `clear()` returns true on every call (06g0_boss_clear.js:19). `RB.alStats.cleared` is always true; use `!BOSS_CLEAR.cleared.has('fells')` before the call.
11. MINOR · Duchess · the win hand-rolls the clear event with `lm: null` (06h_racers.js:712-714) instead of a shared helper. It matches README (roaming, saved flag), and the fort's minimap listener guards null (09_fort.js:18), but any future `tcb:bossclear` listener must handle `lm: null`.
12. MINOR · Vic · duplicate stand-in `bossClear` and a cleared-flag restore (06v_vic_rhythm.js:42-50) are dead in the integrated build (BOSS_CLEAR exists, 06g0_boss_clear.js:6). 06g0 line 1 asks to keep one copy.
13. MINOR · debug · `?rbfresh=1` wipes every boss clear plus the Duchess flag in the shipped build (06h_racers.js:18).
14. MINOR · debug · test globals and URL starters ship live: `window.__fort` with `F.auto` autopilot (09_fort.js:24, :738), `__derby` (07_main.js:210), `__duels` (09a_duel_core.js:216), `__rb` (06h_racers.js:16), `__vic` (06v_vic_rhythm.js:558); `?fort/?derby/?duel/?vic/?rb` (09_fort.js:733, 07_main.js:209/211, 09a_duel_core.js:215, 06v_vic_rhythm.js:551). README documents them as test hooks, so this is minor; gate them behind a dev flag before release.
15. MINOR · Vic · `setInterval(schedTick, 25)` runs from page load forever (06v_vic_rhythm.js:199). It early-returns when not playing (:195) but still means 40 wakeups/s on phones in the city. Start/stop it with the fight.
16. MINOR · cross-mode · `FORT.world()` runs every frame during duels and racer modes (07_main.js:157, before the MODE.duel/RB checks at :159-160). UNVERIFIED cost; need a perf trace in `?duel=jimmy`.
17. MINOR · cross-mode · frame order means `__cel.pause` (07_main.js:158) cannot pause derby, Vic, the full map or the fort (07_main.js:153-156). Test hook only.
18. MINOR · cross-mode · all duck users share one `DUCK.k` and restore to 1 unconditionally (08_radio.js:288-289; 06g_derby.js:437, 06h_racers.js:149, 09a_duel_core.js:175). No overlap path found today (the full map and the modes are mutually exclusive, 07b_fullmap.js:188-189), but a nested mode would un-duck early. UNVERIFIED; low risk.
19. MINOR · full map · `open()` returns `undefined` when the fort is on, but `false` for the other blocked modes (07b_fullmap.js:188 vs :189). Any caller testing `=== false` misreads it.
20. MINOR · phone HUD overlap at 390×844 UNVERIFIED for Fort, Vic and the duels. Racers offset their HUD for the radio ticker (06h_racers.js:32, :40) and derby moves #dbQ at ≤480 px (06g_derby.js:321). Fort (#fflag/#fexit at top+42/46 px, 09_fort.js:46/58), the duels (.dsay top+100 px, 09a_duel_core.js:38) and Vic have no `body.radio` offset. Need 390×844 screenshots with the radio ticker on.

## Per mode (checks 1–4)
**Fort Bombardment (src/09_fort.js)**
1. Win: last wave → `win()` → `finish()` → CONTINUE → `leave(true)` (:517, :520, :530-532, :84, :540). Lose: flag falls → `lose()` → RETRY/LEAVE (:628, :526, :83-84). Both reachable. Y
2. Exit: `leave()` removes body.fort, banners and hint, `musStop`, `hold(false)`, restores hero/partner/camera, clears KEYS/PRESS and resets `last` (:533-545). The ACT label is restored by the city HUD each frame (07_main.js:136). Exit is clean, except finding 2.
3. Null guards: the Redclaw hook is wrapped in try (:180), and the minimap mark guards `!L || !MAP` (:18). The debug hook is finding 14.
4. Phone: findings 3, 6 and 20. The shot hit test has a 38 px minimum (README).

**Bobby derby (src/06g_derby.js)**
1. Win: 10 homers → `win()` → `BOSS_CLEAR.clear` (:522, :451-452). Lose: 10 outs → `lose()` (:522, :454). Y
2. Exit: `exit()` removes the classes, un-ducks, restores fog, clears input, calls `resize()` and resets `last` (:435-440). Start closes an open full map (:427). Clean.
3. Null guards: `say()` falls back through `LM.boss.lines` → GR1 → `{}` (:337). Nothing found.
4. Phone: finding 4.

**Vic rhythm (src/06v_vic_rhythm.js)**
1. Win: KO in phase 3 or vhp ≤ 0.5 at set end (:398, :344). Lose: hp 0 (:389) or outlasted (:344). Y
2. Exit: `exit()` pauses the player, `unlend()`, removes the class, clears input, calls `resize()` (:362-367). The KO and scratch timeouts are guarded by `V.on` / `V.player` null checks (:345, :398). Clean, but see finding 15.
3. Null guards: rig hook typeof-guarded (:113). `console.log` only under `?vicsync` (:410). Findings 12 and 14.
4. Phone: findings 7, 9 and 20. The 3-lane layout on coarse pointers or width < 600 is OK (:281).

**Big Jimmy swim (src/09b_jimmy.js + 09a_duel_core.js)**
1. Win: `bossCleared('aquarium')` then `over('win')` after 2.6 s (09b_jimmy.js:271-272). Lose: air or hp (09b_jimmy.js:274). Y
2. Exit: `D.exit` removes the classes and overlays, restores labels, the ACT icon and the panel, un-ducks, puts the hero and partner back at the entrance, clears input (09a_duel_core.js:168-179). `J.exit` is a no-op (09b_jimmy.js:210); the fog is reset by the city `updateCycle` each frame (07_main.js:100). The deferred `over()` is guarded by `DUELS.cur === J` (:272). Clean.
3. Null guards: none found.
4. Phone: findings 8 and 20.

**Chip Kid duel (src/09c_chipkid.js + 09a_duel_core.js)**
1. Win: `bossCleared('harborplace')` then `over('win')` (09c_chipkid.js:297-298). Lose: T.K.O. → `over('lose')` (:200). Y
2. Exit: as for Jimmy, plus `C.exit` clears the blind (:191). The timeouts are guarded by `DUELS.cur === C`. Clean.
3–4. Same as Jimmy (findings 8 and 20).

**Arabber Al chase (src/06h_racers.js)**
1. Win: 3 rams → `win()` → `BOSS_CLEAR.clear('fells')` (:511, :436-438). Lose: the clock hits 0 → `lose()` → retry card (:453, :441, :458). Y
2. Exit: `exit()` returns the rigs, `rbLeaveFight` (un-duck, HUD hidden, barks restored), repositions the hero and partner, resets `CAM.yaw` (:431-434, :147-150). Clean.
3. Findings 10 and 13.
4. The retry buttons are 14 px font, 12 px padding and a 3 px border, about 44 px tall with min-width 200 (:53). OK.

**Dragon Boat Duchess (src/06h_racers.js)**
1. Win: 3 rams into a pier or buoy (:779, :710-714). Lose: hull 0 (:801, :717) → retry/quit (:804-806). Y
2. Exit: `rbLeaveFight`, then resumes the boat ride or returns the rigs (:706-709). Clean.
3. Finding 11.
4. Same HUD as Al. OK.

## 5. GR3 keys no mode reads yet (content/gr3_mode_writing.json)
None of the 33 keys is read (finding 1). Suggested wiring:
- fort_bombardment → 09_fort.js: `wave_cards` (fbanner :512), `redclaw_taunts` (#fsay), `flag_hit` (flag damage), `win` / `lose` (:520 / :526).
- vic_rhythm → 06v_vic_rhythm.js: `judgements` (judge pops), `phase_cards` (`startPhase` :297), `vic_taunts`, `vic_hurt`, `win` / `lose` (:355 / :358).
- bobby_derby → 06g_derby.js: `pitch_tells` (bobbyWindup :175), `homer`, `out`, `bobby_taunts` (say :337), `win` / `lose` (:451 / :454).
- al_chase → 06h_racers.js: `al_taunts`, `ram_hit` (:511), `produce_warn` (thrown items), `win` / `lose` (:437 / :441).
- jimmy_swim → 09b_jimmy.js: `jimmy_taunts`, `low_air` (air drain), `win` / `lose` (:271 / :274).
- chip_duel → 09c_chipkid.js: `round_cards`, `tells` (tell callouts), `kid_taunts`, `win` / `lose` (:298 / :200).
- duchess_race → 06h_racers.js: `duchess_taunts`, `ram_hit` (:779), `win` / `lose` (:711 / :717).

## Cross-mode conflicts
- **Radio hold vs duck:** the fort uses `hold()` (pause), Vic `lend()` (pause plus player borrow), the other 5 modes `duckTo` / `fightDuck` (volume). See findings 5 and 18. `unlend()` respects `R.held` (08_radio.js:490), so the Fort and Vic paths compose.
- **Full map blocking:** the map refuses to open during the fort, derby, Vic, duels and racer fights, and allows it on boat rides (07b_fullmap.js:188-189), matching README. See finding 19.
- **Frame hooks (07_main.js:153-160):** DERBY and VIC run before the FMAP check, and FORT, MODE.duel and RB after it. That is safe because of the block list above. `MODE.ticks`, `DERBY.marker.tick` and `BARK.tick` run only on city frames (:202-204), so `?duel=` auto-start waits for a city frame (09a_duel_core.js:215). See findings 16 and 17.
- **Shared BOSS_CLEAR:** a single copy at 06g0_boss_clear.js. Vic's stand-in and the Duchess's hand-rolled event duplicate it (findings 11 and 12).

```
SELF-CHECK G8 (P-008)
findings per mode: fort 3, derby 1, vic 4, duels (jimmy+chipkid) 1, racers (al+duchess) 3, cross-mode 8 = 20 (max 40)
by severity: blocker 0, major 5, minor 15
UNVERIFIED: 5, 16, 18, 20
win+lose reachable: 7/7 modes
files read: README.md, site/game.js (sync check), src/09_fort.js, src/06g_derby.js, src/06g0_boss_clear.js, src/09a_duel_core.js, src/09b_jimmy.js, src/09c_chipkid.js, src/06h_racers.js, src/06v_vic_rhythm.js, src/07_main.js, src/07b_fullmap.js, src/08_radio.js, src/06d_panel.js, content/g3_qa_template.md, content/gr3_mode_writing.json
```
