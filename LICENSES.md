# Licences

All original and procedural. Every mesh is built in code from three.js primitives. Each gang draws exactly one texture, on a canvas at load (for example the rats' fur map, the gulls' feather map and the otters' fur map).

This delivery contains none of the following:
- image, model or font files
- third-party code in `src/`
- traced artwork
- real people, mascots, brands, or real gang colours or symbols

The otters' district list contains the game's internal id `'underarmour'`, used as given. It is a data value only: there is no name, text, logo, or brand colour or pattern on any otter.

The gulls' rockfish is a generic fish, not a mascot.

- **three.js r160** (MIT, https://github.com/mrdoob/three.js/blob/r160/LICENSE): `viewer.html` and `tools/qa.html` load it from unpkg. It is not copied into this delivery.
- **`toadcity_kit.js` and `example_gull_thug.js`:** Toad City Baltimore's own kit, rebuilt from the brief's appendix. `THUG_POSES.down` and `HERO_POSES.down` are the game's own code, as supplied.
- **`tools/game/04b_rig_merge.js`:** the game's own `mergeRig()`, as supplied, kept byte-identical and used only by the QA and the viewer's `&merge=1`. Not part of the delivered gang modules.
- **`tools/shoot.mjs`:** uses playwright-core (Apache-2.0) as a dev tool. Not part of the game.
- **`tools/tile.py`:** uses Pillow (MIT-CMU / HPND) as a dev tool. Not part of the game.
- **`kit/` and `harness/`:** Toad City Baltimore's own files from the round-2 ZIP (the kit, the real `mergeRig`, the real poses, the real-pose viewer and Hark's measurement harness), kept byte-identical. Used for gang 5 and its QA; not part of the delivered gang module.
- **`tools/game/thug_dizzy.js`:** the game's own `THUG_POSES.dizzy`, as supplied, attached to the ZIP kit's `K` at test time only.

## Task D bosses, batch 2 (O6)
- **`src/boss_*.js`** (Admiral Redclaw, Big Jimmy, Voltage Vic, Chef Crabcake, Arabber Al, The Pool Shark): original characters, built in
  code from three.js primitives through the kit's `K`. No real people, likenesses, official mascots, team marks, brands or logos. Two
  textures are drawn on canvas at load: Chef Crabcake's seasoning-tin label (original lettering "CHEF'S CRAB DUST", original colours) and
  the Pool Shark's palm-print shirt. Each module's `kitFrom()` holds line-for-line copies of `kit/toadcity_kit.js` helpers, used only when
  a live-mode hook is called with partial deps; the kit itself is unchanged.
- **`viewer_bosses.html`** (shipped as `viewer.html` in the zip) is derived from `kit/real_viewer.html` (Toad City's own); it loads
  three.js r160 (MIT) from unpkg.
- **`tools/measure_boss.mjs`, `tools/check_hooks.mjs`, `tools/boss_seq.js`, `tools/boss_jobs.mjs`, `tools/readme_*.mjs`:** dev tools written
  for this delivery; they import Hark's `harness/realK.mjs` and `harness/fakedom.mjs` (unchanged) and three@0.160.0 (MIT).
