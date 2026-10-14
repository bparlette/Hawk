# Toad_City_Round2_SONNET.zip
Toad City Baltimore, outside-AI round 2 kit for Claude Sonnet. Built 11 October 2026 by Hark.

Start with the session prompt you were given (also in `prompts/`). Do its Step 0 comprehension check first.

| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP and setup (`npm i` at the ZIP root installs three 0.160.0 for the Node harness). |
| `kit/toadcity_kit.js`, `kit/viewer.html`, `kit/example_bench.js`, `kit/example_gull_thug.js` | The **real** starter kit and bench. Ship the kit unchanged; your viewer must run on it. |
| `reference/taskAB_v1/` | Your Task A/B modules as delivered (branch `claude/new-session-j5l7sz`, commit `45f3041`). |
| `reference/taskAB_fixed/` | Hark's fixed copies (the integration worker's `vendor/taskAB`, snapshot at ZIP build time), plus `taskAB_v1_to_fixed.diff`. |
| `reference/game_hooks/landmark_hooks.js` | The game's `LMHOOK.aquarium` / `LMHOOK.science` objects and the `LANDMARKS` list (excerpt of `src/03_city.js` and `src/03c_landmarks_hd_b2.js`). |
| `reference/game_hooks/constellation_scale.md` | How the in-game USS Constellation is scaled (the scale rule for ships). |
| `harness_ab/` | Hark's Node harness for Task A/B (`measure_ab.mjs`, `checks_ab.mjs`, `block20.mjs`, `fakedom2.mjs`, `starter_kit.mjs`), re-pointed at `kit/` and `reference/`. |
| `reviews/sonnet_taskAB_review.md` | The full review. |
| `previews/before_after/` | `evidence_sheet.png` (door, canopy, pickup glow) and the review renders. |
| `previews/quality_bar/` | The in-house car rebuild (`cars_rebuild_sheet.png`) and your v1 sedan for comparison. |
| `briefs/TASK_A_rowhouse_city_block_kit.md`, `briefs/TASK_B_street_props_vehicles.md` | Round-1 briefs (contracts, style). This prompt overrides them where they differ. |
| `prompts/` | All Sonnet round-2 session prompts (S1–S3). |

Node harness setup (from the ZIP root): `npm i` (installs three 0.160.0 from package.json). Browser pages load three r160 from unpkg through an import map.
No credentials, tokens or private data are in this ZIP.
