# Palm City — Staged Destruction Look Target & Delta Spec (Gemini)

> **Proposal for owner approval** (Task 1 of `bparlette/tasking/gemini.md`; target sheets + delta doc only — no game code or asset changes in this delivery).  
> Every sheet uses the **actual live sprites** from `games/palm-city/assets/` at their exact scale (`128x128` car frames, real prop dimensions) rendered under Palm City's warm golden-hour key and `#210f2e` dark-plum ink language.

## Visual Targets

1. [destruction-target-cars-1.png](destruction-target-cars-1.png) — 5 models (`sedan_coral`, `sedan_teal`, `sedan_cream`, `sedan_plum`, `conv_mint`) across 4 states: Intact → Stage 1 → Stage 2 → Stage 3 Wreck.
2. [destruction-target-cars-2.png](destruction-target-cars-2.png) — Remaining 5 models (`conv_rose`, `van_sky`, `van_sun`, `taxi`, `police`) across the same 4 states.
3. [destruction-target-props.png](destruction-target-props.png) — Palms (`palm0..2`), bushes (`bush0..1`, `bush2..3`), 3-slat park bench, chrome skate rail, street lamp pole, and lifeguard tower across 4 states.
4. [destruction-target-scene.png](destruction-target-scene.png) — In-scene golden-hour composite (`420x860` phone viewport) showing a smoking Stage-3 sedan wreck, dented taxi, snapped palm trunk crushing a broken bench with scattered fronds, torn-out hibiscus dirt pit, and kinked promenade rail.

---

## 1. Vehicles — All 10 Models (`assets/car_*.webp`)

Damage progresses across **3 visual tiers** above Intact (`hp ∈ [0, 1]`):

| Stage | Damage Threshold | Silhouette & Material Delta | Runtime Layer / FX Delta |
|---|---|---|---|
| **0. Intact** | `dmg < 0.25` | Unmodified `car_*.webp` (`128x128` cell) | Normal headlights & gloss glints |
| **1. Scuff & Minor Dent** | `0.25 ≤ dmg < 0.60` | Asymmetric bumper/corner cave-in (`4–6 px` inward displacement on impacted corner); light primer scrape streaks (`#d7d0cc`); one darkened/shattered headlight; single hairline windshield crack (`rgba(235,244,255,0.78)`) | Short paint-chip + glass spark burst on impact; `police` cracks one lightbar lens |
| **2. Cracked Glass & Bent Chassis** | `0.60 ≤ dmg < 0.99` | Heavy front/side accordion pinch + door buckle; multi-ray spiderweb cracks across windshield & rear cabin (`van_*` windshield only); darker soot smudge on hood corner; detached bumper strip (`#a8a2ac`) resting beside front fender | Minor dark hood smoke puffs every `0.35 s`; intermittent headlight flicker at dusk; `taxi` roof sign skews off-axis |
| **3. Crumpled Smoking Wreck** | `dmg ≥ 1.0` | Longitudinal compression + irregular crumpled contour (`plum #210f2e` re-inked); matte char/soot wash keeping ~25–30% base pigment so vehicle family remains readable; hollow black cabin glass cavities; 2–3 splayed flat tires protruding at odd angles; warm amber hood ember glow (`#ff8223`) | Ground soot/ash radial stain (`rgba(20,16,26,0.72)`); pooled trailing wisps of pale grey smoke (`rgba(192,188,200,0.26)`) drifting ENE; non-drivable obstacle until end of session |

**Implementation recommendation for Fable (zero sprite-sheet bloat):**  
Avoid baking 3 extra 32-angle `1024x512` WebP sheets per car (which would add 30 MB). Instead, either:
- Overlay **procedural angle-local damage decals + cracked-glass vectors + detached bumper/tire chips** in `render.js` inside the car's rotated local frame, paired with a global darkened char pass (`globalCompositeOperation` / pre-cached damaged stamp per `model`×`stage` on demand), **or**
- Bake **one static top-down Stage-3 wreck sprite per car** (`32` angles unneeded once immobilized — 1 frame × 10 models ≈ `128x128`, negligible RAM).

---

## 2. Trees / Palms (`assets/palm0..2.webp`)

