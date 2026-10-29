# Miso City — the game (Level 1)

A 3D side-scroller fighter + into-the-screen runner built on the Miso City
walking scene. Miso the ninja cat fights the Dog Gang through the Amber
Market, dashes down a 3-lane alley, and faces the Bulldog boss in the Neon
Pink Plaza.

## Play the loop (Level 1)

1. **Amber Market street** (side-scroller fighter): clear the Dane + Beagle
   wave with yarn throws, punches and kicks — big exaggerated anime moves
   with hit-stop, comic impact bursts and POW!/BAM! popups. Stars are worth
   points; defeated dogs sometimes drop a fish (+1 heart). The painted
   background plates are stitched together by varied foreground crossings —
   lamp poles, sign posts, lantern strings, banners, awning edges and
   laundry lines scroll in front of the action (a banner covers one plate
   seam, a lamp pole the other), and a pushcart rolls across the street
   itself on its own path. Lamp poles carry a yarn ring: they are grapple
   anchors for the swing (see Controls).
2. **The Alley** (runner): the glowing alley entrance opens — stand at it
   and press ↑. 3-lane auto-runner (~52 s): switch lanes, jump crates and
   puddles, duck hanging signs, yarn-throw dogs blocking a lane. Crashes
   cost a heart (brief slow-mo).
3. **Neon Pink Plaza** (boss block): Dane + Beagle escorts, then **Big
   Bruno, the American Bulldog** — 16 HP, jump-slam attack, boss HP bar.
   Beat him → **LEVEL 1 CLEAR** screen with score + time. Hearts empty →
   game over + retry.

Teal district exists in the district framework and is teased as
"Level 2 — coming soon" on the win screen (locked by design for Level 1).

## Controls

- **Keyboard:** ←/→ or A/D move · ↑/W/Space jump · ↓/S duck (runner) ·
  X/J yarn throw · Z/K punch · C/V kick · ↑ at the glowing entrance =
  enter alley
- **Miso's move set (street fighter):** the punch input chains a combo —
  **punch → punch → kick finisher** (the finisher lunges further and
  knocks dogs back hard). **↓ + attack** = rising **uppercut** that
  launches the dog into the air. **Attack while steering** (kick input,
  or touch A while holding a direction) = **360 spin kick** that hits
  dogs on BOTH sides. **Attack in the air** = flying **jump kick**.
  **Hold X/J (or touch B)** to charge the yarn ball — release at full
  charge for the **yarn slam** power move (2 damage in an arc in front,
  ~2.6 s cooldown); a quick tap still throws/hooks as before.
- **Dog attack set:** every dog fights with the full kit, picked by
  range — close: **bite** (jaws open wide, clamp on, and SHAKE Miso
  side to side before tossing him) or a rising-paw **uppercut** that
  pops Miso into the air (the boss adds his ground **slam**); mid:
  two-hit **swipe combo**; far: leaping **jump kick** or a **thrown
  bone** (arc — jump it, dodge it, or swat it back with any attack:
  a deflected bone hurts dogs; the boss throws a big bone + a
  follow-up). Every move has a readable wind-up first.
