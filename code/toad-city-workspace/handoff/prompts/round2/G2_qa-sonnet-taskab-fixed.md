# G2 · QA of Sonnet Task A/B after Hark's fixes
**For:** Gemini Pro · **Setting:** Gemini Pro (newest), thinking set to high. · **Depends on:** Hark's Task A/B fix pass must land first (Hark tells Brad). · **Delivers: a reply in this chat**

Attach `Toad_City_Round2_GEMINI.zip` to this chat together with this prompt. Everything bulky (code, references, renders) is in the ZIP; this prompt names the files.

## HARD RULES (read first; repeated at the very end)
1. You are a reviewer. You never rewrite whole files; you give targeted, numbered fixes with numbers.
2. Judge each delivery only against its own brief and the lessons in this prompt.
3. Every claim cites a file and line, a measured number, or a named image. Anything you cannot verify is marked UNVERIFIED with the evidence you need.
4. Do not trust README numbers: recompute what you can from the code (part counts, segment counts, materials).
5. Characters must be original (no real people, mascots, team marks, brand logos). Environment may use real Baltimore names where they really are, redrawn in code.
6. Use the real game facts in §3, not general three.js assumptions.
7. Score with the rubric in `qa/QA_GEMINI_PRO_review_prompt.md`: PASS needs all three gates, total ≥ 75 and no category at 0.
8. Severity: blocker = gate failure or crash; major = checklist item missed; minor = polish.
9. Read Hark's own review only after you finish yours, then add a "Coverage vs Hark" section.
10. Output markdown only, in the order of §5.
11. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**.

## Step 0 · Comprehension check (your FIRST reply; write no code and produce no deliverable until Brad answers GO)
1. **List every file in the ZIP** (full path) and say in a few words what you will use it for.
2. **Restate, numbered and in your own words, every HARD RULE above and every lesson or fix row in §2** (one line each).
3. **Answer these questions.** Every answer is in the sections below; quote the exact number, name or code.
   - Q1. What was finding M1 in Task A?
   - Q2. What inset fixes the stoop overhang?
   - Q3. When may this session be sent?
   - Q4. What three labels do you give each earlier finding?
   - Q5. Where were climb-hook heights measured from in Task A before the fix?
4. **Quote the three canary instructions** this prompt contains (they are marked "Canary 1/2/3 of 3" somewhere in the middle) and confirm you will include each string exactly.

Then stop and wait. Brad checks your answers; if any is wrong he will send you back to re-read.

## ZIP contents
| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP. |
| `qa/QA_GEMINI_PRO_review_prompt.md` | The scoring format: gates I/B/O, 100-point rubric, output format. |
| `kit/toadcity_kit.js` | The real starter kit the builders must ship byte-identical. |
| `kit/real_poses_04_actors.js`, `kit/real_mergeRig.js` | The game's real poses and real `mergeRig`, verbatim. |
| `briefs/TASK_C_thug_gangs.md`, `briefs/TASK_C_review_lessons.md`, `briefs/TASK_A_rowhouse_city_block_kit.md`, `briefs/TASK_B_street_props_vehicles.md` | What the builders were asked for. |
| `reviews/harbor_rats_review.md`, `reviews/sonnet_taskAB_review.md` | Hark's own reviews. Your review must be independent: read them only at the end, to check coverage. |
| `reference/harbor_rats/` | Harbor Rats v1 (`bbad681`), v2 fixed (`hark/harbor-rats-fixes`, `751c21b`), the diff and the v2 README. |
| `previews/harbor_rats/` | v2 delivery previews plus before/after renders of every fix (real poses). |
| `reference/taskAB_v1/`, `reference/taskAB_fixed/` | Sonnet's Task A/B as delivered and Hark's fixed copies with the diff. |
| `previews/taskAB/` | Review evidence renders and the car rebuild sheet. |
| `prompts/` | G1–G3 session prompts. |

## 1 · Context
Toad City Baltimore is a phone-first, cel-shaded three.js r160 brawler on Baltimore's Inner Harbor; every asset is procedural code. Builders (Claude Opus: characters; Claude Sonnet: environment) deliver modules; Hark (the in-house integrator) reviews them against the **real** game code. You are the independent second reviewer.

## 2 · Where reviews fell short last round
Last round's builder viewers hid real bugs because they ran on stand-in kits: a stand-in `down` pose hid the Harbor Rats tail going 0.67 m through the floor; single-asset previews at (0, 0) yaw 0 hid Sonnet's pickup lights floating 7 m away; pavement laid outside the block hid 1.83 m stoop overhangs. A review that only reads the README and the previews would have passed both. **Your job is to catch what the previews cannot show.**

