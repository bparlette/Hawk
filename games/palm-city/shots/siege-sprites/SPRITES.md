# Palm City — Motel Siege Production Sprite Sheets (`SPRITES.md`)

Game-ready transparent WebP sprites (`cwebp -q 90 -alpha_q 100`) built for Fable Task 4 (Motel Siege), matching Palm City world scale (`UPM = 10`, `2 px = 1 wu`) and merged Moth-slice `#210f2e` plum ink. Zero game code modified.

---

## 1. Priced Physics Traps (Side-View Cutaway Props — Intact + Dropped/Broken States)

| Sprite File | Dimensions (px) | World Metrics (`w`, `h`, `ox`, `oy`) | Mechanic / State (`siege-spec.md`) |
| :--- | :--- | :--- | :--- |
| `trap_vend_intact.webp` | `64 × 80` | `w: 32, h: 40, ox: -16, oy: -40` | Floor 1 `VEND` Soda Machine standing against alcove wall |
| `trap_vend_dropped.webp` | `96 × 64` | `w: 48, h: 32, ox: -24, oy: -32` | Tipped `90°` crushing forward w/ spilled cyan/red cans (`+300 TRAP KO`) |
| `trap_tv_intact.webp` | `48 × 48` | `w: 24, h: 24, ox: -12, oy: -24` | Floor 2 CRT TV on dresser (w/ bunny-ear antenna) |
| `trap_tv_broken.webp` | `56 × 48` | `w: 28, h: 24, ox: -14, oy: -12` | Falling / smashed CRT TV with fractured screen & glass shards (`+250`) |
| `trap_cart_intact.webp` | `72 × 64` | `w: 36, h: 32, ox: -18, oy: -32` | Floor 2 Rolling Stainless/Teal Linen Cart (`v = 75 u/s` projectile) |
| `trap_cart_tipped.webp` | `84 × 56` | `w: 42, h: 28, ox: -21, oy: -28` | Overturned cart after bowling corridor officers + tossed white towels |
| `trap_ac_intact.webp` | `56 × 48` | `w: 28, h: 24, ox: -14, oy: -12` | Floor 3 East Window AC compressor on rusty sill bolts |
| `trap_ac_dropped.webp` | `64 × 56` | `w: 32, h: 28, ox: -16, oy: -14` | Crushed fallen AC compressor + sheared bolts for 3-story cruiser drop (`+500 BIG DROP`) |
| `trap_fusebox_intact.webp` | `40 × 48` | `w: 20, h: 24, ox: -10, oy: -12` | Floor 3 Hallway breaker box |
| `trap_fusebox_shorted.webp` | `48 × 56` | `w: 24, h: 28, ox: -12, oy: -14` | Sparks & shorted open panel (`2.5 s` light flicker + `1.8 m` electrical stun) |

---

## 2. Barricades & Architecture (`siege-spec.md`)

| Sprite File | Dimensions (px) | World Metrics (`w`, `h`, `ox`, `oy`) | Usage |
| :--- | :--- | :--- | :--- |
| `barricade_desk_intact.webp` | `96 × 64` | `w: 48, h: 32, ox: -24, oy: -32` | Floor 1 Check-in Reception Desk (`Barricade #1`) |
| `barricade_desk_damaged.webp` | `96 × 64` | `w: 48, h: 32, ox: -24, oy: -32` | Scarred / bullet-riddled desk after `2+` cop slams |
| `barricade_mattress.webp` | `88 × 48` | `w: 44, h: 24, ox: -22, oy: -24` | Floor 2 Queen Mattress (`Barricade #2` across stair lip) |
| `barricade_dresser.webp` | `64 × 80` | `w: 32, h: 40, ox: -16, oy: -40` | Floor 3 Oak Dresser (`Barricade #3`) |
| `prop_roof_hatch_closed.webp` | `88 × 32` | `w: 44, h: 16, ox: -22, oy: -8` | Padlocked F3 -> Roof Coral Hatch |
| `prop_roof_hatch_open.webp` | `96 × 88` | `w: 48, h: 44, ox: -24, oy: -18` | Popped `58°` hatch lid + top of vertical Steel Ladder |
| `prop_fire_escape_flight.webp` | `128 × 128` | `w: 64, h: 64, ox: -32, oy: -64` | Modular East Zig-Zag Fire Escape deck + railing + diagonal flight |
| `prop_awning_coral.webp` | `112 × 56` | `w: 56, h: 28, ox: 0, oy: -14` | Floor 1 East Coral-striped exit awning above Skateboard ramp (`x_local = +6.2 m`) |
| `prop_ext_ladder.webp` | `48 × 144` | `w: 24, h: 72, ox: -12, oy: -72` | Aluminum extension ladder deployed onto F2 balcony (`★3+`) |
| `prop_neon_motel_sign.webp` | `192 × 112` | `w: 96, h: 56, ox: -48, oy: -56` | Rooftop `MOTEL / VACANCY` pink/cyan neon pylon (`z = 10.2..13.2 m`) |

---

## 3. SWAT Officers & Shield Peds (Full 16-Angle × 3-Pose Sheets — Exact `manifest.peds` Parity)

Baked in Blender Cycles (`PED_SCALE = 2.4`, `PED_PPM = 22`, `PED_ANGLES = 16`, `PED_POSES = 3`) matching `assets/ped_cop.webp` (`1032×344`, `12×4` grid) so Fable can index directly via `render.js -> pedCell(p)`:

| Sprite File | Dimensions (px) | Grid (`cols × rows`) | World Metrics (`w`, `h`, `ox`, `oy`) | Role & Usage |
| :--- | :--- | :--- | :--- | :--- |
| `ped_swat.webp` | `1032 × 344` | `12 × 4` (`86×86` cell) | `w: 39, h: 39, ox: -19.5, oy: -19.5` | Armored navy SWAT rifleman (`SWAT` back stencil + carbine aimed `+Y`); drops into both Motel Siege `★4+` roof rappel AND Top-Down `★4–5` Pressure street staging |
| `ped_swat_shield.webp` | `1032 × 344` | `12 × 4` (`86×86` cell) | `w: 39, h: 39, ox: -19.5, oy: -19.5` | Pointman SWAT officer carrying dark ballistic shield w/ visor slit (`★4–5` stack lead) |
| `ped_swat_sh.webp` | `1188 × 396` | `12 × 4` (`99×99` cell) | `w: 110, h: 110, ox: -20.23, oy: -64.32` | Exact Cycles cast shadow sheet shared by both `ped_swat` and `ped_swat_shield` |
