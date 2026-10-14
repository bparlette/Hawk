# Level 9: SHADOWS OF EDO (Act III opener)

**Story.** The reactor blast at the end of Level 8 tears a temporal rift and drops the brothers into Edo-period Japan. Level 9 ends with the rift hurling them onto 17th-century seas, which sets up Level 10. It does not say THE END.

## Files

- `level9.js` (≈35.7 KB). Uses API v1 only and calls only `SS.registerLevel`.
- `level9_edo.jpg` (1630x512, 177 KB): the Edo street strip.
- `level9_castle.jpg` (878x512, 118 KB): the castle-courtyard boss arena.
- `level9_karai.png` (912x194, 132 KB, RGBA): Karai's sprite sheet.
- Screenshots:
  - `shot_gameplay.png`
  - `shot_hazard.png`: archer volley marks
  - `shot_hazard_spikes_bomb.png`: bamboo spikes plus an incoming smoke bomb
  - `shot_boss_intro.png`: Karai on the gate roof
  - `shot_boss.png`: clone feint
  - `shot_outro.png`: thrown onto the high seas

**Install:** copy `level9.js`, the two jpgs and the png into `levels/`. The png is declared in `def.images`, so the engine preloads it and releases it on unload.

## Art (generated for this level, comic-painterly to match ss_assets)

- **Strip.** Generated at 2064x512 (Edo village at dusk: pagoda, machiya houses, lanterns, bamboo, a violet rift swirl in the sky).
  - Re-cut so it tiles without mirroring: crop x 150–1890, then the last 110 px are cross-faded into the first 110 px and those first 110 px dropped.
  - Tile width is 713 world px. There is a slight ghosted lantern at the seam, which is acceptable.
  - **FLOOR_TOP/FLOOR_BOT = [172, 216]**: the road starts at image y≈390.
- **Boss arena.** Generated at 1376x768, scaled to 512 tall and centre-cropped to 878 so the gate and moon sit at screen x=192.
  - **Floor = [170, 216]**: wooden deck from image y≈385.
- **Karai sprite.** A generated photographic-cutout sheet in the same style as the ninja atlas, on chroma green.
  - Keyed, despilled, 1 px alpha-eroded and packed at 0.5x.
  - Frames, all facing right with feet at the rect bottom: `idle, walk, slash, throw, hurt, down`, plus a `kunai` projectile frame.
  - The frame rects are hard-coded in `KF` inside level9.js.
  - Drawn at k=0.36 (≈64 world px tall, a bit taller than foot soldiers).
  - Raw generations are in `/workspace/work/lvl9_art/` (`gen_l9_*.png`, `pack.py`, `bg.py`).

## Section 1: Edo street

- Length 2560. Locks at [0, 620, 1260, 1920].
- Waves (ninja clans re-hued to crimson, navy and indigo):
  1. purple, purple, star
  2. blue, sword, purple, dasher
  3. star, sword, blue, dasher, purple
  4. sword, sword, blue, star, dasher
- **Ambience:** cherry petals and the rift closing overhead for the first 150 frames. The brother barks "WHERE... WHEN ARE WE?!" and then "NINJAS. WHY IS IT ALWAYS NINJAS?".

### Hazards

All hazards telegraph for at least 46 frames, do 1 damage, and also hurt non-boss enemies.

1. **Smoke-bomb ambush.**
   - During a locked wave, the next queued enemy is lobbed in by bomb instead of walking in.
   - Telegraph: a growing ground shadow, a target ring, "!", and a sputtering fuse for 46 frames.
   - The burst does 1 damage within 16 px, leaves a lingering smoke cloud, and the enemy steps out of the smoke.
   - First time it happens, the brother barks "SMOKE BOMBS! HEADS UP!".
2. **Bamboo spike traps.** 7 patches. Each cycles: idle 190 frames → warning 50 frames (dirt shivers, leaf tips poke out, "!") → stakes up for 60 frames (1 damage plus knockdown). Jumping clears them (z ≥ 10).
3. **Archer volley.**
   - About every 6.5–8.5 s, 4 red target rings appear (one under the player) for 56 frames, with "!".
   - Then arrows rain in for 10 frames and do 1 damage plus knockdown. The arrows stay stuck in the ground for a while.
   - First time: "ARCHERS! WATCH THE RED MARKS!".

## Boss: KARAI (44 HP; phase 2 at 50%)

- **Intro.** She stands on the castle-gate roof against the moon (invulnerable).
  - Lines: "SO THE RIFT DELIVERS TURTLES TO MY DOOR." and "I AM KARAI. AND THIS IS WHERE YOU FALL."
  - She then leaps down into the courtyard.
- **Moves.** Her own picker overrides the engine's on `walk` when `cool<=1`.
  - **Twin-blade combo** (close range): red-flash wind-up of 16 frames (12 in phase 2), then two quick slashes. 1 damage each; the second knocks you down.
  - **Kunai fan:** red-flash wind-up of 22 frames, then 3 kunai (5 in phase 2). Drawn from the sheet's kunai frame.
  - **Dash slash:** 34-frame red-flash telegraph, then she streaks across the row with afterimages. 2 damage plus knockdown.
  - **Smoke vanish-and-reappear:** she poofs out (invulnerable and off the floor). A red ring plus "!" plus gathering smoke marks the spot behind you for 44 frames. She reappears there and goes straight into the twin-blade combo.
  - **Clone feint** (from 70% HP, and more often in phase 2):
    - She poofs and reappears with 2 clones (3 in phase 2) surrounding you. All of them flash red in sync for about 26 frames.
    - The tell: only the real one casts a shadow, with an extra-dark contact shadow drawn under her. First time, the brother barks "CLONES?! ONLY ONE HAS A SHADOW!".
    - Then everyone dash-slashes at once. Fakes burst into smoke when they touch you or get hit, and do no damage.
    - Hitting the real one during the stance cancels the feint and the fakes vanish.
  - **Smoke-bomb ambush:** "SHADOWS! STRIKE!". Two bombs land at the screen edges and two clan ninjas step out (purple + star in phase 1, blue + dasher in phase 2).
