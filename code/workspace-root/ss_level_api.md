# Shell Shock Live — Level Plugin API (v1)

Game: `/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/index.html` (deploy copy: `/workspace/work/deploy/shell-shock-live-action/`).
Level 1 (HALLWAY FIRE) is built into `index.html`. **Every other level is one file: `levels/levelN.js`** (N = 2, 3, …),
plus its own assets in `levels/` (name them `levelN_*.jpg/png`). A level file must **only** call `window.SS.registerLevel(def)`
and use `window.SS.api`. Never edit `index.html` from a level task.

Reference implementation: `levels/level2.js` (STREET RUMBLE) uses nothing but this API.

---

## 1. Lifecycle (one level in memory at a time)

1. **Start**: when level N is about to start (after character select, `?level=N`, or "CONTINUE" on the previous results card),
   the engine shows a **LOADING card**, unloads every other plugin level, and injects `<script src="levels/levelN.js">`.
2. **Register**: your file runs and calls `SS.registerLevel(def)` synchronously. The engine validates/normalises `def`.
3. **Preload**: the engine preloads **only this level's images** (every `sections[i].bg`, `sections[i].bgFar`, and `def.images[]`),
   with a progress bar (gives up waiting after ~8 s and starts anyway; missing images fall back to a flat gradient floor).
4. **Card → play**: title card (`SCENE N`, `def.card.title`, `def.card.tagline`), then `def.onStart(api)` (optional) and section 0.
5. **Finish**: last section's boss defeated (or last wave cleared if no boss) → optional `def.outro` → pizza break → results card.
6. **Prefetch**: on the results card the engine injects **`levels/level(N+1).js` only** (JS, not images) so the card can show
   `NEXT: LEVEL N+1 - NAME`. If that file 404s, the card says `THE END... FOR NOW!` and returns to the title.
7. **Unload** (when the next level begins, or on return to title): `def.onUnload(api)` is called, the `<script>` tag is removed,
   the def and its `Image` objects are dropped (`src` cleared), cached tinted sheets keyed to the level are deleted, and
   custom music registered by the level is removed.

Missing files skip gracefully: a bad `?level=N` falls back to Level 1; a missing next level ends the run on the title screen.

Testing: `index.html?level=N` jumps straight to level N after character select. Add `&nocache` to bust the level script cache,
`&debug` to expose `window.__SS` (STATE, LEVELS, spawnBoss, …) for console poking.

**Keep module-level state inside your IIFE and release it in `onUnload`.** Don't add global listeners/timers; if you must, remove them in `onUnload`.

---

## 2. World facts

- World is **384 × 224** (`api.W`, `api.H`), drawn at 3× (`api.RES`). All coordinates below are world pixels.
- `x` is world-horizontal (camera `api.camX` scrolls it), `y` is depth on the floor (feet line), `z` is height above the floor.
  Screen position of an actor = `(x - camX, y - z)`.
- **Floor band**: actors walk between `floorTop` and `floorBot` (default `[150, 215]`). Set `section.floor = [top, bot]` to match your
  background's walkable ground (e.g. Level 2 uses `[168, 218]`). Must be ≥ 30 px tall.
- 60 fps fixed-step. Times are in frames.
- Infinite lives (x∞), every 3rd KO tags in the next brother (fallen body stays until the section ends) — handled by the engine.

---

## 3. `SS.registerLevel(def)` — the level definition

```js
SS.registerLevel({
  number: 3,                       // required, integer >= 2; file must be levels/level3.js
  name: "SEWER SURGE",             // shown on results card ("NEXT: LEVEL 3 - SEWER SURGE"), title, loading card
  card: { title: "SEWER SURGE", tagline: "IT SMELLS LIKE TROUBLE.", color: "#3ae06a" }, // title card text + accent rule colour
  music: "stage",                  // "stage" | "title" | "boss" | a track object from api.track()/api.transpose()
  bossMusic: "boss",               // same options; plays while a boss is up
  hues: { purple: 120, dasher: 60 },// per-enemy-type hue-rotate (deg) palette variants for THIS level (see §5)
  images: [],                      // extra images to preload (get them later with api.img(src))
  sections: [ /* one or more, see §4 */ ],
  hazards: [ /* level-wide hazards, active in every section, see §6 */ ],
  boss: { /* optional, fought at the end of the LAST section, see §7 */ },
  outro: { update(api, st, t) { return t > 120; }, draw(api, st, t, cx) {} }, // optional beat before the pizza break
  onStart(api) {},                 // optional, after section 0 is set up
  onUnload(api) {},                // optional, release references / listeners
});
```
`registerLevel` returns `true` on success; a rejected def logs a warning and the loader treats the level as missing.

