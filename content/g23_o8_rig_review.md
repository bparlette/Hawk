QA-REPORT G3 o8-rigs

# G23 · Rig review of Opus O8: Pit Beef Pete, Kingpin Carl, Riptide Rodney (+ otter_wingman)
Reviewed: branch `claude/o8-new-content`, short hash `05d3361` (fetched with --depth 1; nothing committed there). Phantoms and Chompy skipped (grok/opus-standin).
Method: G3 template v2, code-only. Every number below was recomputed by building the rigs in node (three@0.160.0) against both `kit/toadcity_kit.js` (zipKit) and `harness/realK.mjs` (realGame), counting meshes with ink hulls excluded, then checked against `tools/results_boss_*.json` and a hand count of the `part(...)` calls. Nothing was rendered in a browser.

## 1 · Budgets vs README_o8.md
README_o8.md (9 lines) has no numbers at all, only a status table saying "built, measured, previews" (README_o8.md:5-9). So every README figure is **absent**, not matched. Recomputed numbers (identical for zipKit and realGame):

| Rig | Parts HD / LOD1 | Tris HD / LOD1 | Mats | Merged calls (results) | vs target 63 / 19,800 | vs cap 70 / 22,000 / 4 |
|---|---|---|---|---|---|---|
| Pit Beef Pete | 38 / 36 | 10,524 / 9,732 | 1 toon + shared ink = 2 | 2 | PASS (25 parts, 9,276 tris headroom) | PASS |
| Pete + table (opts.table) | 48 / 45 | 11,748 / 10,860 | 2 | 2 | PASS | PASS |
| Separate table (buildPitBeefTable) | 10 / 9 | 1,224 / 1,128 | 2 | n/a | n/a | n/a |
| Kingpin Carl | 41 / 40 | 12,224 / 12,032 | 2 | 2 | PASS | PASS |
| Riptide Rodney | 42 / 40 | 10,532 / 10,508 | 2 | 2 | PASS | PASS |
| otter_wingman | 35 / 33 | 9,372 / 9,348 | 2 | 2 | PASS | PASS |

Hand count of part() calls (HD):
- Pete 38: stool 4 (boss_pit_beef_pete.js:172-175), hips + tail 2 (177-178), legs 6 (180-182), torso 1 (185), belly 1 + 2 sauce spots (187-188, HD only), apron strap 1 (189), head 10 (192-201), arms 8 (204-207), fork 2 (210-211). LOD drops the sauce spots = 36. Table adds 10 (148-156; onion at 154 is HD only).
- Carl 41: hips 3 (147-149), legs 8 (151-154), torso 6 (157-160), towel 3 (162-164), head 10 (167-176), arms 8 (179-182), pinky ring 1 (184, HD only), ball 1 (186).
- Rodney 42: hips 1 (151), legs 6 (153-155), torso 5 (158-161; side stripes HD only), head 15 incl. 2 eye-black (164-175), arms 8 + armband 1 (178-183), tail 1 (186), stick 4 (190-193). Wingman drops eye-black 2, armband 1 and stick 4 = 35.
These match `tools/results_boss_*.json` budgets.zipKit and realGame exactly, so the measured JSON is right; the README just never received it.
Heights (results summary): Pete 2.756 vs META 2.75 (+0.2 %), Carl 2.594 vs 2.55 (+1.7 %), Rodney 2.345 vs 2.35 (-0.2 %), wingman 1.827 vs 1.85 (-1.3 %). All inside ±10 %. Worst culling radius 2.052 (Carl, down) ≤ 2.6.

## 2 · Required states
- Pete: `eat` (boss_pit_beef_pete.js:260), `full` (267, belly puff via animateBoss 307 and J.setFull 215), `hiccup` (274), `cheat_slide` (281, also atk1 at 288). Table/plate as a separate optional part: `buildPitBeefTable` (160-164) returns its own group; `opts.table` (212) builds it into the rig instead. PASS.
- Carl: `bowl` (boss_kingpin_carl.js:226, = atk1 at 260, ball hides after u 0.5 at 281), `heckle` (236), `celebrate` (244), `sulk` (251). PASS.
- Rodney: `cradle` (boss_riptide_rodney.js:236), `pass` (244), `shoot` (251, = atk1 276), `check` (260, = atk2 277), `stunned` (269). PASS.
- Wingman: `opts.variant === 'otter_wingman'` (148), META from VARIANTS (11, 196). PASS.
- Lowest point: reported per pose for the 17 standard samples (`poses`), the sequences (`seq`) and every extra state (`extra`) in all 5 results files (measure_boss.mjs:178-188). Worst non-foot minY: Pete 0, Carl 0.017, Rodney 0.014, wingman 0.012, all ≥ -0.03. PASS (see findings 3, 4 and 8 for what that number hides).
- Dizzy: no boss module contains "dizzy" (0 grep hits in src/boss_*), so it isn't baked in. But `attachDizzy` (tools/game/thug_dizzy.js:4) is only imported by tools/qa.js:15, viewer.html:33 and viewer_key_hwy_otters.html:38 (gang tools). `tools/measure_boss.mjs` never imports it, so the boss measurements don't attach it at test time (finding 2).

