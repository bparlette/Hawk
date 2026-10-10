# Shell Shock bake-off I: Cel City

Live: https://shellshock-cel-city.surge.sh

Cel-shaded real-3D take on the bake-off intersection (Jet Set Radio-style): toon ramp (3 bands) with screen-space halftone dots in the
shadow band, inverted-hull black outlines (mitred, ~constant screen width), flat saturated palettes, canvas-drawn graffiti, signs and billboards
in one 2048 atlas (the whole city is 1 draw call + 1 outline call + decals). Hero (turtle-shell brawler, blue bandana, twin swords) and five
thugs are procedural three.js rigs with code-driven idle / run / 3-hit combo / jump + air flip slash / hurt / knockdown / get-up.

Camera: third-person chase, a bit higher and wider than C (dist 6.6, pitch ~21 deg, FOV 62, wider in portrait); drag, right stick or Q/E to
orbit; boxed against every building / water tower / car; swings to keep the soft-locked target in frame.

Controls: WASD/arrows move, J attack (3-hit combo, soft lock-on), K/Space jump (J in the air = flip slash), Q/E orbit, drag to orbit.
Touch: floating stick on the left, SLASH / JUMP buttons, arrows or drag to orbit. Gamepad: left stick, right stick camera, X/B attack, A jump.

This folder is the static build (index.html + game.js + three.module.min.js). Source: src/0*.js -> ./build.sh -> game.js.
Test hooks: ?bot=1&sim=N autopilot walks all four corners and fights every thug (orbiting the camera mid-fight); ?pose=1 shows the pose sheet.