## 4. Sections

```js
{
  bg: "levels/level3_sewer.jpg",   // background image path (relative to index.html). Scaled to 224 px tall and tiled
                                   // horizontally with no mirroring, so make it seamless left↔right (cross-fade the edges).
  floor: [160, 216],               // walkable depth band for this section
  length: 2200,                    // section width in world px (>= 384). Camera runs 0 … length-384.
  locks: [0, 420, 860, 1300],      // camera x positions where the screen locks for a wave (one per wave)
  waves: [["purple","purple"], ["blue","star","dasher"], ...], // enemy types per lock (see §5)
  grade: "rgba(10,40,10,0.15)",    // optional colour wash over the background
  weather: "rain",                 // optional built-in overlay: "rain" | "snow" | "drips" | "embers" | "speed"
  hazards: [ ... ],                // hazards for this section only (in addition to level-wide ones)
  auto: 0,                         // >0 = AUTO-SCROLL section (see below)
  onUpdate(api, player) {},        // optional per-frame hook
  drawBack(api, cx) {},            // optional: draw over the background, under the actors
  drawFront(api, cx) {},           // optional: draw over the actors (before the HUD)
  sky: "#141428", ground: "#2e2a30"// fallback colours if the bg image is missing
}
```
Flow inside a section: walk right → camera locks at each `locks[i]` → `waves[i]` spawn (max 5 on screen) → cleared → "GO →" →
after the last wave, walking to the end either starts the **boss** (last section) or shows **GO →** and walking off the right edge
fades into the next section (bodies are cleared, player re-enters at the left).

**Auto-scroll sections** (`auto: 2.4`): the arena is one fixed screen (`camX` stays 0) and `api.scroll` advances by `auto` px per frame;
the background scrolls with it and the player and enemies ride boards (drawn automatically). `locks` become **scroll distances**
at which `waves[i]` are queued; when `api.scroll >= length` and everything is cleared, the boss starts (last section) or the next
section begins. Move obstacles left by `section.auto` per frame yourself in a hazard (screen-space = world-space here). A progress bar shows in the HUD.

## 5. Enemies

Use `waves` / `api.spawnEnemy(type)` with these existing types (all ninja/gunner atlases, tintable per level with `def.hues[type]`):

| type | behaviour |
|---|---|
| `purple` | melee foot soldier; can grab (mash attack to escape); taunts / sidesteps |
| `blue` | fast knife fighter, tries to get behind you; taunts / sidesteps |
| `sword` | sword swings, 40% parry vs light hits; taunts / sidesteps |
| `star` | keeps range, throws shuriken |
| `gunner` | keeps range, fires an energy ray (gunner atlas) |
| `heavy` | big slow bruiser (gunner atlas ×1.18), 7 HP, telegraphed haymaker that knocks you down, armoured vs light hits mid-swing |
| `dasher` | keeps ~80 px away, crouches then does a fast low sliding dash along your row |

`hues` values are hue-rotate degrees applied as `sepia(.7) saturate(3) hue-rotate(deg)` (ninja) / `sepia(.6) saturate(2.4)` (gunner/heavy);
it works on Safari too (colour-matrix fallback). Enemy objects (`api.enemies[i]`) have `type, x, y, z, hp, state, t, facing, boss?`.
States you may test: `"walk" | "attack" | "hurt" | "down" | "getup" | "dying" | "grab" | "fly"`.

## 6. Hazards

A hazard is a plain object with optional hooks. Each instance's state `st` is whatever `init` returns (fresh per section entry).

```js
const geyser = {
  init(api, section) { return { t: 0, x: 600 }; },  // returns per-instance state
  update(st, api, player) { },                      // every gameplay frame (not during hit-stop/cutscenes)
  drawBack(st, api, cx) { },                        // under actors (floor decals, props)
  drawFront(st, api, cx) { },                       // over actors (jets, smoke, warnings)
};
```
Damage rules of thumb (keep it fair & readable): **telegraph ≥ 40 frames** (shake, sputter, a `!`, a shadow), 1–2 damage,
knock the player down for big hits (`api.hurtPlayer(2, false, dir)`), and let hazards hurt enemies too (`api.hitEnemy(e, 1, true, dir)`).
Pits: `api.dropPlayer(x, y, dmg)` (player sinks, pops back out hurt with i-frames). Instant enemy KO: `api.koEnemy(e)`.
Always skip `e.boss` unless you mean it. Errors thrown inside hooks are caught and logged, never crash the game.

