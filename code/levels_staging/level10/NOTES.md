# Level 10: PIRATE SHIP (Act III, time travel)

**Install:** copy `level10.js`, `level10_galleon.jpg`, `level10_galleon_boss.jpg` and `level10_armaggon.png` into `levels/`.

- `level10.js` is 37 KB and uses only plugin API v1.
- No `level11.js` was in my test copy, so the results card showed "THE END... FOR NOW!". Once Level 11 is installed, the card will show it as NEXT.
- The level itself never says THE END.

## Story hook
- **Start:** the rift drops the brothers onto a 17th-century galleon in the middle of a boarding battle.
  - Card: `PIRATE SHIP` / "THE RIFT DROPS YOU INTO 1687. REPEL BOARDERS!"
  - About 1 s into the stage the brother barks "WHOA! A PIRATE SHIP?! WHAT YEAR IS IT?"
- **Outro (about 8 s):**
  1. "CHUM'S UP, SHARK-FACE!"
  2. The rift tears open above the deck. Inside it a steam locomotive chugs across a desert at sunset, with mesas and a saguaro.
  3. The brother barks "THE RIFT! IS THAT... A TRAIN?!" and a train whistle sounds ("TOOT TOOOOT!").
  4. He walks under the rift and leaps in. Caption: **"NEXT STOP: THE WILD WEST!"** This leads into the Wild West train level.

## Art (all generated for this level with generate_image, in the comic-painterly style of ss_assets)

| File | Size | Notes | Floor band (FLOOR_TOP / FLOOR_BOT) |
|---|---|---|---|
| `level10_galleon.jpg` | 1878x512, 248 KB | Main deck at dusk: bulwark, cannons, rigging, rival galleon on the horizon, open plank deck. | `[166, 218]`; the deck starts at image y ≈ 367 |
| `level10_galleon_boss.jpg` | 878x512, 131 KB | One-screen quarterdeck in a lightning storm: ship's wheel and cabin doors at centre, grate at world (192, 158), a shark fin in the waves. | `[160, 216]`; the deck starts at image y ≈ 335 |
| `level10_armaggon.png` | 1539x274, 85 KB | Boss sprite sheet, palette PNG with alpha. Generated on chroma green, keyed, despilled and packed. | n/a |

- **Seamless strip:** the strip is the generated image plus its horizontal mirror, so it tiles seamlessly with no mirroring needed from the engine. The two halves do read as mirrored at the join.
- **Boss sheet frames:** idle, idle2, bite, fire, hurt, walk. All face right, bottom-aligned, with a torso anchor.
- **Raw files:** the raw generations are in `/workspace/work/lvl10_art/`, along with `cut.py` and `atlas.py` (keying and packing).

## Section 1: main deck
- Length 2600. Locks at [0, 640, 1300, 1980].
- **Waves:**
  1. purple ×2, star
  2. sword, blue, purple, gunner
  3. heavy, sword, dasher, star
  4. heavy, gunner, sword, blue, purple
- Pirate palette through `hues`.
- **Music:** an original arrangement of the public-domain shanty "Drunken Sailor" (D minor, 150 BPM). Boss music is the engine boss track at −2 semitones, 178 BPM.

## Hazards (both sections; every one telegraphs for at least 40 frames and also hurts non-boss enemies)
1. **Pitching deck (deck tilt).**
   - Calm for about 6–8 s.
   - Then a **72-frame warning**: a "BRACE! DECK TILTING >>>" banner pointing downhill, creaking rumbles, and the ship heels slightly the other way.
   - Then about 3.6 s of roll at up to ±3.5°. The whole view really rolls: the background is redrawn rotated and actors are drawn in the rotated frame.
   - Everyone standing on the deck slides downhill at up to 0.62 px/frame (the player walks at 2.1). Enemies slide at 85% of that, the boss at 35% and only while walking.
   - The tilt direction alternates each cycle. A ±0.6° idle sway runs all the time.
2. **Loose barrels.**
   - On each tilt, 1–2 barrels (1 during the boss fight) roll downhill along a lane.
   - Warning: a 50-frame dashed lane line plus "!" and ">>" at the uphill edge.
   - A barrel does 1 damage and knocks you down. You can jump it.
3. **Cannon splash zones.**
   - The rival galleon fires a volley every 4.7–6.2 s during fights: 2 zones, or 3 from wave 3 on.
   - The first zone targets the player's position.
   - Warning: a muzzle flash on the horizon, then **76 frames** of a dashed red ring, a filling disc, the ball's shadow closing in, "!", and the ball dropping for the last 18 frames.
   - Impact: 2 damage plus knockdown, an explosion, a water and splinter splash, and a scorch mark that fades.
4. **Rope boarders.** During locked waves, enemies from the queue swing in on ropes from the rigging (a rope is drawn to them) and tumble onto the deck, shouting "AVAST!", "ARRR!" and so on. The engine's down/get-up physics handle the landing.
5. **Boss arena only:** rain and lightning flashes.

## Boss: ARMAGGON (46 HP; the licensed cyber-shark mutant)
- **Look:** a custom `draw` from the generated sheet, about 92 px tall.
  - Red-flash telegraph tint and a phase-2 hot orange tint, both pre-tinted offscreen copies built once.
  - In phase 2, an orange aura.
  - Knocked down or KO'd uses a rotated hurt frame.
- **Entrance:** his dorsal fin circles the deck for 2 s, the grate bulges with a "!", and he bursts up through it.
  - He is invulnerable until he lands. Then: "FRESH SHELLFISH! I'LL CRACK YOU OPEN!"
