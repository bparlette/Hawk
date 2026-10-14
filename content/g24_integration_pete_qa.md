# G24 · G3 regression QA: integration with Pete merged (review/integration-pete @ 0c44dfb)
Date: 2026-10-12 · Reviewer: Grok · Read-only (detached worktree, nothing built or pushed on that branch)
Template: content/g3_qa_template.md (v2). Brief: relay/HARK_TO_GROK.md P-031, relay/briefs/HOMAGE.md.

## Tool runs (tools from claude/new-session-z5ikqq, run on the 0c44dfb tree)
- `node tools/tc_lint.mjs .` exit 1: 255 ERROR / 0 WARN across 20 files. src/09d_pete.js has 11 (C2 Math.random x2, C4 light x1, C3 Mesh*Material x7, C7 frustumCulled x1). The lint targets asset deliveries, so whole-game files fail by design. Read the per-file counts as a baseline, not as a gate. Top files: 06h_racers 72, 09_fort 24, 09c_chipkid 23, 06g_derby 20, 08_radio 17, 06v_vic_rhythm 16, 09b_jimmy 18.
- `node tools/tc_canary.mjs . <12 boss-hook strings>` exit 0, 12/12 FOUND: DUELS.reg('pete'), the addTrigger calls for pete/jimmy/chipkid, PLAY BALL, CHASE AL, FIGHT VIC, boat_ambush, buildPitBeefPete, buildArabberAl, buildDragonBoatDuchess, EAT-OFF PETE.
- Bundle: `cat src/0*.js` passes `node --check` (PARSE_OK) and is byte-identical to site/game.js (cmp), so the shipped build matches src.
- Duplicate top-level declarations across src/0*.js: none. 09d_pete.js is a single IIFE and exports only window.__pete.

## Item 1: reachability and boss-hook collisions
- Pete registers through the shared duel core: `DUELS.reg('pete', P)` at 09d:420, with the trigger set at 09d:433 via `DUELS.addTrigger` (09a:202). Jimmy (09b:384) and Chip Kid (09c:381) use the same path with distinct ids. D.kinds is keyed by id, so the three cannot collide.
- Fort (09_fort.js:33, 'cannon'), Bobby derby (06g:616 'PLAY BALL'), Arabber Al (06h:570 'CHASE AL') and Vic (06v:550 'FIGHT VIC') push their own ACTIONS entries with separate coordinates. Duchess (06f0) is writing data only (boat_ambush) and has no trigger. None of them is touched by 09d.
- Key bindings: 09d adds no keydown listeners; its input goes through the duel core. No collision.
- Shared globals: Pete writes BOSS_CLEAR state directly when the Lexington landmark is absent (09d:443-450). See F4.

## Item 2: mobile 390 px HUD
- #peteui is at left 10 px, bottom 34 px, about 150 px wide (09d:198-204). It is only shown under body.duel-pete, which the core adds at 09a:162 and removes at 09a:173.
- The only other bottom element in #duel is .dhint, centred at bottom 10 px, nowrap, 9 px font, about 21 px tall (09a:43). That leaves roughly 3 px of vertical clearance, so no overlap on paper. The city HUD is hidden in duels (09a:12-14).
- UNVERIFIED: no 390x844 screenshot was taken. Evidence needed: ?pete=1&petenight at 390x844 with the hint visible.

## Findings (0 blocker / 3 major / 5 minor)
| # | Sev | file:line | Finding | One-line fix |
|---|---|---|---|---|
| F1 | major | 09d:424,431 | The Lexington landmark is not in this build (no 'lexington' in LANDMARKS), so the ring falls back to TEMP_ANCHOR (-118,-41), about 24 m north of Oriole Park (03_city.js:509). Whether that point is clear of building colliders and on walkable ground is UNVERIFIED. | Assert `groundY` and a collider probe at TEMP_ANCHOR in a test, or move it onto a known street centreline. |
| F2 | major | 09d:158 | The eat-off scene adds its own PointLight; hygiene rule I7 says no lights. This adds per-pixel cost on phones during the duel. | Bake the warm light into the toon colours or emissive, and drop the PointLight. |
| F3 | major | 09d:37,277 | Math.random drives course picks and taunts (C2), so `peteauto` bot runs can't be reproduced and I9 determinism fails. | Use the seeded RNG from 01_core (or a seeded LCG on P.st). |
| F4 | minor | 09d:443-450 | clearLex re-implements BOSS_CLEAR.clear (localStorage 'tcb_boss_clear', crime, log, fns, event), duplicating 06g0_boss_clear.js:7. It will drift if 06g0 changes. | Add `BOSS_CLEAR.clearDistrict(id, info)` in 06g0 and call it here. |
| F5 | minor | 09d:434 | `ACTIONS[ACTIONS.length-1]` assumes addTrigger pushed an entry. If addTrigger early-returns (09a:203), Pete would relabel and re-route the previous boss's action. This is latent only, since reg runs first. | Have addTrigger return the action, and use that return value. |
| F6 | minor | 09d:438 | The ring and beam are forced lit (fake `cleared:false`), so the beam also shows by day, when the fight isn't playable ('PETE: AFTER DARK'). | Make the beam's visibility depend on `night()`, or dim it by day. |
| F7 | minor | 09d:161-188 | Seven own Mesh*Material constructions and one frustumCulled=false (C3/C7) in the duel set. These are tolerated in duel scenes elsewhere (09b/09c) but add draw calls. | Reuse toonMat or a shared basic material, and drop frustumCulled=false on the fx InstancedMesh. |
| F8 | minor | 09d:198 | The HUD clearance against .dhint is only about 3 px. A future two-line hint or a larger font would overlap. UNVERIFIED render. | Raise #peteui to bottom 44 px, or add `body.duel-pete #duel .dhint { bottom: 4px }`. |

## Self-check
- Findings: blocker 0 · major 3 · minor 5 (8 total, at most 12).
- Files read: src/09d_pete.js, src/09a_duel_core.js, src/09b_jimmy.js:384, src/09c_chipkid.js:381, src/09_fort.js:25-40, src/06g_derby.js:616, src/06h_racers.js:570, src/06v_vic_rhythm.js:44-50,550, src/06f0_gr2_duchess.js:1-2, src/06g0_boss_clear.js:7, src/03_city.js:509, build.sh, README.md, content/g3_qa_template.md, relay/briefs/HOMAGE.md.
- Branch / hash: review/integration-pete @ 0c44dfb ("pete: Pit Beef Pete eat-off at Lexington Market (boss 18), tests passed").
- Not run: browser playtest and 390 px screenshots (UNVERIFIED items F1 and F8).
