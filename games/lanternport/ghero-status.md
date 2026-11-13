# DONE — Lanternport Rigged Hero Integration (`ghero-status.md`)

Date: `2026-11-13`
Repo: `bparlette/Hawk` (`main`, `games/lanternport/`)

## Summary

Replaced the procedural `StageView` hero with the rigged 127-bone Juniper GLB (`assets/juniper/juniper_rig.glb`, `2,336,848` bytes, sourced from `tasking/juniper/model/juniper_rig.glb`) driven deterministically by `Three.AnimationMixer` (matching Three.js `r160` `lib/GLTFLoader.js`) across the **7 staged scenes** expressible with the currently available clip set (`assets/juniper/clips/`). Scene `act()` logic, beats, `FESTIVAL_DAY_ORDER`, journal wiring, Nov 12 button fixes, and bit-exact sim replay (`4/4`) are untouched.

- **Assets + loader commit:** `9942732` (`lanternport: add Juniper rig/pose GLBs and r160 GLTFLoader`)
- **Integration + screenshots + tests commit:** `7622e68` (`lanternport: drive 7 staged scenes with rigged Juniper GLB and AnimationMixer`)
- **Verified `juniper_rig.glb` object size in git:** `2,336,848` bytes (`git cat-file -s HEAD:games/lanternport/assets/juniper/juniper_rig.glb`)

## Staged Scenes Converted to Rigged GLB (`7 / 19`)

| Scene ID | Target Actor ID | Clips Used | Notes / Alignment | Screenshot |
|---|---|---|---|---|
| `pool-rimsit` | `juniper` | `sit-rim`, `sit-lookback` | `0.25s` crossfade between `sit-rim` and `sit-lookback`; `SEATED_Y_OFFSET=0.55`, `SEATED_Z_OFFSET=0.16` atop coping rim; `!runner && sceneMode !== 'watch'` prevents Watch-mode frame-0 hero hide | [`pool-rimsit.png`](audit-assets/ghero/pool-rimsit.png) |
| `cartop-dance` | `juniper` | `dance-cartop` | Loop atop red car roof (`yOffset = STANDING_Y_OFFSET + 0.06`) | [`cartop-dance.png`](audit-assets/ghero/cartop-dance.png) |
| `club-stage` | `dancer` | `dance-club` | Stage loop plus warm `PointLight` key (`0xffe9d2`) attached to model for silhouette legibility in dark stage alcove | [`club-stage.png`](audit-assets/ghero/club-stage.png) |
| `pool-surface` | `juniper` | `swim-surface` | `SWIM_Y_OFFSET=0.46`, `zOffset=-1.05`, `rotY=-Math.PI/2`; slows to `0.55x` rate on rim hold because **`swim-tread` clip does not exist yet** | [`pool-surface.png`](audit-assets/ghero/pool-surface.png) |
| `dock-fishing` | `fen` | `idle-stand`, `fish-cast` | `idle-stand` (`tick < 115`) -> one-shot `fish-cast`; fishing rod mesh parented to `bone_22`; free-play `heroViews` hidden during Watch mode; uses `juniper_rig.glb` as rigged stand-in because no dedicated Fen GLB rig exists | [`dock-fishing.png`](audit-assets/ghero/dock-fishing.png) |
| `cucco-swarm` | `juniper` | `07_01`, `idle-stand`, `09_01`, `sit-rim` | Ground walk/idle/run (`Standing`), then seated on outer plaza stone fountain coping (`FOUNTAIN_SEATED_Y_OFFSET=1.02`, `FOUNTAIN_SEATED_Z_OFFSET=2.25`) at `tick >= 760` | [`cucco-swarm.png`](audit-assets/ghero/cucco-swarm.png) |
| `fairy-orbit` | `juniper` | `07_01`, `idle-stand` | Walk -> standing pause -> walk along plaza courtyard | [`fairy-orbit.png`](audit-assets/ghero/fairy-orbit.png) |

## Procedural Stand-Ins Kept (`7 / 19`) — Exact Reasons

These 7 scenes pose the hero or attach interactive props in ways the current 9-clip set cannot express without fabricating unauthentic motion:

