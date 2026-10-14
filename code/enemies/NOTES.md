# Regular-enemy painted sheets (Shell Shock Live) — notes
Task: replace ninja/gunner re-hue for regular enemies with per-level-group painted sheets + clean engine hook `enemySkins` in index.html (re-hue fallback). No deploy.
Engine facts: 7 enemy types purple/blue/star/sword/dasher/heavy/gunner. drawNinjaAtlas -> ninjaFrame() uses idle/walk/attack/jump/hurt/down; states: walk,attack,grab,held,thrown,down,dying,getup,hurt,fly. NINJA_K=0.3827 (150px->57.4 world). L15 elite: 10 frames [x,y,w,h,anchorX], EL_K=60/160, hack via hue 1337 + drawOver.
Plan: 3 characters per family: light (purple/blue/dasher), weapon (sword/star), big (heavy/gunner, heavy x1.18). Frames: idle walk walk2 attack jump hurt down grab + dash(light)/throw(weapon)/shoot(big).
- gen batch1: street_{light,weapon,big}, sewer_*, biker_light in gen/
- batch2 street_weapon/big regenerated w/o reference (ref image made model copy the punk); biker_*, dock_light. batch3 snow_*, scrap_light, dock_weapon/big. comps now row-major order.
- [all 33 gen images done in gen/; previews view/batch*.jpg]
- [packed] out/enemies_<fam>.png (P-mode, ~110KB) + out/meta.json; walk frame=168px, frames [x,y,w,h,anchorX], rows light/weapon/big
- [engine+L2-8,14,15 patched in test/ copy; poses.js 1-8,14,15 0 errors]
- [L1-8,14,15] engine patch (patch_engine.py: enemySkins hook + L1_ENEMY_SKINS + api.hasSkin) and patch_levels.py applied to test/ copy; poses.js (all 7 types x 8 states next to turtle) L1-8,14,15: 0 page errors. Strips view/s_*.jpg reviewed OK.
- L15: elite hack removed (hue 1337 + drawOver + eliteFly + onSpawn) -> enemySkins ELITE_SKIN; added gen/foot_big.png -> enemies_foot.png for L15 heavy/gunner (FOOT_HEAVY).
- L3: code rat tail on dashers skipped when api.hasSkin(e) (painted rat-man has a tail).
- live.js real-time smoke (invincible turtle, periodic hits incl knockdown/fly) L1-8,14,15: 0 page errors, all drawn via skin (*)
- [23:31] INSTALLED L1-8,14,15 + engine into built + deploy (identical, node --check ok, live smoke on built L1/L15 0 errors). Backups orig/<hash>/. L9-13 waiting for props_9_13.
- pre-validated L9-13 in test/ (poses 0 errors, view/s_9_13.jpg OK; L11 level code puts cowboy hats on enemies — kept). Waiting for props_9_13 DONE before touching live L9-13.
- [L9-13] after props_9_13 DONE: re-read + patched live level9-13.js (built+deploy identical); L1-15 skins now live. Renamed per-level frame const to ENEMY_F (gallery parses it).
- GALLERY: 34 lines added to galRegistry() (marker "// painted enemies (enemySkins)", patch_gallery.py idempotent; anchor = AMBER line). gtest.js over http: 0 page errors, ENEMIES 37 tiles render; names kept <=13 chars.
- DEPLOYED shellshock-live.surge.sh from cp -a staging copy stage_ss/ (of deploy/) after node --check (index scripts + all levels/*.js, freeze fix present). curl 200 + md5 match: index.html 3856da82, level2.js, level11.js, level15.js, enemies_street/trooper/foot.png.