- **Yarn swing (street + boss block):** stand by a lamp pole with a yarn
  ring (it flares when you're in range) and press **X/J** — the yarn
  hooks the pole instead of throwing, and Miso swings. Hold ←/→ to pump
  the swing. **Z/C** (or any attack) mid-swing = a swing kick with a
  long hit window and heavy knockback. **Space/↑** or **X** again
  releases with your swing velocity; you land and play on. One catch:
  if a dog is right in front of you, X throws the yarn at it instead —
  the throw keeps priority. Getting hit knocks you off the yarn (safe
  drop, no extra damage beyond the hit itself).
- **Touch (gamepress gptouch standard):** floating joystick anchors under
  your thumb anywhere on the left half; round buttons bottom-right —
  **A** (👊) = the whole move set: standing still it runs the punch →
  punch → kick-finisher combo; while steering it is the spin kick;
  with the stick held down it is the uppercut; in the air it is the
  jump kick; while swinging it is the swing kick. **B** (🧶) = yarn:
  tap = throw / hook / release; **hold B** = charge, release = yarn
  slam. Stick steers and pumps the swing. Stick up = jump, stick
  down = duck in the alley.

## Characters (all real 3D GLBs, no placeholders)

- `assets/miso.glb` — Miso ninja v2 (20-bone biped, Walk clip; idle is the
  bind pose + a code breathing bob). Yarn throw = orange ball + sagging
  string line that flies, hits, and retracts to his paw.
- `assets/dog-dane.glb` — Great Dane: fast, 2 HP, long reach.
- `assets/dog-beagle.glb` — Beagle: slow, 5 HP tank, belly bump.
- `assets/dog-bulldog.glb` — American Bulldog boss: 16 HP, jump slam.
  All dogs: 21-bone bipeds (the 21st bone is a working JAW — bites
  genuinely open, clamp, and shake) with Walk / Attack (bite) /
  Swipe / JumpKick / Uppercut / Hit / Down clips; per-district stat
  scaling is the difficulty lever. The boss plays every clip at
  0.85× speed (bigger, slower) plus his slam and double bone throw.

Characters render unlit (MeshBasicMaterial — **must stay a single material
per mesh**: an array material on a groupless geometry draws nothing in
three r170; that bug made every character invisible in an early build).

## Tech

- Three.js r170 (vendored in `node_modules/`), GLTFLoader + SkeletonUtils
  for per-enemy cloned instances.
- The seed scene (street paintings, wet-street Reflector with puddle
  shader, district fog/tint scripting, rain, bloom + grade pass, premium
  shell) is reused whole; the shipped walking scene in
  `~/workspace/miso-3d-walk/` is untouched.
- Audio: the seed's adaptive zone music (amber/teal/pink) + a synth SFX
  set (throw/hit/collect/hurt/yip/bark/jump/crash/win/lose) in
  `audio/audio.js` — WebAudio only, no files.
- Test hooks: `window.__game` (mode/hearts/score/district/playerX/
  enemiesAlive/bossHp/throws/enemies, plus swinging/swingLine/anchorX,
  seams, anchors and the occluders list), `window.__gameStart()`,
  `window.__debug` (swing state, forceHook/releaseSwing, setEnemyX,
  occluderState, cartState/setCartX), `?auto=1` attract mode,
  `?touch=1` forces the touch overlay.

## Run it locally

Any static file server from this folder, e.g.:

```
npx serve ~/workspace/miso-city-game
# or
python3 -m http.server -d ~/workspace/miso-city-game 8000
```

Then open `http://localhost:8000/`. Tap/click to start (unlocks audio).

## Verify

```
node game-verify.mjs
```

Playwright + headless Chromium with `http://local.test` route interception
(same approach as the seed's harness). 37 probes: zero-JS-error load,
title → street, movement, punch + kick damage, yarn throw latching +
enemy HP drop, district clear → alley → runner, lane switch, jump,
runner exit → pink, boss spawn, boss kill → WIN, a full touch pass
(stick drag moves Miso, A button attacks, B button throws), the
game-over path — plus the swing suite: anchors exist, every plate seam
is covered by an occluder (and the crossings are varied — ≥5 kinds,
different kinds on the two seams), the pushcart moves on its own path,
hook attaches with the yarn line up, swing kick damages a Dane and the
boss, release lands safely, and the touch swing (B hooks, A kicks,
B releases) — all passing.
Screenshots land in `shots/`. Note: headless SwiftShader renders this
scene at ~1 fps, so logic probes run with `?nobloom&noreflect` (same code
paths, cheaper pixels) and the `00-beauty-*.png` stills are captured at
full quality separately.
