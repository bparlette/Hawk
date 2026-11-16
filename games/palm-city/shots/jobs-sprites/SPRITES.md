# Palm City — Jobs Board Production Sprite Sheets (`SPRITES.md`)

Game-ready transparent WebP sprites (`cwebp -q 90 -alpha_q 100`) baked in Blender Cycles at exact Palm City scale (`UPM = 10`, `2 px = 1 wu`) with Kuwahara flattening, oriented impasto strokes, and `#1a0f2e` (`[0.10, 0.06, 0.18]`) plum contour ink matching the merged slice look. Zero game code modified.

---

## 1. Bus & Tow Vehicles (`32`-Angle Clockwise Sheets + Shadows + Lights)

| Sprite File | Dimensions (px) | Grid (`cols × rows`) | World Metrics (`w`, `h`, `ox`, `oy`) | Usage (`jobs-spec.md`) |
| :--- | :--- | :--- | :--- | :--- |
| `car_bus.webp` | `1280 × 640` | `8 × 4` (`160×160` cell) | `w: 80, h: 80, ox: -40, oy: -40` | Coastal Transit Coach (`6.8m × 2.15m`, teal body, cream roof, HVAC pods, `COAST 4` LED marquee) |
| `car_bus_sh.webp` | `864 × 432` | `8 × 4` (`108×108` cell) | `w: 108, h: 108, ox: -41.2, oy: -57.8` | Cycles shadow-catcher cast ground shadow |
| `car_bus_light.webp` | `60 × 192` | `1 × 1` (north `+Y` frame) | `w: 75, h: 240, ox: -37.5, oy: -175` | `'screen'` night additive headlight cones + cyan marquee + red tail lamps |
| `car_tow_truck.webp` | `1024 × 512` | `8 × 4` (`128×128` cell) | `w: 64, h: 64, ox: -32, oy: -32` | Yellow utility Tow Truck (`4.9m × 2.0m`, rear steel winch drum & orange A-frame boom) |
| `car_tow_truck_sh.webp` | `768 × 384` | `8 × 4` (`96×96` cell) | `w: 96, h: 96, ox: -36.41, oy: -51.11` | Exact `car_van_sky_sh.webp` manifest parity shadow |
| `car_tow_truck_light.webp` | `56 × 176` | `1 × 1` (north `+Y` frame) | `w: 70, h: 220, ox: -35, oy: -160` | `'screen'` headlights + amber warning roof bar wash |

---

## 2. Tow Cable Rig & Taxi Mood Roof-Sign Variants

| Sprite File | Dimensions (px) | World Metrics (`w`, `h`, `ox`, `oy`) | Integration Notes |
| :--- | :--- | :--- | :--- |
| `prop_tow_cable.webp` | `64 × 16` | `w: 32, h: 8, ox: 0, oy: -4` | Tileable braided steel cable strip (`maxLen = 74 wu`); stretch or repeat between tow boom pivot and target chassis hitch, tinting `#ff4a38` above `80%` tension load |
| `prop_tow_hook.webp` | `32 × 32` | `w: 16, h: 16, ox: -8, oy: -8` | Orange/steel grapple claw drawn at hooked car bumper anchor |
| `prop_taxi_sign_free.webp` | `32 × 32` | `w: 16, h: 16, ox: -8, oy: -8` | Default warm amber lit `TAXI` beacon (drawn atop `car_taxi` at roof center) |
| `prop_taxi_sign_fare.webp` | `32 × 32` | `w: 16, h: 16, ox: -8, oy: -8` | Active fare / high-mood (`mood >= 60`) emerald roof beacon |
| `prop_taxi_sign_lowmood.webp` | `32 × 32` | `w: 16, h: 16, ox: -8, oy: -8` | Danger warning (`mood < 25`) flashing coral-red roof sign |
| `prop_taxi_sign_fed.webp` | `32 × 32` | `w: 16, h: 16, ox: -8, oy: -8` | `★3+` Undercover Fed cover-blown split red/blue roof strobe (`VOX_JOB_TAXI_FED_REVEAL`) |

---

## 3. Taxi / Job Fare & Commuter Peds (`16`-Angle × `3`-Pose Sheets)

Exact `assets/ped_cop.webp` manifest layout (`1032×344`, `12×4` grid @ `86×86` cell -> `w: 39, h: 39, ox: -19.5, oy: -19.5`; shadow `1188×396` -> `w: 110, h: 110, ox: -20.23, oy: -64.32`):

| Sprite File | Dimensions (px) | Character / Wardrobe | Job Trigger Mapping |
| :--- | :--- | :--- | :--- |
| `ped_fare_vip.webp` | `1032 × 344` | White/charcoal executive suit, crimson tie, leather briefcase | **TAXI Smooth VIP** (`VOX_JOB_TAXI_PICKUP_VIP`) & Hotel Valet VIP |
| `ped_fare_chaos.webp` | `1032 × 344` | Electric coral jacket, yellow mohawk, street stance | **TAXI Speed Freak / Chaos Fare** (`VOX_JOB_TAXI_PICKUP_CHILL`) |
| `ped_fare_fed.webp` | `1032 × 344` | Undercover slate trench jacket, dark shades, gold chest badge | **TAXI Undercover Fed** (`wanted >= 3`, `VOX_JOB_TAXI_FED_REVEAL`) |
| `ped_fare_tourist.webp` | `1032 × 344` | Teal beach shirt, wide woven sunhat, orange carry-on bag | **TAXI / BUS** coastal tourist commuters (`BUS` stop groups) |
| `ped_fare_sh.webp` | `1188 × 396` | Shared `16×3` cast shadow sheet | Ground shadow layer (`shadowAlpha`) for all 4 `ped_fare_*` roles |
