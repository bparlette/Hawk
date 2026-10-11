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