## 7. Bosses

Fought at the end of the last section; walks in from the right, says `lines.intro`, gets a HUD bar with `name` and a `WARNING: NAME!` flash.
When it dies (and its minions flee) the level finishes. Three ways to build one:

**a) Ramrod-style params** (`base: "ramrod"`, default):
```js
boss: {
  name: "MUCKMAW", base: "ramrod",
  atlas: "ramrod",                 // which sprite sheet: "ramrod" | "zap" | "razor" | "gunner" | "ninja"
  tint: { sepia: .6, sat: 2.5, hue: 60, bri: 1 }, // optional palette shift (CSS-filter semantics, Safari-safe)
  scale: 1.2, height: 100,         // draw scale (×atlas default) / bubble height override
  hp: 36, speed: 1.0, chargeSpeed: 1.0, cool: 110, pitch: 100, // cool = frames between attacks; pitch = chip-voice Hz
  moves: ["charge","kick","fire","throw","slam","summon"],      // any subset
  shot: "ray",                     // "fire" projectile kind: "ray" | "brick" | "rock" | "snowball" | "sludge" | "tire"
  proj: "sludge", throwN: 2,       // "throw" = lobbed arc projectile(s) aimed at the player
  minions: ["dasher","dasher"], summonCd: 600,                 // "summon" queues these
  lines: { intro: "...", hit: ["...", "..."], summon: "...", ko: "..." },
  onDefeat(api, e) {},
}
```
Moves: `charge` (red-flash telegraph, then a rush across the row), `kick` (close range), `fire` (3–5 straight shots, may fan out),
`throw` (wind-up, then lobbed arcs that shatter on landing), `slam` (crouch, leap onto your position, shockwave ring — jump it),
`summon` (calls `minions`). Light hits don't flinch it; 3 quick hits stagger it; finishers knock it down.

**b) Zap-Roller params** (`base: "zap"`): the tank robot AI (electric whip grab + ram) with your `name/hp/tint/scale/lines`.

**c) Custom hooks** on either base: `update(api, e, player)` — return `true` when you handled this frame (the engine still handles
`hurt/stagger/down/getup/dying` reactions and the walk-in); `draw(api, e, sx, sy)` replaces drawing; `spawn(api, e)` runs once.

## 8. `SS.api` reference

Live getters: `ctx` (the 2D context, already scaled; always read `api.ctx` fresh), `STATE`, `player`, `enemies`, `camX`, `scroll`,
`floorTop`, `floorBot`, `level`, `section`, `t` (frame counter). Constants: `W`, `H`, `RES`, `ATLAS`, `BROTHERS`, `BOSS_ATLAS_K`, `TRACKS`.

