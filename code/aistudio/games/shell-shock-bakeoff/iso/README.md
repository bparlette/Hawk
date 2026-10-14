# H · Iso City (Shell Shock camera bake-off)

Live: https://shellshock-iso-city.surge.sh

The same 4-way intersection, hero, five posted foot soldiers (short leash, no waves) and combat as the other prototypes, seen through a
fixed isometric camera: an 11° lens (near-orthographic) about 120 m out, 33° down, turned 45° so every corner block shows two facades.
It follows the hero smoothly and snaps 90° with R / Q or the ⟲ ⟳ buttons. The stick maps to 8 screen directions (up = up-screen
diagonal); the combat frame turns with the view so fights always read left/right and sprites flip relative to the screen.

- Cut-away: a building that hides the hero (or a foe fighting the hero) gets a dithered hole round the hero and thins to a 30% ordered
  dither above the storefronts (shader patch on that building's materials, eased in and out).
- Painted look: the existing painted facades/storefronts, neon signs, awnings; per-building rooftop furniture (water towers, AC units, lit
  stair bulkheads, glowing skylights, festoon lights, planters, dishes, steam vents); warm lamp and neon light pools; soft contact
  shadows at wall bases; a painted tar-paper roof texture (new, generated original art); rim light on characters from the nearest lamp
  plus a cool moon rim; blob + long cast shadows; vignette.
- Test hooks: `?bot` plays the route round all four corners, `?isorot=n` starts turned n × 90°, `?zoom=<metres>` changes the view height.

`source/` holds the src and build.py (built from /workspace/work/ss3d-bakeoff/h_iso; needs the 16-bit game page for the reused combat code).
