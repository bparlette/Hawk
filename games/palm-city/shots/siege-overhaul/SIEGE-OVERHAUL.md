# Palm City — Motel Siege Asset Overhaul, Round 2 (`SIEGE-OVERHAUL.md`)

**Queue 4 Task 2** (`bparlette/tasking/gemini.md`). Zero edits to live `src/` or runtime `assets/`.
Round 1's picked `AFTER` lighting (`assets/siege/`) is preserved untouched as `before/`, and every character sheet, cutaway sheet, and prop is overhauled in `after/`.

---

## 1. Complete Siege Asset Inventory (`23` Files)

| Category | Asset File | Where Today (`assets/siege/` & `siege.json`) | Round-2 Dimensions | What Changed in `after/` |
| :--- | :--- | :--- | :--- | :--- |
| **People (Hero)** | `side_player.webp` | `peds.player` (`2198×368`, `7×2`, `14` poses) | `1884×920` (`6×5`, `30` poses, `314×184` cell) | `#210f2e` ink anatomy, sculpted profile/face, coral cap, teal jacket, white sneakers; expanded 14 → **30 articulated poses** |
| **People (Cop)** | `side_cop.webp` | `peds.cop` (`2198×368`, `7×2`, `14` poses) | `1884×920` (`6×5`, `30` poses, `314×184` cell) | Peaked badge cap, aviators, mustache, gold badge, utility belt, boots; **30 articulated poses** |
| **People (SWAT)** | `side_swat.webp` | `peds.swat` (`2198×368`, `7×2`, `14` poses) | `1884×920` (`6×5`, `30` poses, `314×184` cell) | Matte tactical helmet, cyan ballistic visor, balaclava, Kevlar plate carrier, harness line on `rappel0/1`; **30 poses** |
| **Cutaway Day** | `motel_color.webp` | `motel.color` (`1664×1105`) | `1664×1105` | Built atop Round-1 AFTER lighting: striped retro wallpaper, window drapes, framed wall art, bedside nightstands + lamps, F0 key rack, hallway ice machine, roof AC ducting, balcony planter |
| **Cutaway Night** | `motel_night.webp` | `motel.night` (`1664×1105`) | `1664×1105` | Built atop Round-1 AFTER dusk sconce cones + warm bedside lamp pools + cyan ice machine glow |
| **Barricades (4)** | `barricade_desk_intact.webp`, `barricade_desk_damaged.webp`, `barricade_dresser.webp`, `barricade_mattress.webp` | `props.desk*`, `dresser`, `mattress` | `96×64`, `96×64`, `64×80`, `88×48` | Crisp `#210f2e` ink contours, wood paneling/brass bell/pulls, quilted coral-striped mattress, splintered crack state |
| **Traps (10)** | `trap_vend_{intact,dropped}.webp`, `trap_tv_{intact,broken}.webp`, `trap_cart_{intact,tipped}.webp`, `trap_fusebox_{intact,shorted}.webp`, `trap_ac_{intact,dropped}.webp` | `props.vend*`, `tv*`, `cart*`, `fusebox*`, `ac*` | Exact `siege.json` pixel sizes (`2×` of world `w×h`) | Glowing soda display + spilled cans, CRT rabbit-ears + cracked glass, chrome towel cart, lightning-bolt breaker + sparks, louvered AC box |
| **Roof & Sign (4)** | `prop_ext_ladder.webp`, `prop_roof_hatch_closed.webp`, `prop_roof_hatch_open.webp`, `prop_neon_motel_sign.webp` | `props.ext_ladder`, `hatch*`, `neon` | `48×144`, `88×32`, `96×88`, `192×112` | Clean aluminum rungs, latched/hinged hatch lip, pink/cyan neon `MOTEL` + gold `VACANCY` sign |

---

## 2. Character Sheet Layout (`6 cols × 5 rows = 30 poses`) for Fable

All three sheets (`side_player.webp`, `side_cop.webp`, `side_swat.webp`) keep the **exact** cell size (`314 × 184 px`) and foot anchor (`ox: -50.6, oy: -56.1, w: 101.2, h: 59.4` at `su: 22`). Update `cols: 6` and `poses` in `assets/siege.json`:

```json
"cols": 6,
"poses": [
  "walk0", "walk1", "walk2", "walk3", "walk4", "walk5",
  "walk6", "walk7", "idle", "idle1", "climbA", "climbB",
  "climb2", "climb3", "push0", "push1", "push2", "pry0",
  "pry1", "pry2", "wind", "punch", "slam", "rappel0",
  "rappel1", "jump", "jump1", "hurt", "busted", "down"
]
```

**Cycle Mapping Notes (`src/siege_render.js` `frameOf`):**
- **Walk (8 frames):** `walk0`..`walk7` (contact → down → passing → high-point × 2 sides; replace `% 6` with `% 8`).
- **Idle (2 frames):** `idle` / `idle1` subtle breathing alternation.
- **Climb (4 frames):** `climbA`, `climbB`, `climb2`, `climb3` alternating hand-over-hand & knee drive on stairs/ladders.
- **Push (3 frames):** `push0`..`push2` when pushing a barricade (`b.slide > 0` / pushing).
- **Pry (3 frames):** `pry0`..`pry2` when prying the roof hatch.
- **Action / Breach:** `wind` → `punch` → `slam` (door-bashing / heavy attack).
- **SWAT Rappel:** `rappel0` / `rappel1` during SWAT rope descent.
- **Jump / KO:** `jump` (tuck) / `jump1` (land), `hurt`, `busted` (kneeling hands-up), `down`.

---

## 3. Contact Strips & Bake-Off Sheets

- **Character Frame Strips:** `strip_player.png`, `strip_cop.png`, `strip_swat.png`
- **Phone Bake-Off Comparisons (`420×860 @2x`):** `bakeoff-golden-phone.png` (`t = 0.25`), `bakeoff-dusk-phone.png` (`t = 0.85`)
- **Builder Script:** `node tools/build_siege_overhaul.mjs` (imports `tools/siege_chars.mjs`)
