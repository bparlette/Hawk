# G19: QA of the finale and the Penthouse Pigeon (P-056)

Build: review/integration-455f159 (worktree HEAD 1565aba, snapshot of hark/integration 455f159), site/ served locally.
Method: headless Chromium + Playwright (SwiftShader), same harness as G17. Every command was capped at 120 s (92 s of page time). Win and lose used the bot hooks.
- Win = `exit:<id>:win` in `__duels.log`.
- Lose + retry = the lose screen appeared and the bot pressed RETRY (`retry` in the log).
- Replays = `__juice.replays`.
- Clear = localStorage `tcb_boss_clear`.

Viewports:
- Mobile: 390x844 with touch.
- Desktop: **320x180, not 1280x720**. The shared box was at load 30+, so SwiftShader couldn't finish 1280x720 runs inside the 120 s cap. Desktop cells are therefore logic checks at a small canvas, not layout checks at 1280.

Signage: real signs are allowed under DESIGN's real-signage rule (Oct 11), so none are flagged. Characters follow HOMAGE.md. The Brewmaster and Pigeon are original stand-ins (`standin` in the log), with no real mascot.

## Cells (mode x viewport x win/lose)

| Mode | Desktop win | Desktop lose | 390 win | 390 lose |
|---|---|---|---|---|
| One-Eyed Brewmaster (09w) | PASS (part 3, 95 s, 1 replay, grade S) | PASS (part 3, hp 5: lose:part3:spin -> retry -> retry:part3) | PASS (part 3, 61 s, 1 replay, clear `brewery`) | UNTESTED |
| Penthouse Pigeon (09d_pigeon) | PASS (full from part 1, pigeonquick, seed 7: 89 s, score 18300, splash, 1 replay, clear `wtc`). Part 2 only: PASS in 51 s | PASS (part 1: lose:heli -> retry. Part 2: lose:dive -> retry) | PASS (part 2, 59 s, 1 replay) | UNTESTED |
| Kingpin Carl (09k) | UNTESTED | UNTESTED | PASS (carlauto, 86 s, 1 replay, clear `duckpin`) | PASS (88 s, retry) |
| Riptide Rodney (09m) | UNTESTED | UNTESTED | PASS (5-3, rodney:win, clear `rashfield`, 1 replay. The WIN card was still pending at the cap) | PASS (0-5, 47 s, retry) |

Cells: 16 in total. **12 PASS, 0 FAIL, 4 UNTESTED** (Brew 390 lose, Pigeon 390 lose, Carl desktop win/lose, Rodney desktop win/lose). Carl and Rodney desktop were covered on the older build in G16 (4d14075).

Brewmaster extra checks:
- Part transitions: from part 1 the win bot logged `flee -> part2 -> crash -> part3` in 66 s. PASS.
- Retry loop: retry restarts at the part reached (`retry:part3`). PASS.
- Ending: on the KO, `bossCleared('brewery')` and the `tcb:finale` event fire (09w_brewmaster.js:479-480). The celebration and drone that should follow aren't built (09w:19 says "not built here").
- Final KO fires exactly 1 replay (`brewmaster:ko -> juice:replay -> grade -> exit`). PASS.
- Part 1 lose: with `brewmasterhp=5`, no lose within 92 s (N1).

Pigeon extra checks:
- Climb into the ground fight, with grabs, finish, knock-downs, harbor `splash` KO, then the replay. PASS.
- Window pop-ups and per-face cracks weren't checked one by one. The log has no per-window events, so only the path from the 5-face climb into the collapse was confirmed (by the part 1 win run).

## Shared JUICE KO replay (09aj_juice.js)

| Fight | Replays per final blow | Notes |
|---|---|---|
| Chip Kid | 1 | chipkid:ko -> juice:replay -> win (80 s) |
| Compression King | 1 | compking:ko -> juice:replay -> win (46 s) |
| Penthouse Pigeon | 1 | splash -> juice:replay -> win (3 runs) |
| Brewmaster | 1 | ko -> juice:replay -> win (2 runs) |
| Carl / Rodney | 1 | the fallback replay before the WIN card (they don't call JUICE.ko) |

390 viewport during the replay (Brewmaster):
- The canvas spans 0-390 and the letterbox overlay is 390 wide. scrollWidth stays 390. "FINAL BLOW · REPLAY" and "TAP TO SKIP" sit inside the screen. PASS.
- But the orbit camera passed through a prop, and a tan surface filled most of the frame (B1).

No page errors in any run.

## Bugs
- **B1 (minor)** The replay orbit camera clips through scene geometry. Steps: `?brewmaster=1&brewmasterauto=win&brewmasterpart=3` at 390x844, screenshot 1 s into the replay. A wall-sized surface hides the final blow. Code: 09aj_juice.js:158-159 places the camera at FOC+V0 with no occlusion or near-clip check. Fix: pull the orbit radius in, or raycast to the focus and shorten.
- **B2 (minor)** The spec's hook `?duel=carl&duelbot=win` plays at normal speed, so it doesn't finish in 92 s (at 390 the log only showed `start:carl`). The 5x bot speed applies only with `carlauto` (09k_carl.js:119, :415). Fix: also set `spd` when `DUELS.bot` is set.
- **N1 (note)** Brewmaster part 1 lose doesn't arrive inside the cap even at `brewmasterhp=5` (09w_brewmaster.js:320). The lose bot stands still, but the part-1 crab cake and second wind keep Harold alive. Part 3 loses in 74 s. Consider having `brewmasterhp` turn off heals, as `compkinghp` does.
- **N2 (note)** The finale ends at the WIN card. The `tcb:finale` event has no listener yet (celebration, drone unlock: 09w_brewmaster.js:19).
- **N3 (note)** After Rodney's 5th goal, the replay plus the KO outro push the WIN card past ~25 s at 390 under load. The clear and the replay fire right away.

Bugs by severity: blocker 0, major 0, minor 2, note 3.

## Fix first (5 lines)
1. B1: occlusion-safe replay orbit (09aj_juice.js:158-159). It affects every boss KO.
2. B2: the duelbot route for Carl should use bot speed (09k_carl.js:415).
3. N1: brewmasterhp should turn off heals so part 1 lose is testable (09w_brewmaster.js:320).
4. N2: wire a `tcb:finale` listener for the celebration and drone unlock.
5. G17 B1 is still open: the Chompy threshold (09x_fishing.js:195). It wasn't retested here.

## G18 gaps now closed
- Penthouse Pigeon mode: built and bot-verified (win and lose, harbor KO).
- One-Eyed Brewmaster in 3 parts: built and bot-verified (transitions, retry, clear).
- Carl's Mavis bonus frame: in code (`mavisEarned` / `mavisUsed`, 09k_carl.js:415). I didn't see it trigger in a run.
- Still open from G18: the crime HUD + win state (only BOSS_CLEAR keys), the celebration/drone, Grand Prix, Bike Life, the Phantoms city gang, and the Cobblestone lantern gate (not rechecked).

## Self-check
- Cells tested: 12 of 16 mode x viewport x win/lose (+ 4 replay fights + Brewmaster transitions).
- Bugs by severity: 0/0/2/3.
- 5-line fix list given.
- G18 closures: 3 confirmed.
