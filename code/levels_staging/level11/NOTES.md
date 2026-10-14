# Level 11: WILD WEST TRAIN (Act III, time travel)

## Files
- `level11.js`: 41.8 KB. Plugin API v1 only.
- `level11_train.jpg`: 1672x512, 174 KB.
- `level11_desert.jpg`: 1540x422, 145 KB.
- `level11_boss.jpg`: 878x512, 118 KB.
- `level11_gator.png`: 1351x259, 117 KB, 256-colour PNG with alpha.
- Screenshots: `shot_*.png`.

**Install:** copy `level11.js` and the four images into `levels/`. The level preloads every image it uses: the bgs, plus `def.images` for the desert and gator files.

## Story
- **Card:** "WILD WEST TRAIN / 1880. THE OUTLAWS RIDE THE RAILS."
- **Boss intro:** "WELL, LOOKY HERE! TURTLE SOUP, COMIN' UP!", then "DAT RIFT DUMPED ME IN 1880. NOW I RUN DIS TRAIN!"
- **Outro:** the time rift opens over the tracks ahead.
  - "WHAT'S THAT GLOW UP AHEAD?!" → "THE TIME RIFT! IT'S PULLING US IN!" → "HANG ON TO YOUR SHELLS!"
  - Then a white-out with "SLINGSHOT THROUGH TIME..." and "NEXT STOP: NEW YORK CITY, 2105". That leads into Level 12.
- The level never says THE END.

## Art (all generated, painterly comic style, no text or logos)
- **`level11_train.jpg`:** the boxcar-roof strip at sundown.
  - Re-cut so it tiles seamlessly: the last 180 px are cross-faded into the first 180 px, then those first 180 px are dropped. The engine tiles it with no mirroring; one tile is 732 world px.
  - **FLOOR_TOP = 147, FLOOR_BOT = 186** (image y ≈ 336–425). The roof's back edge is world y 135 (image y 309).
  - A coupling gap is painted in every tile at image x 776, which is world x 339.5 + 732n. The gap hazard uses that.
- **`level11_desert.jpg`:** a seamless desert panorama (mesas, cacti, telegraph poles).
  - It is drawn every frame in a hazard's `drawBack`, clipped to the sky band above the roof (y < 135), and scrolled at train speed. That makes the scenery race past even while the camera is locked; the static bg only supplies the roof.
- **`level11_boss.jpg`:** one screen of flatcar deck behind the coal tender and locomotive.
  - **FLOOR_TOP = 152, FLOOR_BOT = 198.**
  - The coal heap Leatherhead bursts out of is at world (136, ~98). The smokestack is at (313, 33), and animated puffs come from it.
