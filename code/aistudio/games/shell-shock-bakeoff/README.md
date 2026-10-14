# Shell Shock 3D: camera bake-off

Small prototypes with the same 4-way intersection, the same hero and the same five foot soldiers. Only the camera changes.

| | Live | Camera |
|---|---|---|
| A: Free City | https://shellshock-free-city.surge.sh | Raised 3/4 view (40° down), world-aligned, smooth follow, never rotates (R snaps 90°). Buildings between the camera and the hero fade out. |
| B: Paper City | https://shellshock-paper-city.surge.sh | Low cinematic camera that faces the nearest storefront and swings round corners. Q/E, the on-screen buttons or a two-finger drag nudge it. Cutouts paper-flip when they turn. |
| C: GTA City | https://shellshock-gta-city.surge.sh | Third-person chase camera over the shoulder. Drag or the right stick to look, Q/E to turn. It recenters behind the hero, swings behind his shoulder in fights and pulls in before it can clip into a wall. Characters have 8-direction views. |
| D: Skyline City | https://shellshock-skyline-city.surge.sh | Paper City's cutouts and swinging camera, but the camera sits at the hero's hip, tilts up about 13° with a 72° lens and looks down the block at a 3/4 angle, so the towers, fire escapes, water towers, billboards and night skyline fill the frame. When foes wake it eases down and in (about -5°, 60° lens) and drifts back up after the fight. Same controls as B (Q/E, the on-screen buttons, two-finger drag). |

Controls: arrows/WASD move, J attack, K jump, L special. Touch uses the cabinet stick and buttons.
Each folder is a standalone static build: `free-city/`, `paper-city/`, `gta-city/`, `skyline-city/`. The switcher also links E (GTA City 32-bit) and F (Free City 16-bit), which are built separately. `src/` plus `build.py` is the source (`src/skyline.js` holds D's tall-city build). The build also needs the 16-bit game page for the reused combat code.
