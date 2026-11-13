# Lanternport Registered Scenes — Audit Status (`2026-11-13`)

Repo: `bparlette/Hawk` (`main`, `games/lanternport/`)

Registry audited: all **19** entries in `SCENES` (`games/lanternport/scenes.js`), verified both statically in Node (`SCENES`, `festival.js`, `sim.js`) and live in headless Chrome across every `?scene=<id>&loop=1` URL (`WATCH` -> `TAKE CONTROL`).

## Summary Verdict

- **Already built:** **18 / 19** scenes (`rooftop-dive`, `photo-call`, `snapper-shop`, `garden-guard`, `festival-roundabout`, `dawn-shift`, `harbor-run`, `cucco-swarm`, `pot-rampage`, `chest-fanfare`, `dock-fishing`, `fairy-orbit`, `pool-surface`, `pool-rimsit`, `cartop-dance`, `club-stage`, `sword-pedestal`, `ocarina-dawn`). All 18 have real `set()`, `act()`, lighting, sound cues, finite bookmarks, `?scene=<id>&loop=1` support, and `0` runtime exceptions in headless Chrome.
- **Built by you:** **0 / 19** — none needed rebuilding; finished scenes and `FESTIVAL_DAY_ORDER` were left untouched per task rules.
- **Still missing / non-staged and why:** **1 / 19** (`stage-test`, slot 9 / index 8) is intentionally a simulation-level framework proof rather than a staged film scene (details below).

## Per-Scene Audit Table

