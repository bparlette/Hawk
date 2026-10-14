# Toad City Baltimore: couch 2-player co-op (branch `hark/coop`, Hawk mirror `toadcity/coop`)

Owner: Hark. Worktree `/workspace/work/toad-city/game-coop`, cut from `hark/integration` dc8d1d6 (2026-10-14).
Brad's brief (2026-10-14): drop-in second controller, shared screen while together, a forgiving split that only happens when a
player *intentionally* leaves, smooth merge on reunion. Final scope: open world is true 2-player; everything that would need a
major rework (every boss, every own-scene minigame) is **turn rotation**: P1 plays first, then P2 gets a turn.

## 1. Who is Player 2
P2 plays **Mavis** (Harold's wife, the purse-swinging AI partner who is already in the world). No new character, no new rig:
when P2 joins, Mavis's AI is switched off and her pad drives her; when P2 leaves (pad unplugged, or hold Start 3 s) she
goes back to AI. With no second pad, nothing changes: Mavis stays AI and the game is byte-for-byte the same code path.

## 2. Drop-in controls (Gamepad API, standard mapping: Xbox Wireless over USB or Bluetooth, Mac ES-DE Electron build)
- **P1** = keyboard + touch + the first pad that sends any input (sticky claim). Until a pad claims P1, every pad drives P1
  exactly as today (protects against phantom pads sitting at index 0).
- **P2 joins** by pressing **Start (Menu, button 9) or A (button 0)** on any other connected pad. Banner `PLAYER 2 JOINED: MAVIS`.
- P2 in the city: left stick move, A jump, X or B purse combo (3 hits, 3rd is a spin), jump + X = air slam,
  Y = ACT (hold next to a downed Harold = revive), right stick / LB / RB = orbit P2's own camera when split.
- P2 leaves: pad disconnect / controller turned off, or hold Start for 3 s (web; in the desktop build a Start tap is pause, the
  hold still works on the web only if the pause screen isn't up). Mavis goes back to AI.
- Desktop (ES-DE Electron) wrapper: Start = pause there; the wrapper skips its pause for a Start press that just joined P2
  (`C.joinAt`, branch toadcity/desktop preload.js). Pressing A on the 2nd pad also joins and never pauses.
- Back/View on either pad opens the full map (as today).

## 3. Camera: shared, held at the edge, intentional split, merge
- **Shared view** while together: one camera framing the midpoint of both toads; it pulls back and tilts down as they spread
  (up to `MAXSEP` = 13 m apart). Both right sticks may orbit it.
- **Held at the edge**: past `MAXSEP` the toad moving away is held (its away-from-partner motion is removed). Knockback,
  jumps, cinematics are clamped the same way, so nothing ever breaks the shared view by accident.
- **Intentional split**: a player splits off only when ALL hold for **2.0 s continuously**: in a normal walk state
  (`move`), at the edge (separation >= MAXSEP - 0.3), stick held (> 0.5) pointing away from the partner (dot > 0.45).
  A 0.15 s grace absorbs stick jitter; anything else (letting go, turning back, being hit, jumping, attacking, cutscene)
  resets the timer. A small ring fills over the toad's head during the 2 s (`→ SPLIT`).
- **Split**: two independent views (side by side in landscape, stacked in portrait), each an over-the-shoulder
  camera like single-player, P1 left/top. Same world, same thugs, same crime meter.
- **Merge**: when both are on the same level and within `MERGE_D` = 9 m for 0.4 s, the P2 view slides away and P1's view
  eases into the shared camera (0.6 s). Mode exits, game-over resets and vehicle boarding force an instant merge.
- **Perf in split**: second view skips the shadow-map update, both cameras far 260 -> 125 with fog pulled in to 95 m (sky dome
  shrunk to 0.6x so it stays inside), touch devices render at 0.8x resolution, far thugs sleep by distance to the nearer toad.
  Measured (swiftshader, tests/coop/perf.js): split = 159 draw calls at 390x844 / 130 at 1280x720, vs 116-259 for a normal
  single-player city view (ccheck drawcalls), i.e. split costs about one normal view, not two.

## 4. Easy vs hard classification
| Part | Type | How |
|---|---|---|
| Open-world street fights, thugs, QTE dizzy finisher (P1), POWER (P1), revive (both ways) | **True 2P** | Thugs already target the nearer toad; P2 hits credit kills |
| Gang turf / crime meter / district progress (09zi, 09zh) | **True 2P** | KOs count by thug state, so P2's KOs credit the shared meter |
| Landmark popups, minimap, full map | **True 2P** | Both dots already drawn; popup follows P1 |
| Fire-escape ladder BOOST (P1 ACT, Mavis cups hands) | **True 2P** | Scripted states run through Mavis's existing code, then control returns to P2 |
| Roof level mismatch | auto | In shared view P2 is puffed to P1's level; in split P2 is puffed over when back within merge range |
| City vehicles / skateboard / boat (RIDE) | ride-along | P2 rides along (Mavis hidden, view merged) until P1 gets off, then pops out beside P1 |
| Water taxi / paddle rides, sewer / climb transitions | ride-along | No rotation (transport, not a challenge) |
| **All bosses** (every DUELS-core duel, Derby, Vic rhythm, Fort bombardment, Al chase, Duchess, Pigeon, Carl, Brewmaster...) | **Turn rotation** | P1 plays (pad input to the mode = P1 only); on exit a `P2'S TURN` card: P2 A = play the same fight, B = skip |
| Own-scene minigames (fishing, Bike Life, Grand Prix, Poe night + catacombs, Phantoms, Rooftop Run, Hold the Stoop, Rodney lacrosse...) | **Turn rotation** | Same flow |
| Finale celebration / drone | P1 only | Event-triggered, not replayable; P2 watches |

Turn rotation: during a mode only the active player's pad is visible to the mode (`navigator.getGamepads` is filtered),
keyboard/touch stay with P1. The partner inside a mode is whatever AI that mode already has (Mavis crab cakes etc.).
Progress (boss clears, crime) is shared. P2's turn reuses the ring's own `go()`, so a cleared boss replays as its REMATCH.

## 5. Implementation map
- `src/06cc_coop.js` (new): COOP state, pad roles + join/leave, P2 input, `coopUpdateP2` (Mavis player control; delegates
  scripted states to `updatePartner`), separation hold + split timer, shared / split cameras, split render, edge ring + HUD,
  turn rotation (mode detection, gamepad filter, `P2'S TURN` card), test hooks `window.__coop`.
- `src/06_game.js`: `readInput` asks `COOP.padRole(gp)` (unchanged when COOP is off); `updateCamera` refactored into
  `updateCameraFor(C, cam, h, inp, lock)` with the old call identical.
- `src/06b_cine.js`: `tryAction` notes the action (`COOP.noteAct`) so a P2 turn can replay it.
- `src/07_main.js`: one branch each: P2 update instead of the AI, separation hold after the sim, coop camera step,
  coop draw, thug sleep distance by nearer toad, mode-exit hook. All guarded by `COOP.on`.
- Tests: `T/coop/*.js` (gitignored T/ like the rest) + copies under `tests/coop/` (tracked) so CI / others can rerun.

## 6. Test plan
Existing suite (big change): Hawk CI full matrix (every boss win+lose 390x844, city 390x844 + 1280x720) on `toadcity/coop`,
plus local `ccheck.js` / `dtest.js` smoke at 390x844 and 1280x720, zero own console errors.
New `tests/coop/coop.js` (two simulated gamepads via an injected `navigator.getGamepads`), at 390x844 and 1280x720:
1. single-player unchanged: no second pad -> COOP off, Mavis AI, one render per frame, P1 pad drives Harold.
2. join: pad 2 presses Start -> COOP on, Mavis follows pad 2.
3. shared camera: both visible on screen (projected inside the viewport) at 2 m and at 12 m apart.
4. accidental-split resistance: hold away 1.5 s -> no split; knockback past the edge -> no split, held; jump spam -> no split.
5. intentional split: hold away 2.2 s at the edge -> split, two viewports.
6. merge: walk back together -> one view within ~1.5 s.
7. mission credit: P2 KOs a thug while split -> S.kills and gang KOs go up.
8. boss with 2 players: start a duel (Chip Kid) -> only pad 1 drives it; exit -> P2'S TURN card -> P2 A -> duel restarts
   with pad 2 driving; exit -> back to city merged, Mavis under P2 control.
9. leave: pad 2 disconnects -> COOP off, Mavis AI again, single view.
Screenshots: `shots/coop_shared_*.png`, `shots/coop_split_*.png`, `shots/coop_turn_*.png`.

## 7. Milestones
- [x] M0 plan (this file), branch + Hawk mirror
- [x] M1 pad roles + join/leave, P2 controls Mavis in the city
- [x] M2 shared camera + edge hold + intentional split timer + indicator
- [x] M3 split render (two viewports) + merge animation + perf trims
- [~] M4 vehicles / roofs / cine / game-over / mode exit edge cases (coded: level puff, far puff, far-KO auto revive after 8 s, instant merge on mode exit / game over; water taxi + paddle boat are RB own-scene rides so both toads ride along automatically; not separately tested yet)
- [x] M5 turn rotation for bosses + minigames (gamepad filter + P2'S TURN card)
- [ ] M6 coop tests + full regression (CI matrix + local smoke) + screenshots
- [ ] M7 merge latest hark/integration, deploy, push toadcity/integration (+ Hawk main code/toad-city copy if present), desktop package note

## 8. Status / what's left
(updated with each commit)
- 2026-10-14 15:35 ET: plan written, nothing built yet.
- 2026-10-14 16:45 ET: src/06cc_coop.js built + hooks (06_game readInput/padRole, updateCamera -> updateCameraFor, rigLod; 06b tryAction -> COOP.noteAct;
  07_main pre/preStep/updateP2/step/cam/post/draw + split-safe pause draw + resize resK). tests/coop/coop.js: 1280x720 all 21 checks PASS, 0 errors
  (single-player unchanged, join, shared cam, 1.5 s hold / knockback / jump spam / broken pushes don't split, 2 s push splits, mission credit
  while split, merge, Chip Kid duel P1 turn -> P2'S TURN card -> P2 turn, leave). Run: `node tests/coop/coop.js <port> <w> <h> [shotDir] [sim]`
  (`ONLY=boss` skips the camera block). Note: screenshots pause the sim via `__cel.pause` (frames keep running during a capture otherwise).
- Implementation notes for whoever continues: COOP.on false => original code path everywhere. Shared cam = `sharedCam()`; P1 split cam =
  the original `camStep`; P2 split cam = `updateCameraFor(CAM2, camera2, partner, IN2, ...)`. Split draw = `draw2()` (RT.viewport/scissor,
  2nd view skips the shadow-map update). Turn rotation = `navigator.getGamepads` override (only filters while `C.mode` is set) + `pre()`.
