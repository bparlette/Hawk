# world3d.js — the shared 3D engine: era-config contract

`play/engine/world3d.js` is the ONE 3D engine for eras e3–e8 of the Vice Beach
bake-off. It builds the canonical level (`level/canonical/vice_beach.json` via
`engine/level_vice.js`) into a three.js scene once — ground, buildings, water,
palms, placement props, parked cars — and renders the shared sim
(`engine/sim.js`) into it. An era is a CONFIG + a HUD skin, never a new engine.

## An era module is ~30 lines

```js
import { createWorld3D } from "../engine/world3d.js?v=<BUILD>";
const ASSET_BASE = new URL("../../assets/e5/", import.meta.url).href;  // from the
        // module's own URL — NEVER document-relative (the e1 saga, Nov 15)
export function create(canvas, level) {
  const engine = createWorld3D(canvas, level, { /* config below */ });
  // … era HUD on a 2D overlay canvas inserted as canvas.nextSibling
  //   (see eras/e3.js — district bar + glyph timer + diagnostics box) …
  return { draw(sim) { engine.draw(sim); drawHUD(sim); },
           wrapInput: (i, s) => engine.wrapInput(i, s),
           debug: engine.debug, dispose() { hud.remove(); engine.dispose(); } };
}
```

Register it in `play/eras/index.js` (`load: () => import("./e5.js?v=<BUILD>")`).
The page (`play/index.html`) owns the sim, the fixed-step loop and the merged
{gx, gy, act} input (floating stick + IN/OUT + keys); it routes every step's
input through `view.wrapInput` when the era provides one. Nothing else changes.

## Config

| Key | Meaning |
|---|---|
| `era`, `name` | `"e5"`; display/dataset stamps. |
| `assetBase` | Absolute URL of `assets/<era>/`, resolved from the era module's `import.meta.url`. |
| `build` | Version stamp appended to every fetch (`?v=`). Bump on any change to the era's module graph. |
| `camera` | `{ pitchDeg, fovDeg, distanceM, pullBack }`. **Framing is locked:** `2 · distanceM · tan(fovDeg/2) · (420/860)` must equal **33.6 m** (ground width at the player's ground point). Each pack's `manifest.cameraHint` already satisfies this — copy its numbers. `pullBack` 0–0.2 = speed pull-back fraction while driving. The camera NEVER yaws: stick directions stay world directions. |
| `fog` | `{ color, nearFromPlayerM, farFromPlayerM }` — measured **from the player's ground point** (the Opus rule): the engine sets `scene.fog.near/far = cameraDistanceToPlayer + value` every frame. Source: the pack's `manifest.fogHint`. |
| `sky` | Horizon/clear colour. |
| `renderScale` | Internal render resolution as a fraction of CSS px (e3: `240/420`, the pack's `cameraHint.renderTarget`, upscaled nearest by the page CSS). |
| `palette` | `{ facade: [hex…], trunk, bench, pole, bush: [hex…] }` — vertex colours for buildings/props. Building sides get baked face shading (N 0.68 / W 0.78 / E 0.85 / S 0.95). |
| `heroCarStrip` | Key into `manifest.sprites.rotatedCarStrips`; frame 0 (north top view) textures the player's car. Parked cars resolve model → `carModels[].spriteIndex` automatically. |
| `entry` | `{ style: "runaround", doorSec }` — the entry sequencer (below). `doorSec` ≈ 1.15 gives GTA III's ~2.5 s passenger-side entry (run-around at sim run speed + the door beat). |
| `lighting` | Reserved (hemi/sun values); the default materials are **unlit + vertex-colour shading** per ERAS.md ("unlit textures + vertex-colour shading") — three r160's physical light falloff drowns the pack art, so shading is baked, not lit. |
| `wash` | `{ file, strength }` — the pack's `lighting/*-wash.png` applied as a multiply-blend overlay div directly above the game canvas (below the page chrome), or `null`. |
| `lampGlow` | 0–1 opacity for placement lamp glow sprites (promenade lamp line), 0 = off. |

## What the engine does with the level (and only the level)

- **Ground:** one merged mesh; per-cell lid texture from the pack's
  `tiles.lids` (rotated by `lidrot`), flat-overlay lids layered like e1
  (ground-under from a nearest-non-flat BFS; palm lids become palms).
- **Buildings:** zone-H cells with z ≤ 3 become boxes of height `(4 − z) · 4 m`
  (LEVEL-SPEC), roof = the cell's lid texture, sides = palette facades. z 4–5
  footprints stay flat at grade.
- **Water:** zones O/B/P on a scrolling extracted tile texture at y = −0.18.
- **Palms:** cells with the palm flag (or a palm lid) get a trunk prism + two
  crossed horizontal canopy quads from the pack's palm tile.
- **Placements (C1):** positions come ONLY from `level.placements`. Type 66 →
  its OBJECT sprite as a ground decal; type 8 (the promenade row) → lamp posts
  + glow; type 2 → benches; type 16 → a low fixture; types 5/68/71/86/87
  (grass/sand scatter, no art in any pack) → bush/rock blobs. **None are solid.**
- **Parked cars (C2):** rendered from `level.placements.cars`; COLLISION is in
  `engine/sim.js` (solid circles of `TUNE.car.radius` for hero and car alike) —
  never reimplement it in an era.
- **Peds:** deterministic dressing patrols on promenade/sidewalk cells, pure
  functions of `sim.tick` (the e1 pattern), billboards from `manifest.peds`.
- **Hero:** billboard from `manifest.link` — direction by dominant axis, frame
  from `sim.hero.phase` (ground-covered walk cycle), forward lean at run speed,
  blob shadow. The player's car gets body roll/pitch (visual only), a swinging
  driver door and brake-light flare on braking and on entry ignition.

## The entry sequencer (`wrapInput`)

One movement model, era-flavoured entry. When `act` rises near the car on foot,
the sequencer takes over the stick: it walks the hero **around the front bumper
to the driver door** (passenger side) or straight to the door (driver side),
holds a `doorSec` door beat (door mesh swings, hero slides to the sill), then
pulses `act` once so the sim's own enter fires. GTA III has **no hood slide**
(`research/e3-movement/MOVEMENT.md`). It drives The Run's autopilot through the
exact same path (the page wraps demo input too), so the demo entry is the
player's entry. Exit stays the sim's instant step-out, with a door flourish.

## Diagnostics (the phone-truth rule)

The engine mirrors its load state onto the game canvas: `canvas.dataset.state`
(`loading | ready | fallback`), `dataset.w3dstage`, `dataset.w3derr`,
`dataset.w3dfail`. On any pack failure it builds a flat zone-colour fallback
world and stays playable — never a silent blank. The era's HUD overlay prints
the diagnostics box while not ready (see eras/e3.js). A build is only "live"
after EXECUTING it at production path depth (`games/gta-bakeoff/play/?era=eN`)
with zero page errors — serve-verify ≠ run-verify.

## Performance shape

Static world = ~8 merged draw calls + 4 car groups + ~15 billboards. Textures
load from the pack sheets with NearestFilter and no mipmaps. e3 renders at
240×490 internal. (Headless SwiftShader fps on the build VM is not a phone
measurement; the phone verdict is the owner's.)
