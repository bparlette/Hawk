# Level 14: TECHNODROME PORTAL

Files:
- `level14.js` (59 KB). It uses only plugin API v1.
- `level14_portal.jpg` (1696x512, 201 KB).
- `level14_technodrome.jpg` (878x512, 106 KB).
- Screenshots: `shot_*.png`.

Install: copy `level14.js` and both jpgs into `levels/`. On the results card the engine prefetches `level15.js`. While that file is missing the card says "THE END... FOR NOW!", which is the engine's text, not the level's. **The level itself never says THE END.**

## Story
- **Card:** "THE WAR MACHINE IS PHASING INTO NEW YORK!"
- **Boss intro:** a violet beam drops KRANG into the plaza. "BEHOLD! THE TECHNODROME HAS ARRIVED!" then "NOW, TURTLES... TASTE MY NEW BODY!"
- **KO line:** "NO! NOT MY BODY! SHREDDERRR!"
- **Outro (leads into L15):**
  1. Krang's brain pops out of the empty android and scuttles up the Technodrome ramp: "I'LL BE BACK FOR YOU, TURTLES!"
  2. The brother: "THE BRAIN'S GETTING AWAY!"
  3. SHREDDER appears in the hatch doorway: "YOU WANT ME, TURTLES? COME CLIMB MY TOWER!" He vanishes in smoke and the hatch slams shut.
  4. The brother: "SHREDDER'S TOWER... THIS ENDS TONIGHT!"
  5. A caption reads "NEXT: THE FINAL ASCENT / SHREDDER WAITS AT THE TOP OF HIS TOWER."
  6. About 9 s in total, then the pizza break and the results card.
- Brothers keep the engine's names (Lenny, Rafe, Miko, Donny).

## Art (generated with generate_image, using ss_assets jpgs as style references)
- **`level14_portal.jpg`:** a Manhattan brownstone street at night. A purple portal is in the sky, and the lower half of the Technodrome sphere is phasing through it while hull modules fall away.
  - Re-cut so it tiles seamlessly: I found the best-matching column pair 1696 px apart and cross-faded 30 px. Checked by tiling it twice.
  - **FLOOR_TOP = 170, FLOOR_BOT = 214.** The walkable street runs from image y ≈ 390 to 490. The sidewalk and hydrants below that are foreground.
- **`level14_technodrome.jpg`:** a ruined plaza with the Technodrome wedged between skyscrapers inside the portal. Its open hatch and ramp sit at screen centre (x ≈ 192, hatch door y ≈ 98–127).
  - **FLOOR_TOP = 160, FLOOR_BOT = 216.**
- Raw generations are in `/workspace/work/lvl14_harness/l14_strip_raw.png` and `l14_boss_raw.png`.

## Section 1: the street (length 2800, locks at 0 / 680 / 1380 / 2080)
- **Waves:**
  1. purple / purple / star
  2. purple / heavy / gunner / sword
  3. heavy / gunner / blue / star
  4. heavy / heavy / gunner / dasher / sword
- Foot soldiers keep the ninja hues. Heavies and gunners are tinted as Stone/robot troopers (`hues` heavy: 12, gunner: 192).
- Weather is embers, plus random portal lightning bolts and sky flashes.

## Hazards (every one telegraphs ≥ 40 frames and also hurts enemies)
1. **Falling fortress modules** (both sections). A dark shadow ellipse grows on the floor for 66 frames, with a red ring that turns yellow and a blinking "!". In the last 18 frames the armoured hull chunk drops out of the sky in a violet streak.
   - **Crash:** 2 damage and a knockdown. Enemies under it take 3 damage; mousers are scrapped.
   - **Afterwards:** it lies in the street for about 7 s as a solid block with glowing violet seams, a torn edge and a sparking cable.
   - **Cover:** it stops thrown and shot projectiles, turret beams and Krang's eye laser.
   - **Platform:** jump on top (z 15) and you stand on it, which also keeps you above Krang's stomp shockwave.
   - **Blocker:** players and enemies are pushed around its sides.
   - **Phasing out:** it flickers and scanlines for the last 60 frames, then disappears. Krang's walk or a fist rocket smashes one.
   - **Depth fix:** a block is redrawn over actors standing behind it.
2. **Laser turret drones** (section 1, from wave 2 on, one at a time about every 6–8 s). A drone flies in at the left or right screen edge.
   - **Aim:** for 52 frames it tracks your lane, with a dotted red lane line, a lane tint and a "!".
   - **Lock:** the line goes solid for 14 frames.
   - **Fire:** a 26-frame beam along that lane (2 damage and a knockdown). Jump it, change lanes, or hide behind a module; the beam stops at the module.
   - It fires twice, then leaves.

## Boss: KRANG in his android body (34 HP, `base:"ramrod"` with custom `update`/`draw`/`spawn`)
- **Look:** drawn entirely on canvas with posed limbs. Tan muscular body, maroon briefs and boots, grey X-harness with a strap band, steel shoulder pads and headband with an antenna. The **gold belly window has the pink brain inside**, with a tiny face.
- **Poses:** idle, walk cycle, wind-up/punch, stomp (leg raised), fist launch (stump with jet glow), eye charge, summon (arm raised), rage, hurt, stagger, down/getup, KO.
- **Armour:** while the window is dark, each hit only does half damage and shows a "clink". The brother barks once: "TOO TOUGH! HIT HIM WHEN THE BRAIN GLOWS!"
- **When the window glows** (gold glow plus "HIT THE BRAIN!" the first couple of times), hits do full damage. That happens:
  - for 80 frames after a stomp
  - while his fist is flying
  - for 70 frames of overheated stagger after the eye laser
  - for 60 frames while he summons
  - whenever the engine staggers him (3 quick hits)