- **`level11_gator.png`:** the Leatherhead sprite sheet, made from one generated image.
  - The magenta background was keyed out with a soft alpha and a de-spill, then each pose was cropped and packed bottom-aligned. Anchors are the torso centre.
  - 6 poses: idle, walk, tail-swing, chomp/lunge, crate-overhead, hurt.
  - The other animations are built from those poses: KO/down is the hurt frame rotated, the death roll is the chomp/hurt frames rotated 90° and rolled, the intro is the hurt pose rising out of the coal, and the red telegraph flash is a pre-tinted copy of the sheet.
  - The red copy is made with `source-atop` compositing (no `getImageData`, Safari- and file://-safe) and is released in `onUnload`.

## Section 1: boxcar roofs
- Length 2600. Locks are at [0, 640, 1300, 1980]. Weather: `speed`. Outlaw palette comes from `hues`.
- Every non-boss foot soldier gets a canvas-drawn cowboy hat. Its head position comes from the atlas frame the engine would pick.

**Waves:**
1. purple, purple, blue
2. star, purple, heavy, blue
3. dasher, sword, purple, star, gunner
4. heavy, gunner, dasher, purple, sword

### Hazards (each is telegraphed and also hits non-boss enemies)
1. **LOW TUNNEL. Duck it, or it knocks you flat.**
   - **Warning:** about 110 frames of "LOW TUNNEL AHEAD!" with a "!" at the right edge. A rugged mesa cliff rises in the sky band, and telltale ropes (the real railroad warning) sweep past about 55 frames before the portal arrives.
   - **Duck:** once the portal is within about 62 frames of you, the banner switches to "HIT THE DECK! PRESS DOWN". Pressing down (keyboard, gamepad or touch stick) drops your brother prone until the lintel has passed, and you are untouchable while you are down. The first time, he barks "HIT THE DECK!".
   - **If you don't duck:** the slanted stone lintel at head height does 2 damage and knocks you down. Jumping doesn't help, because the ceiling is low.
   - Enemies get hit too: 2 damage plus a knockdown.
   - **Inside the tunnel:** about 3 s of darkness with lantern pools, then the exit portal.
2. **WATER-TOWER SPOUT. Jump it.**
   - A wooden water tower passes in the sky band, and its spout pipe sweeps the roof at shin height, pouring water.
   - "WATER SPOUT! JUMP!" plus a "!" shows for about 115 frames before it reaches the screen.
   - It does 1 damage and a knockdown if you are below z 13. Enemies take 2 damage.
   - Tunnels and towers alternate. The first one comes about 6 s in, then one every 9–13 s.
3. **Coupling gaps between cars.**
   - These are static pits that line up with the painted gaps. Ties rush by underneath.
   - Walking in drops you through (`dropPlayer`, 1 damage, you pop back out); jumping crosses safely.
   - Enemies knocked into a gap are KO'd.
4. **OUTLAW BOXCARS (wave delivery) on waves 2–4.**
   - When the camera locks, an outlaw boxcar pulls alongside on the next track and a banner reads "OUTLAWS!".
   - Its door slides open (lantern-lit interior) and up to 3 outlaws from the wave queue leap across onto your roof. One of them shouts "YEEHAW!", "GET 'EM, BOYS!" or "STICK 'EM UP!".
   - Then the pin pops ("UNCOUPLED!") and the car drops away behind.
   - While the car pulls in, the engine's edge spawns are held off by bumping `STATE.spawnT`. The rest of the wave spawns normally.

## Boss: LEATHERHEAD (48 HP; Act III bosses should be tougher than L2–7's 30–40)
**Intro:** glowing eyes in the coal heap → he bursts out (smoke, shake) and delivers both lines → he leaps down onto the deck with a landing quake (2 damage if you're close).

**Attacks** (each has a red-flash wind-up and a "!"):
1. **Tail sweep.**
   - A 44-frame wind-up with a red dashed danger ellipse (radius 66) on the floor.
   - Then a low 360° sweep. Jump it: below z 9 you take 2 damage and a knockdown. It hits his own outlaws too.
   - It is his favourite wake-up retaliation after being knocked down.
2. **Death-roll grab.**
   - A crouching 36-frame telegraph, then he lunges along your row.
   - If he connects, he grabs you using the engine's grab, so the engine's own "MASH ATTACK! n/6" HUD and drain apply.
   - He rolls over and over with you in his jaws (bark: "HE'S GOT ME! DEATH ROLL!"). Mash free and he staggers.
   - Otherwise he tosses you after about 2 s (2 damage plus a knockdown).
3. **Chomp charge.**
   - "CHOMP CHOMP!", jaws open and a red flash for 40 frames, then a chomping rush across the row (2 damage).
   - If he reaches the arena edge he crashes into the rail and is staggered, which gives you a punish window.
4. **Swamp-strength throw.**
   - He lifts a wooden crate overhead (sprite pose) and lobs it at you. A red/yellow target ring marks the landing spot the whole time it's in the air.
   - In phase 2 he throws twice per wind-up, and often rips up a coal boulder instead of a crate.

**Phase 2 (at 50% HP):**
- He roars "NOW YOU SEE SWAMP STRENGTH!" and is invulnerable for 130 frames while two outlaws leap in.
- After that he is faster (cool 62) and gains a summon ("BOYS! COME GET DESE TURTLES!": blue + dasher leap in).
- **Low tunnels come back in the arena.** A tunnel lintel also smacks Leatherhead if he's standing ("MY HEAD! OOF!", 3 damage), so ducking gives you a free punish.

**Lines:**
- Hits: "OOH, DAT STING!", "YOU GONNA PAY, SHELLBACK!", "AH'M JUST GETTIN' WARMED UP!", "QUIT TICKLIN' ME!"
- KO: "BEAT... BY A BUNCH O' BABY TURTLES..."

**Music:** an original A-minor spaghetti-western gallop at 150 BPM, with a train-rhythm drum pattern. The boss track is the engine's boss track moved down 2 semitones at 182 BPM.

## Testing (private copy `/workspace/work/lvl11_test`, harness `/workspace/work/lvl11_harness`)
- `node --check` passes.
- **Headless auto-play of `?level=11&debug`** went stage → boss → outro → pizza → results → title with no exceptions and no "level hook error".
  - The results card shows THE END... FOR NOW only because there is no `level12.js` in my copy.
  - Instrumented counts in one run: 3 tunnels (the bot ducked twice), 2 towers, all 3 boxcars, boss moves tail ×13 / roll ×3 / lift, 1 death-roll grab, phase-2 roar.
- **`DEATHS=1` run:** tag-ins to Rafe and Miko worked, and the run reached the results card.
- **Chromium screenshots checked with `read_file`:** gameplay with the boxcar dump, tunnel warning (cliff + telltales + banner), water tower, boss intro burst, tail-sweep telegraph, death roll, rift outro, 2105 card.
  - Fixed after review: blob-like smoke puffs, a black box over the coal heap, the death-roll rotation, and banner overlap with the engine's MASH HUD.
- **Ducking verified in Chromium:** a synthetic ArrowDown keydown inside the window set prone, and HP was unchanged after the lintel passed.
- **Debug-only handle:** `window.__L11 = { g, startEvent }` is created only when `window.__SS` exists (`&debug`) and is deleted in `onUnload`. It was used to force tunnel/tower/boxcar events for screenshots.

## API gaps worked around (engine not patched) and wished-for hooks
1. **No duck/crouch input or pose.** The level detects "pressing down" from the player's own movement: y increasing, or the walk animation ticking at the front edge of the floor with x unchanged. That works for keyboard, pad and touch. The duck is drawn by setting `p.downT` (prone frame) with `kvx = 0` and i-frames.
   - **Wish:** `api.input` (held directions/buttons) and a player `duck` state/pose.
2. **No spawn-at-position API.** Boxcar and phase-2 outlaws use `spawnEnemy(type)`, then move `api.enemies[last]` and set `state:"down", z>0` so the engine's fall, bounce and get-up physics run (same trick as L8).
   - **Wish:** `api.spawnEnemy(type, {x, y, z, vx})`.
3. **Holding queued spawns** for the boxcar is done by bumping `STATE.spawnT`. **Wish:** `api.holdSpawns(frames)`.
4. **Boss move picker pre-emption.** Picks are intercepted in `walk` at `e.cool <= 1`, as in L8.
   - Bosses get juggled by constant combos, because engine-handled hurt/down/getup never call `cfg.update`. So the level detects a gap in `e.life` between update calls and grants a wake-up attack.
   - **Wish:** an `onReact(state)` hook, or super-armour frames for bosses.
5. **Custom boss states:** attacks run under the v1-hittable state name `"attack"` (sub-move in `e.mv`). `lurk`, `hop` and `roar` are deliberately invulnerable. `cfg.hittable:["attack"]` is also set, which is harmless on v1.
6. **Effects freeze during an outro** (same as L8): `outro.update` ticks `STATE.fx` itself.
7. **No per-sprite tint API for level-supplied sheets** (`tintSheet` only knows the built-in atlases). Worked around with a composited red copy.
8. **Cosmetic overlay alignment.** The hats re-derive the engine's ninja frame choice (`walkT`, `taunt`), so a future engine change to `ninjaFrame` could shift them by a few px.
   - **Wish:** `e.frame` exposed, or an `onDrawEnemy` hook.

## Judgment calls
- **No duck in the engine:** I made "press DOWN = hit the deck" for tunnels, and gave the spout the jump role, so the brief's "duck/jump" is covered by two hazards. Jumping into a tunnel still gets you hit.
- **Image locations:** generated images first landed in `/workspace/` root (the tool's default). I moved them to `/workspace/work/lvl11_art/`, and the raw generations are kept there.
- **Testing scope:** I tested `?level=11` directly. The 10→11 handoff uses the standard loader path. `level8.js` is in my test copy, but there is no level10/12 there.
