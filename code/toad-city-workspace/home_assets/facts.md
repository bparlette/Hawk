# Toad City Baltimore: homepage facts

**Play:** https://toad-city-baltimore.surge.sh (HD cel-shaded by default; `?retro=1` gives the 32-bit look)

**Pitch:** An HD cel-shaded three.js brawler set on Baltimore's Inner Harbor. You play Harold, a bald old toad with a cane. His wife Mavis, with her gray afro and handbag, fights beside you as an AI partner. Together you clean up the harbor district by district. Day turns to night every 5 minutes (a 10-minute loop).

## The heroes
- **Harold** (player): bald, round glasses, cardigan, slacks, wooden walking cane. Fights with a 3-hit cane combo and the Cane Quake POWER move.
- **Mavis** (AI wife): gray afro, floral dress, pearls, handbag. She follows you, joins fights and swings her handbag. Hold ACT to revive her.

## 16 landmarks (real map, compressed about 3x)
HD-modeled (cel shading with ink outlines, real signage drawn on canvas):
1. Power Plant complex (four black stacks, Barnes & Noble, Hard Rock guitar)
2. National Aquarium (glass pyramid, red Australia wing, blue neon wave)
3. Maryland Science Center (brick block, observatory dome, IMAX)
4. Harborplace (Pratt Street and Light Street pavilions)
5. USS Constellation (full rigging, moored at Pier 1)
6. World Trade Center (pentagon tower)
7. Domino Sugars (script sign on its lattice: gold by day, red neon by night)

Blockout massings (simple solids for now):
8. Four Seasons (glass tower)
9. Pendry (recreation pier, clock tower, roof pool)
10. Fells Point (market hall, rowhouses, cobbles)
11. Washington Monument (column)
12. Oriole Park (warehouse and stands)
13. M&T Bank Stadium (bowl)
14. Federal Hill (a mound you can walk up)
15. Under Armour / Tide Point (brick halls, clock tower)
16. Fort McHenry (star fort and flag)

## The 17 bosses (approved design; one per landmark, plus the final boss; not yet in the live build)
- **Bird Brain Bobby** (Oriole Park): a rogue bird mascot who pitches fastballs down the brick hallway.
- **The Raven King** (M&T Bank Stadium): a giant raven linebacker with a "Nevermore" blitz.
- **Dr. Shellacious** (Science Center): a mad snapping-turtle scientist, fought in the IMAX.
- **The Hon Queen** (Federal Hill): beehive, cat-eye glasses, hairspray clouds. She pushes you down the hill.
- **Sugar Rush** (Domino Sugars): a sugar-crystal golem fought beside the neon sign.
- **The Compression King** (Under Armour): an athleisure mannequin brute.
- **Admiral Redclaw** (Fort McHenry): an 1812 redcoat crab with rockets'-red-glare cannon barrages.
- **Big Jimmy** (National Aquarium): a giant blue crab, fought underwater.
- **Voltage Vic** (Power Plant): an electric-eel DJ whose attacks drop on the Baltimore club beat.
- **Chef Crabcake** (Four Seasons): throws blinding seasoning and swings crab mallets.
- **Arabber Al** (Fells Point): a car chase against a souped-up horse cart.
- **The Pool Shark** (Pendry): the rooftop-pool heavy.
- **Dragon Boat Duchess** (Harborplace): rides a giant dragon paddle boat.
- **Captain Cobblestone** (USS Constellation): a ghost privateer.
- **The Penthouse Pigeon** (World Trade Center): rules the rooftop deck.
- **The Stoop Scrubber** (Washington Monument): a marble-step matriarch with a scrub brush and slippery suds.
- **Mister Formstone** (final boss): a Formstone-faced crime lord whose fake-stone armour cracks off.

## Thug gangs (one per district)
- **Harbor Rats** (Norway rats; North Shore: Harborplace, USS Constellation, World Trade Center, Washington Monument; mustard and navy). Dockside toughs in watch caps and do-rags. One swings a broken rowboat oar, and the bruiser flashes a gold tooth.
- **Pier Gulls** (herring gulls; the piers: National Aquarium, Power Plant, Four Seasons; white and blue). Bucket hats and backwards caps. One swings a frozen rockfish by the tail, and the bruiser is a great black-backed gull in a gold chain.
- **Cobblestone Catfish** (channel catfish; Fells Point and Pendry; slate and teal). Newsboy caps and harbour-captain hats. Their weapon is a cobblestone in a net bag on a rope, and the bruiser is a flathead.
- **Masked Bandits** (raccoons; west side: Oriole Park, M&T Bank Stadium, Science Center; orange and grey). Watch caps, big headphones and do-rags. One swings a traffic cone by its tip.
- **Key Highway Otters** (river otters; Federal Hill, Domino Sugars, Under Armour, Fort McHenry; green and brown). Refinery hard hats and towels. One swings a sugar sack on a rope, and the bruiser wears a drum-major shako with a plume.
(The gangs are finished rig modules, built and reviewed. The live build still uses the generic thugs until they are wired in.)

## Controls
- **Touch, arcade panel:** a ball-top joystick and round arcade buttons docked under a tall game view, with no floating pad. SWING is red, JUMP is yellow, the white buttons turn the camera, and ACT is the big glowing green button.
- **Keyboard:** WASD to move, J for the cane, K to jump, E for ACT (hold to revive Mavis), Q/R or drag to turn the camera, H to switch between HD and 32-bit. Gamepad works too.
- **ACT is one context button.** It picks, in order: FINISH (a dizzy thug), SEWER, CLIMB / LEAP, RIDE / DRIVE / BOARD, KICK OPEN / VAULT, then POWER.
- **POWER, Harold's Cane Quake:** a hop, a flip and a cane slam. The shockwave floors every thug within about 5 m, with hit-pause and a heavy shake, on a 7 s cooldown. Mavis joins with a spinning handbag when she's close. ACT also cancels a cane combo into POWER.
- **Finishers:** stun a thug until he's dizzy, then hit ACT to start a timed QTE finisher with camera cuts and slow-mo.
- **Water kills:** knock thugs into the harbor for a splash KO. Toads don't drown; they respawn on the nearest dock.

## B-MORE 410 RADIO (GTA-style dial; switch stations any time, full credit shown like a station ID)
- **B-MORE 410 REMIX** (default): shuffles Brad's 30 Baltimore classics and plays a 20 s clip of each, crossfaded into the next (see remix.json).
- **AUTO:** DAY by day, NIGHT by night, crossfading at dusk and dawn.
- **B-MORE 410 DAY** and **B-MORE 410 NIGHT**.
- **DUCKY DYNAMO FM:** the Creative Commons Baltimore club tracks by Ducky Dynamo and DJ AyyMello.
- **LOR BITEWHO:** [FREE] Baltimore type beats, prod. Lor Bitewho (@OneBiteBeats).
- **B-MORE CLUB** (14 tracks) and **B-MORE RAP** (16 tracks): Brad's 30 classics.
- **OFF.**

All music plays through official YouTube embeds (audio only), with Bandcamp's embed as the fallback for CC tracks. No audio ships with the game.
