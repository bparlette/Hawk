You are the environment-kit builder for Toad City Baltimore (Claude Sonnet, extended thinking on, medium effort; use high effort for the first kit piece, because it sets the pattern). Self-test every piece in viewer.html before you move on.

## Context (read first)

You are making game assets for **Toad City Baltimore**, a browser open-world brawler set on Baltimore's Inner Harbor. The heroes are Harold, an elderly toad with a cane, and his wife Mavis, who has a grey afro and fights with her handbag. They clean the crime out of each district. Everything is built in code and cel-shaded with ink outlines. The game uses **three.js r160** with plain ES modules: no bundler, no image files, no model files. Every texture is drawn on a canvas at load time.

You were given the **starter kit**: `toadcity_kit.js` (the game's own materials, outline method, rig and pose code, plus the prop collector), `viewer.html` (a standalone test bench), `example_gull_thug.js` (character interface) and `example_bench.js` (prop interface). If the files did not come with this brief, rebuild them from the appendix of the PDF. Your modules must run against the kit unchanged, because the game passes the same `K` object to them.

**Conventions (all units are metres):**

- Y is up, X is east and Z is south (north is −Z). Facing for a character or vehicle at yaw 0 is **+Z**, and its feet or base sit at y = 0.
- Pavement top (kerb) `CURB = 0.16`. Ground floor height `GF = 4.4`, upper floors `FH = 3.4`, parapet `PAR = 1.3`. Harbour water surface `WY = −0.85`.
- City block: 24 × 24 m. Street: 10 m wide (grid period 34 m). Brick promenade on every water edge: 6 m. Render chunks are 64 m and the collision grid is 16 m.
- Character scale: Harold is about 1.6 m tall, Mavis about 2.0 m to the top of her afro, and a standard thug about 2.0 m. The bruiser is the thug rig scaled ×1.2.

**Hard rules for every delivery:**

1. **No `import` statements in your modules.** Everything comes in through the `K` argument. Each file has one `export const META` and one or more `export function buildXxx(K, …)`.
2. **Materials:** create them only through `K.toonMat()`, `K.basicMat()` or `K.makeAtlas()`. Outlines must use the shared `K.OUT_CHAR`, `K.OUT_PROP` or `K.OUT_CITY` hulls (which `K.part()` and `out.build()` add for you). Do not use PBR materials, post-processing, edge-detection passes or lights inside assets. Lamps go through `out.lamp()`.
3. **Textures:** draw them on canvas only. Use at most one 1024² atlas per task family and at most 256² per character map. Do not use image files, web fonts or network fetches. Text uses font stacks such as `Impact, "Arial Black", Georgia, serif`.
4. **Deterministic:** do not call `Math.random()` at build time. Use a seeded LCG (`seed = seed * 16807 % 2147483647`) taken from `opts.seed`.
5. **Do not edit `toadcity_kit.js`.** If you need something it lacks, add the helper inside your own module and say so in the README.
6. **Real signage, original characters:** storefronts, signs and props in the Inner Harbor area **may use real Baltimore businesses' names and sign styles where they really exist there**. Examples: Phillips Seafood, Barnes & Noble and Hard Rock Cafe at the Power Plant, the harbour water-taxi branding, Natty Boh-style corner-bar signs, Utz, Old Bay. Recreate the lettering, colours and sign shapes **drawn on canvas or built from geometry**; never copy or embed logo image files, photos or traced artwork. Only put a real name where that business really is or is typical (a crab house, a corner bar, the Power Plant shops); fill everything else with plausible Baltimore signage. **Characters stay original:** no real people, likenesses, real gang colours or symbols, official mascots or film/game characters, and no brand logos on thugs or bosses. Third-party code is allowed only under MIT or CC0, credited with its URL in `LICENSES.md`.
7. Do **not** model landmark buildings (stadiums, the aquarium, the power plant, towers, the fort, the monument and so on). The in-house team builds those.
8. Use three.js r160 APIs only. The code must have no console errors in Chrome or iOS Safari.


# Task A: Baltimore rowhouse and city-block kit

## Goal
Build a modular kit that fills the generic 24 × 24 m city blocks around the harbour with recognisably **Baltimore** rowhouse streets. The kit covers Formstone fronts, white marble stoops, bracketed cornices, painted window screens, corner bars and corner shops, in 3- and 4-storey variants. It must merge into the game's chunk meshes, so the whole city stays at a few draw calls per 64 m chunk.

## Pieces to build

1. **`buildRowhouse(K, out, atlas, x, z, ang, opts)`**: one house. Frontage 4.2–6.0 m (2 or 3 window bays), depth 12–14 m, 3 or 4 storeys (`opts.floors`). Front facade options in `opts.front`:
   - `formstone`: faux-stone cement facing in irregular blocks, grey-beige to pink-grey, drawn on the kit atlas.
   - `brick`: red or tan brick, with optional painted brick (`opts.paint`).
   - `permastone`: a smoother variant of Formstone.
   The house also has:

   - **A white marble stoop**: 3–5 steps, 1.3–1.5 m wide, projecting 1.4–1.8 m onto the pavement, with a slight bevel. Use near-white `#eae6dc` with a cool shadow band.
   - **A cornice**: a bracketed metal or wood cornice at the roofline, with 0.5–0.8 m projection, 4–8 brackets and a dentil band. Painted cornice colours come from the palette.
   - **Windows**: 1/1 sash with lintels and sills; some ground-floor windows get **painted window screens**, which are original folk-art scenes drawn on canvas (a red-roof cottage by a lake, a swan, a lighthouse, a sailboat). Use at least 4 designs and no copies of real artworks.
   - The door with transom and number, a basement window grille, a downspout, and a flat roof with a low parapet, a hatch and an optional rooftop deck.
2. **`buildCornerBar(K, out, atlas, x, z, ang, opts)`**: the end-of-row corner building with a chamfered corner door, a neon or painted sign: real Baltimore corner-bar styles are welcome (Natty Boh-style beer signs, "TAVERN", "CRAB HOUSE", "BAR & GRILL"), drawn on canvas, glass-block windows and an awning. The neon glows at night through `out.glow()`.
3. **`buildCornerShop(K, out, atlas, x, z, ang, opts)`**: a corner store with a big front window, a roll-up security shutter (half-open option) and a sign ("CORNER MARKET", "CARRYOUT", "BARBER", "HARDWARE", "LAUNDROMAT", "DELI"), plus real local product signs in the window (Utz, Old Bay, Natty Boh-style), drawn on canvas.
4. **`buildRowBlock(K, out, atlas, x0, z0, x1, z1, opts)`**: fills one block. Houses face all four streets and stand shoulder to shoulder, with a corner bar or shop on 1–2 corners and a 3 m rear alley or yard strip in the middle (`out.coll` closes it). It mixes fronts, heights, colours and stoops from `opts.seed`. Neighbours never repeat the same front and colour.
5. **`KIT_TILES`**: the canvas-drawn tiles (Formstone, brick, painted screens, signs, door and window details) for **one** 1024² atlas, made with `K.makeAtlas(KIT_TILES)`.

## Interface (must match exactly)
File names: `src/rowkit_tiles.js`, `src/rowkit_rowhouse.js`, `src/rowkit_corner.js` and `src/rowkit_block.js`.
```js
export const META = { id: 'rowhouse', kind: 'kit', footprint: [4.8, 13], floors: [3, 4] };
export function buildRowhouse(K, out, atlas, x, z, ang = 0, opts = {}) {
  // (x, z) = centre of the FRONT wall at pavement level; the front faces +Z rotated by ang. Base sits on K's CURB (0.16).
  // Write only through: out.solid(geom, colour, outline?), out.glow(geom, colour), out.decal(geom, atlas, tileName),
  //                     out.coll({x0,x1,z0,z1} | {x,z,r}), out.bld({x0,x1,z0,z1,h}), out.lamp(x,y,z), out.hook(type, data)
  return { width, depth, height };   // so the block filler can pack houses
}
```

- Geometry is placed in **world space** with `K.place(geom, x, y, z, ry)`. `out.build()` merges everything into one toon mesh, one outline hull, one glow mesh and one decal mesh.
- **Night windows:** each window pane goes through `out.glow(paneGeom, colour)`, with roughly 45% lit chosen by the seeded RNG. Lit panes use warm `#ffe08a` / `#ffbf3c`; unlit panes are not written to glow (they stay as dark glass in `out.solid`). Shop glass and neon always glow.
- `out.bld()` adds one camera-collision box per house. `out.coll()` gives the house footprint and each stoop. `out.hook('climb', {x, z, ang, top})` marks one drainpipe or ladder per block for the CLIMB action.

## Performance budget

- **One house ≤ 2,500 triangles**, a corner building ≤ 3,500, and **one full block ≤ 30,000**.
- Materials: only what `out` uses (`K.CITY_MAT`, the glow material and **one** kit atlas for the whole task). A full block must build to **≤ 4 draw calls** (plus the shadow pass).
- Outline hulls only on major masses (house box, stoop, cornice, bay edges). Use `outline: false` for anything under about 6 cm (mullions, bricks, trim strips).

## Style

- Use chunky, slightly exaggerated proportions: cornices a bit deeper, stoops a bit whiter and wider than in reality, to read on a phone.
- Formstone gets bold irregular block outlines drawn in a darker tone of the base (not `K.INK`) so that it does not become noise at a distance.
- Wall colours come from the building palette (red brick `#8a4a3a`, grey stone `#6f6a62`, tan brick `#9a6a44`, plum `#5a4f5c`, green-grey `#4f5a52`, sandstone `#a4907a`) plus painted-brick pastels (`#c9b48a`, `#b8a27a`, `#9ab0b8`, `#c49a9a`).

## Acceptance checklist

- [ ] All five pieces exist with the exact signatures. `viewer.html?show=street` shows two facing blocks across a 10 m street with a pavement, in day and night.
- [ ] Formstone, white marble stoops, bracketed cornices, painted screens, corner bar and corner shop are all present and recognisable.
- [ ] Both 3- and 4-storey variants exist, with at least 3 front types and at least 4 painted screen designs.
- [ ] Budgets are measured: house ≤ 2.5k, corner ≤ 3.5k and block ≤ 30k triangles; a full block uses ≤ 4 draw calls; there is one atlas in total.
- [ ] Night: about 45% of windows lit (seeded, stable on rebuild), with shop glass and neon glowing.
- [ ] Colliders, camera boxes and climb hooks are written. Nothing floats and nothing sinks below `CURB`.
- [ ] Same seed gives the same block; a different seed gives a visibly different mix.
- [ ] Signs read as real Baltimore: real names and sign styles only where they really exist or are typical, all drawn on canvas or built from geometry (no logo image files). `LICENSES.md` is present.

## Do NOT

- Do not model landmarks or any specific real building.
- Do not use per-house materials or per-house meshes; everything goes through `out`.
- Do not use image textures, logo files, or photos pasted as textures. Real names and sign styles must be redrawn on canvas.

## Session plan
The **first piece sets the pattern**: build the 3-storey Formstone rowhouse to full quality and self-test it before anything else. Then build the other fronts and 4 storeys, then the corner bar and corner shop, then the block filler, then the previews.


## Delivery and self-test

**Make one zip per task:** `toadcity_task<LETTER>_<short-name>_v<N>.zip`, laid out like this:
```
src/                  your modules (snake_case file names, e.g. gang_harbor_rats.js, boss_raven_king.js, rowkit_rowhouse.js)
toadcity_kit.js       the kit, byte-identical to the one you were given
viewer.html           your test bench (start from the kit's viewer.html): imports ./src/*.js, ?show=<id>, ?night=1, ?pose=…
previews/             <asset_id>_day.png and <asset_id>_night.png at 1280x720, plus <group>_phone_390x844.png
README.md             exports, how to view, the MEASURED budget table (parts, tris, draw calls, materials), known issues
LICENSES.md           "All original, procedural" or credits (name, URL, licence) for any MIT / CC0 source used
```

**Self-test loop** (run it for every asset before you move to the next):

1. Serve the folder (`python3 -m http.server 8000`) and open `viewer.html?show=<id>`. Check day, then press N for night, then P to cycle poses.
2. Read the corner readout. **Draw calls and triangles must be inside the budget** for the asset type. Count your materials too.
3. Look at the asset at gameplay distance in a 390×844 window, the iPhone portrait view. The silhouette must read at about 6–10 m away.
4. Take screenshots. Headless Chrome works with `--use-gl=swiftshader`; wait for `window.__ready === true`, then save the `previews/` PNGs.
5. The console must show zero errors. Fix the asset before you move on.

**Do not send:** model or image files (GLB, OBJ, FBX, PNG/JPG textures), minified code, copies of three.js, or anything with an unclear licence.

