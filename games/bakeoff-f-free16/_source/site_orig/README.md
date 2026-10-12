# Shell Shock 3D — Level 1: "Big Apple, 3 A.M."

A real-3D beat-'em-up through two New York City blocks at night, built with three.js (vendored locally as
`three.module.min.js`, r160; no CDN). Live: https://shellshock-3d.surge.sh/

## Play
- **Move**: arrows / WASD, the cabinet stick (touch), or a gamepad stick / d-pad. Movement is camera-relative.
- **Attack** J / A button · **Jump** K / B · **Special** L / P (or attack+jump) · **Use** E, or Special next to a manhole, ladder, door or elevator.
- Walk the block; the street seals into an arena until each wave is down. Turn the corner onto block 2, beat the
  Zap-Rollers, then Ramrod in the lot at the north end. 3 lives; the next brother tags in when one goes down.

## Layers (optional exploration)
- **Sewer**: drop into the steaming manhole on block 1 and travel the tunnels; climb out of a *different* manhole far up
  block 2 (a shortcut), or back up the way you came. A hidden side room is the secret lair (+1000).
- **Rooftops**: the fire escape on block 1 leads up to three roofs — jump the alley gap, cross the plank, climb down the
  corner building to block 2. Fall into an alley and you land hard on the sidewalk.
- **Walk-in building**: the lit "APTS 7-49" door on block 1 opens into a lobby (own lights, collision and camera);
  its elevator rides up to a bulkhead on roof 3 and back down.

## How it's built
- `game.js` = code reused **verbatim** from the Shell Shock 16-Bit JS game (audio/music/SFX, cabinet/touch/keyboard/
  gamepad input, pixel HUD font, character select, the data-driven enemies, enemy/Zap-Roller/Ramrod/Scorcher AI,
  combat, combos, specials, props, pickups, throws, atlas frame tables) + new 3D code (world, decor, billboard actors,
  zones/arenas, camera, layer transitions, HUD port, bot). The 16-bit 2D combat runs unchanged in a local frame laid
  along each street, tunnel, roof or room ("zone"); attacks keep the 16-bit depth-range hit rules.
- Characters are the painted Live-action atlases (same layout as the 16-bit atlases) as camera-facing billboards with
  directional flip, blob shadows and nearby-light tinting (HD-2D style). Static city geometry is merged per material per
  region; regions (street+roofs / sewer / interior) are culled as a whole; a pool of 6 point lights follows the nearest
  sources; no shadow maps.
- Debug: `?bot` plays the level (`&turbo=N`, `&bro=0-3`, `&route=sewer`), `?fps` shows the frame rate, `?shot=<place>`.

## Inspiration
Art direction is an homage to the late-80s/early-90s Turtles New York: Turtles in Time's "Big Apple, 3 A.M." street,
the 1989 arcade game's burning-apartment opening and news van, the 1987 cartoon / 1990 film sewer lair, and the 1990
film's rooftop fight. Everything here is original — geometry, textures (painted for this project), signs and text
("Channel 7 News" is a generic local-news name); no logos, characters or names from those works are used.
