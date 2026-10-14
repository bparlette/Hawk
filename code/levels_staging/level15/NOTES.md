# Level 15: SHREDDER'S TOWER (the true finale), `final: true`

Files:
- `level15.js` (47.5 KB). It uses only plugin API v1 (`SS.registerLevel` and `SS.api`).
- Backgrounds:
  - `level15_elevator.jpg` (878x512, 73 KB)
  - `level15_penthouse.jpg` (878x512, 112 KB)
  - `level15_lab.jpg` (1880x512, 215 KB)
- Boss sprite sheets:
  - `level15_shredder.png` (600x190, 136 KB)
  - `level15_super.png` (701x261, 250 KB)
- Screenshots: `shot_*.png`

Install: copy `level15.js` and the 5 images into `levels/`.
- No `level16.js` exists, so after the results card the engine shows "THE END... FOR NOW!" and goes back to the title.
- The real ending plays inside the outro.

## Story beats
- **Card:** "SHREDDER'S TOWER" / "THE TRUE FINALE. END THIS, BROTHERS."
- **Section 1: Foot HQ express elevator.** At the top the car stops: "DING!", PENTHOUSE, "TOP FLOOR. SHREDDER'S WAITING!".
- **Section 2: the penthouse duel.** SHREDDER poses on the steps under lightning.
  - "I AM OROKU SAKI... THE SHREDDER!" then "TONIGHT I FINISH WHAT I STARTED, TURTLES!"
  - KO line: "NO...! THIS CANNOT BE...!"
  - He staggers onto the rooftop hatch, the grate gives way, and he drops into the glowing TCRI mutagen reservoir (green splash).
  - Barks: "HE FELL INTO THE MUTAGEN RESERVOIR!" then "AFTER HIM! DOWN TO THE LABS!", then an automatic fade to section 3.
- **Section 3: TCRI ooze labs.** At the end the back wall shakes, cracks and bursts, and SUPER SHREDDER steps out of the breach.
  - "THE OOZE HAS MADE ME... INVINCIBLE!" then "NOW I CRUSH YOU ALL, TURTLES!!"
  - KO line: "IMPOSSIBLE... THE POWER... IT'S TEARING ME APART...!"
- **Outro, part 1 (about 3.3 s):**
  - Facility collapse: red alarm strobe, "WARNING: FACILITY COLLAPSE", falling rubble, rumbling.
  - Barks "THE WHOLE LAB IS COMING DOWN!" and "GO GO GO!". The brother sprints off right, an explosion, then a white-out.
- **Outro, part 2 (about 12.7 s):**
  - The penthouse rooftop at sunrise, the storm breaking.
  - The other three brothers run in from both sides; the player's current brother (tag-ins included) is already there. Amber fades in at centre.
  - "WE DID IT! SHREDDER'S FINISHED!", then Amber: "MY HEROES! THE CITY IS SAFE!".
  - Everyone jumps, with fireworks and confetti.
  - A big zooming **THE END**, then "SHREDDER IS GONE. THE CITY SLEEPS EASY." and "THANKS FOR PLAYING SHELL SHOCK LIVE!".
- After the outro: pizza break, then the results card.

## Art
- **Generation:** made with generate_image in the ss_assets comic-painterly style, using the ss_assets jpgs and atlases as references. The raw generations are in `/workspace/work/lvl15_art/`.
- **`level15_elevator.jpg`**
  - Cropped to one screen. Floor band `[186, 221]` (image y 425–505).
  - The glass back wall spans world y 42–175. Pillars are at image x 140–176 and 700–738.
  - Brass floor indicator at world x 127–258, y 18–31.
- **`level15_penthouse.jpg`**
  - Centre-cropped to one screen. Floor band `[158, 218]` (image y 361–498).
  - The round hatch is centred at world (192, 186), radii about 79 × 21.
- **`level15_lab.jpg`**
  - Seamless strip: the last 200 px are cross-faded into the first 200 px and those first 200 px are cut. Tile = 822.5 world px.
  - Floor band `[178, 220]` (image y 407–503).
  - Vats in each tile at world x 102.8, 368.0 and 536.8.
- **Sprite sheets:** generated on chroma green, keyed, split by connected components, and downscaled. The green fringe is suppressed.
  - Shredder: idle / walk / attack / jump / hurt. KO and down poses are the hurt frame rotated.
  - Super Shredder: idle / walk / blast / raise / hurt / down.
  - Frame rects carry a body-anchor x, so poses with an arm stretched out don't slide sideways.
  - Red telegraph flashes use a red-washed canvas copy of the sheet. It is built once per sheet and dropped in `onUnload`, and it works without `ctx.filter`.

