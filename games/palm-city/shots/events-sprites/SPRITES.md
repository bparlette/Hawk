# Palm City — City Events Production Props (`SPRITES.md`)

Game-ready transparent WebP sprites (`cwebp -q 90 -alpha_q 100`) at Palm City scale (`UPM = 10`, `2 px = 1 wu`) matching `#210f2e` plum contour ink and [events-spec.md](../events-spec.md). Total: **`17`** files. Zero game code edits.

---

## 1. WRECK IT! — Domino Anchors & Blast FX (`5` Files)

| Sprite File | Dimensions (px) | World Metrics (`w`, `h`, `ox`, `oy`) | Mechanic (`events-spec.md`) |
| :--- | :--- | :--- | :--- |
| `anchor_fuel_drum_intact.webp` | `48 × 48` | `w: 24, h: 24, ox: -12, oy: -12` | Red hazard fuel barrel cluster w/ dashed yellow hazard zone (`+300` anchor trigger) |
| `anchor_fuel_drum_blast.webp` | `160 × 160` | `w: 80, h: 80, ox: -40, oy: -40` | Hit-Stop explosion crater + `'screen'` shockwave ring (`r = 95 wu` cascade) |
| `anchor_hydrant_intact.webp` | `36 × 36` | `w: 18, h: 18, ox: -9, oy: -9` | Curb pressurized fire hydrant domino anchor |
| `anchor_hydrant_geyser.webp` | `128 × 64` | `w: 64, h: 32, ox: -9, oy: -16` | Sheared hydrant flange anchored at `(18, 32)` shooting directional water jet |
| `anchor_propane_pallet.webp` | `64 × 48` | `w: 32, h: 24, ox: -16, oy: -12` | High-pressure propane cylinder rack near Garage & Office alleys |

---

## 2. VALET PARK IT! — Cone Course, Reticles & J-Turn Stunt Markers (`6` Files)

| Sprite File | Dimensions (px) | World Metrics (`w`, `h`, `ox`, `oy`) | Usage |
| :--- | :--- | :--- | :--- |
| `valet_cone_intact.webp` | `32 × 32` | `w: 16, h: 16, ox: -8, oy: -8` | Orange traffic cone w/ reflective collar framing valet stall borders |
| `valet_cone_knocked.webp` | `36 × 32` | `w: 18, h: 16, ox: -9, oy: -8` | Knocked cone state on minor curb scrape |
| `valet_stall_active.webp` | `88 × 128` | `w: 44, h: 64, ox: -22, oy: -32` | Cyan pulsing target stall box + golden nose-out alignment arrow (`±14°` window) |
| `valet_stall_locked.webp` | `88 × 128` | `w: 44, h: 64, ox: -22, oy: -32` | Emerald confirmed park reticle (`Mint Condition +$300`) |
| `valet_jturn_arrow.webp` | `96 × 96` | `w: 48, h: 48, ox: -24, oy: -24` | Dashed curved `180°` J-Turn entry pavement arc guide (`5x` multiplier cue) |
| `valet_inspector_clipboard.webp` | `32 × 32` | `w: 16, h: 16, ox: -8, oy: -8` | Silver/slate clipboard prop carried by curb Valet Inspector ped |

---

## 3. Shared Wreck Props — Crates, Planks & Tires (`6` Files)

| Sprite File | Dimensions (px) | World Metrics (`w`, `h`, `ox`, `oy`) | Usage |
| :--- | :--- | :--- | :--- |
| `wreck_crate_intact.webp` | `48 × 48` | `w: 24, h: 24, ox: -12, oy: -12` | Breakable wooden alley shipping crate (`+60` wreck pts) |
| `wreck_crate_smashed.webp` | `64 × 64` | `w: 32, h: 32, ox: -16, oy: -16` | Splintered 4-slat smashed crate footprint |
| `wreck_plank_1.webp` | `48 × 24` | `w: 24, h: 12, ox: -12, oy: -6` | Light cedar cafe fence/crate plank shard |
| `wreck_plank_2.webp` | `48 × 24` | `w: 24, h: 12, ox: -12, oy: -6` | Dark stained cafe plank shard |
| `wreck_tire_stack.webp` | `56 × 56` | `w: 28, h: 28, ox: -14, oy: -14` | 3-tire apex corner barrier stack |
| `wreck_tire_loose.webp` | `32 × 32` | `w: 16, h: 16, ox: -8, oy: -8` | Detached rolling / settled tire prop |
