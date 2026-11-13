# Lanternport — staged scenes for Shorts: status & how to add one

The point of this file: anyone picking up Lanternport can see in one page what
filming infrastructure exists, which scenes are built, and exactly how to add
the next one. Two build briefs live in the gamepress repo under
`docs/fable-prompts/`: **`fablego.md`** — the live brief (a festival-metropolis
program of eight original scenes, self-contained, no external specs) — and
**`aicitygo.md`** — the original frame-matched scene program, whose specs and
key stills live at `docs/fable-prompts/lanternport-refs/<folder>/`, held for a
different builder. The slate table below is the aicitygo program; the fablego
scenes reuse the same registry slots as they land.

## Filming kit (built, tested)

- **Capture camera** (`capture.js`, wired in `index.html`): freecam (P toggles,
  drag orbit / Shift-drag pan / WASD fly / wheel dolly, touch orbit + pinch),
  drift-free timescale 0.25 / 0.5 / 1 / 2 ([ and ] step), 9:16 guide overlay
  (G), hide-HUD (U). URL: `?freecam=1&ts=0.25&guide=1&hud=0`. State for the
  external recorder is on `window.__dbg` (freecam, timescale, bookmark, tick,
  digest, scene).
- **Digest parity is proven**: `test/lanternport-capture.test.mjs` plays the
  bot at every timescale and odd frame rates and requires an identical sim
  digest at every tick. Slow motion cannot change the game.
- **Scene staging** (`scenes.js`): open `?scene=<id>&seed=<n>`. Number keys
  **1–8** jump the freecam to `SCENES[n]`'s staged bookmark framing. The
  scene's event log (name + tick) is on `window.__dbg.scene.events` so a
  recorder can align captions and cuts. Contract: scenes use only game state
  + the seeded RNG — no Math.random, no wall clock — and
  `test/lanternport-scenes.test.mjs` proves determinism + timescale parity
  for every registered scene.
- **Watch or play** (`index.html`): a scene link opens in **ready mode** —
  the set is dressed, the cast holds its first pose, and the player keeps
  the controls (the full town is playable; walk to the set or peek with
  1–8). The **▶ WATCH THE SCENE** button (or Enter) starts the performance
  and frames the bookmark; **🎮 TAKE CONTROL** hands the game back
  mid-scene; when a performance ends, control stays with the player and the
  button becomes **↻ WATCH AGAIN**. Taking control means playing *in the
  set*: the freecam releases, the touch controls return, the staged hero
  double hides, and the player hero spawns where the staged hero stands
  (the game hero waits at the hideout while a scene is watched, so there
  is only ever one Juniper on screen). Free-play actions inside a set
  (swim, board dive, rim sit in the dive set) are specced for the scene
  owner in fablego.md §5. Filming keeps the old behaviour with
  `&loop=1` (or `&auto=1`): auto-start, auto-loop, no button. Film scenes
  (`filmscenes.js` on the `stage.js`/`stageview.js` stage system) register
  into the same `SCENES` list. Juniper wears the playable game's hero look
  in scenes too (`hero: true` in `stage.js`) — since Nov 10 that look is
  the **Linkle kit** (Cherie's reference images): twin braids with red
  bands, green capelet, hood down behind the neck, compass pendant,
  pointed ears, orange shorts, tall boots, shield and sword. The hood
  takes the old cap slot, so `capOff` poses animate it.

## How to add a scene

1. Read the scene's SPEC.md and look at its KEY STILLS (gamepress,
   `docs/fable-prompts/lanternport-refs/`).
2. Add a definition to `SCENES` in `games/lanternport/scenes.js`: id, title,
   duration in ticks (30 = 1 s), the bookmark framing that matches the spec's
   pinned frame, an `input(game, bot, state, tick)` driver (the Bot's
   walk/drive helpers are the movement primitives), and `events` for the
   beats a recorder needs.
3. Add nothing to the determinism tests — they iterate the whole registry.
   Run `node --test test/lanternport-scenes.test.mjs test/lanternport-capture.test.mjs test/lanternport.test.mjs test/lanternport-pass3.test.mjs`.
4. Film it: `?scene=<id>&guide=1`, press its number key for the framing,
   record, done. Update the table below.

## Scene slate

