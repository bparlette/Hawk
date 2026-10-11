# Licences

All original and procedural. Every mesh is built in code from three.js primitives. Each gang draws exactly one texture, on a canvas at load: the rats' fur map and the gulls' feather map.

This delivery contains none of the following:
- image, model or font files
- third-party code in `src/`
- traced artwork
- real people, mascots, brands, or real gang colours or symbols

The gulls' rockfish is a generic fish, not a mascot.

- **three.js r160** (MIT, https://github.com/mrdoob/three.js/blob/r160/LICENSE): `viewer.html` and `tools/qa.html` load it, along with its `examples/jsm/utils/BufferGeometryUtils.js` addon (QA only), from unpkg. It is not copied into this delivery.
- **`toadcity_kit.js` and `example_gull_thug.js`:** Toad City Baltimore's own kit, rebuilt from the brief's appendix. `THUG_POSES.down` and `HERO_POSES.down` are the game's own code, as supplied.
- **`tools/shoot.mjs`:** uses playwright-core (Apache-2.0) as a dev tool. Not part of the game.
- **`tools/tile.py`:** uses Pillow (MIT-CMU / HPND) as a dev tool. Not part of the game.
