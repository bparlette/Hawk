# Parallel builder brief (shared by every Hark build thread, 2026-10-12)

Game: Toad City Baltimore, a three.js browser game. Live: https://toad-city-baltimore.surge.sh. Root: /workspace/work/toad-city.
Read first: DESIGN.md (all of it, especially the 2026-10-12 sections and fit tweaks), PROGRESS.md (last 15 lines), and /workspace/memory/toad-city-baltimore.md.
Copy the patterns of the existing set-piece modes in game-int/src: 09_fort.js (standalone set piece), 06g_derby.js, 09a_duel_core.js + 09b_jimmy.js + 09c_chipkid.js (duels, rig hooks with stand-ins), 06h_racers.js (chase/race), 06v_vic_rhythm.js, 06g0_boss_clear.js (BOSS_CLEAR.clear(<district>)), 07_main.js (frame hooks, ACT entry labels), 08_radio.js (duckTo/hold when a mode owns audio). Test harness and scripts: game-int/T/ (int2, int3 runners, ccheck, dc.js); build/run commands are in game-int's README or the T/ scripts.

## Your worktree
- `cd /workspace/work/toad-city/game-int && git worktree add ../game-<feature> -b hark/<feature> hark/integration`. Work ONLY in that worktree. Never commit to hark/integration, never deploy, and never touch other worktrees. The hourly thread integrates and deploys finished branches.
- Add new code as new src files (for example `src/06p_pete.js`). Keep edits to shared files (07_main.js, 08_radio.js, 01_core.js, index/build list) small and append-only, because 4 builders run in parallel and every branch has to merge cleanly. Put a one-line comment `// <feature>:` on each shared-file hunk.
- The sandbox has only 2 CPUs. Run EVERY headless Chrome / node render test through `flock /workspace/work/toad-city/locks/chrome.flock <cmd>` so only one runs at a time. Keep tests short (scripted ?auto paths, at most a ~60 s sim each).

## Done means
- A test URL param enters the mode directly (e.g. `?pete=1`) and an auto param scripts a win/lose (e.g. `&peteauto=win|lose`).
- An in-city entry: an ACT label at the anchor DESIGN.md gives, or a clearly marked temporary anchor if that landmark isn't built yet. Say which in the commit.
- Characters not delivered by Opus get procedural stand-in rigs behind a `build<Name>()` hook (with the contract written in the file header) so real rigs drop in later.
- A win calls BOSS_CLEAR.clear('<district>') where DESIGN says so. Lose = retry. Exit restores the city, camera, radio and controls.
- Touch + keyboard + gamepad controls follow the existing modes' conventions (arcade stick, SWING/JUMP/ACT).
- Headless: win and lose paths pass at 390x844 and 1280x720 with 0 own console errors, city ccheck has 0 own errors, and city draw calls are within ~10% of hark/integration.
- Save a 390-wide screenshot to /workspace/work/toad-city/assets_preview/<feature>_390.png and look at it (read_file) to check that it reads well.
- Commit on hark/<feature> with "tests passed" in the message. Append one line to PROGRESS.md: time ET, branch, commit, what it does, tests, test params.
- Remove /workspace/work/toad-city/locks/<feature>.lock when done (or write BLOCKED: <reason> into it if you give up).

## Rules
Never delete or replace completed assets. No deploys, no pushes except optional `git push` of your branch to bparlette/Hawk (github credentials) for backup. No money, posts or YouTube. Homages per /workspace/work/hawk-relay/relay/briefs/HOMAGE.md: original characters, no real people, mascots or logos on characters. Real storefront signage (Hooters, Lexington Market lettering) is drawn procedurally, never from copied logo files; refs/ images are reference only and never shipped.
Grok writing is in /workspace/work/hawk-relay/content/*.json. Wire in lines for your feature if they exist (for example the Wheelie Kings or Pigeon taunts); otherwise write short placeholder lines.
If a test loops failing more than twice on the same issue, commit what works with "WIP" and note the blocker in PROGRESS.md and the lock file.

## lexington status (13:24 EDT 2026-10-12)
Built, uncommitted in game-lexington. Lock still held but builder agent has ended — treat lock as stale. Remaining: T/lex/run.sh (draw calls vs game-int + 1280 + re-shots), trim if >10% dc (merge Westminster into Lexington build, or drop outline hulls on small pieces), commit 'tests passed' on hark/lexington, PROGRESS line, remove lock.

## carl status (13:54 EDT 2026-10-12)
Built, uncommitted in game-carl (src/09k_carl.js). Builder ended; lock stale. Win/lose/entry pass. Remaining: re-measure city draw calls at door (-86,-79) — measured +65% likely noise; ccheck 390; commit on hark/carl; PROGRESS line; remove lock. Carl uses own landmark 'duckpin' (district lexington) — accept.

## Queue additions (Brad, 2026-10-12 14:06) — see DESIGN.md "Brad's additions 14:06"
- poe-night (stealth + catacomb horror chapter) — needs lexington merged (POE_ANCHOR, catacomb hatch)
- stoop-defense (Hold the Stoop tower defense)
- rooftop-run (Fells Point 2.5D platformer)