| Slot | ID | Category | Implementation & Checks | Notes / `TAKE CONTROL` Spawn (`m`) |
|---|---|---|---|---|
| 1 | `rooftop-dive` | `already built` | `filmscenes.js`; `set`+`act`, `10` props, `10` actors (`juniper` `hero: true`), `9` events, `17` sound cues, `errs=0` | Spawns at Juniper (`[9.1, 22.5, 14.15]` on rooftop deck) |
| 2 | `photo-call` | `already built` | `filmscenes.js`; `set`+`act`, `8` props, `13` actors (`fen`, `photog`, 8 crowd, 3 flashes), `6` events, `39` cues, `errs=0` | Fen vignette; spawns at scene origin `[31, 0, -11]` |
| 3 | `snapper-shop` | `already built` | `filmscenes2.js`; `set`+`act`, `1` prop, `5` actors (`snapper`, `clerk`, `melon`, `slice`, `pan`), `10` events, `34` cues, `errs=0` | Supporting vignette; spawns at `[232, 0, 40]` |
| 4 | `garden-guard` | `already built` | `filmscenes2.js`; `set`+`act`, `9` props, `7` actors (`gardener`, 4 hens, `feathers`, `gleam`), `9` events, `16` cues, `errs=0` | Supporting vignette; spawns at `[-232, 0, 60]` |
| 5 | `festival-roundabout` | `already built` | `filmscenes2.js`; `set`+`act`, `3` props, `30` actors (`cab`, `drift`, `smoke`, `dancer`, 26 fans), `7` events, `24` cues, `errs=0` | Spawns at origin `[31, 0, -11]` |
| 6 | `dawn-shift` | `already built` | `filmscenes2.js`; `set`+`act`, `8` props, `10` actors (`juniper`, `fen`, 5 carts, 3 gulls), `7` events, `12` cues, `errs=0` | Both heroes present (`JUNE`/`FENN` without `hero: true`); spawns at origin `[-236, 0, -150]` |
| 7 | `harbor-run` | `already built` | `filmscenes2.js`; `set`+`act`, `6` props, `34` actors (`skiff`, `wake`, `fen`, `snapper`, `launch`, `officer`, 28 marshbirds), camera `track`, `8` events, `13` cues, `errs=0` | Fen in moving skiff (`x=-112` local); `TAKE CONTROL` falls back to origin `[0, 0, 268]` (kept untouched per finished-scene rule) |
| 8 | `cucco-swarm` | `already built` | `cucco.js`; `set`+`act`, `3` props, `37` actors (`juniper` `hero: true`, 32 cuccos), `8` events, `16` cues, `errs=0` | Spawns at Juniper (`[16.5, 0, -24.2]`) |
| 9 | `stage-test` | `still missing (by design)` | `scenes.js`; `set=false`, `act=false`, `light=false`, `0` props/actors/cues; `sim` `input()` + `3` events (`start`, `at-fountain`, `end`), `errs=0` | Intentionally a **framework proof**, not a film scene (`SCENES.md:71`, excluded from `tourSceneIds` in `festival.js:22`, tested by `test/lanternport-scenes.test.mjs:32-45`). Left untouched to avoid breaking unit tests and `festival.js:34` (`* 0.01` marker scaling); note raw sim-unit bookmark `[2100, 260, -2100]` (`dist=2400`) places `freecam`/`TAKE CONTROL` outside the town if opened directly via `?scene=stage-test` |
| 10 | `pot-rampage` | `already built` | `zelda.js`; `set`+`act`, `2` props, `7` actors (`juniper` `hero: true`, `clerk`, 5 pots), `6` events, `17` cues, `errs=0` | Spawns at Juniper (`[-24.5, 0, -87]`) |
| 11 | `chest-fanfare` | `already built` | `zelda.js`; `set`+`act`, `1` prop, `5` actors (`juniper` `hero: true`, 2 fans, `redRupee`, `sparkle`), `7` events, `8` cues, `errs=0` | Spawns at Juniper (`[27, 0, -12.5]`) |
| 12 | `dock-fishing` | `already built` | `zelda.js`; `set`+`act`, `2` props, `3` actors (`fen`, `snapper`, `splash`), `7` events, `11` cues, `errs=0` | Fen vignette; spawns at `[93, 0, 87.5]` |
| 13 | `fairy-orbit` | `already built` | `zelda.js`; `set`+`act`, `1` prop, `2` actors (`juniper` `hero: true`, `fairy`), `7` events, `10` cues, `errs=0` | Spawns at Juniper (`[16.7, 0, -21]`) |
| 14 | `pool-surface` | `already built` | `surface.js`; `set`+`act`, `9` props, `8` actors (`juniper` `surfaceSprite`, sunbathers, gulls), `6` events, `9` cues, `errs=0` | Spawns at rooftop pool `[14.15, 22.5, 14.15]` |
| 15 | `pool-rimsit` | `already built` | `rimsit.js`; `set`+`act`, `9` props, `7` actors (`juniper` `hero: true` 3D pool-look figure per `b70dcfd`), `6` events, `7` cues, `errs=0` | Spawns at Juniper (`[14.35, 22.5, 16.13]` on rooftop rim) |
| 16 | `cartop-dance` | `already built` | `cartop.js`; `set`+`act`, `6` props, `5` actors (`juniper` `cartopSprite`, 3 fans, flash), `3` events, `8` cues, `errs=0` | Spawns at origin `[31, 0, -11]` |
| 17 | `club-stage` | `already built` | `clubstage.js`; `set`+`act`, `5` props, `7` actors (`dancer` `clubSprite`, 5 audience, flash), `3` events, `8` cues, `errs=0` | Spawns at origin `[31, 0, -11]` |
| 18 | `sword-pedestal` | `already built` | `scenes.js`; `set`+`act`, `25` actors (`juniper` `hero: true`, `fen`, `pedestal`, `heldSword`, 5 crowd, 14 sparkles), `6` events, `10` cues, `errs=0` | Spawns at Juniper (`[16.6, 0, -10.4]`) |
| 19 | `ocarina-dawn` | `already built` | `scenes.js`; `set`+`act`, `1` prop, `19` actors (`juniper` `hero: true`, `fen`, `ocarina`, 4 lanterns, 12 sparkles), dusk -> sunrise `lightCues`, `5` events, `11` cues, `errs=0` | Spawns at Juniper (`[17.95, 22.5, 14.35]` on rooftop) |

## Verification

- Static & headless Chrome `?scene=<id>&loop=1` (`WATCH` -> `#sceneBtn` `TAKE CONTROL`) check across all **19** scenes: **19/19** loaded with `0` console/runtime exceptions (`stage-test` caveat noted above).
- Full Lanternport suite (`node --test test/lanternport*.test.mjs test/linkle-walk-assets.test.mjs test/headless-pages.test.mjs`): **57/57 passed, 0 failed**.
