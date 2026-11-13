# DONE — Lanternport Scripted Pose Clips & Rigged Scene Status (`POSE-STATUS.md`)

Date: `2026-11-13`
Repo: `bparlette/Hawk` (`main`, `games/lanternport/`)

## Scripted Rigging Toolchain (`games/lanternport/tools/`)

| Script / Config | Role |
|---|---|
| `games/lanternport/tools/pose_specs.json` | Declarative 30 fps keyframed bone pose specs (`pelvis`, `spine`, `head`, `leftLeg`, `rightLeg`, `leftArm`, `rightArm`, `hop`, `hz`, ground mode) |
| `games/lanternport/tools/compile_pose_clip.py` | Compiles `pose_specs.json` via monotone cubic Hermite interpolation + automatic ankle-drop grounding through Fable's `Retargeter` / `pose_modes.run_pose` / `glb.write_animation_glb` into `assets/juniper/clips/<name>.glb` |
| `games/lanternport/tools/verify_clip.mjs` | Loads `juniper_rig.glb`, `07_01.glb`, and target clip(s) into the unmodified M2 player (`glb.js`, `rig.js`, `clips.js`, `animator.js`), enforcing `34/34` bound tracks (`0` unbound), unit quaternions, finite FK worlds, and `Animator` transitions |
| `games/lanternport/tools/scene_schedules.json` | Declarative per-scene schedule segments (`actorId`, `clips`, `untilTick`, `startTick`, `clipOffsetFrames`, `loop`, `rate`, offsets, `rotY`) |
| `games/lanternport/tools/generate_schedules.mjs` | Validates clip binaries and generates `CLIP_FILES` + `HERO_GLB_SCENES` entries inside `games/lanternport/heroglb.js` (leaving Moth's `pool-rimsit` and `rooftop-dive` untouched) |
| `games/lanternport/tools/bonemap.json` | Bone map and tuning contract for `juniper_rig.glb` (`127` bones, `34` animated tracks) |

## Newly Authored Pose Clips (`games/lanternport/assets/juniper/clips/`)

Verified via `node games/lanternport/tools/verify_clip.mjs --all`:

| Clip Name | GLB File | Frames (30 fps) | Duration | Mode | Tracks Bound (M2) | Min Foot Y | Animator Gate |
|---|---|---:|---:|---|---:|---:|---|
| `pot-rampage` | `assets/juniper/clips/pot-rampage.glb` | 75 | 2.500 s | one-shot | 34 / 34 (0 unbound) | -75.74 | `animatorOk: true` |
| `chest-fanfare` | `assets/juniper/clips/chest-fanfare.glb` | 110 | 3.667 s | one-shot | 34 / 34 (0 unbound) | -75.74 | `animatorOk: true` |
| `sword-pedestal` | `assets/juniper/clips/sword-pedestal.glb` | 140 | 4.667 s | one-shot | 34 / 34 (0 unbound) | -75.74 | `animatorOk: true` |
| `ocarina-dawn` | `assets/juniper/clips/ocarina-dawn.glb` | 186 | 6.200 s | one-shot | 34 / 34 (0 unbound) | -75.57 | `animatorOk: true` |
| `dawn-shift` | `assets/juniper/clips/dawn-shift.glb` | 180 | 6.000 s | one-shot | 34 / 34 (0 unbound) | -75.65 | `animatorOk: true` |
| `festival-roundabout` | `assets/juniper/clips/festival-roundabout.glb` | 60 | 2.000 s | loop (`wrap=1.75 deg`) | 34 / 34 (0 unbound) | -75.36 | `animatorOk: true` |

*(All 17 clips in `assets/juniper/clips/` — including the 11 existing/locomotion/Moth clips (`07_01`, `09_01`, `bend-car`, `dance-cartop`, `dance-club`, `dive`, `fish-cast`, `idle-stand`, `sit-lookback`, `sit-rim`, `swim-surface`) — passed `34/34` bound tracks and `animatorOk: true`.)*

## Newly Converted Scenes in `heroglb.js` (`14 / 19` Total Converted)

Moth's `pool-rimsit` and `rooftop-dive` schedule entries were preserved untouched.

| Scene ID | Actor ID | Clips Used | Primary Clip Frame Count | Tracks Bound | Suite / Chrome Result |
|---|---|---|---:|---:|---|
| `pot-rampage` | `juniper` | `07_01`, `pot-rampage`, `idle-stand` | 75 | 34 / 34 | Pass (`127` bound bones, `fallbackVis: false`, 0 errors) |
| `chest-fanfare` | `juniper` | `idle-stand`, `07_01`, `chest-fanfare` | 110 | 34 / 34 | Pass (`127` bound bones, `fallbackVis: false`, 0 errors) |
| `sword-pedestal` | `juniper` | `idle-stand`, `07_01`, `sword-pedestal` | 140 | 34 / 34 | Pass (`127` bound bones, `fallbackVis: false`, 0 errors) |
| `ocarina-dawn` | `juniper` | `idle-stand`, `ocarina-dawn` | 186 | 34 / 34 | Pass (`127` bound bones, `fallbackVis: false`, 0 errors) |
| `dawn-shift` | `juniper` | `idle-stand`, `07_01`, `dawn-shift` | 180 | 34 / 34 | Pass (`127` bound bones, `fallbackVis: false`, 0 errors) |
| `festival-roundabout` | `dancer` | `festival-roundabout` | 60 | 34 / 34 | Pass (`127` bound bones, `fallbackVis: false`, 0 errors) |

### Remaining Non-Juniper / Framework Scenes (`5 / 19`)

- `stage-test`: non-staged sim framework proof (`set: false`).
- `photo-call`: Fen portrait scene on city hall steps.
- `snapper-shop`: giant swamp snapper hero.
- `garden-guard`: neighbour + four hens.
- `harbor-run`: Fen skiff vessel scene + swamp snapper.

## Verification Results

- `node games/lanternport/tools/verify_clip.mjs --all`: **17 / 17 clips passed** (`34/34` tracks bound, `0` unbound, `animatorOk: true`).
- `node games/lanternport/tools/generate_schedules.mjs --check`: **OK** (`heroglb.js` matches `scene_schedules.json`).
- `node --test test/lanternport-*.test.mjs`: **52 / 52 passed, 0 failed, 0 skipped**.
- `node --test test/*.test.mjs` (with local HTTP server on port 8765): **61 / 61 passed, 0 failed, 0 skipped**, including live headless Chrome verification of all **14 / 14** converted scenes (`boundBones === 127`, finite skinned bounds, `0` browser runtime exceptions).