- **Phase 2 (at 50%).**
  - She vanishes, reappears on the gate roof with "ENOUGH GAMES. NOW FACE ALL OF ME!", and bombs in two ninjas.
  - The brother barks "SHE'S EVEN FASTER NOW! WATCH HER SHADOW!" and she drops back in.
  - From then on: speed 1.75, cool 58, a red aura, 5-kunai fans, 3 clones.
- **Hit lines:** "SLOPPY.", "YOU'LL HAVE TO BE FASTER!", "A LUCKY CUT.", "NOT BAD... FOR A TURTLE."
- **KO line:** "THIS... ISN'T OVER, TURTLES...". About 0.8 s into her dying state she vanishes in a burst of smoke instead of lying there.
- **Animation:** idle/walk alternate while moving; slash, throw, hurt (stagger shake), down/dying, plus the red-flash telegraph copy (a cached canvas, released on unload).

## Outro (leads to Level 10)

1. Bark "SHE VANISHED... TYPICAL NINJA."
2. The rift over the moon grows into a vortex with wind streaks and rumble: "THE RIFT! IT'S PULLING US IN!"
3. The brother is lifted, spinning, into it: "HERE WE GO AGAAAIN!"
4. White flash, then a night-sea card with a galleon silhouette and the captions "SOMEWHERE ON THE HIGH SEAS... 1600-SOMETHING", "SPLASH!" and "WE TRADED NINJAS FOR PIRATES!"
5. About 7.3 s total, then the pizza break, then the results card.

## Testing

- **`node --check`:** passes.
- **Headless auto-play of `?level=9&debug`:** ran stage → boss (barks for the clone and phase 2 seen in natural play) → outro → pizza → results → title, with no exceptions and no "level hook error" warnings.
- **`DEATHS=1` run:** also passed, with tag-ins to Rafe and Miko, one of them mid-boss.
- **Results card:** shows the end-of-run card in my test copy only because `level10.js` isn't there. That is the standard prefetch path.
- **Chromium screenshots checked:** street plus volley marks, spikes plus an incoming bomb, Karai's roof intro, the clone feint, phase-2 rage on the roof, the vanish marker, the KO, and the sea outro.
  - Fixes from them: the roof speech moved into a side bubble (the engine bubble sat under the HUD); the clones' red flash synced to the real Karai; a softer red overlay; gradient smoke; outro captions moved below the HUD; "?" removed from `ptext` because that font has no "?".
- **Test copies:** site `/workspace/work/lvl9_test/` (it includes `level8.js` from staging for the chain prefetch); harness `/workspace/work/lvl9_harness/` (`play.js`, `multi.js`, `p1–p5.json`).

## API gaps worked around (engine not patched; API v1 only)

1. **No spawn-at-position.** Smoke-bomb enemies use `api.spawnEnemy(type)` and then move `api.enemies[last]` into place (and set `entered=true`).
2. **No way to hide a boss or its shadow.** For vanish and the clone feint, `e.y` is parked at 900 (off the floor: no shadow, no hits) and restored on reappear. A safety check restores her if any other state is entered while she's hidden.
   - Wish: `e.hidden` / `e.noShadow`.
3. **No custom hittable states.** The clone stance uses the state name `"boss"`, which is in the engine's player-hit state list, so the real Karai can be punished. Wind-ups reuse `kwind`/`kick`/`throw`/`tele`/`charge`/`summon` for the same reason.
   - Wish: `cfg.hittable: [...]`.
4. **Speech bubbles for high positions.** The engine bubble is placed at `y - z - height`, which goes under the HUD when the boss is perched high. The roof lines call `enemySay` (for the voice), zero `sayT`, and draw a two-line side bubble instead.
   - Wish: a bubble-offset option.
5. **Outro doesn't tick `STATE.fx`.** Same workaround as Level 8: the outro filters `STATE.fx` itself.
6. **No per-level hit-flash tint for custom sheets.** `tintSheet` only works on built-in atlases, so a red-overlay copy of the Karai sheet is built once and dropped in `onUnload`.
   - Wish: `api.tintImage(img, tint)`.
7. **The boss's own picker is pre-empted** by intercepting `walk` when `cool<=1`, as Level 8 does. The phase-2 stat boost swaps `e.cfg` for a per-enemy copy.
8. **Nice-to-have hooks for the v1.1 engine:** a level-chosen outro music track; `api.playerSay` with a bubble side; a spawn-from-point helper that also marks the enemy as having entered.

## Judgment calls

- I chose the level name and card ("SHADOWS OF EDO" / "THE RIFT THREW US BACK 400 YEARS. AND THE NINJAS WERE WAITING.").
- The licensed name is used only for the boss (KARAI), as BRIEF2 allows. Brothers stay Lenny/Rafe/Miko/Donny. Amber doesn't appear in this level.
- The heavy/gunner types are left out of the waves: their modern-soldier look fights the Edo setting.
