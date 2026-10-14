# G15 — QA of the new boss modes (review/integration-1759052 @ 1a7f1e5)

Template: content/g3_qa_template.md. Method: a worktree of review/integration-1759052 @ 1a7f1e5 with `site/` served on 127.0.0.1:8800, run in headless Chromium (Playwright, SwiftShader GL), the same harness as G14. Each row reports only what these runs showed. UNTESTED means no run gave clear evidence either way.

## Results

| Mode | Start | Win | Lose | Retry | Mobile 390 | Controls | Softlock | City entry (ACT ring) |
|---|---|---|---|---|---|---|---|---|
| Chef Crabcake (09p_crabcake.js) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | UNTESTED |
| The Pool Shark (09r_poolshark.js) | PASS | PASS | PASS | PASS | PASS | PASS (hop UNTESTED) | PASS | UNTESTED |
| The Stoop Scrubber (09s_stoop.js) | PASS | PASS | PASS | PASS | PASS | UNTESTED | PASS | UNTESTED |

| Extra check | Result |
|---|---|
| Power Plant signage is an AMP HOUSE homage (HOMAGE) | PASS (checked in source and in the shipped site/game.js; not checked visually) |
| `?goto=lexington` loads the market and Pete | PASS |

## Evidence

- **Chef Crabcake.**
  - `?crabcake=1&crabcakeauto=win` logged `start:crabcake` → `crabcake:grade:S` → `exit:crabcake:win`, with `__duels.result` = win.
  - `crabcakeauto=lose` logged `crabcake:lose:slam` → `retry` → `crabcake:lose:slam` → `exit:crabcake:leave`.
  - Key log taken from `__crabcake.st`:
    - D set lane 1 and A set lane -1.
    - S and K set duck to true.
    - J set swingT to 0.1.
    - E (CHEF'S FLIP) wasn't exercised because POWER was 0.
  - At 390×844, scrollWidth was 390 and no element sat off-screen. The HUD, THE PASS sign and the panel (SWING/DUCK/FLIP) were all visible.
  - No page errors, and `__celErr` was 0.
- **The Pool Shark.**
  - `?poolshark=1&poolsharkauto=win` logged 3× `poolshark:bank` → `poolshark:win:S` → `exit:poolshark:win`.
  - `poolsharkauto=lose` logged `poolshark:secondwind` → `poolshark:lose:land` → `retry` → `poolshark:lose:ball` → `exit:poolshark:leave`.
  - Key log taken from `__poolshark.st`:
    - D moved hx by -0.31 and A by +0.31.
    - W moved hz from -4 to -3.38.
    - J started a swing (stats.swings 0 → 1, atkI 0).
    - K (hop): hy read 0 at the 0.2 s sample, so the hop is UNTESTED.
    - E wasn't exercised because POWER wasn't full.
  - D moving Harold toward -x wasn't checked against the on-screen direction.
  - At 390, scrollWidth was 390 and nothing was off-screen. The CANNONBALL tell card and its ring were readable.
- **The Stoop Scrubber.**
  - `?scrubber=1&scrubberauto=win` logged `scrubber:win` → `exit:scrubber:win`, after a STOOP SURF line.
  - `scrubberauto=lose` logged `scrubber:lose` → `retry` → `scrubber:lose` → `exit:scrubber:leave`.
  - Key log taken from `__scrubber.st.h`:
    - D moved x from 0 to 0.34.
    - A moved x back to 0.19.
    - W moved z from 4.2 to 4.06.
    - S didn't clearly move Harold toward +z.
    - J, K and E showed no clear change in the fields I sampled.
    - The controls cell stays UNTESTED.
  - At 390, scrollWidth was 390 and nothing was off-screen.
- **Softlocks.** Every win and lose run reached `exit:` with the city restored and no page errors. Lose runs take about 5–13 minutes of wall time under SwiftShader. That's harness speed, not a bug.
- **City entry.**
  - Each mode registers a ring with `DUELS.addTrigger` at its landmark anchor:
    - fourseasons, labelled FIGHT CHEF / REMATCH CHEF.
    - pendry at 126, -19.5.
    - monument at -20, -84, labelled SCRUB-OFF.
  - I didn't walk Harold to any ring, so all three are UNTESTED.
- **Signage.**
  - The shipped Power Plant text in src/03b_landmarks_hd.js:245–420 is:
    - The AMP HOUSE and HARBOR CAFE badge (a bolt on a navy plate).
    - The AMP HOUSE blade sign, which replaces the guitar.
    - AH roundels.
    - TURN IT UP, HON.
    - POWER PLANT.
    - UNITED RAILWAYS & ELECTRIC COMPANY.
  - A case-insensitive grep of src/ and site/game.js found nothing for "hard rock", "hardrock" or the real mottos.
  - HOMAGE.md isn't in this snapshot, so I checked against the HOMAGE note in the file header (lines 246–247).
- **Lexington.** `?goto=lexington` at 1280×720:
  - The market rendered: LEXINGTON / MARKET, WORLD FAMOUS, SINCE 1782, the seal and the canopy.
  - The name popup shows the Pit Beef Pete line.
  - `window.LEX_ANCHOR` and `window.__pete` are both present.
  - No page errors and no overflow.
  - Pete's model wasn't in the camera frame.

## G14 UNTESTED control cells

There's still no key or input log in this build: grep found nothing for keylog, inputLog or __keys in src/, and `__duels.log` and `__rb.log` record no key events. So the G14 controls cells for Derby, Jimmy, Chip Kid, Duchess and Vic stay UNTESTED.

## Bugs

There are no blocker, major or minor bugs in the three modes.

- **N1 (note, outside P-051's Hard Rock scope).** The Power Plant atlas still draws real tenant names.
  - 'Phillips' and 'SEAFOOD' at src/03b_landmarks_hd.js:283 and :287.
  - 'BARNES&NOBLE' and 'BOOKSELLERS' at :317 and :322.
  - Steps: open the source, or view the Power Plant west and middle buildings in the city.
  - Flagging it for the homage policy.
- **N2 (note).** The Pool Shark's D key moves Harold toward world -x (09r_poolshark.js, input block near :402). I didn't check this against the on-screen direction. It's worth a quick look by a person.

## Self-check

- Covered all 3 modes (Crabcake, Pool Shark, Stoop Scrubber), plus the Power Plant signage and the `?goto=lexington` check.
- Bugs by severity: blocker 0, major 0, minor 0, note 2.
- 26 cells (24 mode cells + signage + Lexington):
  - 22 PASS, 0 FAIL, 4 UNTESTED.
  - UNTESTED: city entry ×3 and Scrubber controls. The Pool Shark hop is noted as untested inside a PASS cell.
- The 5 G14 control cells stay UNTESTED because no key log exists.