- **Attacks:**
  1. **Bite lunge.** A 36-frame rear-back with red jaw flashes, then a fast lunge along the row with the bite frame (2 damage plus knockdown). He staggers for 40 frames afterwards, which is the punish window.
  2. **Fin-dive.**
     - He leaps and plunges through the planks (splinters and splash).
     - His dorsal fin hunts you through the deck, with lag, for 140 frames (110 in phase 2). Touching the fin does 1 damage.
     - Then it locks: a cracking-plank target ring with "!" for 46 frames.
     - Then he bursts up (2 damage plus knockdown in a 30 px radius, also hits enemies) and staggers for 40 frames.
  3. **Harpoon cannon.** A 40-frame red laser sight from the arm cannon, then 1 tethered harpoon (a fan of 3 in phase 2) for 2 damage plus knockdown.
  4. **Close kick/bite.** The engine `kwind`/`kick`, drawn with the bite frame.
  5. **Phase 2 only, eye-laser sweep.** A 48-frame dotted aim line, then a 52-frame beam along his row that slowly sweeps toward your lane (0.32 px/frame). You dodge it by changing lanes. 2 damage, and it also cuts through his own crew.
  6. **Phase 2 only, summon:** "CREW! FEED 'EM TO THE FISHES!" Two pirates swing in on ropes.
- **Phase 2 (at 50% HP):**
  - He roars "NOW YOU'VE MADE ME HUNGRY!" while invulnerable.
  - A 4-zone cannon volley and two rope boarders follow.
  - The brother barks "FEEDING FRENZY! KEEP MOVING!"
  - His stats rise to speed 1.35, charge 1.4 and cool 66.
- Cannon volleys continue during the fight: 2 zones every 7.8 s, or 3 every 5.5 s in phase 2. They pause while he is diving, rising or raging.
- **Lines:**
  - Hit pool: "GRRRAAH!", "YOU'LL PAY FOR THAT, TURTLE!", "I SMELL FEAR... AND SHELL!", "THAT TICKLES!"
  - KO: "MY TEETH... MY BEAUTIFUL TEETH...!"

## Testing
- `node --check` passes.
- **Headless auto-play** (`/workspace/work/lvl10_harness/play.js "?level=10&debug&nocache"`): loading → stage → section 2 → boss fight → phase-2 bark → outro → pizza → results → title, with no exceptions and no hook errors.
- **Also passed with `DEATHS=1`:** Rafe and then Miko tagged in, and the run still reached outro, results and title.
- **Chromium screenshots checked with read_file:** gameplay with cannon zones, the BRACE banner, the deck rolled with a barrel, boss entrance and intro, the bite lunge, the fin hunt and lock ring, the harpoon sight, phase-2 rope boarders with a 4-zone volley, the eye laser, and the outro rift with the train and "NEXT STOP".
- **No page errors** in any Chromium run.
- **Fixes made after viewing:**
  - The roll's corner fill changed from stretched to mirrored edge bands.
  - The red tint was softened.
  - The harpoon and laser sight were moved to the muzzle height.
  - The outro rift was raised so it no longer covers the brother's speech bubble.
  - The barrel was redrawn as a lid.
- **Test copy and harness:** `/workspace/work/lvl10_test/` (with level2.js and level8.js present) and `/workspace/work/lvl10_harness/` (`play.js`; `multi.js` with key down/up steps; `plan*.json`).
- **Engine version:** my test copy's `index.html` already contained the v1.1 engine (props and pickups). The level uses none of it.

## API gaps worked around (engine not patched) / wished-for hooks
1. **No camera roll / world transform hook.** The roll is done in `section.drawBack`:
   - It redraws the background rotated about (192, 190), with mirrored bands past the top and bottom edges.
   - It deliberately leaves the rotation on the context, so actors, hazard fronts, weather and the outro draw in the rolled frame.
   - This relies on `drawStage` doing `ctx.restore()` before the HUD, which it does.
   - Wish: `section.camera = { rot, zoom }` or a `drawWorldTransform` hook.
   - It also redraws the background a second time each frame (the engine has already drawn it).
2. **No `BG_EXPOSE` access.** The level makes its own `brightness(1.3) contrast(1.05)` canvas copy to match. Without canvas filters it uses the raw image.
3. **No spawn-at-position / custom entrance API in v1.** Rope boarders call `api.spawnEnemy` and then reposition the enemy as `state:"down", z:58` (the same trick Level 8 uses).
4. **No per-actor velocity / external-force hook.** The deck slide edits `p.x` / `e.x` directly and clamps to the screen.
5. **The outro doesn't tick `STATE.fx`.** The outro filters `STATE.fx` itself (same as Level 8).
6. **The boss move picker is pre-empted** at `walk && cool <= 1`.
   - The lunge reuses the state names `tele`/`charge`, the eye laser uses `throw`, and the burst uses `slam`, so he stays hittable during them.
   - `rise`, `dive` and `rage` are deliberately invulnerable.
   - Phase-2 stats come from a per-enemy copy of `e.cfg`.
7. **No sprite-sheet boss API.** The boss uses `base: "ramrod"` with a custom `draw` from a level image declared in `images`. A `def.sprites` / `api.drawSheet` helper with flip and anchor would be nice.
8. **No whistle SFX.** The train whistle is two `SFX.chat` blips.

## Judgment calls
- **Name:** "PIRATE SHIP", as the brief named it.
- **Boss:** I treated ARMAGGON (the TMNT cyber-shark) as the licensed boss the brief allows. The shanty arrangement is public domain.
- **Mirrored strip:** I mirrored the deck strip rather than cross-fading it, because it is lower risk for seams. The rival galleon appears twice per ~822-world-px loop, once facing each way.
- **Untested handoff:** I tested only `?level=10` directly. The Level 9 → 10 handoff wasn't tested.
