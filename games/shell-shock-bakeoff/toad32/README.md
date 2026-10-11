# Bake-off K: Toad Street 32

Live: https://toad-street-32.surge.sh

A fork of J (Cinema City), cut down to ONE street and re-dressed as a 32-bit (PS1-era) game, with a day/night cycle.

## The street
- One block of the old south arm, running north-south: road |x| < 7, sidewalks to |x| < 11, storefronts on both sides
  (5 buildings a side: PIZZA / PAWN / DINER / DELI 24H / PHARMACY / BAKERY / BINGO / LAUNDRO signs, fire escapes, a water tower, a billboard),
  a manhole, three parked cars (maroon coupe, taxi, blue hatch), lamps, hydrants, bins, bunting, and the red STAFF alley door with a dumpster.
- Both ends are closed: jersey barriers + a ROAD CLOSED board, a building across the street, and fog. Walkable z 3.6..46.4.
- Removed with the other arms: the fire-escape CLIMB / BOOST and the rooftop LEAP DOWN (their code is still there, unreachable).
  Kept: door KICK OPEN (+ pizza, +50 HP), car VAULT (both sides of all three cars), the dizzy-thug QTE finisher with camera cuts + slow-mo,
  the partner's tag-team hit (now "TEAMWORK!"), revive, game over / retry, the intro crane (now down the street from the north barricade).
- The 5 posted thugs: a pair outside the alley, one mid-block, one further up, the bruiser at the north barricade.

## The heroes (an ordinary elderly toad couple: no shells, no bandanas, no mutant stuff)
- HAROLD (you): bald, round glasses, brown cardigan over a cream shirt, slacks, brown shoes. Weapon: a wooden walking cane
  (3-hit cane combo, spinning cane finisher, flip + downward cane whack in the air). The cane hangs down when he walks.
- MAVIS (AI partner, computer-controlled as RIDGE was): wide grey afro, floral dress, pearls, gold bangle, burgundy shoes. Weapon: her handbag.
- Both: warty olive-green skin, pale throat, wide mouth, bulging gold eyes with horizontal pupils. Low-poly rigs (src/04_actors.js buildHero).

## Quality: HD (default) / 32-bit
HD (default): full-res, cel bands + J-style ink outlines (characters, props, city), smooth heads, warty skin texture, curly grey afro, filtered full-size textures.
32-bit: ?retro=1 (or ?hd=0), key H, or the 32-BIT/HD HUD button toggles at runtime. Character polygon detail is fixed at page load (low-poly when opened with ?retro=1).

## HAROLD model viewer: site/viewer.html (src/01_core.js + src/04_actors.js + src/v_viewer.js -> site/viewer.js)
Turntable plinth, slow auto-spin, drag to rotate, pinch/wheel zoom, big 32-BIT/HD toggle (rebuilds the model at that detail), DAY/NIGHT, IDLE/WALK/CANE SWING, SPIN. Keys H, N, 1-3. ?retro=1 ?night=1 ?rot=R ?anim=walk|swing.

## 32-bit look (src/01_core.js)
- The scene renders into a low-res target with 240 lines on the short side (427x240 at 16:9; 240x519 on a 390x844 phone) and is upscaled with
  nearest-neighbour (canvas at low res + CSS image-rendering: pixelated). ?res=N changes the line count.
- Post pass: 4x4 Bayer ordered dither + 15-bit colour (5 bits per channel). ?dither=0 turns the dither off.
- All materials are Lambert with vertex snapping (clip-space xy snapped to the low-res grid) and, on the city, affine-ish texture mapping
  (uv 45% screen-space-interpolated -> PS1 texture wobble; ground quads are subdivided so it stays readable).
- Textures: the 2048 atlas is drawn then shrunk to 512 (64 px per facade tile), all FX / sign / HUD-in-world textures shrunk to <=128 px, NearestFilter, no mips.
- Low-poly everything (spheres 8x6, cylinders <= 8 sides), no outlines / halftone, hard 512 px shadow map, far plane 95 m, distance fog 16-66 m.
- HUD: Press Start 2P pixel font (site/pressstart2p.woff2, OFL), square boxes, hard shadows, segmented HP bars, an in-game clock.

## Day / night (src/07_main.js updateCycle)
- Continuous loop, default 120 s: 60 s day -> night, 60 s night -> day (tod 0 = noon, .25 = dusk, .5 = midnight, .75 = dawn).
- Sky gradient, fog colour and distance, hemisphere + sun colour / intensity / direction (low western sun at dusk, a moon at night; shadows follow).
- At night: the 4 street lamps switch on (orange halos, additive glow pools on the pavement, point lights), building windows light up
  (a second "emissive" atlas; each window lit or dark by a hash), shop glass and signs glow, the BINGO neon blade sign buzzes on (pink light, flicker),
  stars come out, the fog closes in and darkens. A dim camera-side fill keeps the heroes readable.
- ?tod=0..1 pins the time of day, ?cycle=N sets the loop length in seconds.

Controls: WASD/arrows move, J cane (3-hit combo), K/Space jump (J in the air = flip whack), E (or F) action / finisher (hold: revive), Q/R or drag to orbit.
Gamepad: left stick, right stick camera, X/B attack, A jump, Y action. Touch: floating stick, SWING / JUMP / ACT buttons.

Source: src/0*.js -> ./build.sh -> site/game.js (ES module, three r160). Tests: kcheck.js (intro, bounds, door + pizza, vault, QTE + tag, cycle values),
bot.js <port> <prefix> <w> <h> <maxSec> <sim> [extraQuery] (walks up the block and back, fights every thug, presses the QTE), shot.js.
Query flags: ?nointro=1, ?pose=1, ?bot=1&sim=N, ?tod=, ?cycle=, ?res=, ?dither=0.
