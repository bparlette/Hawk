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
