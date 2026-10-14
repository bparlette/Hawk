# Crystal Cave 2.5D (vertical slice)

Live: https://crystal-cave-25d.surge.sh

A short 2.5D side-scroller: flat 2D tile game logic and pixel sprites inside a lit, glowing 3D crystal cave. All art and characters are original (Pip, a turtle-shell kid with a blue bandana, and crystal beetles).

## Controls
- Move: ← → or A / D
- Jump: Space, Z, ↑ or W (hold to jump higher)
- Run: Shift or X
- Touch (phones, or any screen up to 820px wide): ◀ ▶ on the left, B (run) and A (jump) on the right
- `?bot` in the URL starts the auto-play test bot

## How it's put together
- `source/src/level.js`: the level as a 100×20 tile grid of strings (made by `genlevel.py`). Gameplay reads only this grid.
- `source/src/main.js`: 2D game running at a fixed 60 Hz. Hitboxes are boxes tested against the grid, with X and Y handled separately. Includes run acceleration and skid, coyote time, jump buffering, variable jump height (extra gravity when you let go of jump), stompable enemies that turn at walls and ledges, bump blocks, coins and the goal. The camera has a deadzone and looks ahead in the direction you run. Sprite positions are smoothed between steps.
- `source/src/world.js`: turns the grid into the 3D cave. The 3D side never changes gameplay.
  - Rock tiles become bevelled boxes, slightly jittered and merged into one mesh per 16-column chunk. Top faces get an icy colour and a bump map generated on a canvas.
  - The top edges of exposed tiles get thin glowing cyan rims, merged into one mesh.
  - Faceted crystal clusters (crystal platforms, decoration, mid-layer and abyss) are all one merged flat-shaded mesh, glowing by vertex colour.
  - Stone columns have glowing bands. A mid layer holds stalactites, rock pillars and mounds. A painted backdrop wall sits far behind.
  - Bump blocks: cave-brick blocks, plus rune blocks whose glowing rune pops out a coin.
  - Coins are drawn as one instanced mesh. The goal is a crystal gate with a swirling portal.
- Rendering: 25° perspective camera tilted slightly down, so the parallax comes from real depth plus fog. Lights are a key light, a magenta back light, a cyan fill, a hemisphere ambient, four point lights that move to the crystals nearest the camera, and a light that follows the hero.
- Post-processing: UnrealBloom → sprite pass → OutputPass (neutral tone map) → vignette and colour grade. Sprites are drawn after bloom, but still hidden correctly behind the world, so the pixel art stays sharp instead of glowing.
- `source/src/sprites.js`: the hero's 8-frame sheet (idle, run, jump, fall) and the beetle's 3-frame sheet, drawn as pixel art on a canvas with an automatic outline. Shown on flat planes with nearest-neighbour filtering.
- About 31 draw calls and about 100k triangles per frame.

## Build / test / deploy
- `./build.sh`: esbuild bundles three.js from node_modules into `dist/game.js`, so no CDN is needed.
- `./run.sh 1280 720 d_` / `./run.sh 390 844 m_`: Playwright bot plays from start to goal in the background. Results go to `T/<prefix>log`.
- `./deploy.sh`: surge.
