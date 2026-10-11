# Toad City Baltimore — environment assets (Tasks A and B)

Procedural, cel-shaded three.js r160 assets for the Toad City Baltimore brief ("Environment: rowhouse kit, street props and vehicles").
Everything is built in code (geometry from primitives / extrusions / lofts, every texture drawn on a canvas at load); no model, image or font files.

| | Task | Modules | Delivery zip |
|---|---|---|---|
| A | Baltimore rowhouse and city-block kit | `src/rowkit_*.js` | `dist/toadcity_taskA_rowhouse_kit_v1.zip` |
| B | Street props and vehicles | `src/props_*.js`, `src/veh_*.js` | `dist/toadcity_taskB_props_vehicles_v1.zip` |

Per-task READMEs (exports, how to view, **measured** budget tables, self-test results, known issues) are in `docs/README_A.md` and `docs/README_B.md`
(they are also the `README.md` inside each zip). Previews (day, night, iPhone 390x844) are in `previews/`.

## Quick look

```
python3 -m http.server 8000
open http://localhost:8000/viewer.html?show=street        # Task A: two facing blocks across a street (N = night)
open http://localhost:8000/viewer.html?show=vehicles      # Task B: boats, cars, cart, skateboard with animate() running
open http://localhost:8000/viewer.html?show=props
```
The viewer loads three.js r160 from unpkg (an import map; it is never copied into `src/`). Every `?show=<id>` is listed in the task READMEs.

## Layout

```
toadcity_kit.js      the shared kit K  (REBUILT from Appendix A of the brief: the starter zip was missing; see below)
viewer.html          test bench (kit viewer): ?show=<id>, night, cameras, budget readout, window.__api for the harness
src/                 the deliverable modules (no imports, one META, build functions that take K)
examples/            example_bench.js, reproduced from the brief
previews/            PNGs written by tools/previews.mjs
docs/                README_A.md, README_B.md, measured_A.json, measured_B.json
dist/                the two delivery zips
tools/               dev-only harness (not shipped): headless Chromium screenshots, measurements, zip builder
```

## Kit note

The brief says the starter kit (`toadcity_kit.js`, `viewer.html`, `example_gull_thug.js`, `example_bench.js`) comes as a zip. It was not attached, so `toadcity_kit.js` was rebuilt from Appendix A:
the prop / city core (materials, outline hulls, `part`, `place`, `makeOut`, `makeAtlas`) is the appendix text; the elided rig, pose and lighting sections were re-created from the numbers in the brief.
The modules in `src/` use only appendix members (`K.THREE`, `place`, `makeOut`, `makeAtlas`, `toonMat`, and `CURB` / `GF` / `FH` with the brief's values as fallbacks), so the game's own kit can replace the file unchanged.
`example_gull_thug.js` is not reproduced (the brief prints no code for it).

## Dev harness (optional)

```
cd tools && npm install            # three@0.160.0 + playwright-core (Chromium from /opt/pw-browsers or $CHROME)
node tools/measure.mjs all         # budgets + determinism + lit-window ratio -> docs/measured_*.json
node tools/previews.mjs all && node tools/batch.mjs /tmp/previews_jobs.json   # previews/*.png
python3 tools/build_deliveries.py  # docs/README_*.md and dist/*.zip
```
The harness answers the viewer's unpkg request from `tools/node_modules/three`, so it works offline.
