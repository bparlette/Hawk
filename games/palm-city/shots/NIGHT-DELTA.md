# Palm City — True Night Grade Delta & Look Targets (Gemini)

**Deliverables (look targets + parameter spec — zero game code edits):**
- [night-target-nova.png](night-target-nova.png) (`840×1720` / `420×860 @ 2x`, `10:45 PM`, `NOVA` / `Office` / `Garage` block)
- [night-target-beach.png](night-target-beach.png) (`840×1720` / `420×860 @ 2x`, `10:45 PM`, Beach promenade, wooden `Pier`, and midnight surf)

---

## Why True Night Needs a Separate Stop Beyond Dusk (`t = 1.00`)

In `src/render.js` (`KEYS` lines `22–27`), the existing final stop at `t = 1.00` (`7:48 PM` Blue Dusk) keeps `roofMul: [108, 120, 198]` (~47% lavender-cornflower ceiling) and caps practical streetlamp alpha at `G.lamps * 0.78`. That works well for coastal twilight, but leaves true night feeling washed blue rather than velvet noir. Adding a `t = 1.00..1.35` (or extending normalized `t = 0.0..1.0` with a new midnight key at `1.00` and moving Blue Dusk to `0.86`) produces sharp shadow contrast so lamp pools, neon signage, car headlights, and lit skylights pop cleanly.

---

## 1. Exact `KEYS` Ambient, Multiply & Dark-Sky Vignette Values (`src/render.js`)

| Stop | Time (`clockText`) | `mul` (Ground) | `roofMul` (Roofs/Tops) | `shadow` | `shadowCol` | `vigCol` | `vigAlpha` | `eastGlow` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Existing Dusk (`t = 0.86`)** | `7:40 PM` | `[52, 68, 148]` | `[128, 132, 206]` | `0.44` | `[22, 26, 78]` | `[10, 14, 42]` | `0.62` | `[150, 90, 200]` |
| **Late Dusk (`t = 0.94`)** | `8:30 PM` | `[24, 34, 96]` | `[92, 102, 172]` | `0.42` | `[16, 20, 62]` | `[7, 10, 32]` | `0.68` | `[115, 70, 165]` |
| **True Night (`t = 1.00`)** | `10:45 PM` | `[10, 14, 42]` | `[52, 58, 108]` | `0.48` | `[8, 10, 28]` | `[4, 6, 20]` | `0.76` | `[76, 48, 128]` |

- **Dark-Sky Treatment:** Push radial outer vignette to `rgb(4, 6, 20)` at `vigAlpha = 0.76` (inner clear radius `~0.33 * vh`), keeping screen edges velvety obsidian-indigo so central practical lights carry depth without muddying street curbs.
- **`warm` & `glow`:** Drop both to `0.00` past `t >= 0.88` (no warm west sunset soft-light wash past twilight).

---

## 2. Practical Lighting & Light-Layer Gains (`src/render.js` pass 5)

| Light Layer Element | Dusk Current (`t = 0.96`) | True Night Target (`t = 1.00`) | Palette & Radius |
| :--- | :--- | :--- | :--- |
| **Street Lamps (`s.kind === 'lamp'`)** | `Math.min(1, G.lamps * 0.78)` | `Math.min(1.0, G.lamps * 1.05)` | Core `#fff5d6` (`r = 18 wu`) -> Sodium Amber `#ffba54` (`r = 85 wu` sidewalk / `r = 95 wu` pier) |
| **Building Skylights & Windows (`s.kind === 'building'`)** | `Math.min(1, G.windows * 1.05)` | `Math.min(1.0, G.windows * 1.25)` | Warm Saffron `#ffcc66 -> #ffa23e` (`s.e.night` roof skylights + café patios glow vividly against `roofMul [52, 58, 108]`) |
| **Neon Signage & Entrance Strips** | `0.02 + 0.98 * smooth(...)` | `1.0` + additive wide halo (`screen`) | `NOVA`: Hot Magenta `#ff3ab2` · `DINER`: Ice Cyan `#5ceeff` · `SOLANA`/`MOTEL`: Rose Pink `#ff5c9e` · Soft wet asphalt shimmer below curbs (`blur ~ 4 px`, `0.48` α) |
| **Moving Car Headlights & Taillights** | `G.heads * 0.75` (`parked ? 0 : 0.75`) | `G.heads * 0.96` (`car_*_light.webp` w/ soft border feather) | Quartz Cream `#fff6d0` forward twin cone (`220 wu` length) + Ruby Brake halo `#ff263a` (`r = 18 wu`) on rear bumper |
| **Wooden Pier Rail Lanterns** | Single soft dot | Twin Pier Rail Pools (`r = 88 wu` warm gold `#ffcc70` + `r = 68 wu` rail tip `#ffc062`) | Warm amber reflection ribbons beneath Pier (`drawSoftWaterShimmer`, `h = 72 wu`, blur `4 px`) |

---

## 3. Water & Shoreline Treatment at Night (`beach / pier`)

- **Sand Grade Drop:** Sand inherits `mul [10, 14, 42]`, transitioning coastal sand from warm golden tan into cool slate-indigo (`#1c2240`) punctuated sharply by yellow boardwalk lamp pools.
- **Ocean Surf Floor:** Darken open water channels by ~`0.78x` relative to dusk (`deep midnight ocean #050a1e` off the East shoreline).
- **Moonlit Wave Sparkles & Pier Reflections:** Replace opaque vector arcs with blurred sinusoidal wavelets (`rgba(145, 200, 255, 0.24)`) breaking gently along shore + warm vertical pier-lantern glow shimmers (`rgba(255, 198, 92, 0.50)` fading downward cleanly into dark water).
