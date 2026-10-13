# G14 · Regression QA of the older modes on review/integration-lex @ b7c6252 (2026-10-12)

Template: content/g3_qa_template.md (only the parts that apply to play QA. The asset intake lines I1-I10 are n/a for a regression pass).
Setup: a detached `git worktree` of b7c6252, `site/` served with `python3 -m http.server`, Playwright 1.62 with headless Chromium (swiftshader GL).
Desktop runs were 1280x720. Mobile runs were 390x844 with touch and isMobile on.
Modes were started with the README test hooks (`?fort=1`, `?derby=`, `?duel=`/`duelbot=`, `?rb=`/`rbauto=`, `?vic=`). Retry was done by clicking or pointer-tapping the real on-screen button.
Every row below reports what I saw in these runs and nothing more. UNTESTED means no run gave clear evidence either way.
The only console errors were Chrome's `navigator.vibrate` blocked-before-gesture notices (duels, 390) and a "compute-pressure" permissions-policy notice (derby). There were no page errors, and `__celErr.n` was 0 in every run.

## Results

| Mode | Start | Win | Lose | Retry | Mobile 390 | Controls | Softlock |
|---|---|---|---|---|---|---|---|
| Fort Bombardment | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Bobby derby | PASS | PASS | PASS | PASS | PASS | UNTESTED | PASS |
| Big Jimmy swim | PASS | PASS | PASS | PASS | FAIL (minor, see B2) | UNTESTED | PASS |
| Chip Kid duel | PASS | PASS | PASS | PASS | PASS | UNTESTED | PASS |
| Arabber Al chase | PASS | PASS | PASS | PASS | FAIL (minor, B1) | PASS | PASS |
| Duchess ram | PASS | PASS | PASS | PASS | FAIL (minor, B1) | UNTESTED | PASS |
| Vic rhythm battle | PASS | PASS | PASS | PASS | PASS (minor polish, B4) | UNTESTED | PASS (see B3) |

## Evidence per mode
- **Fort.** `fort=1&fortauto=1` reached phase `win` (wins 1, flag 100) in 213 s.
  - `fort=1&fortwave=4` with no input reached phase `lose` (flag 0). Clicking `#fretry` brought it back to phase `wave` with flag 100.
  - Controls: 40 presses each of Space, J and Enter took `F.stats.shots` from 0 to 31; the gap is the reload ring.
  - At 390 the arcade panel fit, with no horizontal scroll (scrollWidth 390).
- **Derby.** `derby=perfect` won 10 HR / 0 outs (best 447 ft, BOSS_CLEAR set). `derby=miss` lost 0 / 10 outs.
  - Clicking the card's RETRY started a fresh at-bat: state `pitch`, outs 0.
  - Controls: mashing Space for about 20 s left STRIKE 2 after 2 pitches. That doesn't show whether the swings counted or were called strikes, so it's UNTESTED.
  - The 390 layout fit.
- **Big Jimmy.** `duelbot=win` gave log `exit:jimmy:win`. `duelbot=lose` gave `jimmy:lose:hit` → `retry` → `jimmy:lose:hit` → `exit:jimmy:leave`.
  - Keyboard input (J/K/E) left no trace in `__duels.log`, so controls are UNTESTED.
- **Chip Kid.** `duelbot=win` ran through the defeat line and exited. `duelbot=lose` gave `lose:slam` → `retry` → `lose:slam` → `exit:chipkid:leave`.
  - Controls UNTESTED, for the same reason as Jimmy.
- **Arabber Al.** `rbauto=win` logged `al WIN hits=3 left=55.3`. With `rbtime=10` and no input it logged `al LOSE HE GOT AWAY!`.
  - Tapping TRY AGAIN logged `al retry` and a new intro line.
  - Controls: mashing J and K with no steering got `al RAM 1`, which shows boost and hop work.
- **Duchess.** `rbauto=win` logged `duchess CRASH pier 3` and `duchess WIN`. `rbauto=lose` logged `duchess LOSE`.
  - Tapping TRY AGAIN logged `duchess retry` (I cleared `__rb.auto` first, see B5).
  - J/K mashing left no log entry, so controls are UNTESTED.
- **Vic.** `vic=perfect&vicyt=0` won by KO: 479 perfect, drops countered 20/20.
  - `vic=miss&vicyt=0&vicbars=4` lost by "zapped". Clicking RETRY restarted at phase 0.
  - With `vic=1`, the start card stayed up until DROP THE NEEDLE was clicked.
  - The run lost in under 12 s with no input (18 misses), so my key mashing came too late. Lane keys are UNTESTED.

## Bugs
- **B1 · minor · Al / Duchess at 390: the city intro title card covers the fight.**
  - Steps: `?rb=al` (or `rb=duchess&rbfresh=1`) at 390x844, wait 35 s.
  - The "PHASE 1 · CITY BLOCKOUT / TOAD CITY BALTIMORE" title sits over the racer view (screenshot m390_al / m390_duch).
  - Cause: `src/07_main.js:211`. The `?rb=` hook starts the fight without `CINE.intro.skip = true`, while the duel hooks do skip it (`src/09a_duel_core.js:215`).
  - It probably only affects test URLs, but I didn't check the in-city ACT entry path.
- **B2 · minor (needs a human eye) · Jimmy at 390: the camera is jammed against Jimmy's body.**
  - Steps: `?duel=jimmy` at 390x844, idle 35 s.
  - Most of the frame was Jimmy's shell, an eye, and a green stalk crossing the screen. Harold's HP and AIR were draining.
  - This is one frame, so it may be a passing moment when he's close.
- **B3 · minor (test hook) · `?vicbars=4` can't be won.**
  - Steps: `vic=perfect&vicyt=0&vicbars=4`.
  - The perfect bot hit 40/40 notes and still lost "outlasted" with Vic at vhp 9. The set is too short to drain 300 HP.
  - Without `vicbars` the same bot wins. This only matters for short test runs.
- **B4 · minor (polish) · Vic HUD at 390.** The "VOLTAGE VIC" HP label draws over the "POWER PLANT LIVE" sign, which is cut to "WER PLANT LIVE" (m390_vic).
- **B5 · note (test hook) · rbauto ignores the retry buttons.**
  - With `rbauto=` set, the retry phase ignores the player (`src/06h_racers.js:460`, `:805`, `c = RB.auto ? ... : rbRetryInput()`). Tapping TRY AGAIN does nothing until `RB.auto` is cleared.
  - Human play isn't affected.

## Self-check
- All 7 modes covered: Fort, Derby, Jimmy, Chip Kid, Al, Duchess, Vic.
- 49 cells: 41 PASS, 3 FAIL, 5 UNTESTED.
  - FAIL: Jimmy, Al and Duchess mobile.
  - UNTESTED: controls for Derby, Jimmy, Chip Kid, Duchess and Vic.
- Bugs by severity: blocker 0, major 0, minor 4 (B1-B4), note 1 (B5).
- Not covered:
  - Real touch input on the arcade panel (only the layout was checked).
  - Gamepad.
  - The YouTube path for Vic (I ran `vicyt=0`, the procedural beat).
  - City entry by ACT.
  - Audio.
