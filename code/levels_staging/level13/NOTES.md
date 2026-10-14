# Level 13: DIMENSION X (Act IV opener)

**Install:** copy into `levels/`:
- `level13.js` (46 KB; uses the plugin API v1 only)
- `level13_dimx.jpg`
- `level13_dimx_boss.jpg`
- `level13_earth.jpg`
- `level13_traag.png`
- `level13_granitor.png`

The engine was not patched, nothing was deployed, and no shared files were touched.

**Story:** the time rift spits the brothers out in Dimension X. The outro takes them back to Earth through a portal, and the Technodrome phases into the city skyline. The outro lines are "WE'RE HOME... BUT SO IS THE TECHNODROME!", then "TIME TO TAKE THE FIGHT TO SHREDDER!", with the banners "THE TECHNODROME HAS PHASED INTO THE CITY!" and "THE FINAL SIEGE BEGINS...". There is no "THE END".

**Card:** DIMENSION X, tagline "THE RIFT SPITS US OUT... ON AN ALIEN WORLD.", accent colour `#5affb0`.

## Art (all generated, original, comic-painterly to match ss_assets)

| File | Size | What it is | Floor band |
|---|---|---|---|
| `level13_dimx.jpg` | 1809x512, 196 KB | Alien strip: stone bunker, fossil ribcage, glowing mushrooms, crystal spires, floating rocks, a sky portal. Built from two generations joined with 140 px cross-fades, so it tiles without mirroring. Tile = 791.4 world px. | `FLOOR_TOP=150`, `FLOOR_BOT=194` (ground in the image is y 305–450, about world 133–197; below that is a cliff face) |
| `level13_dimx_boss.jpg` | 878x512, 129 KB | Rocky plateau. The Technodrome looms at the centre back, a rock artillery emplacement with a big cannon sits on the right, and a stone bunker on the left. | `[152, 214]` |
| `level13_earth.jpg` | 878x512, 144 KB | Outro only: a city rooftop at night with the Technodrome materialising out of a green rift. | The brothers stand at about y 196–204 |
| `level13_traag.png` | 1169x228, 72 KB | Sprite sheet (alpha, 255-colour PNG): idle, walk, fire (painted muzzle flash), hurt, down | — |
| `level13_granitor.png` | 909x332, 78 KB | Sprite sheet (alpha, 255-colour PNG): idle, walk, leap (fists overhead), hurt, down | — |

- Both sheets were keyed off chroma green and despilled.
- Frame rects (with the body-anchor x) are listed in `FR` in the JS.
- The raw generations, plus the split/pack scripts, are in `/workspace/work/lvl13_art/`.

## Section 1: Dimension X strip
**Layout:** length 2600, locks at [0, 640, 1300, 1980].

**Waves:**
1. purple, gunner, blue
2. heavy, dasher, gunner, purple
3. sword, gunner, star, heavy
4. heavy, gunner, dasher, blue, gunner

**Enemies (by `hues` tint):**
- **Rock soldiers:** `gunner` hue 22 and `heavy` hue 32, earthy tan/brown. They march out of the bunkers.
- **Aliens:** ninja types tinted green, teal and magenta (purple 95, blue 165, sword 130, dasher 295, star 60).

**Hazards** (every one is visible or telegraphed for at least 40 frames, and they also hurt non-boss enemies):
1. **Low gravity (level-wide hook).**
   - Each frame it adds `vz += 0.1` to the airborne player and to airborne non-boss enemies. That cuts the net gravity from 0.25 to 0.15, so jumps float about 1.6x longer and higher, and knockdowns fly farther.
   - The brother barks "WHOA... I FEEL LIGHTER!", and a banner reads "LOW GRAVITY: JUMPS FLOAT FARTHER!".
2. **Acid pools.** There are 6 pools. Each is always visible as a bubbling green pool with a rock rim.
   - Stepping in drops you like a pit (`api.dropPlayer`, 1 damage), with a bark the first time.
   - **Eruption cycle:** fast bubbles, a rumble and a "!" for 52 frames, then a 64 px acid column for 40 frames. The column does 1 damage and knocks you down. It does 2 to enemies.
   - Walking enemies that wade into a pool take 1 damage.
3. **Toxic chasms.** There are two, at x 950–1050 and 1700–1815. Each is a dark ravine with lit rock lips, a sickly glow far below and fumes, cutting across the BACK 22 px of the floor band.
   - Yellow hazard posts flash "!" as you approach, and the first time you also get the bark "TOXIC CHASM! JUMP IT OR GO AROUND!".
   - **If you walk in:** you fall (2 damage) and climb out onto the front lane. During i-frames you are pushed back onto the rock instead of falling.
   - **Enemies:** walking enemies skirt around it. Enemies knocked down into it fall in (instant KO, "AIEEEE!").
