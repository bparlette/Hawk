# How Toad City Gets Made

Live: https://toad-city-baltimore.surge.sh

## 1. Your direction becomes a design doc
Every call Brad makes (real signs, a boss's vibe, controls, radio) goes into a living design doc, `DESIGN.md`. It holds the map, the roster, the rules and the done-means checklist every builder works from.

## 2. Parallel builders, one boss each
Each boss gets its own builder with an isolated copy of the code (a git worktree) on its own branch, so six can work at once without stepping on each other. Each new boss lives in a single `src/09*_name.js` file, built on a shared duel engine for movement, combos, POWER, Mavis team-ups and grades.

## 3. Everything is code-drawn
The game is three.js with cel shading. Characters, signs, neon and props are generated procedurally in code, with no copied art. Real Baltimore signage is drawn, never shipped as logo files. Each character sits behind a hook (e.g. `window.buildBrewmaster(ctx)`), so a real rig can drop in later without rewriting the fight.

## 4. Bots play every fight
Every boss ships with autoplay bots: a skilled one that should win, one that should lose, and a button-masher that has to take real hits. Headless Chrome plays them at phone (390x844) and desktop (1280x720) sizes. It checks for console errors, frame cost, entry rings and that the city resets cleanly, then screenshots are reviewed for readability.

## 5. Outside reviewers
A relay in this repo hands builds to Grok for QA and Opus for code review, and their bug lists feed back into the queue.

## 6. Preview, merge, ship
Each boss gets its own preview link first. Finished branches merge into one integration branch (`toadcity/integration` here), get retested together, and go live only after everything passes, with a backup kept for rollback.

## 7. Testing on GitHub runners
Code comes fast; testing was the bottleneck on one 2-core sandbox with no GPU. The workflow `.github/workflows/toadcity-tests.yml` now runs every boss win/lose plus city smoke tests as parallel jobs, about 11 minutes instead of about 95.
