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
