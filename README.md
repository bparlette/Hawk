# Toad City Baltimore: Task C gangs (outside-AI deliveries)

| gang | module | delivery README | zip | status |
|---|---|---|---|---|
| 1 · Harbor Rats | `src/gang_harbor_rats.js` | [README_harbor_rats.md](README_harbor_rats.md) | `dist/toadcity_taskC_harbor_rats_v1.zip` | v1, left as-is (fixed on the in-house side) |
| 2 · Pier Gulls | `src/gang_pier_gulls.js` | [README_pier_gulls.md](README_pier_gulls.md) | `dist/toadcity_taskC_pier_gulls_v1.1.zip` (v1: `…_v1.zip`) | v1.1: real `mergeRig`, real timings, margins; all QA checks pass |
| 3 · Cobblestone Catfish | `src/gang_cobble_catfish.js` | [README_cobble_catfish.md](README_cobble_catfish.md) | `dist/toadcity_taskC_cobble_catfish_v1.zip` | v1: built under the same rules and QA; all QA checks pass, margins included |

**Shared files:**
- `toadcity_kit.js` is the kit, rebuilt from the brief's appendix, with the real `down` pose.
- `viewer.html` is the test bench. Add `&merge=1` to run the game's real `mergeRig`.
- `tools/` holds the headless runner, the QA suite, the table generator and `tools/game/04b_rig_merge.js` (the game's own file).
- `qa/` holds the raw QA reports.

To QA any gang:
1. Run `python3 -m http.server 8000`.
2. Open `http://localhost:8000/tools/qa.html?gang=<id>`. The page loads `src/gang_<id>.js`.
