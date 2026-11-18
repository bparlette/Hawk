# Motel Siege Asset Overhaul — Round 2 (`SIEGE-OVERHAUL.md`)

> Complete asset overhaul starting from the picked Round-1 `AFTER` lighting (`shots/siege-interiors-bakeoff/after/`). People come **first** (art & multi-frame cycles), followed by enriched motel room/hallway/exterior dressing and all `18` furniture, barricade, trap, and signage props in `#210f2e` dark-plum ink. Zero live `src/` or `assets/` edits.

---

## 1. Full Siege Asset Inventory (Before -> Round 2 After)

### A. Side-View Characters (`PRIORITY #1` — Expanded `7×2` -> `8×3` `2512×552 px`, `314×184 px/cell`, `su=22`)
- **Live locations:** `assets/siege/side_{player,cop,swat}.webp`, `assets/siege.json` (`peds.{player,cop,swat}`).
- **What changed:**
  - Replaced un-inked Cycles stick silhouettes with bold `#210f2e`-inked (`2.6 px`), phone-readable proportions, articulated knees/elbows/ankles, expressive jawlines/eyes, crimson ballcap + teal windbreaker (`player`), peaked cap + gold badge + utility belt (`cop`), and tactical ballistic helmet + cyan visor + vest (`swat`).
  - Expanded from `14` poses (`6`-frame walk, `2`-frame climb) to **`24` poses** (`cols: 8, rows: 3`):
    - **Index `0..7`:** `walk0`..`walk7` (8-frame full contact -> down -> passing -> high-point gait cycle with sneaker sole flexion)
    - **Index `8..14`:** `idle`, `wind`, `punch`, `climbA`, `climbB`, `climb2`, `climb3` (4-frame hand-over-hand stair/ladder climb; `climbA`/`climbB` preserve backward compatibility with `siege_render.js`)
    - **Index `15..23`:** `push0`, `push1` (barricade lean-in push), `pry0`, `pry1` (roof hatch crowbar pry), `rappel0`, `rappel1` (SWAT rope descent), `hurt`, `down`, `jump`
  - **Contact Sheet:** [g_overhaul_people_strips.png](./g_overhaul_people_strips.png)

### B. Motel Cutaway Architecture (`1664×1105 px`)
- **Live locations:** `assets/siege/motel_{color,night}.webp`.
- **What changed:** Layered ON TOP OF Round-1's picked `AFTER` lighting (100% preserving its warm golden glazes and saffron dusk sconce cones) with retro room dado rails & wainscoting, framed tropical wall art, bedside lamp shades + night wall cones, and the 1st-floor illuminated lobby ice machine.

### C. Barricades, Traps & Roof/Exterior Props (`18` WebPs at exact `2 px/wu` pixel sizes)
- **Live locations:** `assets/siege/{barricade_*,trap_*,prop_*}.webp` + `assets/siege.json` (`props.*`).
- **What changed:** Re-rendered all `18` props in crisp `#210f2e` ink with wood grain, diamond mattress quilting, lobby bell on front desk, `PALM` soda bezel on vending machine, rabbit-ear CRT TVs, steel breaker lightning decal on fusebox, louvered AC coils, riveted extension ladder, and glowing `MOTEL / VACANCY` neon tubes.
- **Props Sheet:** [g_overhaul_props_sheet.png](./g_overhaul_props_sheet.png)

---

## 2. Fable Wiring Table (`assets/siege.json`)

| Field | Old (Round 1) | New (Round 2) |
|---|---|---|
| `peds.{player,cop,swat}.cols` | `7` | **`8`** |
| `peds.{player,cop,swat}.poses` | `14` entries | **`['walk0','walk1','walk2','walk3','walk4','walk5','walk6','walk7','idle','wind','punch','climbA','climbB','climb2','climb3','push0','push1','pry0','pry1','rappel0','rappel1','hurt','down','jump']`** |
| `peds.*.color.{w,h,ox,oy}` | `101.2, 59.4, -50.6, -56.1` | **Unchanged** (exact `314×184` cell size preserved) |

*(Optional `siege_render.js` polish: cycle `walk0..walk7` at `Math.floor(p.walk / 0.24) % 8`, `climb0..3`, and map `p.pushing -> push0/push1`, `p.prying -> pry0/pry1`, `p.st === 'climbin' && p.surf === 'R' -> rappel0/rappel1`.)*

---

## 3. Phone Bake-Off Sheets (`420×860 @2x`)

- [bakeoff-siege-golden-phone.png](./bakeoff-siege-golden-phone.png)
- [bakeoff-siege-dusk-phone.png](./bakeoff-siege-dusk-phone.png)
- **Rebuild:** `node tools/build_siege_overhaul.mjs` (from `games/palm-city/`)