## Section 1: elevator ascent (one locked screen; `locks [0,0,0,0]`)
- **Waves (Foot Elite, crimson/maroon hues):**
  1. purple / sword / purple
  2. blue / star / sword / dasher
  3. heavy / sword / blue / star
  4. sword / sword / heavy / dasher / star
- **Floors whooshing past:**
  - Floor slabs with lit windows slide down behind the glass, with speed streaks. The pillars are redrawn on top from the jpg.
  - The indicator lamp steps along and a "FLOOR 61 → 99" readout counts up.
  - The car judders now and then. It decelerates and shows DING / PENTHOUSE when the section clears.
- **Hazard: ceiling-hatch drop-ins.** These replace the engine's edge spawns.
  - 40 frames of telegraph: a red hatch light on the ceiling, falling dust, a growing landing shadow and a "!".
  - The ninja then falls in and rolls to his feet.
  - The queue entry is taken only when he lands, so a wave never reads as cleared early.
- **Hazard: SECURITY SCAN.**
  - 48 frames of warning: the emitter strip blinks red and shows "SECURITY SCAN! JUMP!".
  - Then a red laser line sweeps the floor depth front-to-back, alternating direction, over 54 frames.
  - Touching it on the ground (z < 7) does 1 damage plus knockdown. It hits enemies for 2.

## Section 2: SHREDDER (46 HP), rain-swept penthouse
- **Moves (each one telegraphed):**
  - **Gauntlet-blade combo** at close range: a blade glint plus red flicker for 16 frames, then two slash arcs (1 damage, then 2 damage with knockdown).
  - **Dash slash:** 36 frames of red flash, then a fast rush along the row with afterimages (2 damage, knockdown).
  - **Shuriken fan:** 3 stars (5 in phase 2).
  - **Teleport kick:** vanishes in smoke while a red/yellow reticle tracks the player for about 0.9 s. He drops from above as a red silhouette (2 damage, knockdown), then staggers for 40 frames, which is the opening to punish him.
- **Phase 2 (at 50% HP):** "ENOUGH! FOOT ELITE, TO ME!", lightning, and two Foot Elite in smoke. He gets faster (speed 1.4, cool 56) and a purple aura. From then on he can call in more Foot Elite.
- **Background:** lightning flashes about every 5–9 s, followed by thunder.

## Section 3: TCRI ooze labs (length 1900, `locks [0, 620, 1220]`)
- **Waves:**
  1. purple / sword / gunner / purple
  2. heavy / sword / star / dasher
  3. sword / heavy / gunner / blue / sword
- **Hazard: bursting vats** (the painted vats). Off-screen vats stay dormant.
  1. **Warning (56 frames):** cracks spread over the glass, a rumble, a "!" and a dashed green outline on the floor showing where the ooze will land.
  2. **Burst:** sparks, glass, and a green gush.
  3. **Toxic puddle (about 170 frames):** 1 damage per touch with a 50-frame cooldown. Jumping avoids it. It also knocks enemies down.
- **Weather:** green drips.

## Final boss: SUPER SHREDDER (70 HP), about 128 px tall
- **Entrance:** the wall cracks for about 1.2 s (rumble, "!"), then explodes into flying chunks.
  - He stands in the breach, delivers both lines, then leaps into the arena.
  - His landing stomp sends out a shock ring.
  - The breach stays drawn: lit jagged rim, green-lit gut, torn pipes, rubble.
- **Energy blasts (`fire`):** the palm glows for 30 frames, with a red flicker. He fires 2 big crackling orbs in phase 1, or a 3-orb spread in phase 2 (2 damage, knockdown).
- **Ground-shattering stomp (`slam`):**
  - 46 frames with fists raised, a red flash, a growing red floor glow under him and a "!".
  - The stomp sends out a purple shock ring that has to be jumped (2 damage). Phase 2 sends a double ring.
  - The stomp also brings down 2 ceiling chunks (4 in phase 2).
- **Wall-collapse debris:** each chunk shows a 62-frame growing shadow plus "!", then falls (2 damage, knockdown) and hits enemies too. One chunk always targets the player.
- **Engine moves, drawn with our sprites:**
  - claw swipe at close range (`kwind`/`kick`)
  - shoulder rush (`tele`/`charge`)
