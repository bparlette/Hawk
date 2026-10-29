# MISO CITY — LEVEL 1 (3D fighter + runner) — project brief

PLAY IT: https://homebrewgametrailers.itch.io/miso-city-3d-walk
(browser-playable, mobile friendly, landscape)
GIT: github.com/bparlette/Hawk — branch `main` — `games/miso-city-3d/`
(This folder. The itch build and this source are the same game; the GLB
models and art binaries were uploaded in a separate commit — if `assets/`
or `art/` look empty, that upload has not landed yet.)

## What it is
A brand-new 2026 homebrew Nintendo-style game in three.js (web). Ninja cat
Miso fights through Level 1 in three acts:
1) Amber Market street — side-scroller beat-'em-up vs dog gangs
2) Alley runner — into-the-screen 3-lane runner (switch lanes, jump crates,
   duck signs, yarn-throw dogs blocking lanes)
3) Neon Pink Plaza — boss block vs Big Bruno, an American Bulldog (16 HP,
   jump-slam), then LEVEL 1 CLEAR. 3 paw hearts persist across all acts.

Run it: serve this folder over HTTP (e.g. `python3 -m http.server`) and open
`index.html`. three.js is vendored under `node_modules/` — no build step.
Verify: `node game-verify.mjs` (Playwright harness, 37 probes: full loop,
melee, swing, touch, game-over; zero JS errors expected).

Controls: arrows/AD move, Z/K punch, C/V kick, X/J yarn throw — or HOOK a
lamp pole when no dog is point-blank (pendulum swing; attack mid-swing =
swing kick; jump/X releases). Touch: floating joystick (left half) +
A = attack, B = yarn/hook.

## Cast / design locks (do not change)
- Miso: orange anime ninja cat, NO scarf, NO bell. Green headband with metal
  plate engraved with a yarn ball, charcoal arm/shin wraps, flat chest strap
  right-shoulder to left-hip, small pouch at left hip.
- Enemies on one shared 20-bone biped rig (Walk/Attack/Hit/Down clips):
  Great Dane (fast, 2 HP, long reach), Beagle (slow tank, 5 HP, belly bump),
  Bulldog boss. All characters are real procedural 3D models — Blender-built
  GLBs from the builders in `rig/` (rig_biped.py, rig_dog.py, make_dogs.py,
  make_miso_ninja.py). No placeholders, no sprites.
- Engine gotcha already fixed: procedural GLBs store raw sRGB in
  baseColorFactor; three.js reads it as linear — convertSRGBToLinear() per
  material at load or the cast renders pastel.

## What has been accomplished (all live on itch)
1. Complete verified Level 1 shipped Oct 29, 2026.
2. Fight-readability overhaul (owner playtest: "Can't see punches or kicks.
   I want big exaggerated action. Anime comic book style."): runtime
   pose-override punch/kick, 85 ms hit-stop, starbursts, POW!/BAM!/THWACK!
   popups, swoosh arcs, per-enemy white flash, telegraphed dog lunges.
   Found real bug: the dogs' Attack clip was never being played in code.
3. Split-screen background fix v1: 15 foreground crossings in 6 kinds (lamp
   poles, sign posts, lantern strings, awning edges, banners, laundry
   lines) at irregular spacing — a different element covers each
   background-plate seam — plus a pushcart that rolls across the street.
4. Yarn swing v1: hooks the 4 lamp poles, pendulum + pump, mid-swing kick
   with THWACK + extra knockback (works on the boss), momentum release.

## Still not right — where help is wanted
- The punch reads cross-body in frozen stills (the rig's arm-chain local
  axes are rolled ~90 deg vs the hips). In motion it sells; in stills it
  doesn't. Fixing the arm axes properly is open.
- The dogs' Attack clip is still a basic chop underneath the telegraph +
  lunge dressing. Re-authoring a real lunge/bite clip in the rig is the
  next lever for enemy readability.
- The swing is a LOW SKIM: hooking from the ground, feet brush the street
  at the bottom of the arc (~1.3 units of rise). Bigger, higher Tarzan
  arcs wanted — taller anchors are the obvious lever, feel unverified.
- Seam coverage is only at crossing height: between crossings a plate join
  can still peek. The full cure is rebuilding the backgrounds as one
  continuous world from a folder of reference images instead of butted
  plates. Not started.
- Standard of proof: probes passing does NOT mean it reads. Combat and
  look are judged on frozen action stills and on the owner's actual play.

## Hard rules
- No full-screen shake, no pond-ripple, no chromatic aberration.
- Touch = floating joystick (anchors under the thumb, left half) + round
  A/B buttons bottom-right. No fixed D-pad.
- No "Parlette"/"bparlette" names or GitHub URLs inside files shipped to
  itch. Original characters/art only.
