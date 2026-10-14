# Level 5 — DOCKSIDE DOUBLE-CROSS (levels/level5.js)

Card: "DOCKSIDE DOUBLE-CROSS" / "SOMEBODY'S SMUGGLING TROUBLE BY THE CRATE." (accent #3ab8e0)
Files: `level5.js` (~31 KB), `level5_docks.jpg` (1904×512, see the art note below), `level5_docks_boss.jpg` (1032×512, unchanged).
Music: an original A-minor sea-shanty groove (126 BPM). Boss music: stock boss track moved down 1 semitone, 168 BPM.

## Layout
- **Section 0, the dock strip** (`level5_docks.jpg`, floor [166,218], length 1720): 3 waves at locks 0 / 560 / 1140.
- **Section 1, the ship deck** (`level5_docks_boss.jpg`, floor [168,218], length 420, so the camera ends at x=36 with all 3 hatches in view):
  1 wave of deckhands who climb out of the hatches, then the boss. That makes 4 waves in total.

## Hazards (all telegraphed, 2 damage with knockdown, and they hurt enemies too; the boss is never hit)
1. **Swinging crane hooks** (x 765 lane 190, and x 1440 lane 180). The hook hangs idle, then gets hauled back on its cable for 54 frames.
   During the haul it shakes, shows a "!", plays a rumble, and the floor shows a striped yellow swing path. Then it swings and the swing dies down.
   Its floor shadow always shows the lane. Step out of the lane to dodge it.
2. **Dropping crates** (waves 2–3, and on the deck once the boss is below 50% HP). A shadow grows and darkens for 60 frames with a blinking red ring, then the crate falls for 12 frames.
   It lands with a shockwave, sits for 70 frames, then splinters.
3. **Roll-up doors / ship hatches spawn enemies.** While the engine counts down `STATE.spawnT` to the next queued spawn, a visible door rattles and rolls up.
   The enemy that appears is moved into that doorway. On the deck, the boss's summon first flashes red klaxon lights over all three hatches (50 frames), then the adds burst out of them.
4. **Forklift charge** (wave 3). For 66 frames you get a striped lane at the brother's depth, headlight glow from the edge it will come from, a flashing "!" with ">>", and reversing beeps.
   Then it crosses the screen at 4.4 px/frame.

## Boss: GRIMWALE (harpoon-gun and anchor-chain bosun)
Ramrod atlas tinted sea-teal (sepia .5, sat 1.9, hue 155), scale 1.12, 38 HP. Custom `boss.update` adds these moves, plus the stock charge, kick and slam:
- **Harpoon**: he tracks your row for 30 frames, then locks on. A red/white sight line runs along the row, a loaded harpoon glints at the muzzle, and he fires at frame 48.
  A hit does 2 damage and reels the downed brother toward him ("REEL 'EM IN!"). Below 50% HP he fires a second harpoon.
- **Anchor sweep**: he whirls the anchor overhead for 44 frames while a red ring pulses on the floor, then makes one low 360° spin at radius 60. Jump it.
- **Anchor toss**: a target reticle sits on your spot for about 52 frames before the anchor lands there. The landing shockwave hits enemies too, then he hauls the anchor back.
- **Hatch summon** at 70% HP (purple + star) and at 40% HP (sword + dasher): "ALL HANDS ON DECK!"
- Lines: intro "WELCOME ABOARD, SHELLFISH! NOW WALK THE PLANK!", hits "MIND THE CHAIN, BARNACLE-BACK!" / "I'VE GUTTED BIGGER FISH!" / "ARR... THAT STINGS!", KO "ABANDON... SHIP..."
- **Outro** (leads to Level 6, snowy city): the ship's horn ("HONK!"), "THE CARGO'S GOING UPTOWN!", then "BUNDLE UP, BROS. IT'S SNOWING UP THERE!" while the first snowflakes fall.

## Verification
- `node --check` passes.
- Headless `play.js ?level=5&debug` reaches loading → stage → section 2 → boss fight → outro → pizza → results → title with no exceptions.
  The results card shows THE END because there is no level6.js in my test copy. Also passes with `DEATHS=1` (tag-ins).
- A keep-away variant of the bot confirmed every custom move fires (toss, harp, sweep, hatch) and that the forklift, hooks, crates and doors all trigger.
  No `level hook error` warnings.
- Chromium screenshots viewed: shot_gameplay (door spawn), shot_hazard (hook haul, swing path, crate shadow and falling crate), shot_forklift, shot_boss (toss reticle, anchor, harpoon sight line),
  shot_boss_sweep and shot_boss_hatch (klaxons). 0 page errors.
- Fixed after viewing: a hard tile seam in the strip, a hook that was too small, a forklift that was too small, the harpoon height and rope anchor point, and the door interior glow.

## API gaps worked around (no engine patches)
- **No seamless tiling:** the engine tiles section backgrounds without mirroring, and the stock `level5_docks.jpg` showed a hard seam every 903 px.
  My level copy is re-cut to 1904 px with the last 160 px cross-faded into the first 160, so the strip now tiles every 833 world px. Door rects in the code match this crop.
- **No door/hatch spawn API:** `spawnEnemy` only spawns at screen edges and returns nothing. Door spawns watch `STATE.spawnT` and `STATE.queue` to open a door ahead of time,
  then move the newly pushed enemy (spotted with a WeakSet) into the doorway.
- **No custom boss state names:** the engine's player hit-test only lets you hit enemies in a fixed list of states, so a custom state name would make the boss invulnerable.
  Custom moves therefore reuse `fire` / `kick` / `throw` / `summon` and tag the real move in `e.mv`. The hook clears `e.mv` if the engine changes the state (stagger or down).
- Harpoon and anchor projectiles live in a deck hazard (`gear`), not in the boss hook. That way they keep moving while the boss is staggered (`boss.update` is skipped then).
- **No new sprites:** there is no boss atlas besides ramrod/zap/razor/gunner/ninja, so GRIMWALE reuses the ramrod sheet (as BRICKJAW does) with a new tint plus a drawn anchor, chain and harpoon.
  Its "fire" frame gun doubles as the harpoon gun. It looks like a recoloured rhino, so a dedicated sprite sheet would make him far more distinct.
- `onUnload` drops the module-level `gear` state. Everything else is per-section hazard state created in `init`. There are no global listeners or timers.