| # | id | spec folder (gamepress) | status |
|---|----|------------------------|--------|
| — | `stage-test` | — (framework proof, not a film scene) | ✅ built |
| 1 | `rooftop-dive` | fablego festival program (built as a film scene) | ✅ built |
| 2 | `photo-call` | fablego festival program (built as a film scene) | ✅ built |
| 1 | `rooftop-pool` | `03-rooftop-pool` | ⏳ awaiting builder |
| 2 | `mugshot-flash` | `01-mugshot-flash` | ⏳ awaiting builder |
| 3 | `gator-store` | `06-gator-store` | ⏳ awaiting builder |
| 4 | `hammer-neighbor` | `09-hammer-neighbor` | ⏳ awaiting builder |
| 5 | `plaza-takeover` | `04-cartop-dance` + `17-donut-takeover` | ⏳ awaiting builder |
| 6 | `release-morning` | `02-gate-shrug` | ⏳ awaiting builder |
| 7 | `marsh-skiff-run` | `18-marsh-airboat` | ⏳ awaiting builder |
| 8 | `cucco-swarm` | aigo.md Part 2 (Gemini) — reassigned from Fable Nov 10 | ✅ built & proven |
| 9 | `sword-pedestal` | fablego.md §4 (Gemini) — Zelda slate | ✅ built & proven |
| 10 | `ocarina-dawn` | fablego.md §4 (Gemini) — Zelda slate | ✅ built & proven |
| 11 | `pot-rampage` | aigo.md Part 2 (Gemini) — Zelda slate | ✅ built & proven |
| 12 | `chest-fanfare` | aigo.md Part 2 (Gemini) — Zelda slate | ✅ built & proven |
| 13 | `dock-fishing` | aigo.md Part 2 (Gemini) — Zelda slate | ✅ built & proven |
| 14 | `fairy-orbit` | aigo.md Part 2 (Gemini) — Zelda slate | ✅ built & proven |

**Pool frames for `rooftop-dive`** (from Cherie's reference stills, Nov 10 —
for the scene's owner to fold into its opening/closing holds): the money
compositions are at the pool *edge*, close — (a) seated on the rim, back
three-quarter, looking back over her shoulder at camera, cocktail glass
in the near foreground; (b) chin resting on folded arms on the pool deck,
front-on, direct look at camera. The dive's rim-sit ending already lands
near (a); frame (b) is the natural opening hold.

The town re-dress to the pack's Look (gamepress `00-city-look`) is also still
to do — it is dressing work in `view.js`/`fx.js`, independent of the scenes.


**`pool-surface` (added Nov 11, 2026, Moth):** Juniper surfaces at the rooftop
pool's near rim, pulls up onto her forearms and rests her chin on folded arms —
Cherie's 8-panel sheet, keyed and deck-line aligned into sprite frames
(`assets/linkle-surface/surface_00..07.png`) and played on a camera-facing
sprite in the rooftop-dive set via the registered `surfaceSprite` stage kind
(`surface.js`). This is composition (b) from the pool-frames note above, as a
full scene: `?scene=pool-surface`.

**`pool-rimsit` (added Nov 11, 2026, Moth):** the companion composition (a) —
Juniper seated on the rim, back three-quarter to camera, looking back over her
shoulder. Cherie's second 8-panel sheet, keyed + seat-line aligned into
`assets/linkle-rimsit/rimsit_00..07.png`, played on a sprite in the same
rooftop set via the registered `rimsitSprite` stage kind (`rimsit.js`):
`?scene=pool-rimsit`. The look-back frames get the long holds.

**`cartop-dance` (added Nov 11, 2026, Moth):** Juniper dances on the roof of a
glossy red wedge car parked on the festival plaza, townsfolk cheering from the
kerb — Cherie's 8-frame cartop sheet, keyed and flipped head-left into
`assets/linkle-cartop/cartop_00..07.png` (drawn ground slab kept, the
pool-rimsit way), played on a crossfading sprite via the registered
`cartopSprite` stage kind, the car built by the `cartopCar` kind in the same
module (`cartop.js`): `?scene=cartop-dance`. The frames loop continuously —
a new frame every ~4 ticks — over a dance bed, with a cheer at each loop start.

**`club-stage` (added Nov 11, 2026, Moth):** the cartop dance moved indoors —
the same 8-frame performance on a raised club stage instead of the car roof:
deep-red curtain with drapes and a valance, three warm spot cones breathing
over the stage pool, candlelit cocktail tables, and a dark audience (three on
the front bench, two standing) between the camera and the stage. The same
crossfading sprite via the registered `clubSprite` stage kind, the room built
by the `clubRoom` / `clubTable` / `clubBench` kinds in the same module
(`clubstage.js`): `?scene=club-stage`. Same dance timing as cartop-dance — a
new frame every ~4 ticks — over a dance bed, with cheers at the loop start and
mid-loop.

---

## Festival Day

A connective wrapper (`festival.js` + HUD in `index.html`) ties the registered scenes together into a playable town tour without altering the 30 Hz sim or scene/bookmark numbering:

- **Scene Journal (`📖 SCENES`):** lists every registered scene in `SCENES` with its persisted state (`not found` / `watched` / `played` in `localStorage`) and a `▶` button to open that scene in ready mode.
- **In-World Triggers:** every registered scene places a glowing ring-and-beam marker at its bookmark set position (and a dot on the minimap). Walking into a marker during free-roam opens that scene's ready mode.
- **Festival Day (`▶ FESTIVAL DAY`):** runs the 11 built scenes as an ordered day with live traffic and Heat between stops, highlighting the active stop in gold and ending with a day-complete summary card (`watched` / `played` counts) before returning to free-roam. Order: `rooftop-dive` → `photo-call` → `cartop-dance` → `club-stage` → `pool-surface` → `pool-rimsit` → `pot-rampage` → `chest-fanfare` → `dock-fishing` → `fairy-orbit` → `cucco-swarm`.
- **Play-All Tour (`🎬 TOUR`):** chains the built scenes back-to-back on the capture camera for filming; any tap/click or `Esc` exits to free-roam.
