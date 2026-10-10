# Shell Shock 3D: camera bake-off

Three small prototypes with the same 4-way intersection, the same hero and the same five foot soldiers. Only the camera changes.

| | Live | Camera |
|---|---|---|
| A: Free City | https://shellshock-free-city.surge.sh | Raised 3/4 view (40° down), world-aligned, smooth follow, never rotates (R snaps 90°). Buildings between the camera and the hero fade out. |
| B: Paper City | https://shellshock-paper-city.surge.sh | Low cinematic camera that faces the nearest storefront and swings round corners. Q/E, the on-screen buttons or a two-finger drag nudge it. Cutouts paper-flip when they turn. |
| C: GTA City | https://shellshock-gta-city.surge.sh | Third-person chase camera over the shoulder. Drag or the right stick to look, Q/E to turn. It recenters behind the hero, swings behind his shoulder in fights and pulls in before it can clip into a wall. Characters have 8-direction views. |

Controls: arrows/WASD move, J attack, K jump, L special. Touch uses the cabinet stick and buttons.
Each folder is a standalone static build: `free-city/`, `paper-city/`, `gta-city/`. `src/` plus `build.py` is the source. The build also needs the 16-bit game page for the reused combat code.