4. **Crystal meteors.** About every 3–5 s, a shadow and ring grow near the player with a "!" for 56 frames. A crystal then falls slowly over the last 22 frames and shatters: 1 damage plus knockdown, 2 damage to enemies.
5. **Bunker doorways.** They line up with the bunker painted in each tile (x = 118 + 791.4n).
   - During a locked wave, a doorway glows orange with a "!" for 44 frames.
   - Then the next queued rock soldier (heavy or gunner) is pulled from `STATE.queue` and marches out of the door. Cooldown is 300 frames.

## Section 2: boss arena. GENERAL TRAAG & LT. GRANITOR (one boss entity, two phases, tag team)
**Setup:**
- The boss is 60 HP across both phases, on the `ramrod` base with custom `spawn`, `update` and `draw` hooks.
- Traag walks in. His intro line is "TURTLES! IN DIMENSION X? YOU'RE A LONG WAY FROM HOME!".
- Meanwhile Granitor stands on the cannon emplacement at the top right and says "THE ROCK SOLDIERS WILL CRUSH YOU!".
- A hint banner reads "DODGE THE TARGET MARKERS! JUMP THE SHOCKWAVES!".

**Phase 1: Traag fights, Granitor works the artillery**
- **Arm-cannon blast:** a 28-frame red-flash aim, then 3 shells along your row. They leave the muzzle high and dip toward the floor (custom `shot.update`).
- **Ground pound:**
  - A red crouch telegraph (26 frames), then a leap onto your spot with a red landing ellipse.
  - Landing: a direct hit (2 damage) and an expanding shockwave ring you must jump (2 damage).
  - Afterwards he staggers briefly, which is the punish window.
- **"GRANITOR! FIRE FOR EFFECT!":** calls a 3-shell artillery barrage. Every shell gets a red/yellow target marker on the floor with a "!" for 64 frames. A shell visibly drops from the sky over the last 18 frames, then explodes (2 damage plus knockdown, radius about 24).
- **Engine moves:** charge rush (red-flash tele) and the close kick.
- **Reinforcements, "ROCK SOLDIERS! FALL IN!":** the arena bunker door glows and 2 enemies march out.
- **Partner fire:** on top of all that, Granitor fires 2-marker barrages every 8–9 s on his own.

**Tag team (at 50% HP):**
- Traag calls "LIEUTENANT! TAG IN!", Granitor answers "YES, GENERAL!", and they leap past each other.
- Traag goes up to the cannon and Granitor drops into the arena. His landing is a ground pound with a shockwave.
- The HUD bar renames to LT. GRANITOR, with a WARNING flash.
- Then the lines "I'LL GRIND YOU TO GRAVEL!", Traag's "I HAVE THE BIG GUN NOW, TURTLES!" and the brother's "A TAG TEAM?! WATCH THE SKY!".
- The boss is invulnerable during the swap, about 3.5 s.

**Phase 2: Granitor fights, Traag on the cannon**
- Faster stats: speed 1.35, charge 1.4, cool 66, with an orange aura.
- **Moves:**
  - triple ground-pound chain (3 leaps that follow you, each with a shockwave)
  - lobbed rock throws (engine `throw`, 3 rocks)
  - charge
  - kick
  - "TRAAG! BOMBARD THEM!" calls (4 shells)
  - reinforcements
- **Traag's fire:** he shells you with 3–5 shells every 5–6 s, either targeted at you or as a creeping line across the arena.

**KO:**
- Granitor says "THE GENERAL... I HAVE... CRUMBLED...".
- The cannon explodes and Traag tumbles off the emplacement: "NO! THE TECHNODROME IS PHASING OUT! RETREAT!".

**Hit lines:** each boss has his own pool (`cfg.lines.hit`, swapped with the cfg at the tag).

**Animation:** all poses are animated:
- idle (breathing bob)
- walk (alternating frames)
- attack (fire, leap, lunge)
- hit (hurt frame, stagger shake)
- KO (down frame)
- a red-flash telegraph silhouette, made from a cached canvas.