1. **Stage 1 — Cracked Trunk (`1–2` heavy hits / low-speed bump):**
   - Existing trunk shake + leaf burst extends with a **persistent `10°–15°` lean** away from impact vector and a visible tan wood fracture wedge at trunk base collar.
   - 2–3 frond tips darken/notch asymmetrically.
2. **Stage 2 — Snapped & Falling (`dmg ≥ 1.0`, car impact > slow nudge or repeated punches):**
   - Leaves a **permanent jagged split stump** (`r ≈ 10 world`, dark bark `#6c4428`, pale heartwood `#ddb47e`, ring detail, plum `#210f2e` ink outline) at the anchor coordinate.
   - Entire trunk cylinder (`#a6764c -> #583822`) + slightly ruffled crown fall away from the hit vector over `~0.45 s` with heavy impact thud, radial sand/leaf scatter, and crush check against any ped, bench, bush, or car under the landing footprint.
3. **Stage 3 — Settled Fallen Trunk & Fronds:**
   - Stays permanently on the ground as a climbable/low debris obstacle (blocks foot paths cleanly without hard-locking cars; loose scattered fronds fade slowly or stay within pool cap).

---

## 3. Bushes (`assets/bush0..3.webp`)

1. **Stage 1 — Ruffled / Scuffed (`dmg ≥ 0.35`):** Slight squash & `~12°` shear away from impact + 2–3 detached blossom petals (`#ff6494` / `#ffd44c` / `#fff`) and leaf chips on the soil.
2. **Stage 2 — Flattened (`dmg ≥ 0.70`):** Crown splayed into a wide horizontal oval (`1.26x × 0.56y`), bruised olive-brown center smudge, perimeter petals scattered outward.
3. **Stage 3 — Torn Out (`dmg ≥ 1.0`):** Foliage removed leaving a permanent dark oval root pit (`#523420` / `#382214` ringed in `#210f2e` ink) with 2 torn root stubs and scattered petals.

---

## 4. Benches & Street Props (`bench`, `skate rail`, `lamp`, `lifeguard`)

| Prop | Stage 1 (Scuffed / Cracked) | Stage 2 (Broken in Half / Snapped) | Stage 3 (Collapsed / Settled Debris) |
|---|---|---|---|
| **Park Bench (3-slat wood, `render.js` L666)** | Jagged crack notch across center slats; slight `4–5°` skew | **Breaks clean in two angled halves** (`-18°` and `+24°`) kicked `~8 world` apart with pale `#e4ba88` splintered ends & twisted `#3a3044` iron leg | Flat criss-crossed scatter of 3–4 short plank shards + bent iron leg brackets (persistent ground debris, no longer blocks movement) |
| **Skate Rail (`S.rails`, `render.js` L658)** | Mid-span inward bow (`5 world`) + dark scuff crease (un-grindable beyond `0.6` bow or becomes erratic!) | Snaps at kink into two angled chrome segments detached from mount posts | Short crooked scrap tubes + exposed bolt sockets |
| **Street Lamp (`assets/lamp.webp`)** | Head skewed `~16°`; cracked warm lens & flickering night pool | Snaps at base flange; long dark pole + lantern falls across sidewalk with glass shard glint scatter & night light kills | Twisted cast-iron base socket + 4–5 pale blue-white glass shards |
| **Lifeguard Tower (`assets/lifeguard.webp`)** | Cracked teal canopy corner; slight skew | Crushed pyramid roof (`-16°` tilt) exposing tan deck beams beneath + kicked ladder slats | Flattened pile of tan deck planks (`#d4a070`) + crumpled turquoise canopy strips |

---

## 5. Persistent Debris Budget (Phone-Safe)

Per `fable.md` Task 1 rules:
- **Zero per-frame allocation:** Pre-allocate pooled debris stamps (`max 160` persistent pieces across leaves, wood splinters, metal trim, glass shards, and soil craters; FIFO overwrite oldest off-screen minor shards while **never** recycling major anchors like tree stumps, Stage-3 car wrecks, or broken benches).
- **Smoke puffs (Stage 2–3 wrecks):** Cap active billboarded smoke particles per wreck to `6–8` pooled soft radial sprites, spawned only within viewport bounds (`hw + 80`).