- **Phase 2 (at 50% HP):**
  - "THE POWER... IS OVERWHELMING!!", lightning arcs and a debris shower.
  - A Foot Elite swordsman and a heavy appear.
  - From then on: green aura, faster (speed 1.15, charge 1.45, cool 64), and debris rains every 5–7 s.

## Testing
- `node --check` passes.
- Headless auto-play of `?level=15&debug&nocache`: elevator → Shredder → reservoir drop → labs → Super Shredder → outro → pizza → results → title, with no exceptions.
- Also passes with `DEATHS=1`, where Rafe and Miko tag in and the finale cast adapts.
- Chromium screenshots checked with read_file: elevator waves, security scan, Shredder dash telegraph, teleport-kick reticle, reservoir drop, vat burst, wall breach, stomp rings and phase 2, the collapse and THE END. Fixes made from them:
  - The breach hole was redrawn.
  - The drained-vat box was removed.
  - The lab gunner hue was changed so gunners stand out from the green.
  - A stronger sunrise grade was added to the finale.
- Harness copy (paths changed to point at my copy): `/workspace/work/lvl15_harness/` (`play.js`, `multi.js`, `plan*.json`, `run_full.txt`, `run_deaths.txt`).
- Test site copy: `/workspace/work/lvl15_test/`. It includes `level8.js` from staging for chain prefetch; I tested `?level=15` directly.

## API gaps worked around (engine not patched; wished-for hooks)
1. **Mid-level boss (Shredder in section 2).** The API only fights a boss at the end of the last section.
   - Workaround: the section-2 hazard calls `api.spawnBoss(SHRED)` on its first frame, which puts the engine in `phase "boss"` so the empty section never auto-exits.
   - `onDefeat` sets `STATE.ramrodOn = false` so `bossPhase` doesn't call `finishLevel`.
   - The hazard then stages the reservoir fall: it holds `e.t` so the engine's 90-frame dying timer doesn't remove him early, and sets `e.gone` itself.
   - Finally it sets `STATE.fadeOut = 1` to go to section 3.
   - Wish: `section.boss` (a per-section boss), or `api.nextSection()`.
2. **Boss HUD bar label.** When a boss disappears mid-level, the sliding-away bar shows "ZAP-ROLLER" for about 12 frames, because the HUD falls back to that label when there is no boss. This is cosmetic. The engine could remember the last boss name.
3. **Spawn at a position.** No API for it. Spawning uses `api.spawnEnemy(type)` and then moves the newest enemy (ceiling drops use `state "down", z 70`).
   - Section 1 suppresses the engine's edge spawning by holding `STATE.spawnT = 99` and spawns from `STATE.queue` itself.
   - Wish: `api.spawnEnemy(type, {x, y, z})`.
4. **Effects freeze during the outro.** The outro ticks `STATE.fx` itself (the same issue Level 8 reported).
5. **Final-level results card.** `final: true` is set in the def, but the current engine ignores it. The results card would still say "THE END... FOR NOW!". Suggest the engine read `def.final` to show a congratulations/credits card.
6. **Custom boss states are invulnerable.** States outside the engine's hittable list (`pose`, `rage`, `tk`, `breach`, `hop`) can't be hit. That's on purpose for vanish and cutscene beats. The attack states reuse hittable names (`kwind`, `kick`, `tele`, `charge`, `throw`, `fire`, `slam`, `summon`) so he can still be hit and countered.
7. **Outro music.** The engine plays no special music for the outro; it keeps the level music and only SFX are added.
8. **Sprite flashes.** `api.drawFrame` applies the engine's white hit-flash to the level's own sheets automatically. For red telegraphs a tinted copy is needed, because `tintSheet` only accepts the engine's named atlases. Wish: `api.tintSheet(img, tint)` for level images.

## Judgment calls
- **Names:** the licensed names are used on screen as BRIEF2 asks: SHREDDER / Oroku Saki, SUPER SHREDDER, Foot Elite, TCRI is named only here in the notes. The brothers stay Lenny/Rafe/Miko/Donny and Amber stays Amber. No logos or text appear in any art.
- **Shredder sheet:** the generated 6th pose (lying down) came out helmetless, so it was dropped. KO and down use the hurt frame rotated.
- **Super Shredder sheet:** the generated blast and raise poses touched each other and were split by a colour/column rule. A few energy specks stay at the edge of the blast frame, and the palm energy is drawn on canvas.
- **Lab seam:** the cross-faded seam has a little ghosting across one doorway; it reads as part of the scenery.
- **Outro length:** the outro runs about 16 s, well under the engine's 1800-frame cap.
