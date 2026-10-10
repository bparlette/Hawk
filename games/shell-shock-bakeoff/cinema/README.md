# Shell Shock bake-off J: Cinema City

Live: https://shellshock-cinema-city.surge.sh

The Cel City intersection (same cel-shaded city, original turtle-shell hero BLADE, the same 5 posted thugs on short leashes, no waves,
360-degree combat with soft lock-on), presented like a cinematic co-op adventure game:

- Over-the-shoulder camera: low, close, right-shoulder offset, slight handheld sway. It pulls back and up in fights so 360-degree combat stays readable.
  It is kept out of walls, and the shoulder offset shrinks on portrait phones.
- Film letterbox bars ease in during fights (half height) and fully during cinematics, the intro and QTEs.
- Intro: a 5 s crane sweep high over the junction that comes down the south arm and settles behind the hero, with a title card. Any key or tap skips it.
- One-button contextual prompts (E / Y on a pad / ACT on touch), each a world-anchored prompt with an icon:
  - CLIMB the fire-escape ladder on the SE tower (east arm): a street-level camera tilts up the climb, then the hero vaults the parapet onto the roof.
  - LEAP DOWN from the roof's south-west corner into the south arm (the rooftop shortcut), with a flip and a low landing camera.
  - VAULT the three parked cars (either side).
  - KICK OPEN the red "STAFF" alley door on the south arm, which hides a pizza box (+50 HP).
- QTE finisher: the first time a thug drops to half health it goes dizzy for 2.8 s (stars over its head; ordinary hits can't KO it).
  A FINISH! prompt shows a draining ring. Pressing the button in reach plays a finisher: a long-lens side angle on the dash and two slashes,
  a cut to a reverse dutch angle for the flip strike in 0.35x slow-mo, then a wide shot of the thug being launched, and a cut back to play.
  If you're too far away the prompt reads GET CLOSE. If the window runs out, the thug recovers on 1 HP.

Controls: WASD/arrows move, J attack (3-hit combo), K/Space jump (J in the air = flip slash), E (or F) action / finisher, Q/R or drag to orbit.
Gamepad: left stick, right stick camera, X/B attack, A jump, Y action. Touch: floating stick, SLASH / JUMP / ACT buttons (ACT pulses when a prompt is live).

Source: src/0*.js -> ./build.sh -> game.js (ES module, three r160). New in J: src/06b_cine.js (letterbox, prompts, interactions, QTE finisher,
cinematic cameras, intro); the camera, dizzy state and roof walking are in src/06_game.js; the ladder and fire escape are in src/03_city.js.
Tests: cine.js (intro, door, pizza, vault, climb, roof leap, QTE finisher), bot.js (?bot=1&sim=N autopilot: walks all four corners, fights
every thug and presses the QTE). Query flags: ?nointro=1 skips the intro, ?pose=1 shows the pose sheet.