## Outro (about 15 s)
1. The arena rumbles and the Technodrome flickers and ghost-slices ("IT'S PHASING OUT!").
2. A green/violet portal opens, with the bark "THAT PORTAL LEADS HOME! GO!".
3. The brother walks over and jumps in, and the screen whites out.
4. On the Earth rooftop, all four brothers drop out of the rift. The Technodrome glitches into solid reality over the skyline, with lightning and a rumble.
5. The lines and banners listed under Story play, and the brothers bounce.
6. Then the pizza break, then the results card.

## Testing
- `node --check` passes.
- **Full auto-play:** `node play.js "?level=13&debug"` reaches stage → acid fall → boss (Traag) → tag to Granitor → outro → pizza → results → title with no exception and 0 hook errors. It also passes with `DEATHS=1` (tag-ins Rafe and Miko).
  - Output is in `/workspace/work/lvl13_harness/run_full.txt` and `run_deaths.txt`.
- **Chromium:** no page errors. The only console error is the expected 404 for the `level14.js` prefetch, which is missing from my test copy.
- **Screenshots** viewed and fixed: the chasm was redrawn as a ravine, and the bubbles and banners were moved off the HUD.
- **Shipped shots:**
  - `shot_gameplay.png` — low-G jump with alien and rock-soldier enemies
  - `shot_hazard_acid_meteor.png` — acid eruption and meteor
  - `shot_hazard_chasm.png`
  - `shot_bunker_spawn.png`
  - `shot_boss_traag_blast.png`
  - `shot_boss_barrage_markers.png`
  - `shot_boss_tag_team.png`
  - `shot_boss_granitor_pound.png`
  - `shot_outro_earth.png`
  - `shot_results.png`
- **Boss shots were staged:** the tag and pound shots were taken with a test-only hook that drops section 1. That is why the WARNING flash overlaps Traag's intro bubble in `shot_boss_tag_team.png`; in normal play the tag happens long after the intro.
- **Harness:** `/workspace/work/lvl13_harness/`.
  - `multi.js` has two additions:
    - **manual-frame stepping** (`{"manual":true}`, `{"step":N,"cond":"js"}`), which is about 10x faster than real-time while the box is loaded
    - **`BOSSFIRST=1`**, which wraps `SS.registerLevel` to start at the arena
  - `play.js` adds `PASSIVE`, `LOGBOSS` and `BOSSFIRST` env switches.
- **Test site copy:** `/workspace/work/lvl13_test/` (includes `level8.js` from staging; `level12.js` wasn't in staging when I started).

## API gaps worked around (engine not patched) / wished-for hooks
1. **No per-enemy custom drawing.** Rock soldiers and aliens can only be hue-rotated `gunner`/`ninja` atlases (after sepia, so no true stone grey). Wish: `def.enemySkins[type] = {sheet, frames}` or a `draw(api,e,sx,sy)` hook for regular enemies.
2. **No spawn-at-position.** Bunker and door spawns call `api.spawnEnemy(type)` and then move `api.enemies[last]` (same as L8). Wish: `api.spawnEnemy(type, {x, y})`.
3. **Two-boss fights aren't supported** (one HUD bar, and the level finishes when no `e.boss` is left). The duo is one boss entity. Its identity (`who`, `name`, `cfg`) swaps at the tag, and the partner is drawn and simulated by the arena hazard (bubbles via `api.bubble`).
4. **No gravity setting.** Low gravity is a level-wide hazard that adds `vz` back each frame. Wish: `section.gravity`.
5. **Custom boss states must reuse hittable state names** so the boss can be hit: blast = `fire`, calls/doors = `summon`, pounds = `slam` with `e.mv`. The swap state `tag` stays invulnerable on purpose. The engine's move picker is pre-empted at `e.cool <= 1` (same trick as L8).
6. **Effects freeze during an outro** (same as L8). `outro.update` ticks `STATE.fx` itself.
7. **The outro can't change the background.** The Earth scene is drawn full-screen in `outro.draw`, over the actors, with the four brothers redrawn by hand. Wish: `api.setBackground(src)` or an outro `bg`.

## Judgment calls
- I made a third image (`level13_earth.jpg`) for the outro payoff. The brief only asked for a strip and an arena; it is still small (144 KB).
- The boss sheets are PNG, as BRIEF2 allows (each under 80 KB).
- The licensed names used are Dimension X, General Traag, Lt. Granitor, the Technodrome and Shredder (outro line). This follows BRIEF2, which allows the licensed boss names; the brothers stay Lenny/Rafe/Miko/Donny.
- The strip has a faint cross-fade "ghost" at its two joins (behind the bunker and near the crystals). It is visible on close inspection only.