- **Attacks:**
  1. **Stomp:** he raises his leg for 40 frames, with a red/yellow growing floor ring and "JUMP!". Then a crash with close damage plus an expanding shockwave ring; jump it or stand on a module. Phase 2 adds a second, delayed ring.
  2. **Fist rocket:** he aims for 34 frames, tracking your row with a red-flashing window, then fires his fist with a jet flame along the lane (2 damage and a knockdown). It returns to the arm. Phase 2 adds a second fist from the other arm, aimed at your current row. A module in the way is smashed.
  3. **Eye/brain laser:** a 36-frame charge with a dotted targeting line from his eye to your lane and a lane tint. Then a beam sweeps along your lane, leaving scorch marks (2 damage and a knockdown); a module stops it. Afterwards he overheats into a 70-frame stagger with smoke. Phase 2 fires a second sweep first.
  4. **Summon mousers:** "MOUSERS! CHEW THEM UP!" 3 robot mousers (4 in phase 2) with chomping jaws chase you and bite for 1 damage. Any swing scraps one; shockwaves, lasers, fists and modules kill them too.
  5. **Close punch:** the engine's `kwind` / `kick`.
- **Phase 2 (at 50% HP):** "TECHNODROME! FULL POWER! CRUSH THEM!" He gets a violet aura and lightning, and a salvo of 4 modules rains into the plaza. The brother barks "HE'S OVERLOADING! WATCH THE SKY!" After that he picks moves faster, uses the double moves above, and modules fall more often.
- **Music:** an original D-minor march at 148 BPM. The boss track is the engine's, raised 2 semitones, at 180 BPM.

## Testing
- `node --check` passes.
- **Headless auto-play of `?level=14&debug`:** 3 normal runs plus one with `DEATHS=1` (tag-ins Rafe and Miko). Each went loading → stage → boss fight → outro → pizza → results → back to title, with no exceptions and no hook warnings.
- **Boss length:** the harness bot only button-mashes and never waits for the glow, yet it took him to about 10% HP within its 2400-frame stuck limit in 2 of 4 runs. In those runs the harness force-killed the boss. In the other runs the bot killed him itself (about 40 s).
- **Chromium screenshots checked:** street wave, falling-module shadow, a turret beam stopped by a module, the boss beam-in, stomp ring, fist rocket, mousers, eye laser, phase 2, the KO, the brain escaping, Shredder in the hatch, and the caption.
- Test copy: `/workspace/work/lvl14_test/`. Harness copy: `/workspace/work/lvl14_harness/`, with `play.js`, `playdbg.js`, `multi.js`, `plan1–7.json` and `fps.js`, all pointed at my copy. `level8.js` is copied into the test copy for chain prefetch.

## API gaps worked around (engine not patched)
1. **No hookable damage pipeline.** The armour/vulnerability window is done by watching `e.hp` each frame in the arena hazard and refunding part of the damage when the window is closed. Wished for: `boss.onHit(api, e, dmg, heavy) → dmg`.
2. **No solid props or platforms.** Modules do their own collision (pushing the player and enemies, standing on top at z = 15, filtering `STATE.stars`) inside a hazard. Engine v1.1 props may cover this later. A `section.solids` or `api.addSolid` with platform heights would be cleaner.
3. **Depth sorting for hazards.** `drawBack` is always under every actor. Modules are redrawn in `drawFront` when an actor stands behind them. Wished for: `api.addActor({y, draw})`, a depth-sorted custom drawable.
4. **Mousers are not engine enemies** (there's no small-enemy type). They're a custom swarm in the arena hazard: player swings are detected through `p.attackT` / `p.atk` / `bro.reach`. A `spawnEnemy(type, {x, y, custom})` with custom AI and hitbox would help.
5. **Effects freeze during an outro** (same as L8). `outro.update` ticks `STATE.fx` itself.
6. **The boss move picker is pre-empted** by intercepting `walk` when `e.cool <= 1`. The phase-2 boost replaces `e.cfg` with a per-enemy copy.
7. **Custom boss states are invulnerable** (`phase`, `rage`). The move states reuse the engine's hittable names (`slam`, `throw`, `fire`, `summon`), so he can be hit during his attacks.
8. **No spawn-at-position** (same as L8). Not needed here, because the mousers are custom.

## Judgment calls
- **Krang is drawn procedurally on canvas,** not as a generated sprite sheet. That gave reliable poses for every state and no PNG to load or key out. It reads as Krang: tan android body, maroon briefs/boots, harness, and the brain in the belly window.
- **Shredder appears only as a small outro figure:** a steel-tinted ninja atlas sprite with a canvas-drawn bladed helmet, mask, cape and spiked shoulders. His full boss fight belongs to L15.
- **Boss HP is 34,** below L8's 58, because the armour and vulnerability windows already stretch the fight.
- The section-1 floor band keeps actors on the asphalt, off the sidewalk.
