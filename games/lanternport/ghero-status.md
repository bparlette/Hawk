# DONE — Lanternport Rigged Hero Integration (`ghero-status.md`)

Date: `2026-11-13`
Repo: `bparlette/Hawk` (`main`, `games/lanternport/`)

## Summary

Replaced the procedural `StageView` hero with the rigged 127-bone Juniper GLB (`assets/juniper/juniper_rig.glb`, `2,336,848` bytes, sourced from `tasking/juniper/model/juniper_rig.glb`) driven deterministically by `Three.AnimationMixer` (matching Three.js `r160` `lib/GLTFLoader.js`) across all **14 human-hero staged scenes** (`8` existing scenes including Moth's `pool-rimsit` and `rooftop-dive`, plus `6` newly converted scenes driven by scripted 30 fps pose specs in `tools/pose_specs.json` -> `tools/compile_pose_clip.py` and declarative schedules in `tools/scene_schedules.json` -> `tools/generate_schedules.mjs`). Scene `act()` logic, beats, `FESTIVAL_DAY_ORDER`, journal wiring, Nov 12 button fixes, and bit-exact sim replay (`4/4`) are untouched.

- **Assets + loader commit:** `9942732` (`lanternport: add Juniper rig/pose GLBs and r160 GLTFLoader`)
- **Initial 7-scene integration commit:** `7622e68` (`lanternport: drive 7 staged scenes with rigged Juniper GLB and AnimationMixer`)
- **Moth's pool-rimsit fix + rooftop-dive GLB wiring:** `db7e01b`, `c20d6e8`, `eae7000` (untouched)
- **Verified `juniper_rig.glb` object size in git:** `2,336,848` bytes (`git cat-file -s HEAD:games/lanternport/assets/juniper/juniper_rig.glb`)
- **See also:** [`POSE-STATUS.md`](POSE-STATUS.md) for the scripted pose-clip toolchain and per-clip M2 player verification numbers.

## Staged Scenes Converted to Rigged GLB (`14 / 19`)

| Scene ID | Target Actor ID | Clips Used | Notes / Alignment |
|---|---|---|---|
| `pool-rimsit` | `juniper` | `sit-rim`, `sit-lookback` | `0.25s` crossfade; Moth's `SEATED_Z_OFFSET = 0.0` preserved untouched |
| `cartop-dance` | `juniper` | `dance-cartop` | Loop atop red car roof (`yOffset = STANDING_Y_OFFSET + 0.06`) |
| `club-stage` | `dancer` | `dance-club` | Stage loop plus warm `PointLight` key (`0xffe9d2`) attached to model |
| `pool-surface` | `juniper` | `swim-surface` | `SWIM_Y_OFFSET=0.46`, `zOffset=-1.05`, `rotY=-Math.PI/2`; slows to `0.55x` rate on rim hold |
| `dock-fishing` | `fen` | `idle-stand`, `fish-cast` | `idle-stand` -> one-shot `fish-cast`; fishing rod mesh parented to `bone_22` |
| `cucco-swarm` | `juniper` | `07_01`, `idle-stand`, `09_01`, `sit-rim` | Ground walk/idle/run (`Standing`), then seated on outer plaza fountain coping at `tick >= 760` |
| `fairy-orbit` | `juniper` | `07_01`, `idle-stand` | Walk -> standing pause -> walk along plaza courtyard |
| `rooftop-dive` | `juniper` | `idle-stand`, `07_01`, `dive`, `swim-surface`, `sit-rim` | Moth's `dive` one-shot schedule preserved untouched |
| `pot-rampage` | `juniper` | `07_01`, `pot-rampage`, `idle-stand` | Scripted 75-frame crouch -> overhead lift -> slam smash timed to first pot (`t=140`) & big pot (`t=670`) |
| `chest-fanfare` | `juniper` | `idle-stand`, `07_01`, `chest-fanfare` | Scripted 110-frame kneel -> chest lid open -> arms raised overhead holding red rupee into light |
| `sword-pedestal` | `juniper` | `idle-stand`, `07_01`, `sword-pedestal` | Scripted 140-frame two-handed hilt grip -> pull strain surges -> draw free & overhead reveal (`rate: 0.34`) |
| `ocarina-dawn` | `juniper` | `idle-stand`, `ocarina-dawn` | Scripted 186-frame raise ocarina -> 3-note play with gentle sway -> skyward sunrise gaze -> lower (`rate: 0.30`) |
| `dawn-shift` | `juniper` | `idle-stand`, `07_01`, `dawn-shift` | Scripted 180-frame crate carry & tired sunrise shrug (`t=200..300`) + crouch crate set-down & coffee sip (`t>=380`, `clipOffset: 60/30`), with `attachDawnProps` |
| `festival-roundabout` | `dancer` | `festival-roundabout` | Scripted 60-frame looping celebration dance/hop & alternating overhead wave atop cab-cart roof |

## Non-Juniper & Framework Proof Scenes (`5 / 19`)

- `photo-call`: Fen standing/grinning photo op on city hall steps (no Juniper; no Fen GLB rig).
- `snapper-shop`: Giant swamp snapper + snack shop clerk.
- `garden-guard`: Neighbour + four hens guarding tomato patch.
- `harbor-run`: Fen skiff pilot + swamp snapper (vessel scene).
- `stage-test`: Non-staged sim framework proof (`set: false`).

## Verification Results

Ran after the final conversion pass (`14 / 19` staged scenes):
- `node games/lanternport/tools/verify_clip.mjs --all`: **17 / 17 clips passed** (`34/34` tracks bound, `0` unbound, `animatorOk: true`).
- `node --test test/lanternport-*.test.mjs`: **52 / 52 passed, 0 failed, 0 skipped**.
- `node --test test/*.test.mjs`: **61 / 61 passed, 0 failed, 0 skipped**, including live headless Chrome WebGL loading across all **14** converted scenes (`boundBones === 127`, `fallbackVis === false`, `0` runtime exceptions).
