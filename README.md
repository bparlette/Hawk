# Toad City Baltimore: Task C gangs (outside-AI deliveries)

| gang | module | delivery README | zip | status |
|---|---|---|---|---|
| 1 · Harbor Rats | `src/gang_harbor_rats.js` | [README_harbor_rats.md](README_harbor_rats.md) | `dist/toadcity_taskC_harbor_rats_v1.zip` | v1; predates the gang-2+ rules and fails them (see below) |
| 2 · Pier Gulls | `src/gang_pier_gulls.js` | [README_pier_gulls.md](README_pier_gulls.md) | `dist/toadcity_taskC_pier_gulls_v1.zip` | v1; passes the TASK_C rules and the gang-2+ rules |

**Shared files:**
- `toadcity_kit.js` is the kit, rebuilt from the brief's appendix, with the real `down` pose.
- `viewer.html` is the test bench.
- `tools/` holds the headless runner, the QA suite and the table generator.
- `qa/` holds the raw QA reports.

To QA any gang:
1. Run `python3 -m http.server 8000`.
2. Open `http://localhost:8000/tools/qa.html?gang=<id>`. The page loads `src/gang_<id>.js`.

Gang 1 under the gang-2+ QA (`qa/harbor_rats_report_newrules.json`):
- the tail goes 66.0–79.2 cm below ground in `down`
- shoulder gaps are 2.9–3.1 cm in `down`
- 40/40 parts
- shadow-rule violations

It has not been retrofitted.
