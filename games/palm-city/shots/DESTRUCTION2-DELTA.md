# Palm City — Destruction Phase 2 Look Targets & Delta Spec (Gemini)

> **Feeds Fable Task 10** (Task 6 of `bparlette/tasking/gemini.md`; look target sheets + technical delta only — zero game code edits).  
> Continues the exact **4-stage progression** and `#210f2e` dark-plum ink language established in [DESTRUCTION-DELTA.md](DESTRUCTION-DELTA.md), covering building front sub-elements, perimeter fences, fire hydrants, and market stalls.

## Visual Targets

1. [destruction2-target-buildings.png](destruction2-target-buildings.png) — **Building Fronts** across 4 states:
   - Storefront Glass (`diner` / `shops`)
   - Striped Cloth Awnings (`shops` / `cafe` / `hotel` patio)
   - Rooftop & Wall Neon Signage (`NOVA` / `DINER` / `MOTEL` / `SOLANA`)
2. [destruction2-target-street.png](destruction2-target-street.png) — **Perimeter & Street Fixtures** across 4 states:
   - Picket Yard Fence (`house1..3` / `villa1..3`)
   - Chain-Link Security Fence (`garage` / `motel` parking lot)
   - Fire Hydrant (`anchor_hydrant_*` integration + intermediate states)
   - Coastal / Plaza Market Stall (boardwalk canopy + display counter)

---

## 1. Building Fronts — Non-Destructive Sub-Colliders

Buildings remain rigid structural footprints, while attached front/roof sub-elements receive independent `12–28 wu` perimeter damage bays so sideswipes and curb hops chew up storefronts without deleting whole blocks:

| Sub-Element | Stage 1 (`0.25 ≤ dmg < 0.55`) | Stage 2 (`0.55 ≤ dmg < 0.99`) | Stage 3 (`dmg ≥ 1.0`) | Runtime Layer / FX Delta |
|---|---|---|---|---|
| **Storefront Glass (`diner` / `shops`)** | **Scuff & Hairline:** Dark tire/bumper rubber streak across center pane + bowed center mullion + single crack line (`#f2fbff`). | **Spiderweb Crack:** Dual radiating frosted fracture spiders across panes; `4–6` early `#cbeeff` glass chips on apron. | **Shattered Bay:** Gaping `#181224` interior recess with jagged glass edge teeth along lintel + snapped bronze mullion + `10–14` sidewalk shard fan. | Crisp glass shatter SFX (`1` pooled burst); Stage 3 extinguishes corresponding interior warm window/patio bounce at night (`bld_*_night` cutout). |
| **Striped Cloth Awnings** | **Creased / Bent Frame:** Center edge caves inward (`~8–10 wu` deflection) with slack canvas wrinkle crease (`#3c2539`). | **Torn & Hanging:** Right/impacted half-panel rips free (`~26°` skew hang), exposing bare `#5f687a` tubular steel support arms. | **Collapsed Scrap:** Bent wall mount stubs (`#535b6b`) over crumpled striped canvas strips on sidewalk. | Canvas rip thud; torn flap keeps lightweight wind sway (`±3°` sin wave). |
| **Neon & Blade Signage (`NOVA` / `DINER` / `MOTEL`)** | **Tilted (`~14°`) & Snapped Strut:** Sign casing rocks off-axis with cracked outer acrylic + flickering intermittent tube (`V` or middle glyph flickers). | **Half-Detached Hang (`~-36°`):** Sign swings downward over curb by one anchor bracket + dangling yellow spark cable (`#ffe56b`), extinguishing 1 letter. | **Fallen Smash:** Empty exposed mount bolts on parapet; dark crushed casing on sidewalk ringed by pink/cyan glass dust (non-blocking ankle height). | High-voltage electrical snap + spark burst (`4–6` orange/gold sparks); permanently kills sign's `drawNeonPuddles` spill at dusk/night. |

---

## 2. Fences (`picket`, `chain-link`)

Fences segment into modular **`48–60 wu` span bays** between anchored posts so a single car breach opens a drivable gap instead of deleting an entire yard perimeter:

1. **Picket Yard Fence (`house1..3`, `villa1..3`):**
   - **Stage 1 (Splintered / Bowed):** Horizontal rails bow inward `~8 wu`; impacted center post leans `+15°` into turf.
   - **Stage 2 (Breached Bay):** Span snaps open into two canted stubs (`±12°`), clearing a `38 wu` vehicle shortcut with `#f6efe6` splinter shards across apron.
   - **Stage 3 (Crushed Stumps):** Flush `#ccbda9` post sockets + scattered wood slats (zero collision).
2. **Chain-Link Security Fence (`garage`, `motel` lot):**
   - **Stage 1 (Dented Mesh):** Top bar bends inward `~12 wu`; mesh stretches dark silver.
   - **Stage 2 (Torn Flap):** Top rail snaps and peels back (`±24°`), leaving an uprooted middle pipe stub; drivable shortcut opens cleanly.
   - **Stage 3 (Crushed Posts):** Base stanchion sockets + tangled steel wire scraps.

---

## 3. Fire Hydrants & Market Stalls

| Fixture | Stage 1 (Leaking / Skewed) | Stage 2 (Geyser / Breached) | Stage 3 (Capped Stump / Pile) | Notes |
|---|---|---|---|---|
| **Fire Hydrant (Corner Curb)** | Tilts `~18°` away from bumper; fine twin pressure spray mist + `r = 22 wu` pale cyan curb dampness. | **Full Sheared Geyser:** Uses live `anchor_hydrant_geyser.webp` silhouette (`r = 52 wu` widening `#5cc4f2` sidewalk puddle + upward frothy white-cyan plume for `6.0 s`, quenching nearby car hood fires and feeding `drawWetReflections` shimmer at night!). | **Settled Flange & Pool:** Dark iron base flange oozing quiet widening reflection puddle + detached red hydrant cap resting nearby. | Car entering Stage-2 geyser gets mild hydraulic push (`85 wu/s`) + windshield wash particles. |
| **Boardwalk / Plaza Market Stall** | Canopy twists `+12°` over wood trestle; `3–4` spilled fruit/souvenir props roll onto promenade. | Corner support pole snaps, dropping striped awning down at `-20°` squash across splintered counter planks + mid-radius produce scatter. | Flattened canopy ribbons + broken `#b87f4d` counter splinters + fruit pulp decal (zero movement obstruction). | Uses shared pooled debris budget (`max 160` persistent pieces alongside Phase-1 leaf/plank shards). |
