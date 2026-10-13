# G21: QA of the Fells Point Phantoms + regression of fishing/Chompy and Poe (P-058)

Build: review/integration-59933ee (worktree HEAD 13654c2, snapshot of hark/integration 59933ee), site/ served locally.
Method: headless Chromium + Playwright (SwiftShader), same harness as G20. Every command was capped at 120 s. Load was low (~0.6).
- Viewports: 390x844 with touch, and **640x360** as the desktop size. City boot also ran at 1280x720.
- Hooks: `?phantoms=1&phauto=win|lose` (night + lantern implied), `&nolantern=1`, `fishauto`, `poeauto`.
- Template: g3_qa_template.md. HOMAGE.md applies to characters, and DESIGN's real-signage rule to signs.

## 1. Fells Point Phantoms (src/09z_phantoms.js)

| Cell | Result | Evidence |
|---|---|---|
| Win, 390 | PASS | 49 s. Waves 1→3, lantern flashes, sinks across all 3 kinds, `phantoms:win`, **1 replay**, exit:win |
| Win, 640x360 | PASS | 53 s, same flow, 1 replay |
| Lose + retry, 390 | PASS | 44 s. `phantoms:lose:dread`, then RETRY, which restarts at the wave reached (09z:142) |
| Lose + retry, 640x360 | PASS | 48 s, same |
| Save / flag | PASS | After the win, a reload gives `phantomsCleared()` = true and tcb_phantoms {cleared:true, clears:1} |
| Can it be cheesed without the lantern? | PASS (no cheese) | `&nolantern=1` with the win bot: stuck in wave 1 for 96 s, with no kill and no lose. Swings only stun non-solid ghosts, as designed |
| Layout 390 | **FAIL** (B1) | Nothing runs off screen (scrollWidth 390), but the HUD sub-line runs together: "WAVE 1/3 · GHOSTS 10LANTERN READY (K)" |
| ACT label | PASS (code read) | 09z:286. By day "PHANTOMS: AFTER DARK". At night with no lantern "PHANTOMS: NEED LANTERN". Then "FIGHT PHANTOMS", then "PHANTOMS AGAIN". The banners explain each case |

No page errors in any run. The win doesn't touch `tcb_boss_clear`. It uses its own save and a `tcb:phantoms` event instead, which the 09z header says is intended.

Fun check:
- **The 3 waves are distinct.** Wave 1 is two fast Dreads. Wave 2 is Bosun Bones plus 2 Monkeys lobbing bombs with landing rings. Wave 3 mixes all three (5 ghosts). Each kind has its own HP, speed, reach and windup (09z:27-30).
- **The lantern toggle is readable.** The HUD shows "LANTERN READY" or "LANTERN Ns", the bots used it 1-5 times per wave, and solid ghosts are the only ones that sink.
- **No cheese found.** The win bot needs about 50 s with the lantern and can't progress without it.
- Real touch feel is UNTESTED, because the bot has no touch input.

## 2. Regression: fishing, Chompy and Poe at 390

| Cell | Result | Evidence |
|---|---|---|
| Fishing win, Broadway at night | PASS | 60 s. Ghost lantern first (still guaranteed), 4 junk, chompy 80, lantern=true |
| Fishing lose + retry | PASS | 31 s, retry |
| Chompy cane threshold (seed 98, then a fish) | PASS | chompy 102, cane true, survives reload (G20 fix holds) |
| **Casts persist (G20 N2)** | **FAIL, still open** | casts 2 before the reload and 1 after. 09x_fishing.js:211 bumps `save.casts`, but `persist()` only runs on a catch (09x:199) and on exit (09x:182) |
| Poe win | PASS | 22 s. feather true, clears 1 |
| Poe lose + retry | PASS | 13 s. spotted 1, retry |

## 3. HOMAGE pass, pirate ghosts
- Names are original: Bosun Bones, Deckhand Dread, Powder Monkey, and the leader Captain Cobblestone (09u).
- The only dialogue is Mavis's lines (09z:139, :184). A grep found no film or franchise pirate names (Jack Sparrow, Black Pearl, Davy Jones, Blackbeard, Captain Morgan and so on).
- The look is a procedural see-through teal stand-in, with no rig yet (the `buildPhantomPirate` hook). No real-brand or real-name risk.

## 4. City boot and night-only ring

| Cell | Result | Evidence |
|---|---|---|
| Boot 390 | PASS | 0 page errors, `__celErr` 0, nothing off screen |
| Boot 1280 | PASS | First try, 60 s, 0 errors |
| Phantoms ring only at night | **FAIL** (B2, code read) | 09z:288: `P.ring.visible = d < 20 && !DUELS.cur`. There's no night check, so the green ring also glows by day. The header (09z:273) says "night only". The day ACT label and banner do block the fight, so this is cosmetic |

## Bugs
- **B1 (minor)** The Phantoms HUD sub-line collides at 390: "GHOSTS 10LANTERN READY (K)". The two `DUELS.sub` halves touch, and the phone shows the keyboard hint "(K)". Code: 09z_phantoms.js:135. Fix: drop "(K)" on touch, or shorten the text to "LANTERN ✓".
- **B2 (minor)** The Phantoms ring is visible by day (09z_phantoms.js:288). Fix: add `&& isNight()`.
- **N1 (minor, carried over)** casts still aren't saved on cast (09x_fishing.js:211). This is G20 N2, still open.
- **N2 (note)** On a Phantoms lose, `retry` is logged twice: 09z:142 `P.retry` pushes its own, in addition to the core's (09a). This doubles retry counts in tests and stats.
- **N3 (note, carried over)** `save.purse` is still never read. 0 references in 09x, so the purse upgrade still has no effect (G20 N1).
- **N4 (note)** Fishing and Poe wins now play the JUICE fallback replay (`juice:replay` in both logs). That's odd on a fishing haul or a stealth exit. Consider turning the fallback off for side missions.

Bugs by severity: blocker 0, major 0, minor 3, note 3.

## Closed vs open since G20
- Still closed: the Chompy cane/purse unlock + persistence, the lantern guarantee, the Poe feather save.
- Still open: G20 N1 (purse effect), G20 N2 (casts persist), G20 N4 (Rodney's late WIN card, not rechecked), G20 N5 (Chip Kid mash, waiting on a design call), G19 N2 (`tcb:finale` listener, not rechecked).
- New: B1, B2, N2, N4.

## Fix first (5 lines)
1. B2: the Phantoms ring needs a night-only check (09z_phantoms.js:288, `&& isNight()`).
2. B1: shorten or split the Phantoms HUD line at 390, and hide "(K)" on touch (09z_phantoms.js:135).
3. N1: `persist()` after `save.casts++` (09x_fishing.js:211).
4. N3: give the purse upgrade an effect (09x reel/score code).
5. N2/N4: drop the duplicate retry log in 09z:142, and skip the JUICE fallback replay on side missions.

## Self-check
- Cells tested: 18. That's 8 Phantoms + 6 fishing/Poe + 1 HOMAGE + 3 boot/ring.
- PASS 15, FAIL 3 (Phantoms 390 HUD, casts persist, day ring), UNTESTED 0. Touch feel is noted as not covered.
- Bugs by severity: 0/0/3/3.
- Closed vs open listed. 5-line fix list given.
