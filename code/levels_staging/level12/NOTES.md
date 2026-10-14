# Level 12: FUTURE NYC 2105 (Act III, the fourth time-travel stop)

## Files
- `level12.js` (39 KB). It uses only plugin API v1.
- `level12_skyway.jpg` (1786x512, 205 KB)
- `level12_datahub.jpg` (878x512, 138 KB)
- `level12_viral.png` (653x175 RGBA sprite sheet, 122 KB)
- Screenshots: `shot_*.png`

**Install:** copy `level12.js` and the three images into `levels/`.

**Story hook:** the card tagline is "THE RIFT DROPPED US IN THE FAST LANE."

**Ending:** the outro ends with "NEXT STOP: DIMENSION X", which leads into Level 13. It never says THE END.

## Art
All art is newly generated in the comic-painterly style, using the ss_assets jpgs as style references. The raw generations are in `/workspace/work/lvl12_art/`.

- **`level12_skyway.jpg`:** a neon 2105 Manhattan canyon behind an elevated glass/steel skyway deck with magenta and cyan edge strips.
  - The strip was resized to 512 px tall. I then searched for the start/end columns that match best (start 152, end 1938) and cross-faded 60 px, so it tiles without mirroring. The seam was checked in-game.
  - Deck: image y ≈ 376–512.
  - **FLOOR_TOP/FLOOR_BOT = [170, 216]**
- **`level12_datahub.jpg`:** a rooftop data hub. A cracked green/magenta holographic data monolith sits at centre, with the dimensional rift painted at top centre (world ≈ x 192, y 16) and neon towers in the side windows.
  - Cropped to exactly one screen, with the monolith at x = 192.
  - **FLOOR_TOP/FLOOR_BOT = [172, 216]**
- **`level12_viral.png`:** VIRAL generated as a 5-pose sheet (idle, walk/glide, attack/beam, hurt-glitch, KO lying) on magenta chroma.
  - Keyed and despilled in Python, then packed.
  - Frame rects are in `VF` in the JS. Frames face right. Draw scale is `VK = 66/175`, so she stands about 66 world px tall.

## Section 1: the skyway
- Length 2500. Locks at [0, 560, 1180, 1820].
- Waves:
  - purple / blue / purple
  - gunner / dasher / blue / star
  - heavy / sword / gunner / dasher
  - heavy / gunner / blue / dasher / star
- Enemies are hue-shifted to cyan/teal/violet. Weather is `speed`, with a light violet grade.
- **Music:** an original A-minor synthwave chase at 140 BPM. The boss track is the engine's boss track at −2 semitones, 182 BPM.

### Hazards
Every hazard has at least 40 frames of warning and also hurts non-boss enemies.

