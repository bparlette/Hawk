# Level 3 — SEWER SHOWDOWN (levels/level3.js)

Files: `level3.js` (~25 KB), `level3_sewer.jpg` (strip), `level3_sewer_boss.jpg` (arena). Drop all three into `levels/`.
Tested in a private copy (`/workspace/work/lvl3_test/`) alongside the unchanged level2.js.

## Structure
- Card: "SEWER SHOWDOWN" / "HOLD YOUR NOSE. HOLD YOUR GROUND." (green rule). Original music (E minor, 120 BPM sewer groove); boss music = stock boss track transposed −1, 168 BPM.
- Section 0 (strip, length 2240, floor [154,218]): 3 locked waves (4 / 5 / 6 enemies), `drips` weather.
- Section 1 (outflow-pipe arena, length 384 = one screen): one small rat wave (dasher, dasher, purple), then the boss.
- Hues: rats = brown dashers (hue 15) with drawn pink tails; olive/teal palette for the rest.

## Hazards
- **Wading lane** (level-wide): y < 172 is the glowing water channel. Player and walking enemies move at ~55% horizontal / 70% depth speed there; splash droplets + ripple rings hide their feet. Knockback/air/grab are not slowed.
- **Sludge geysers** (strip): 6 drawn floor grates on the walkway. Cycle 190 idle → 52-frame telegraph (grate flashes, bubbles, `!`, rumble SFX) → 38-frame eruption column. 2 dmg + knockdown; also knocks enemies down (2 dmg). Jumping high clears it (z ≥ 34).
- **Pipe drops** (both sections): ~50% of strip spawns (90% in the arena) drop out of a wall pipe on screen (pipe mouths at strip x 235/742 per 903-px tile; arena outflow pipe at x 226) with a green gush, land with a splash. Invulnerable and passive while falling.

## Boss: GULCH GATOR (original sewer-gator brute)
- Built on the ramrod base + atlas, re-tinted green, with an **original gator head painted over the sheet's head** in a custom `draw` hook (per-frame head anchors, red-flash and hit-flash variants via tinted sheets).
- Entrance: surfs out of the outflow pipe on a gush (custom state, invulnerable), lands with a splash ring; intro line held until the WARNING banner clears: "SURF'S UP, SHELLBACKS! THIS IS MY SWAMP!"
- Patterns (5 + summon): **Tidal wave** (custom; 46-frame lane telegraph = pulsing band + chevrons on the back or front half of the floor, then a crest rolls across that half — sidestep in depth or jump; below 50% HP a second wave follows on the other half), **Sludge vents** (custom; 3–4 bubbling puddles under/around the player, 52-frame telegraph, then geysers), plus engine `charge`, `kick`, `slam`, `throw` (3 sludge lobs) and `summon` (2 rats, which drop out of the pipe). HP 38.
- Waves/geysers also hit minions. KO line: "GLUB... I'M... GOIN' DOWN THE DRAIN..."; on defeat all pending waves/vents are cleared.
- Outro: a ladder + daylight shaft; brother walks over: "PHEW! FRESH AIR UP THAT LADDER..." → "THAT'S THE HIGHWAY! GRAB A BOARD!" + "NEXT: THE HIGHWAY" blink → pizza → results (prefetches level4.js).

## Tests run
- `node --check` OK.
- Headless auto-play `?level=3`: loading → section 0 → section 1 → boss fight GULCH GATOR → outro → pizza → results → title, no exceptions/hook errors. Also with DEATHS=1 (tag-ins RAFE/MIKO fine) and a chained `?level=2` run (L2 results → L3 loads, L2 unloads, L3 completes; level4.js missing → back to title).
- Chromium screenshots viewed: gameplay (rats with tails, wading ripples), geyser eruption, boss tidal wave, boss wave telegraph, boss frame gallery. No page errors.

## API gaps worked around (no engine patches)
1. **No movement-speed hook** → wading slow is done in a hazard `update` by damping the frame's position delta (player via stored previous pos; enemies via `e._px/_py`).
2. **No spawn-position hook** → pipe drops relocate freshly spawned enemies (tagged `e._l3`) and fake the fall by driving `e.z` while holding x/y.
3. **Custom boss states aren't hittable** (checkPlayerHits whitelists states) → custom moves run under the engine's `"throw"` state with `e.mv` = surf | wave | vents, so the boss stays hittable/staggerable; `cfg.update` returns true for those.
4. **Boss `spawn` can't replace the walk-in** cleanly → spawn sets state "throw"/mv "surf" and positions the boss at the pipe; the intro line is spoken by our own code (bossEnter never runs).
5. **`frameTint`/`flashAll` aren't exposed** → the custom draw uses `api.tintSheet` with RED / WHITE tints for telegraph and hit flash.
6. The engine leaves the "GO →" arrow up when a section's last wave clears right before the boss; the arena's `onUpdate` zeroes `STATE.goT` during the boss phase.
7. The boss HUD bar covers the bottom ~15 px of the floor, so the front-half wave crest is partly under it (telegraph band is still visible above). Engine layout, not changed.

Note: headless Chromium here runs the game at ~17 fps under load; Playwright's Chromium cache disappeared mid-session and was reinstalled with `npx playwright install chromium` (in /workspace/work/sstest).