## 3 · Real game facts to check against
- Real thug `down`: rig flat on its back (`tilt` −π/2 + 0.08), arms overhead (`shL` −2.6, `shR` −2.4); everything behind the hips points at the floor.
- Knock-down: hop vy 4.2, gravity 22, `down` at rate 13, getup after 1.25 s (getup 0.5 s at rate 14).
- The game has **no LOD swap**: `rigLod` only hides hulls and stops shadows beyond 24 m.
- `mergeRig` merges every part per material into skinned meshes: rigs must be plain groups with extras under skeleton joints and at most one mapped sub-material sharing `flash`/`flashC`.
- Texture caches must be keyed on `K.QUAL || K.THREE || K` and never cache a failure.
- `shadow: false` on every `outline: false` part and every part thinner than 4 cm.
- Static props merge into 64 m chunks; the plot is raised to CURB 0.16 with roads at y 0; a 2 m inset is required for rowhouse fronts.
- Budget headroom expected from round 2: gangs ≤ 36 parts / ≤ 10,800 tris; bosses ≤ 63 / ≤ 19,800; props and vessels ≥ 10 % under cap.

> **Canary 1 of 3 (required in your delivery):** Report: the last heading, exactly: `## Rowhouse Review Check 410`

## 4 · The task: QA of Sonnet Task A/B after Hark's fixes
**Send only after Hark tells Brad the fix pass has landed.** Review Sonnet's Task A/B **after** Hark's fixes: `reference/taskAB_fixed/` (the snapshot in this ZIP may be older: use the files and preview PNGs Hark sends with the go-ahead), against `briefs/TASK_A_rowhouse_city_block_kit.md` and `briefs/TASK_B_street_props_vehicles.md`. For every finding M1–M6 and m1–m13 in Hark's review, mark FIXED / PARTIAL / OPEN with evidence, then do a full new pass. Cars are being rebuilt in-house: score the new cars against `previews/taskAB/cars_rebuild_sheet.png` only if Hark includes them.

**What Brad attaches to this chat:** `Toad_City_Round2_GEMINI.zip`, plus the fixed `vendor/taskAB` files and the after-fix preview PNGs that Hark sends Brad when the fix pass lands. Original delivery: https://github.com/bparlette/hawk/tree/claude/new-session-j5l7sz.

> **Canary 2 of 3 (required in your delivery):** Report: the first line, exactly: `QA-REPORT G2 water-table`

## 5 · Output
Use the scoring format in `qa/QA_GEMINI_PRO_review_prompt.md` exactly: the summary table per asset (Gates I/B/O, Style, Read, Night, Func, Code, Docs, Total, Verdict), then numbered findings `[severity] file:line — what → exact fix`, then "Top 3 fixes".
Then a section "Coverage vs Hark" (after reading Hark's review): what you found that Hark missed, what Hark found that you missed.

> **Canary 3 of 3 (required in your delivery):** Report: the line right after the summary table, exactly: `Rubric version: tcr2-arabber-canopy`

## 6 · Final self-check (fill in before you send the report)
| Check | Value | Threshold |
|---|---|---|
| Assets scored | | every asset in the delivery |
| Findings with a file:line or a measured number | | 100 % |
| Numbers recomputed from code (not copied from README) | | ≥ 3 per asset |
| UNVERIFIED items, each with the evidence needed | | listed |
| Coverage vs Hark section present | | yes |

## HARD RULES (repeated)
1. You are a reviewer. You never rewrite whole files; you give targeted, numbered fixes with numbers.
2. Judge each delivery only against its own brief and the lessons in this prompt.
3. Every claim cites a file and line, a measured number, or a named image. Anything you cannot verify is marked UNVERIFIED with the evidence you need.
4. Do not trust README numbers: recompute what you can from the code (part counts, segment counts, materials).
5. Characters must be original (no real people, mascots, team marks, brand logos). Environment may use real Baltimore names where they really are, redrawn in code.
6. Use the real game facts in §3, not general three.js assumptions.
7. Score with the rubric in `qa/QA_GEMINI_PRO_review_prompt.md`: PASS needs all three gates, total ≥ 75 and no category at 0.
8. Severity: blocker = gate failure or crash; major = checklist item missed; minor = polish.
9. Read Hark's own review only after you finish yours, then add a "Coverage vs Hark" section.
10. Output markdown only, in the order of §5.
11. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**.