| function | what it does |
|---|---|
| `hurtPlayer(dmg, force?, knockDir?)` | damage the player (respects i-frames unless `force`); `knockDir` ±1 knocks him down |
| `hitEnemy(e, dmg, knock, dir)` | damage an enemy as if hit |
| `spawnEnemy(type)` | spawn at a screen edge |
| `spawnBoss(cfg)` | spawn a boss now (normally automatic) |
| `koEnemy(e)` | instant KO (non-boss) |
| `dropPlayer(x, y, dmg=2)` | pit fall (returns false if the player can't fall right now) |
| `shot(o)` | add a projectile: `{x, y, vx, vy?, kind?}` straight, or `{arc:true, x, y, z, vz, vx, vy, kind, dmg}` lobbed; `o.draw(api,s,sx,sy)` / `o.update(api,s)` (return true = handled; set `s.dead`) for custom ones |
| `enemySay(e, text, frames, pitchHz, speak?)` | speech bubble over an enemy + chip voice |
| `playerBark(force, text?)` | brother speech bubble (+ voice) |
| `fx(kind, x, y, life)` | `"spark" | "smoke" | "boom" | "pop" | "pop5" | "pop5k" | "clink" | "ring"`; or push `{kind:"x", x, y, t:0, life, draw(api, f, sx, k)}` into `STATE.fx` |
| `dust(x, y)`, `shake(amp, frames, decay)` | particles / screen shake |
| `SFX.*` | `swing hit finisher defeat jump land charge shuriken gun rumble zap pickup confirm hurt clink boom door chat(hz) munch` (all honour mute) |
| `rect(x,y,w,h,c)`, `text(s,x,y,size,c,align)`, `ptext(s,x,y,scale,c,align)`, `bubble(x,y,s,c,size)` | pixel drawing helpers (screen coords) |
| `drawFrame(sheet, frameRect, x, y, k, facing)` | draw an atlas frame, feet at (x,y) |
| `atlasImg(name)`, `tintSheet(name, tint)` | atlas `<img>` / cached tinted canvas (`ninja gunner ramrod zap razor amber lenny rafe miko donny`) |
| `img(src)` | the loaded image for a path this level declared (null until loaded) |
| `drawFlame(x, base, s)`, `drawRay(x, y)`, `contactShadow(sx, y, z, w)`, `shadow(sx, y, z, w)` | stock effects |
| `track(o)`, `transpose(track, semis, bpm)`, `bassLine`, `arpLine`, `rep` | chip-music builders (see level2.js) |
| `rnd(a,b)`, `lerp(a,b,k)`, `hash(n)`, `buzz(ms)` | utils |

Music `track(o)`: `{ bpm, loop:true, chords:[...chord names: Em C D B Am G F E Dm Edim Ddim Fx Gx], lead:"NOTE:16ths ...", bass:api.bassLine(chords,[8 offsets]), arp:api.arpLine(chords, +semis, [order]), drums:[16-char strings per bar: k s h o .] }`.

---

## 9. Minimal example level (`levels/level9.js`)

```js
(function () {
  const SS = window.SS; if (!SS) return;
  const vent = {
    init: () => ({ t: 0, x: 700 }),
    update(st, api, p) {
      st.t = (st.t + 1) % 240;                     // 0-179 idle, 180-219 warning, 220-239 blast
      if (st.t >= 220 && p.inv === 0 && Math.abs(p.x - st.x) < 14 && p.z < 8) api.hurtPlayer(1, false, p.x < st.x ? -1 : 1);
    },
    drawBack(st, api, cx) { api.rect(st.x - cx - 10, api.floorTop + 20, 20, 4, st.t >= 180 && st.t % 6 < 3 ? "#ff4a3a" : "#444"); },
    drawFront(st, api, cx) { if (st.t >= 220) api.rect(st.x - cx - 6, api.floorTop - 40, 12, 64, "rgba(255,255,255,0.6)"); },
  };
  SS.registerLevel({
    number: 9, name: "TEST ALLEY",
    card: { tagline: "A TINY EXAMPLE." },
    sections: [{ bg: "levels/level9_alley.jpg", floor: [150, 215], length: 1200, locks: [0, 500], waves: [["purple", "blue"], ["heavy"]], hazards: [vent] }],
    boss: { name: "BIG LUG", atlas: "ramrod", tint: { hue: 120, sepia: 0.4, sat: 2 }, hp: 20, moves: ["charge", "kick", "slam"],
            lines: { intro: "YOU LOST, SHELLS?", ko: "OOF!" } },
    onUnload() {},
  });
})();
```

## 10. Checklist for a level author
- File `levels/levelN.js` + assets `levels/levelN_*` only. `node --check levels/levelN.js`.
- Background: same photo-real style/camera as `hallway.jpg`, 224 px tall after scaling (e.g. 2064×512 source), seamless horizontally,
  walkable ground matching your `floor` band.
- Telegraph every hazard; keep fights short (3–5 enemies per wave, 3–5 waves, boss 30–40 HP).
- Test: open `index.html?level=N&nocache` (character select → your level), play to results; results should show the next level or THE END.
- Headless harness: `cd /workspace/work/sstest && bash extract.sh && STOPAT="back to title" node play.js "?level=N&debug" 40000`
  (auto-plays, prints milestones: loading → stage → boss fight → outro → pizza → results → title; exits 1 on exception).

---

## 11. v1.1 additions (additive — every v1 level keeps working unchanged)

`SS.version === 1.1` (`SS.apiVersion === "1.1"`). Nothing below is required. Everything is optional and defaults to v1 behaviour,
with two engine-wide changes: the boss HP bar now sits at the **top right** so the front floor lane stays clear, and fx keep animating during outros.

### 11.1 Level / section fields
```js
SS.registerLevel({
  number: 15, final: true,          // final level: results say "THE END", no next-level prefetch, then high-score entry
  sections: [{
    bg: "levels/level9_x.jpg", bgMirror: true,   // tile the strip mirrored (every other tile flipped). Default: plain tiling
    props:   [{ kind: "barrel", x: 520, y: 190 }, { kind: "crate", x: 900, y: 205, drop: "pizza" }], // see 11.3
    pickups: [{ kind: "slice", x: 1000, y: 214 }],                                            // see 11.2
    slide: 0.85,                                  // whole-section ice: 0 = grip, 0.97 = max slide (player + walking enemies)
    zones: [{ x0: 300, x1: 700, y0: 190, y1: 218, speed: 0.55 }, { x0: 900, x1: 1200, slide: 0.9 }], // wading lanes, ice patches
    waves: [["purple", { type: "dasher", from: "pipe", x: 420, y: 196, fallFrames: 26 }, { type: "blue", from: "door", x: 300 }]],
    onSpawn(api, e) {},                           // called for every enemy spawned in this section (after the entrance is applied)
    auto: 2.4, bossScroll: 0.25,                  // auto-scroll speed multiplier during the boss (default 0.5, the old behaviour)
  }, {
    arena: true, bg: "levels/level9_boss.jpg",    // one-screen boss arena: length = 384, no waves, the boss walks in immediately
  }],
});
```
- **Wave entries** may be objects: `{ type, from, x, y, height, fallFrames, hp }`. `from`: `"pipe" | "drop" | "sky"` (falls from `height`, default 110,
  over `fallFrames`, default 30; state `"drop"` until it lands; not hittable mid-fall), `"door" | "hatch"` (appears at `x` on the back wall,
  `y` defaults to the floor top, with a smoke puff), `"left" | "right"` (screen edge). Plain strings work as before.
- Enemies on **auto-scroll sections** now get boards per section (`curSec().auto`), not level-wide. A level that sets `e.board` itself still wins.

### 11.2 Pizza pickups
`slice` heals 4 HP (25%), `pizza` heals to full. If the brother is already full, it's +500 points. Enemies sometimes drop a slice
(EASY 20%, NORMAL 12%, HARD 7%; heavies 2.5×); set `e.noDrop = true` to opt an enemy out.
```js
api.spawnPickup({ kind: "slice", x: 640, y: 200 });                 // on the floor
api.spawnPickup({ kind: "pizza", x: e.x, y: e.y, z: 6, vz: 2.6 });   // popped up in an arc
api.spawnPickup({ kind: "slice", x, y, life: 600 });                // disappears after 600 frames (blinks for the last 120)
api.pickups                                                          // live array
```

### 11.3 Props (barrels, crates, trash cans, cones)
Attack breaks crates (2 hits), trash cans (2) and cones (1). Hitting a **barrel** sends it rolling, and it knocks down every enemy in its row.
Standing on a prop and pressing ATTACK (with no enemy in reach) **lifts it overhead**: ATTACK throws it (3 dmg, knockdown), JUMP puts it down.
A thrown barrel lands and keeps rolling. `drop: "slice" | "pizza" | "none"` sets what breaking it leaves behind (default 15% chance of a slice).
```js
const crate = api.spawnProp({ kind: "crate", x: 700, y: 196, drop: "pizza", onBreak(api, pr) { api.shake(3, 10, true); } });
api.props  // live array: { kind, x, y, z, state: "idle"|"held"|"thrown"|"roll", hp, drop }
```

### 11.4 Boss hooks
```js
boss: {
  hittable: ["magnet", "scrap"],                // custom state names that player attacks can hit
  pickMove(api, e, p) {                          // runs exactly when the cooldown hits 0 (where v1's update never saw e.cool === 0)
    if (Math.random() < 0.4) { api.setBossState(e, "magnet", { hittable: true, pose: "fire", warn: true }); return true; } // you picked
    return false;                                // let the engine pick from `moves`
  },
  update(api, e, p) { if (e.state === "magnet") { /* ... */ if (e.t > 90) e.state = "walk"; return true; } return false; },
  drawOver(api, e, sx, sy) { /* drawn right after the boss sprite (glows, chains, magnet fields) */ },
}
```
- `api.setBossState(e, name, { hittable = true, pose, warn })` puts the boss in a level-owned state. `pose` is an atlas frame name
  (`"fire"`, `"charge"`, `"kick"`…) drawn by the stock renderer. `warn` keeps the engine's red telegraph blink. Both end when the state changes.
  Setting `e.hittable = true` / `e.pose` / `e.warn` directly also works for states the engine doesn't know.
- `api.hittable(e)` tells you whether the player can hit `e` right now.
- `api.drawTinted("red" | "white", fn)` runs your own draw calls with the engine's telegraph-red or hit-flash-white tint.
  `api.hitFlash(e)` is true on hit-flash frames, and `api.warnFlash(e)` gives the red blink phase.
- Bosses and enemies knocked out of the air (hurt/stagger/down/dying with `z > 0`) now fall to the floor instead of hanging.

### 11.5 Hittable level objects
```js
const gen = api.registerTarget({ x: 900, y: 172, z: 0, w: 24, h: 40, d: 6,   // world x, depth y, height z..z+h, width w, depth tolerance d
  onHit(api, tg, info) { tg.hp = (tg.hp || 6) - info.dmg; return tg.hp <= 0; } }); // info: {dmg, dir, kind: combo|jump|special|throw|barrel}; true = remove
gen.remove();  // targets are also cleared on every section change
```
Combos, jump attacks, specials (including Donny's landing wave), thrown props and enemies, side slams and rolling barrels all hit targets.

### 11.6 Player control
```js
api.holdPlayer(x, y, z);      // call every frame to carry the player (magnet, claw, conveyor lift). Input and gravity are suspended
api.releasePlayer(1, -1);     // let go: optional damage + knock direction (releases with no i-frames so the hit lands)
api.playerHeld                // true while held this frame
api.freezePlayer(90);         // input locked, idle pose (draw your ice block yourself); gravity still applies
api.stunPlayer(40);           // input locked, hurt pose
api.playerDrawOffset(dx, dy); // draw-only offset for THIS frame (bob on a raft or a shaking floor). Never touches x/y/z, jumps or landings
api.spawnEnemyAt("purple", x, y, { from: "pipe" }) // spawn one enemy with an entrance (returns it). api.spawnEnemy(type) now returns the enemy too
api.addZone({ x0, x1, y0, y1, speed, slide })      // runtime zone (returns it, .remove())
api.difficulty  // 0 EASY | 1 NORMAL | 2 HARD    api.difficultyName
```

### 11.7 New player moves (engine-side, for reference)
- **Special** (ATTACK+JUMP together, the SPECIAL cabinet button, `L`, or gamepad B/RB). Invincible while it runs, costs up to 2 HP but never the last one.
  LENNY *Cyclone Slash* (rising spin), RAFE *Drill Dive* (forward corkscrew dash), MIKO *Nunchuck Copter* (hovering multi-hit, steerable),
  DONNY *Bo Vault Slam* (vault plus a floor shockwave on landing).
- **Throws**: push into a foot soldier to grab him. ATTACK does a side slam over the shoulder (3 dmg, and the landing hurts anyone near it), DOWN+ATTACK tosses him at the screen (KO),
  JUMP lets go. Bosses, Zap-Rollers and heavies can't be grabbed; set `e.noThrow = true` to protect others.
  New enemy states you may see: `"held"`, `"thrown"`, `"drop"` (not hittable).
- Difficulty (EASY / NORMAL / HARD, saved on the device) scales damage taken (×0.6 / ×1 / ×1.4), enemy HP (×0.75 / ×1 / ×1.3),
  boss HP (×0.8 / ×1 / ×1.25), attack cooldowns and pizza drop rates. Player HP can now be fractional (pips round up).

### 11.8 Planned: local 2-player co-op (not built)
Keyboard/gamepad only, never on touch. Plan: `STATE.players[]` with P2 on IJKL + U/O/P or gamepad #2. Each player owns `hold/carry/spec/inv`,
attack tokens are shared per target player, the camera locks to the leftmost player, and the bigger brother's HUD box mirrors on the right.
Plugin API stays compatible because `api.player` keeps returning P1. A new `api.players` would be added, and hazards that should hit both
iterate it (v1 levels that only touch `api.player` would simply ignore P2).
