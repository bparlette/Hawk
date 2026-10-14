# Level 8: FORTRESS OF RAZORBACK (the final level)

Files: `level8.js` (34.7 KB, plugin API only), `level8_fortress.jpg`, `level8_final_boss.jpg`, plus screenshots `shot_*.png`.
Install: copy `level8.js` and both jpgs into `levels/`. No `level9.js` exists, so the results card ends the run and returns to the title.

## Art
- `level8_fortress.jpg` (1864x512): made from ss_assets/level8_fortress.jpg. The last 200 px are cross-faded into the first 200 px and the first 200 px cut off, so the strip tiles without a seam (the engine tiles plugin backgrounds without mirroring). Tile width is 816 world px. Floor band is `[172, 205]`, which keeps everyone off the catwalk edge.
- `level8_final_boss.jpg` (878x512): the throne room cropped to exactly one 384-world-px screen, so the throne and the reactor core sit at screen centre (x=192). Floor band is `[166, 214]`.

## Structure
- **Section 1: fortress corridor.** Length 2600. 4 waves with locks at [0, 620, 1300, 1950]:
  - purple / gunner / purple
  - sword / gunner / dasher / purple
  - heavy / gunner / blue / star
  - heavy / gunner / dasher / sword / gunner
- The robot troopers are gunners and heavies tinted steel blue through `hues`. The weather is embers.
- **Section 2: throne room.** `waves: []` and `length: 384`, so the boss starts as soon as the section loads.
- **Music:** an original E-minor march at 138 BPM. The boss track is the engine's boss track moved down 3 semitones at 186 BPM.

