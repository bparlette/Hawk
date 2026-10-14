# Boss art upgrade — shared brief (Shell Shock Live)
User wants every boss at painted quality, no shortcuts. Krang (L14) is the finished reference.
Study /workspace/work/lvl14_art/ (NOTES.md, seg.py, pack.py, anchors.py, fix.py) and /workspace/work/lvl15_art/sprites.py and reuse that exact pipeline:
generate_image (deferred tool) on chroma green, photoreal live-action style matching the turtle atlases (deploy/shell-shock-live-action/atlas_lenny.png etc.) and the level14_krang.png / level15_shredder.png sheets as refs -> connected-component frames -> uniform scale -> hip-centre anchors -> de-fringe -> optimized PNG -> wire in with level15's spr() anchor pattern.
See /workspace/work/ART_AUDIT.md for what's code-drawn in your level.
Rules:
- Edit ONLY your level's file levels/levelN.js and add levels/levelN_<boss>.png, identically in BOTH /workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/ and /workspace/work/deploy/shell-shock-live-action/. Other workers are editing other levels in parallel: never touch index.html or other level files.
- Frames for every state the boss uses (idle, walk, each attack, hurt, knocked down/KO, any vehicle/rig parts that belong to the boss like a jetpack/tank/harpoon gun painted into the sheet). Remove tint/code-drawn body hacks. Gameplay, hitboxes, timing identical.
- Work dir /workspace/work/lvlN_art/ ; append progress to NOTES.md there after each step (sandbox restarts and rate-limit crashes happen; resume from notes).
- Test: node --check; the level's headless harness (look for /workspace/work/lvlN_harness / lvlN_test / lvlN_h; if absent, adapt /workspace/work/lvl14_harness) through boss fight, KO and outro, 0 page errors; screenshots of each pose next to a turtle; VIEW them and iterate until style and scale match. If chromium is missing: npx playwright install chromium.
- Do NOT deploy; the coordinator deploys once all levels pass.
- Report: screenshot paths (one clear idle-next-to-turtle shot), what changed, tests, anything not done. If you loop more than twice on a blocker, stop and report.