| Scene ID | Hero / Actor | Why Kept Procedural |
|---|---|---|
| `rooftop-dive` | `juniper` | **`dive` clip does not exist yet** in `tasking/juniper/clips/` (and scene drives springboard `crouch`, midair cannonball `tuck`/`spin`, `capOff`, and landing `sit`). Will convert cleanly once Task 4 authors `dive.glb`. |
| `pot-rampage` | `juniper` | Drives alternating rapid `armL`/`armR` pottery-smashing strikes and `crouch` overhead lift of `bigpot`; no strike/carry clips in clip set. |
| `chest-fanfare` | `juniper` | Drives deep chest-opening kneel (`crouch: 0.8`) and double-arm overhead `[2.9, ±0.1]` `redRupee` celebration hold. |
| `sword-pedestal` | `juniper` | Drives two-handed grip/pull strain against planted pedestal blade and vertical `[3.0, 0.05]` overhead `heldSword` reveal. |
| `ocarina-dawn` | `juniper` | Raises ocarina to lips (`armL` `[1.7, -0.25]`) with synchronized `headPitch` across dusk -> sunrise cue. |
| `dawn-shift` | `juniper` | Drives shoulder crate `carry: 1`, shrug, `crouch` set-down, and `cupL`/`cupR` coffee handoff with Fen. |
| `festival-roundabout` | `dancer` | Spins continuously in place (`yaw` `0 -> 46` rad) waving overhead atop a circling drift cab cart in a flared dress silhouette. |

## Non-Juniper & Framework Proof Scenes (`5 / 19`)

- `photo-call`: Fen standing/grinning photo op on city hall steps (no Juniper; no Fen GLB rig).
- `snapper-shop`: Giant swamp snapper + snack shop clerk.
- `garden-guard`: Neighbour + four hens guarding tomato patch.
- `harbor-run`: Fen skiff pilot + swamp snapper (vessel scene).
- `stage-test`: Non-staged sim framework proof (`set: false`).

## Known Gaps & Clean Pool-Outfit GLB Swap Path

1. **Missing outfit & pose assets (honest gaps):**
   - **Pool bathing-suit GLB model:** Not authored yet — currently using `assets/juniper/juniper_rig.glb` (`field` cloaked rig) everywhere, including `pool-rimsit` and `pool-surface`.
   - **`swim-tread.glb` and `dive.glb`:** Both do not exist in `tasking/juniper/clips/` yet; `pool-surface` temporarily slows `swim-surface` (`0.55x`) on the rim hold, and `rooftop-dive` stays procedural until `dive.glb` lands.
2. **Clean future swap:** All per-scene GLB loading lives in `games/lanternport/heroglb.js` (`assetURL()` + `HERO_GLB_SCENES`). Dropping in a swimwear GLB that honors the 127-bone contract only requires serving e.g. `juniper_pool_rig.glb` and selecting `cfg.rig || 'juniper_rig.glb'` in `loadHeroGLBAssets()` / `buildRigInstance()`, with zero changes to `stage.js`, `scenes.js`, `sim.js`, or beat timing.
3. **`STAGE` determinism & `StageView` notes:**
   - `evaluateHeroSchedule(handle, cfg, tick)` samples `AnimationMixer` strictly as a function of simulation tick (`timeSec = tick / 30`) with deterministic smoothstep `0.25s` crossfade between segments.
   - Added `test/lanternport-heroglb.test.mjs` covering binary integrity, schedule selection/blending, and live headless Chrome WebGL loading across all 7 converted scenes (`boundBones === 127`, `fallbackVis === false`, `0` runtime exceptions).

## Verification Results

Ran after integration (`7622e68`):
- `node --test test/*.test.mjs`: **61 / 61 passed, 0 failed, 0 skipped** (`12.86s`), including:
  - `test/lanternport-heroglb.test.mjs`: **4 / 4 passed**
  - `test/lanternport-replay.test.mjs`: **4 / 4 passed** (bit-exact `SimClock` replay preserved)
  - `test/headless-pages.test.mjs`: all passed (`FESTIVAL_DAY_ORDER`, replay overlay, mobile phone HUD layout)
  - `test/lanternport-scenes.test.mjs`: all passed (timescale parity & scene event contracts)