## 3 · Palette and homage
- Rodney's palette matches `KO_C` on claude/o4-key-hwy-otters @ 6d85421 (src/gang_key_hwy_otters.js:22-24) exactly for green #23c26b, stripe #5e3e28, fur #7a5236, dark #3e2c22, cream #d8c4a0 and eye #ece6d2 (boss_riptide_rodney.js:142). The stick head #e6e2da reuses KO_C.hat. PASS.
- Lacrosse stick (190-193): a 1.0 m plain shaft, an open half-torus head and a cream ellipsoid pocket with a ball. No brand head shape, lettering, number or logo. Original. PASS.
- All three are geometry-only with flat vertex colours: no textures, lettering, numbers or logos anywhere in the three files. Pete is a generic hog butcher (no real stand or person), Carl a possum in a generic bowling shirt, Rodney an otter in an unnumbered jersey. Nothing matches a Not-allowed item in HOMAGE.md. PASS.

## Findings (8: 0 blocker, 3 major, 5 minor)
1. MAJOR · README_o8.md:1-9 · No per-model table, no lowest-point, build-ms or phone-budget line, which the O8 self-check requires ("measured README numbers only"). Fix: generate the table from tools/results_boss_{pit_beef_pete,pit_beef_pete_table,kingpin_carl,riptide_rodney,riptide_rodney_otter_wingman}.json (parts 38/48/41/42/35, tris 10,524/11,748/12,224/10,532/9,372, merged calls 2) plus a phone-budget line.
2. MAJOR · tools/measure_boss.mjs (no import of tools/game/thug_dizzy.js) · The O8 rule "dizzy pose attached at test time" isn't exercised for any boss; only the gang tools attach it. Fix: `import { attachDizzy } from './game/thug_dizzy.js'; attachDizzy(KR);` in measure_boss.mjs and add a dizzy sequence (STATE maps dizzy to hurt, kit/real_viewer.html:130) to `seq`.
3. MAJOR · boss_kingpin_carl.js:153-154 · Carl's shoes sink through the floor in every standing pose. Feet included, my minY at META.scale 1.25 is -0.089 (idle), -0.109 (bowl), -0.089 (heckle), -0.085 (celebrate) and -0.092 (sulk). The gate passes only because feet are skipped (measure_boss.mjs:49). Fix: raise both shoe parts by 0.08 (L153 y -0.03 → 0.05, L154 y -0.02 → 0.06) or lift p.y in stand(), then re-measure with feet included.
4. MINOR · boss_riptide_rodney.js:256, 265 · Both feet leave the ground in shoot and check: lowest point including feet is 0.058 / 0.077 m (knees 0.137 / 0.164 in results `poses.atk1_*` / `atk2_*`), so he hovers through his two main attacks. Fix: drop p.y by about 0.06 in shoot and 0.07 in check, or straighten the back leg (lgR/knR).
5. MINOR · tools/results_boss_riptide_rodney_otter_wingman.json budgets.limits · The wingman is held to 40 parts / 12,000 tris, a limit that doesn't appear in O6 or O8. Fix: cite where it comes from in the README, or use the 63 / 19,800 boss target.
6. MINOR · boss_riptide_rodney.js:236-267 · The wingman has no stick (188 is gated on !wing), but cradle, pass, shoot and check still pose both paws gripping a shaft, so he mimes an invisible stick. Fix: give the wingman his own throw/shove poses or a short practice stick (2 parts).
7. MINOR · tools/measure_boss.mjs:182-186 · `extra[name].minY` is the min of a static u sweep and a played-from-idle run, so for Carl and Rodney every state reports the same idle frame ("played idle t 1.50", 0.034 / 0.022) and the state's own lowest point is hidden. Fix: report `static` and `played` minY separately per state.
8. MINOR · boss_pit_beef_pete.js:147 vs 162 · Built into the rig the table sits at z 0.92; returned separately it is reset to z 0, and no constant tells the game how far in front of Pete to place it. Fix: export `TABLE_Z = 0.92` (rig units, x META.scale) and mention it in the header comment (L7).

## UNVERIFIED
- Visual look of the poses and the merged/flash previews: I read the code and the results JSON only; confirming needs the previews/*_states.png and *_merged_*.png images opened.
- Whether the game plays a boss `dizzy` through hurt (kit/real_viewer.html:130 suggests yes); needs the game's boss state machine (06_game.js).

## Self-check
- Findings: 8 (blocker 0, major 3, minor 5).
- Files read: 17 (relay/HARK_TO_GROK.md P-030, relay/briefs/O8.md, relay/briefs/O6.md section 4, relay/briefs/HOMAGE.md, content/g3_qa_template.md, README_o8.md, src/boss_pit_beef_pete.js, src/boss_kingpin_carl.js, src/boss_riptide_rodney.js, 5 tools/results_boss_*.json, tools/measure_boss.mjs, tools/game/thug_dizzy.js, src/gang_key_hwy_otters.js @ o4 6d85421).
- Reviewed: claude/o8-new-content @ 05d3361.
- Pit Beef Pete: 38 parts recomputed (36 LOD1; 48 with table).
- Kingpin Carl: 41 parts recomputed (40 LOD1).
- Riptide Rodney: 42 parts recomputed (40 LOD1).
- otter_wingman: 35 parts recomputed (33 LOD1).
