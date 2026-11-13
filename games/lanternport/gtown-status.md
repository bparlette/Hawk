# Lanternport Town Re-Dress Status (Gemini Pass)

## Goal
Make the town re-dress transformation obvious at a glance in both a phone-sized still (`420px` wide) and full size across all 6 camera viewpoints (`plaza`, `dock`, `street`, `harbour`, `rooftop`, `pool`) using bold silhouette and colour changes rather than high-frequency micro-props.

## Footprint & Guardrails
- **Modified:** `games/lanternport/dressing.js` (plus `games/lanternport/gtown-status.md` and `games/lanternport/audit-assets/town-gemini/`)
- **Untouched (byte-identical):** `stage.js`, `filmscenes.js`, `filmscenes2.js`, `festival.js`, `fx.js`, `sim.js`, `index.html`
- **Determinism:** Purely deterministic seeded LCG (`0x44524553`); zero `Math.random()` or clock reads; sim digest strictly untouched.

## Performance & Draw-Call Budget
- **Before (base city without dressing):** `29` draw calls (city static meshes + hero/entities)
- **Added by `buildDressing`:** `15` instanced draw calls (`1` `THREE.InstancedMesh` per geometry/material bucket in `LISTS`)
- **Total after:** `44` draw calls (`15,099` total dressing instances across the 15 instanced meshes)

## What Changed Per Viewpoint

| Viewpoint | Key Silhouette & Colour Changes | At-a-Glance Verdict (420px & Full) |
| :--- | :--- | :--- |
| **`plaza`** (`#1`) | Framed by a crimson-and-gold **Triumphal Festival Archway** on the South approach (`x=0, z=-22`), vertical festival banners, glowing amber lantern strings, a purple-and-gold hot-air balloon in the upper-left sky, and the **16 m Golden Sun-Spire & Radial Maypole Canopy** rising at `(0, 0)` with 12 radiating bunting & lantern webs. | **PASS** — Immediate high-contrast foreground frame and central golden landmark. |
| **`dock`** (`#2`) | Bold crimson-and-cream striped harbour awning + high-vis yellow cargo stack on the right dockside warehouse, a **rooftop lighthouse cupola with glowing beacon** breaking the right skyline, and multi-tiered diamond bunting + glowing lanterns spanning the left street corridor. | **PASS** — Strong colour blocking on the right warehouse/skyline and left street corridor. |
| **`street`** (`#3`) | Dense overhead **criss-crossing festival bunting and glowing lantern canopies** spanning the main South avenue, bold striped shopfront awnings (crimson/cream, purple/gold) along both building facades, large painted geometric wall murals, rooftop clock cupola, the plaza archway down the avenue, and coral/purple festival balloons in the sky. | **PASS** — Transforms a bare beige canyon into a vibrant festival avenue. |
| **`harbour`** (`#4`) | Overhead criss-crossing **festival bunting and glowing string lights** across the promenade trees, bold **painted geometric murals** along both the left and right stone sea walls, and **giant billowing striped triangular ship sails** (coral, gold, teal, cream) rising above the battlements on the water. (Also includes a 15 m yellow/crimson harbour gantry crane and stacked colour-blocked containers along the South quay). | **PASS** — Strong vertical sail silhouettes on the horizon, bold murals on blank walls, and warm overhead lights. |
| **`rooftop`** (`#5`) | Outer-rim **Stage-Roof Festival Pergola** (`y=15`) with timber posts, alternating crimson/gold/teal/purple/coral valances, and glowing lanterns framing the perimeter of the roof (leaving the inner stage deck clear), plus a **turquoise/coral hot-air balloon** in the center sky and colourful rooftop cupolas/pavilions across the NW skyline. | **PASS** — Immediate foreground pergola frame and mid-sky festival balloon. |
| **`pool`** (`#8`) | North-rim **Stage-Roof Festival Pergola** with teal/coral valances and glowing lanterns framing the upper deck, **coral and purple festival balloons** + the **Golden Plaza Sun-Spire** rising in the center-right sky, and painted murals/banners along the distant North town wall. | **PASS** — Clear roofline framing, sky silhouettes, and distant wall colour. |

## Deliverables & Stills (`games/lanternport/audit-assets/town-gemini/`)
For each of the 6 viewpoints (`plaza`, `dock`, `street`, `harbour`, `rooftop`, `pool`):
- `town_<view>_before.jpg` — Full-size (`566x664`) before still (dressing hidden)
- `town_<view>_after.jpg` — Full-size (`566x664`) after still (dressing visible)
- `town_<view>_after_420w.jpg` — Phone-width (`420x493`) after still
- `town_<view>_before_after.jpg` — Side-by-side (`1132x664`) comparison pair

## Steps & Commits
- [x] **Step 1:** Rework `games/lanternport/dressing.js` with bold architectural and festival silhouettes; verify all 25 tests pass (`e6b2613`).
- [x] **Step 2:** Capture before/after stills (full-size, `420px` phone-size, and side-by-side pairs) in `games/lanternport/audit-assets/town-gemini/` and verify every viewpoint pair passes the at-a-glance test.

## Left Undone
- Nothing left undone. All 6 viewpoints pass the at-a-glance test, all 25 automated tests are green, and all guardrails are preserved.
