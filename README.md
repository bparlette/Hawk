# Toad City Baltimore: Task C gangs (outside-AI deliveries)

| gang | module | delivery README | zip | status |
|---|---|---|---|---|
| 1 · Harbor Rats | `src/gang_harbor_rats.js` | [README_harbor_rats.md](README_harbor_rats.md) | `dist/toadcity_taskC_harbor_rats_v1.zip` | v1, left as-is (fixed on the in-house side) |
| 2 · Pier Gulls | `src/gang_pier_gulls.js` | [README_pier_gulls.md](README_pier_gulls.md) | `dist/toadcity_taskC_pier_gulls_v1.1.2.zip` | v1.1.1 accepted; v1.1.2 widens the bruiser's dizzy stray-ink margin (12 → 0 px on the left upper arm); all checks pass |
| 3 · Cobblestone Catfish | `src/gang_cobble_catfish.js` | [README_cobble_catfish.md](README_cobble_catfish.md) | `dist/toadcity_taskC_cobble_catfish_v1.1.zip` | v1 accepted; v1.1 raises the bruiser's head 8 cm (dizzy stray-ink fix); all checks pass |
| 4 · Masked Bandits | `src/gang_masked_bandits.js` | [README_masked_bandits.md](README_masked_bandits.md) | `dist/toadcity_taskC_masked_bandits_v1.zip` | v1 accepted |
| 5 · Key Highway Otters | `src/gang_key_hwy_otters.js` | [README_key_hwy_otters.md](README_key_hwy_otters.md) | `dist/toadcity_taskC_key_hwy_otters_v1.zip` | v1: built on the round-2 ZIP kit (`kit/`, byte-identical) with Hark's harness; all checks pass, approved margins included |

**Shared files:**
- `toadcity_kit.js` is the kit, rebuilt from the brief's appendix, with the game's real `down` and `dizzy` poses (gangs 1–4).
- `kit/` and `harness/` are the round-2 ZIP's kit and Hark's harness, byte-identical (gang 5). `viewer_key_hwy_otters.html` is the ZIP's real viewer set up for the otters, and `bench.html` (→ `viewer.html`) takes `&kit=zip&gangs=<id>`.
- `viewer.html` is the test bench:
  - `&merge=1` runs the game's real `mergeRig`.
  - `&strip=knockdown|attack|run|dizzy` shows 60 fps filmstrips.
  - `&stars=1` marks the dizzy stars sprite height.
- `tools/` holds the headless runner, the QA suite, the table generator and `tools/game/04b_rig_merge.js` (the game's own file).
- `qa/` holds the raw QA reports.

To QA any gang:
1. Run `python3 -m http.server 8000`.
2. Open `http://localhost:8000/tools/qa.html?gang=<id>`. The page loads `src/gang_<id>.js` (gang 5 runs on the ZIP kit by default; `&kit=zip|repo` picks one).
