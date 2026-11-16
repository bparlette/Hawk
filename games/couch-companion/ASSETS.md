# COUCH COMPANION — asset credits

| Asset | Used for | Source | License |
|---|---|---|---|
| `assets/RobotExpressive.glb` | The companion character (fully rigged, 13 animation clips: Idle, Dance, Wave, No, Sitting, Jump, …) | Model by **Tomás Laulhé**, distributed with the three.js examples — https://threejs.org/examples/#webgl_animation_skinning_morph (file: examples/models/gltf/RobotExpressive/RobotExpressive.glb, three.js r160) | **CC-BY 4.0** — attribution: "RobotExpressive" by Tomás Laulhé, via three.js |
| `vendor/three.module.min.js` | 3D engine (r160) | three.js, https://threejs.org (vendored from the repo's own copy) | MIT |
| `vendor/addons/loaders/GLTFLoader.js`, `vendor/addons/utils/BufferGeometryUtils.js` | GLB loading | three.js examples (jsdelivr, three@0.160.0) | MIT |

Procedural (no external asset): the soft shadow blob is a canvas radial
gradient; ducking is a procedural crouch on the model root (the rig has no
crouch clip); breathing / look-around are procedural bone + root motion on top
of the model's real Idle clip.

No Rockstar / GTA artwork, models, or audio are used anywhere in this app.
The companion is an original robot character — not a franchise character.
