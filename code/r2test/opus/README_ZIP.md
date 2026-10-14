# Toad_City_Round2_OPUS.zip
Toad City Baltimore, outside-AI round 2 kit for Claude Opus. Built 11 October 2026 by Hark.

Start with the session prompt you were given (also in `prompts/`). Do its Step 0 comprehension check first.

| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP and the one-line setup (`npm i` at the ZIP root installs three 0.160.0 for the Node harness). |
| `kit/toadcity_kit.js` | The **real** starter kit. Its `THUG_POSES` / `HERO_POSES` / `applyPose` are byte-identical to the game's `src/04_actors.js`. Ship it unchanged. |
| `kit/viewer.html`, `kit/example_gull_thug.js`, `kit/example_bench.js` | The kit test bench and the two interface examples. |
| `kit/real_mergeRig.js` | The game's real `mergeRig()` (verbatim from `src/04b_rig_merge.js`) as an ES module. |
| `kit/real_poses_04_actors.js` | The game's real pose code, verbatim, for reading. |
| `kit/real_viewer.html` | Real-pose viewer: `?mods=../src/<file>.js&show=<id>&pose=all`, `&merge=1` (real mergeRig), `&seq=knockdown|attack|hurt` (real game timings; `window.__report.seq.minY` gives the lowest vertex per rig, unmerged). |
| `harness/realK.mjs`, `harness/fakedom.mjs`, `harness/measure_gang.mjs` | Hark's Node harness. `GANG=./src/gang_<id>.js node harness/measure_gang.mjs` writes `results_gang.json`: parts, tris, hulls, shadow casters, heights, per-pose lowest point and limb gaps, real mergeRig result, determinism. |
| `reference/harbor_rats/` | Harbor Rats v1 (`bbad681`), the fixed v2 (Hark's branch `hark/harbor-rats-fixes`, commit `751c21b`), the v1→v2 diff and the v2 README. |
| `reference/pier_gulls_v1/` | Your Pier Gulls v1 (`f1cfba4`): module, README and QA page. |
| `reviews/harbor_rats_review.md`, `reviews/TASK_C_review_lessons.md` | The full Harbor Rats review and the lessons list. |
| `previews/before_after/` | Before/after renders of every Harbor Rats fix (real poses), and `harbor_rats_fixes_compare.png`. |
| `briefs/TASK_C_thug_gangs.md`, `briefs/TASK_D_bosses.md` | Round-1 briefs (full interfaces, roster, style rules). This prompt overrides them where they differ. |
| `prompts/` | All Opus round-2 session prompts (O1–O7). |

Node harness setup (from the ZIP root): `npm i` (installs three 0.160.0 from package.json). Browser pages load three r160 from unpkg through an import map.
No credentials, tokens or private data are in this ZIP.
