# G22: QA of the finale payoff, drone mode, credits and the Cobblestone storm + G21 retest (P-059)

Build: review/integration-4ff78b9 (worktree HEAD f18b22a, snapshot of hark/integration 4ff78b9), site/ served locally.
Method: headless Chromium + Playwright (SwiftShader), same harness as G21. Every command was capped at 120 s. Load was low.
- Viewports: 390x844 with touch, and **640x360** as the desktop size. City boot also ran at 1280x720.
- Template: g3_qa_template.md. HOMAGE.md applies to characters, and DESIGN's real-signage rule to signs.

## 1. Finale (`?finale=1&finaleauto=1`, src/09z_finale.js)

| Cell | Result | Evidence |
|---|---|---|
| Full run, 390 | PASS | Phases dock → card → cred → off. Log: start, cheer, hug, card, drone:unlocked, credits, finish, city:saved:0. 34 firework bursts. 0 errors |
| Full run, 640x360 | PASS | Same log, 33 bursts, 0 errors |
| Text fits at 390 | PASS | Nothing in the finale overlay runs off screen in the dock, card or credits phases. The only off-screen element is the scrolling radio ticker, which is expected. The Mavis line box, TAP TO SKIP, SKIP ▸▸ and the credits list are all inside 390 |
| Credits contents | **FAIL** (B1) | 19 bosses + final "The One-Eyed Brewmaster" + 44 radio tracks. The 19 are the landmark bosses plus Pete, Rodney and Carl. **Dragon Boat Duchess is missing**: she's roster #7 in DESIGN, but as a roaming boss she isn't in the brewery gate list that the credits use (09z_finale.js:296) |
| HOMAGE check on the credits | PASS | Every boss name is original. The landmark subtitles use real place names (allowed under the real-signage rule). The radio credits name the real artists/producers as DESIGN requires. No real mascot names (Boh, Utz, the Oriole Bird and so on) |
| CITY SAVED + save | PASS | Banner "CITY SAVED!" and chip "CITY SAVED · CRIME 0%". After reload, tcb_finale {saved:true, drone:true} and the chip and the DRONE button are still shown |

Tap-skip (dock → credits → city) ran through the auto timing. The SKIP ▸▸ button and the key skip are wired (09z:101, :284-285, :351), but a real tap-skip is UNTESTED (the bot doesn't tap).

## 2. Drone mode

| Cell | Result | Evidence |
|---|---|---|
| Enter/exit, 640 | PASS | Save seeded with drone:true. V → body.drone, DR.on. Esc → off. V again → on, V → off |
| Enter/exit, 390 | PASS | Same. The drone HUD shows ✕, DOWN/UP/LAND labels and "STICK FLY · DRAG TURN · JUMP UP · SWING DOWN · ACT LAND" |
| Can't get stuck or fall out | PASS | 8 s dive: stops at y 1.8 (ground + 1.6, 09z:423). 10 s forward, then 10 s climb to y 78-87 (cap 110). X/Z are clamped to the world bounds (09z:422). Leaving always worked |
| Unlock saved after reload | PASS | See the finale save above |

## 3. Captain Cobblestone, started by day (`&tod=0.1`)

| Cell | Result | Evidence |
|---|---|---|
| Win, 640 | PASS | Storm intro (cobblestone:storm, then storm:end), then the fight. Phase 3 win in 63 s, 1 replay, clear `constellation` |
| Win, 390 | PASS | 61 s, same flow |
| Lighting after exit | PASS | The city screenshot after the win is daytime (2:20 PM, full sun), not storm-dark |
| Lose + retry, 390 | UNTESTED | No lose within 100 s, even from phase 3. Harold's HP drained slowly (21 at 100 s with heals). There's no `cobblestonehp` hook (N2) |
| Lose + retry, 640 | UNTESTED | Same |

## 4. G21 retests (this build, by code read + run)

| G21 item | Status | Evidence |
|---|---|---|
| B1: Phantoms HUD line "GHOSTS 10LANTERN READY (K)" | OPEN | 09z_phantoms.js:135 is unchanged |
| B2: Phantoms ring visible by day | OPEN | 09z_phantoms.js:289 still `d < 20 && !DUELS.cur`, with no `isNight()` |
| N1: casts not saved on cast | OPEN | casts went 2 → 1 after reload. 09x_fishing.js:211 is unchanged |
| N2: duplicate `retry` log | OPEN | 09z_phantoms.js:142 still pushes 'retry' |
| N3: purse has no effect | OPEN | 0 reads of `save.purse` in 09x |
| N4: JUICE fallback replay on side missions | OPEN | No opt-out in 09aj_juice.js |

## 5. City boot

| Cell | Result |
|---|---|
| 390x844 | PASS: 0 page errors, `__celErr` 0, nothing off screen |
| 1280x720 | PASS: first try, 0 errors |

## Bugs
- **B1 (minor)** Dragon Boat Duchess is missing from the credits. The list comes from `__brewmaster.gate.others()` (09z_finale.js:296), which only holds landmark bosses. Fix: add the Duchess explicitly (and anyone else off the landmark list), or credit from the DESIGN roster.
- **B2 (minor)** The radio station-ID card ("B-MORE 410 RADIO · NOW PLAYING …") drops over the top of the dock scene at 390, even though the finale holds the radio (09z:271). Seen in the dock screenshot. Fix: hold or hide the station card while `body.finale` is set.
- **N1 (note)** The `finaleauto` scripted drone flight (3.5 s) hadn't landed 6+ s later. The log ends at `drone:on:auto` with no `drone:off:auto`, and `lastOn` stays true (09z:415, :433). This is probably slow sim time under SwiftShader. Worth checking that auto mode exits on wall-clock time too.
- **N2 (note)** Cobblestone has no HP hook, so lose + retry can't be checked inside the cap (09u_cobblestone.js:253). Add `cobblestonehp`, like `compkinghp`.
- **N3 (note)** The drone has no collision with buildings (only the ground and ceiling clamps). This is probably fine for a sightseeing mode.
- **N4 (note)** At 390 the "Toad City · P1" chip covers the area label (`≡ · HARBORPLACE`) in the city and drone views.
- Carried from G21, all still open: Phantoms HUD B1, day ring B2, casts N1, duplicate retry N2, purse N3, side-mission replay N4.

Bugs by severity (new in G22): blocker 0, major 0, minor 2, note 4. Carried open: 2 minor + 4 note.

## Fix first (5 lines)
1. Add Dragon Boat Duchess to the credits (09z_finale.js:296).
2. Phantoms ring night-only: `&& isNight()` (09z_phantoms.js:289). Still open from G21.
3. Hide the radio station card during the finale (09z_finale.js:271).
4. `persist()` on cast (09x_fishing.js:211). Still open from G20.
5. Add a `cobblestonehp` test hook and a wall-clock exit for the auto drone flight.

## Self-check
- Cells tested: 17. That's finale 6, drone 4, Cobblestone 5, boot 2.
- PASS 14, FAIL 1 (credits), UNTESTED 2 (Cobblestone lose ×2).
- Plus 6 G21 retests: 0 closed, 6 open.
- Bugs by severity given. Closed vs open listed. 5-line fix list given.
