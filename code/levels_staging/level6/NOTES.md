# Level 6 — FROSTBITE BOULEVARD

Files: `level6.js` (~28 KB, API-only plugin), `level6_snow.jpg` (street strip, 1720x512), `level6_snow_boss.jpg` (ice-rink arena, 1032x512).
Install: copy all three into the game's `levels/`. Nothing else changes.

## Structure
- **Section 0, street** (`floor [160,216]`, length 2320, falling snow): 4 waves, locks at 0/520/1060/1620.
  Waves: purple×2+blue → star, purple, dasher, blue → heavy, sword, star, dasher → heavy, gunner, dasher, purple, blue. Enemies get a cold palette through `hues`.
- **Section 1, frozen plaza rink** (`floor [164,212]`, length 384, `waves: []`): the boss starts as soon as you walk in.
- Music: an original E-minor 126 BPM track (`api.track`), plus the stock boss track shifted down 1 semitone at 170 BPM.

## Hazards (all telegraphed, all hurt enemies too, none hit the boss)
1. **Icy patches**: 8 glossy ellipses with sparkles. The player builds speed slowly and keeps sliding after letting go. Walking foot soldiers slip a little, and knocked-down foes skate further. Active all the time.
2. **Snowballs / ice chunks**: lobbed from behind the snowbank every ~3–4.5 s while the screen is locked. A flashing target ring and a growing shadow mark the landing spot for 54–62 frames. A snowball does 1 damage. An ice chunk (1 in 3, red ring) does 2 damage and knocks you down.
3. **Falling icicles** (wave 2 on, 2 at a time in wave 4): an icicle cluster shakes at the top of the screen, with a "!" plus a darkening shadow and a blue ring on the floor, for 56 frames. It then drops (14 frames) and shatters: 2 damage plus knockdown. Shard particles.
4. **Runaway snowplow** (wave 3 on, every ~9–12 s while locked): 84-frame warning showing a flashing amber lane band on your row, sweeping chevrons, "! PLOW!" on the side it comes from, then headlights. The plow truck then barrels across that lane at 6.2 px/f. You take 2 damage plus knockdown; enemies take 3. Jump over it or change lanes.

## Boss: COLD FRONT (freeze-gas gun villain on skates)
Ramrod-base boss using the `gunner` atlas, icy tint, scale 1.35, 38 HP. Custom `draw` adds a gas tank, skate blades and a frosty nozzle telegraph glow. The custom `update` adds two patterns; the stock patterns cover the rest.
- **Freeze Spray** (custom): the nozzle frosts over for 44 frames, then a 54-frame cyan gas cone sweeps along his row (150 px). If it catches you: 1 damage and you're **frozen in an ice block for 66 frames**. On the rink you keep gliding while frozen.
- **Blizzard Spin** (custom): 40-frame pirouette telegraph, then a ring of 10 ice shards fanning out across the floor. Below 50% HP he does two staggered rings.
- **Skate Rush** (stock `charge`, 1.45× speed, skate sparks), **Ice Lob** (stock `throw`, 3 snowballs), **Ice Quake** (stock `slam`), **kick**, **summon** (dasher + star, 900-frame cooldown).
- Below 50% HP: says "YOU WANT A COLD WAR? YOU GOT ONE!" and attacks come about a third sooner.
- **The whole rink is ice**: the player and minions slide with momentum.
- Lines: intro "FORECAST: 100% CHANCE OF SHELL-SICLES!"; hits "HEY! THAT'S MY GOOD PARKA!", "YOU'RE SKATING ON THIN ICE!", "BRR-UTAL!", "CHILL OUT, GREENIE!"; summon "BOYS! PUT 'EM ON ICE!"; KO "I'M... MELTING... OUTTA HERE..."
- **Outro** (Level 7 lead-in): "THAT PLOW CAME FROM THE JUNKYARD!", then "LET'S GO SCRAP SOME BAD GUYS!" with "NEXT STOP: THE JUNKYARD" on screen.

## Verified
- `node --check` passes.
- Headless auto-play `?level=6`: loading → street → rink → boss COLD FRONT → KO → outro → pizza → results → title. No exceptions and no level hook warnings, both normal and with `DEATHS=1` (tag-ins work).
- Debug run confirmed snowballs, icicle crashes, the plow, freeze spray (player frozen) and the boss's half-HP phase. Spin, spray and plow were also forced in Chromium for screenshots. No page errors.
- In my private copy the results card shows THE END because there's no level7.js there. With Level 7 deployed it will prefetch normally.

## API gaps worked around (no engine changes)
- **No friction/slide primitive.** Ice is done inside hazards: each frame, take the actor's intended movement (position change since the last frame) and blend the real velocity toward it (`slide()` in level6.js). The hazard update runs after player input and before enemies move, so this works for the player the same frame and for enemies one frame later.
- **No "freeze/stun player" call.** Freezing calls `hurtPlayer(1)` and then holds `player.hurtT` up while a module-level `FROZEN` counter runs. The ice block is drawn in the rink section's `drawFront`.
- **No boss frames for custom states.** The stock `bossFrame` would show "idle" for custom states and the boss's red flash is internal, so the boss uses a custom `draw` (with its own cyan telegraph glow instead of the red flash).
- **No boss arena field.** The arena is a second section with `waves: []` and `length: 384`; the engine starts the boss immediately.
- Pale effects disappear against the white snow/ice background, so all hazard and boss effects use dark outlines or saturated cyan (worth telling other snow/ice level authors).
- Unload: `onUnload` resets `FROZEN` and drops the hazard `init` refs. Per-section state, including WeakMaps of enemy slide records, lives in hazard `st`, which the engine throws away. No global listeners or timers.

## Screenshots
shot_gameplay.png (street, snowball + ice chunk in flight with target ring, icy patch), shot_hazard_plow.png (plow charging), shot_hazard_plow_warning.png (lane warning), shot_hazard_icicles.png (hanging icicles + shadow + crash), shot_boss_freeze_spray.png, shot_boss_shard_spin.png.
