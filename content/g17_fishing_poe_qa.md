# G17: QA of Harbor fishing + Chompy and Poe stealth night (P-053)

Build: review/integration-4e2f8d0 (worktree HEAD 3115282, snapshot of hark/integration 4e2f8d0), site/ served locally.
Method: headless Chromium + Playwright (SwiftShader), same harness as G16. Every command was capped at 120 s, using the test-bot hooks `fishauto` / `poeauto`. Win = `exit:<id>:win` in `__duels.log`. Lose + retry = the lose screen appeared and the bot pressed RETRY (`retry` in the log). Persistence = read localStorage, then reload the page with no params in the same browser context. Mobile ran at 390x844 with touch, 60 s after load. Template: g3_qa_template.md.

## Results

| Cell | Harbor fishing + Chompy (09x_fishing.js) | Poe stealth night (09y_poe.js) |
|---|---|---|
| Start | PASS (`?fish=1`, spots broadway / p3 / default p1) | PASS (`?poe=1`) |
| Win | PASS. Night at Broadway: 5 catches in 79 s. Day at p3: 5 catches in 68 s | PASS (40 s), flow only: the win bot turns detection off (st.ghost, per the header), so real sneaking wasn't checked |
| Lose | PASS (3 snaps, 30 s) | PASS (SPOTTED, 16 s) |
| Retry | PASS | PASS |
| Mobile 390 | PASS (scrollWidth 390, nothing off screen, CAST/REEL/LEAVE labels) | PASS (SNEAK/OFFER/PEBBLE/LEAVE labels, SPOTTED card fits) |
| Controls | UNTESTED (no key log, as in G14-G16) | UNTESTED |
| Softlock | PASS (no stalls, wins exit to the city) | PASS |
| City entry by ring | UNTESTED (rings not reachable headlessly in the cap) | UNTESTED |
| Save / flags | FAIL (B1) | PASS |

Feature checks I verified:
- Ghost lantern: from fresh storage, the first night cast at Broadway (`fishspot=broadway&fishnight=1`) landed GHOST LANTERN, and save.lantern=true.
- Day and night lists are separate. Day at p3 caught PERCH, BLUEGILL and BLUE CRAB. Night at Broadway caught LANTERN, BUCKET, BOOT, CRAB and KEY.
- Junk feeds Chompy (+20 each, save.junk 2). Fish and crabs also add 4 and 6 (09x_fishing.js:192). That isn't what the header says ("junk only feeds him"), but the code does it on purpose.
- The sunken key landed on the bot's 5th night cast, which is a normal roll (3%, or 6% on a perfect cast, 09x_fishing.js:60).
- Fishing save (`tcb_fish`) survives a reload: caught, bucket, junk, chompy, lantern and key all came back.
- Poe save (`tcb_poe`): feather=true and clears=1 after the win, and both survive a reload, with hasNevermoreFeather() true. In a fresh context with no params, hasNevermoreFeather() is false, so the Raven King gate (09v_ravenking.js:514) applies. A lose records spotted=1.
- No page errors in any run.

## Signage check
HOMAGE.md isn't in the branch. I checked against the no-real-brands rule.
- Fishing: there's no sign text in 09x. Chompy is an original stand-in (09x_fishing.js:88). Spot names are public places (Harborplace, Constellation pier, Aquarium, Power Plant, Broadway pier). Clean.
- Poe: the HUD shows only CROW WATCH, ROSES/BOTTLE and PEBBLES. There's no brand text. The item name "NEVERMORE FEATHER" uses NEVERMORE, which is on the R-052 banned-term list (N1).

## Bugs
- B1 (major) Chompy upgrades are lost if a fish or crab crosses the threshold. At 09x_fishing.js:195, `before` subtracts 20 only for junk. When a fish (+4) or crab (+6) takes save.chompy past 100 or 240, `before` already counts the upgrade, so `after.slice(before)` is empty. Then cane or purse is never set, and no later catch sets it. Steps I reproduced: seed localStorage tcb_fish={chompy:98}, then `?fish=1&fishspot=p3&fishauto=win`. After one STRIPED ROCKFISH: chompy 102, cane false, and no BURP line. Fix: subtract the points actually added (`- gained`).
- N1 (note) The "NEVERMORE FEATHER" name and `hasNevermoreFeather` use the banned term NEVERMORE (09y_poe.js:8, :20). Hark needs to make the policy call, same as G16 N3.
- N2 (note) `hasNevermoreFeather()` returns true for any `?duel`, `?duels` or `?feather` param, or when a bot is running (09y_poe.js:20). That's fine for tests, but those URLs skip the gate.
- N3 (note) The Poe win bot runs with detection off, so cone, line-of-sight and sneak logic were not covered by this QA. Only the `__poe.seen()` unit test mentioned in the header covers it.

## Self-check
- Both modes covered: Harbor fishing + Chompy, and Poe stealth night.
- Signage check done: fishing is clean, Poe has 1 banned-term note.
- Bugs by severity: blocker 0, major 1, minor 0, note 3.
- Cells: 18 in total (2 modes x 9). 13 PASS, 1 FAIL, 4 UNTESTED (controls x2, ring entry x2).
