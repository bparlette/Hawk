# G20: QA of the latest integration (P-057)

Build: review/integration-769bc08 (worktree HEAD cbd2936, snapshot of hark/integration 769bc08), site/ served locally.
Method: headless Chromium + Playwright (SwiftShader), same harness as G19. Every command was capped at 120 s. The box was quiet this time (load ~0.2).
- Desktop cells ran at **640x360**.
- Mobile ran at 390x844 with touch.
- City boot ran at 390x844 and 1280x720. 1280 booted on the first try in 60 s.

Template: g3_qa_template.md. Signage follows DESIGN's real-signage rule. Characters follow HOMAGE.md.

**Correction to G19:** its table actually had 10 PASS and 6 UNTESTED: Brew 390 lose, Pigeon 390 lose, and Carl and Rodney desktop win and lose. R-059 wrongly said 12/4. G20 closes all 6.

## 1. G19 untested cells, now closed

| Mode | Viewport | Win | Lose |
|---|---|---|---|
| Brewmaster | 390 | (G19 PASS) | PASS. Part 3 at hp 5: lose:part3:spin, then retry, then retry:part3 (74 s) |
| Penthouse Pigeon | 390 | (G19 PASS) | PASS. Part 2: lose:bomb, then retry (57 s) |
| Kingpin Carl (`carl=1&carlauto=`) | 640x360 | PASS (83 s, 1 replay, clear `duckpin`) | PASS (80 s, retry) |
| Riptide Rodney (`duel=rodney&duelbot=`) | 640x360 | PASS. 5-1 `rodney:win` in 77 s. The WIN card still lands after the cap (G19 N3, still open) | PASS (0-5, 53 s, retry) |

The G19 + G20 matrix is now 16/16 PASS, 0 FAIL, 0 UNTESTED (4 modes x 2 viewports x win/lose).

## 2. Retests of the fixed bugs

| Bug | Result | Evidence |
|---|---|---|
| G19 B1: JUICE replay camera clipping at 390 (09aj_juice.js:158) | **FIXED** (in the frame checked) | Same steps as G19, `brewmaster=1&brewmasterauto=win&brewmasterpart=3` at 390, screenshot 1 s into the replay. The Brewmaster and his mallet are in frame, with no wall in front. Canvas 0-390, letterbox 390, scrollWidth 390. |
| R-055 B1: Compression King tell box at 390 | **FIXED** | `.dtell` no longer runs off screen at 390 (G16 measured -32..422). New: a transient `ckpop word` damage-word pop measured -40..302 (N3). |
| R-056 B1: Chompy cane/purse after a fish or crab crosses the threshold | **FIXED** | Seeded chompy 98, then one PERCH: chompy 102, cane **true**, still true after reload. Seeded 238 (cane true), then one BLUE CRAB: chompy 244, purse **true**, still true after reload. |

## 3. Chip Kid rework (`?duel=chipkid`) vs R-032

| R-032 finding | Now | Status |
|---|---|---|
| Mashing SWING wins | `duelbot=mash` at 390 wins in 71 s with grade A (the win bot gets S). The 09c header records Brad's brief: "it should be easily beaten" | Changed by design: mash still wins but scores lower. Not a bug under the new brief |
| Tell / POWER READY text overflows at 390 | `?duel=chipkid` at 390: nothing off screen, scrollWidth 390 | CLOSED |
| HOMAGE risk: bonneted pigtail kid too close to a real snack mascot | Reworked into an original pilot: purple flight helmet with an antenna, goggles, messy indigo hair, teal jumpsuit. Original purple/teal/lime "CRUNCH-O-TRON" mech with no snack-brand palette (09c_chipkid.js:4-7) | CLOSED (from code. I didn't zoom in on the kid model in a screenshot) |

Other Chip Kid results:
- Lose (`duelbot=lose&ckhp=5`) reached chipkid:lose:can in 15 s. PASS.
- The win plays exactly 1 replay.

Fun check: the specials rotate (cyclone / mallet / homer in G19's win log), the KO gets a replay, and the grade separates skill (S) from mashing (A). That fits the "easy, flashy" brief. Real thumb feel at 390 is UNTESTED, because the bot has no touch input.

## 4. City boot

| Viewport | Own errors | Overflow | Notes |
|---|---|---|---|
| 390x844 | 0 page errors, `__celErr` 0 | none (scrollWidth 390) | Boots to the street with the panel |
| 1280x720 | 0 page errors, `__celErr` 0 | none | First try, 60 s. Harold and Mavis on the promenade by the Constellation, radio ticker, minimap, HUD |

Brewmaster ACT label (code read, 09w_brewmaster.js:740-748): "BREWMASTER: N LEFT" until every other boss is cleared, then "FIGHT BREWMASTER", then "REMATCH BREWMASTER". On a fresh save N counts all the other bosses, so it reads as a sensible lock. I didn't walk to the brewery ring in a run.

## Bugs (new or open)
- **N1 (minor)** The purse upgrade unlocks but still does nothing. `save.purse` is never read anywhere in 09x (only `save.cane` changes the reel rate). G18 #6 is still open.
- **N2 (minor)** `save.casts` isn't saved on cast. It's bumped at 09x_fishing.js:211, but only saved on a catch, so a reload loses the last cast (2 became 1 in both seeded runs). Fix: call `persist()` after `save.casts++`.
- **N3 (note)** Compression King at 390: a `ckpop word` damage pop was measured at -40..302 (partly off the left edge). It's short-lived, but pops should be clamped to the viewport.
- **N4 (note)** G19 N3 is still open. Rodney's WIN card arrives late after the winning goal (desktop and 390).
- **N5 (note)** Chip Kid can still be beaten by mashing (grade A). This is by design under the "easily beaten" brief. Listed so Hark can confirm.

Bugs by severity: blocker 0, major 0, minor 2, note 3.

Closed since G19: G19 B1 (replay camera), R-055 B1 (tell box), R-056 B1 (Chompy threshold), R-032 390 overflow, R-032 kid HOMAGE risk.
Still open: G19 B2 (Carl duelbot speed, not rechecked), G19 N1 (part 1 brewmasterhp), G19 N2 (no `tcb:finale` listener), G19 N3 / N4 (Rodney card), the purse effect (N1).

## Fix first (5 lines)
1. Give the purse upgrade an effect: read `save.purse` in 09x (for example, more Chompy points or a sixth line). It's a dead reward right now.
2. Call `persist()` on cast (09x_fishing.js:211).
3. Shorten Rodney's post-win outro, or show the WIN card during it (09m_rodney.js).
4. Clamp the JUICE/duel pops to the viewport at 390 (Compression King `ckpop`).
5. Wire the `tcb:finale` listener (celebration and drone unlock) so the finale has an ending.

## Self-check
- Cells: 16/16 mode x viewport x win/lose (6 new in G20).
- Extras: 3 bug retests, 3 Chip Kid checks (mash, lose, 390 layout), 2 city boots, the Brewmaster label. That's 14 cells run in G20.
- Bugs by severity: 0/0/2/3.
- Closed vs open listed. 5-line fix list given.