1. **Hovercar traffic lanes.** There are three lanes across the deck: y 171–184, 187–200 and 203–216.
   - **Warning (62 frames):** a lane (60% of the time, the player's own) flashes red. Big chevrons slide the way the car will travel, and a red "!" beacon glows on the side it comes from.
   - **Car:** it screams across at 8.5 px/frame with light trails.
   - **Damage:** 2 plus knockdown to the player. It can be jumped if timed (z ≥ 18). Enemies take 3 damage and are knocked down.
   - Traffic gets denser from wave 3 on.
2. **Anti-gravity pulse pads.** There are 8 floor pads that run on the music tempo (one beat ≈ 25.7 f).
   - A ring of 8 beat lights fills up. During beats 7–8 (about 52 f) the pad strobes white with a "!".
   - On the downbeat it fires a vertical pulse column.
   - Anyone standing on it is flung: the player takes 1 damage and a knockdown launch. Enemies take 1 damage and a big launch.
   - Jumping on the beat avoids it. The pads alternate in two groups, offset by 4 beats.
3. **Security drones.** One at a time, with a cooldown of about 5.5 s.
   - It hovers in and sweeps a cyan searchlight across the deck.
   - When the light finds you it turns red and a reticle locks on: it tracks for 20 f, then holds still for 32 f, with a "!".
   - A zap bolt then strikes that spot (1 damage plus knockdown; 2 damage to enemies).
   - It fires two shots, then flies off. Drones stop during the boss.

## Boss: VIRAL (46 HP)
**Look:** the custom sprite sheet, drawn by a custom `draw`.
- Every so often the sprite glitches: horizontal slices are displaced, with an RGB-split ghost.
- She has a green aura.
- The red flash on the engine's `tele` telegraph is kept.
- When she dies she dissolves into pixels that drift up toward the rift.

**Intro (state `boot`):** she assembles out of the monolith pixel by pixel and is invulnerable while doing so. Line: "WELCOME TO 2105, TURTLES. THIS CITY RUNS ON ME."

**Attacks:**
1. **Glitch teleport (`warp`).**
   - She dissolves for 20 f and is invulnerable while hidden.
   - A translucent ghost of her plus a dashed floor ring shows where she will reform, behind the player. It tracks loosely for about 40 f, with a "!".
   - She re-forms and goes straight into the engine `kwind` → `kick` (2 damage).
2. **Data beam (`fire`).**
   - **Warning (46 f):** her row turns red with edge lines, a dashed targeting line runs along it, her palm charges and a big "!" shows. She only re-aims during the first 24 f.
   - **Beam (30 f):** a full-width beam along that row. It does 2 damage plus knockdown and hits minions too.
   - Step out of the row to dodge it.
3. **Adaptive pixel swarm (`throw`).**
   - 5 to 8 glowing data cubes orbit her. Dashed aim lines show just before each one dives at where the player is heading.
   - After diving they home slowly for about 2 s, doing 1 damage on contact. Any swing pops them.
   - Each use adapts: it adds a cube, leads the dive more, and dives and homes faster. A "SWARM ADAPTING..." caption shows.
4. **Split into copies (`summon`, phase 2).**
   - She creates 2 decoys and all three shuffle to spread-out spots.
   - Decoys aim slow data bolts with a "!" and palm-glow telegraph (34 f).
   - One hit pops a decoy (a "DECOY!" burst).
   - **Tell:** decoys are slightly translucent and glitch much more often than the real one.
5. **Engine moves:**
   - `kick` at close range.
   - Glide-rush `charge`, with the red-flash `tele` telegraph, when she shares the player's row.

**Phase 2 (at 55% HP, state `rage`):**
- She is invulnerable and overloads: shake, pixel bursts, the rift flares. Line: "YOU CAN'T DELETE WHAT'S EVERYWHERE!"
- She performs the first split.
- The brother barks "SHE SPLIT! THE FAKES GLITCH MORE!"
- From then on she is faster (speed 1.35, cool 66) and splits again about every 16 s once the decoys are gone.

**Lines:**
- Hit pool: "CORRUPTED DATA!", "YOU CAN'T PUNCH CODE!", and others.
- Summon: "WHICH ONE OF ME IS REAL?"
- KO: "ERROR... ERROR... THE RIFT... IS PULLING ME..."

## Outro (about 6.7 s)
1. Leftover pixels are sucked up into the rift. The brother walks under it: "SHE'S GONE... BUT LOOK AT THE RIFT!"
2. The rift swells and a glimpse of the alien source appears inside it: a magenta sky, an orange sun and floating rock islands. Rumbles. "IT'S SNAPPING BACK TO WHERE IT CAME FROM..."
3. At t = 200 the rift snaps shut: white flash, boom, shake.
4. Caption: "THE RIFT SNAPS BACK TO ITS ALIEN SOURCE..." / "NEXT STOP: DIMENSION X". The brother says "DIMENSION X! AFTER IT, BROS!"
5. Then the pizza break and the results card. The results card prefetches `level13.js`.

## Testing
- `node --check` passes.
- **Headless auto-play of `?level=12&debug`:** loading → stage → boss fight VIRAL (the phase-2 split bark fired) → outro → pizza → results → title. There were no exceptions and no level-hook warnings.
  - It also passed with `DEATHS=1` (tag-ins RAFE and MIKO).
  - The logs are in `/workspace/work/lvl12_harness/run_full.txt` and `run_deaths.txt`.
- **Chromium screenshots viewed:**
  - `shot_gameplay` (lane warning plus an incoming hovercar)
  - `shot_hazard` (drone lock reticle plus a pad in warning)
  - `shot_boss_intro` (pixel assembly)
  - `shot_boss_split` (three Virals: the earlier, more-opaque decoy build)
  - `shot_boss` (phase-2 data beam knocking the brother down, decoys present)
  - `shot_outro` and `shot_outro2`
- **Fixes made after viewing:** chevron direction, a stronger beam/lane telegraph, bigger swarm cubes, a ghost-silhouette teleport marker, drone "!" moved off the HUD, decoy tells, and a reworked rift glimpse.
- The test copy is `/workspace/work/lvl12_test/` (it includes `level2.js` and the staged `level8.js` and its jpgs). The harness is `/workspace/work/lvl12_harness/` (`play.js`, `multi.js`, `plan*.json`).
- I tested only as `?level=12` directly, as the brief says. The Level 11 → 12 handoff is the standard loader path.

## API gaps worked around (engine not patched)
1. **Things the player can hit that aren't engine enemies.** Swarm cubes and decoys aren't `STATE.enemies`, so the level checks the player's live swing itself (`playerStrikes`: `p.attackT`, `p.atk`, `p.facing`, `p.bro.reach`).
   - Wish: `api.playerHitbox()` or a `hittable` custom-object list.
2. **Effects freeze during an outro.** The outro ticks `STATE.fx` itself, as in Level 8.
3. **The boss's move picker is pre-empted.** It is overridden by catching `walk` when `e.cool <= 1`. The phase-2 boost copies `e.cfg` per enemy so the shared def isn't changed.
4. **Custom boss states are invulnerable by design.** `boot`, `warp` and `rage` aren't in the hittable list. The beam, swarm and split reuse the engine names `fire`, `throw` and `summon`, so she can still be hit (and armour-staggered) during them.
5. **No beat clock from the music engine.** The pads count beats from `api.t` at the track's BPM, so they share the tempo but not necessarily the bar phase.
   - Wish: `api.beat` / `api.musicTime`.
6. **Custom bosses get no depth-sorted draw for extra actors.** Decoys are drawn in the hub hazard's `drawBack` or `drawFront`, depending on whether they are behind or in front of the player.
   - Wish: `api.addActor({x, y, draw})` that joins the depth sort.

## Judgment calls
- VIRAL is a generated sprite, not a tinted atlas, so she reads as a female digital entity: black/green data body, pixel-tendril hair, green eyes.
- The TMNT boss name is used by name, as BRIEF2 allows. The brothers stay Lenny/Rafe/Miko/Donny.
- Boss HP is 46, between the Act I bosses (30–40) and the L8 finale (58).