## Hazards (every one gives at least 40 frames of warning and also hurts non-boss enemies)
1. **Laser fences** at x 500, 1110, 1520 and 2260. Each is a slanted grid of three beams that covers every lane (the beams go up to z 34, so you can't jump them).
   - Off for 150 frames, then a dotted, flickering warning with a "!" for 46 frames, then live for 74 frames.
   - A live beam does 1 damage and knocks you down.
   - A faint dashed floor line marks the fence even while it is off.
2. **Steam vents:** 8 floor grates. Each hisses, puffs and shows a "!" for 48 frames, then fires a 70 px column for 56 frames (1 damage plus knockdown).
3. **Blast doors**, which line up with the doors painted in the art (x 140 + 816n, and 538.5 + 816n).
   - During a locked wave, a door on screen flashes a red beacon and "!" for 40 frames, then slides open. The panels are slices of the background jpg pulled apart.
   - It takes the next enemy from `STATE.queue` and spawns it in the doorway, then closes. Cooldown is 260 frames.
4. **Electrified floor panels:** 7 plates with hazard-striped edges. Each crackles for 50 frames, then is live for 80 frames (1 damage). They don't hit you while you are jumping (z ≥ 3).

## Final boss: RAZORBACK (58 HP; earlier bosses had 30–40)
- **Look:** the same `razor` atlas Level 1's Amber-kidnap cutscene uses, untinted, at 1.42× the cutscene scale (about 82 px tall). It has a custom `draw`: leap / grab / idle frames, red telegraph flashes, and in phase 2 a magenta aura, a hot tint and lightning.
- **Intro:** he sits on the throne dais, invulnerable. Lines: "SO THE SHELLS CRAWLED IN AT LAST." then "AMBER STAYS WITH ME. FOREVER!". About 4 s later he leaps down and the landing sends out a shockwave.
- **Phase 1 attacks:**
  - kick (close range)
  - charge rush (red-flash telegraph)
  - slam leap with a shockwave
  - razor-disc fan: 3 discs with a red flash wind-up
  - window drop-in henchmen: two enemies crash through the side windows with glass shards, land in a knocked-down state and get up
- **Reactor-core shockwave rings:** the core flashes white and shows a "!" (plus a "JUMP THE RING!" hint the first two times), a floor glow grows for 54 frames, then a magenta ring spreads across the floor from the dais. You have to jump it (2 damage).
  - Phase 1: one ring about every 7 s.
  - Phase 2: every 4–5 s, often a double ring.
- **Phase 2 (at 50% HP):**
  - He leaps back onto the dais, invulnerable: "ENOUGH! THE CORE OBEYS ME!"
  - Screen shake and sparks, two henchmen drop in, then a forced double ring.
  - The brother barks "HE'S SUPERCHARGED! STAY SHARP!" and Razorback leaps back down.
  - From then on he is faster (speed 1.4, charge 1.45, cool 64) and throws 5-disc fans.
  - He gains an energy-ray burst (engine `fire`) and a **sky dive**: he leaps off the top of the screen while a red reticle follows the player, it locks on, and he crashes down with a shockwave. After landing he staggers for 40 frames, which is the opening to punish him.
- **Lines:** a hit-line pool ("IMPOSSIBLE!", "YOU DARE STRIKE ME?!" …), the summon line "GUARDS! THROUGH THE WINDOWS!", and the KO line "NO... MY CORE... MY EMPIRE...!".

## Outro (the finale)
1. The brother walks to Amber's energy cage ("AMBER! HANG ON!"). The cage explodes and Amber, now free, says "MY HEROES! YOU CAME!".
2. "LET'S GO HOME, AMBER!", then the reactor powers down (screen dims, rumble).
3. The other three brothers (whoever the player isn't) run in from the left and everyone jumps in celebration.
4. Fireworks and confetti, and a big zooming "THE END", with the lines "AMBER IS SAFE. THE CITY SLEEPS EASY." and "THANKS FOR PLAYING SHELL SHOCK LIVE!".
5. About 10.7 s after the cage breaks the outro ends, then the pizza break, then the results card.

## Testing
- `node --check` passes.
- Headless auto-play of `?level=8&debug` ran stage → boss fight → phase-2 bark → outro → pizza → results → back to title with no exceptions. It also passed with `DEATHS=1` (tag-ins Rafe and Miko).
- Chromium screenshots checked: corridor with a blast door open, laser fence and vents live, phase-2 rage with drop-ins and the ring telegraph, the rescue, the THE END finale, and the results card.
- Harness copy (paths changed to my copy): `/workspace/work/lvl8_harness/` (`play.js`, `multi.js` plus `plan*.json`). Test site copy: `/workspace/work/lvl8_test/`.

## API gaps worked around (engine not patched)
1. **Effects freeze during an outro.** `updateStage` returns into `updateOutro` before `STATE.fx` is ticked, so any `api.fx` spawned in an outro (or still alive when it starts, like the "+100" pops of fleeing minions) would freeze on screen. The level's `outro.update` runs `STATE.fx = STATE.fx.filter(f => ++f.t < f.life)` itself, which is what `updateCut` does. Suggest fixing this in the engine.
2. **The results card can't be customised for a final level.** It shows "THE END... FOR NOW!" and "PLAY AGAIN" when `level9.js` is missing. The real finale celebration therefore happens in the outro. An optional `def.final: true` (for example, to show "THE END" / "CONGRATULATIONS") would be a nice engine addition.
3. **No spawn-at-position API.** Door and window spawns call `api.spawnEnemy(type)` and then move the newly pushed enemy (`api.enemies[last]`) to the door or window. Window drop-ins also set `state:"down", z:46` so the engine's own fall, bounce and get-up physics run.
4. **The boss's own move picker is pre-empted.** It is overridden by intercepting `walk` when `e.cool <= 1`. The phase-2 stat boost replaces `e.cfg` with a per-enemy copy (`Object.assign({}, cfg, …)`) so the shared def isn't changed.
5. **Custom boss states keep the boss invulnerable.** `throne`, `hop`, `rage` and `dive` aren't in the engine's hittable-state list. Disc throws and window summons reuse the `throw` / `summon` state names so the boss can still be hit during them.
6. **The engine plays no special music for the outro.** It keeps the level music; only SFX are added.

## Judgment calls
- The fortress strip was recut (seam cross-fade) and the throne room cropped to centre the throne. Both are new jpgs in this folder; the originals in ss_assets are untouched.
- Tested only as `?level=8` directly. The Level 7 → 8 handoff wasn't tested because level7 isn't in my test copy, but it is the standard loader path.
