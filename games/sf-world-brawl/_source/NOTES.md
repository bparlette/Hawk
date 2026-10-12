# SF WORLD BRAWL — progress notes (resume run, 2026-10-08)

## Status log
- [x] Inspected prior work: atlases (ryu/cammy/feilong/deejay players, ninja=Shadaloo scout, gunner=rogue karateka, ken, evil) good; kept (art/make_atlas.py, art/atlas_rects.json).
- [x] Cabinet: art/cab_fixed.png (SF2-style marquee, black cab, side art; same 704x1520 layout, button caps + stick hole aligned to the original) -> 256-colour PNG with transparent screen hole -> game/cabinet_special.png + cabinet_nostick.png (~214 KB). stick.png/ball.png and all control positions/CSS untouched.
- [x] Engine fork: patch.py (re-runnable) turns engine_base.html (FROZEN copy of the Shell Shock Live engine, taken 17:32; the deploy copy is being changed by other agents) into game/index.html.
- [x] levels/level1.js (Ryu's Dojo) + level1_dojo.jpg / level1_arena.jpg. TMNT level2-8 plugins moved out to tmnt_levels_removed/.
- [x] Node auto-play: title -> select -> map -> stage -> Ken -> Evil Ryu (warp/dash/vanish) -> outro -> tea break -> results -> initials -> title, no exceptions.
- [x] Chromium screenshots (test/shots/, 0 page errors), forced-deaths node run with tag-ins (Cammy, Fei Long), icons/manifest (SF World Brawl), deployed https://sf-worldbrawl.surge.sh (HTTP 200, files md5-match local).

## Stage 01 contents (levels/level1.js)
- Section 1 "cedar corridor" (2300 px, floor 172-218): 5 locks. W1 scouts; W2 karateka (heavy) + scouts dropping from the rafters + shuriken scout; W3 KEN MASTERS sparring mid-boss (22 HP; rush, kick, Hadouken, anti-air Shoryuken; red flash = COUNTER window +300; yellow OPEN! after a whiff = PUNISH window, +1 dmg +500; on-screen tip); W4 sword/knife scouts + karateka; W5 slide-dasher, shuriken, karateka, scout.
- Props: training dummies, shoji screens, scroll racks (tea/onigiri), dummies hiding roast chicken + sushi. Mist + falling cedar needles overlay. No hazards.
- Section 2 "main hall" arena: EVIL RYU projection (34 HP): fast double dark Hadoukens, teleport -> dash strike, rush/kick; vanishes at 10% (cutscene, player frozen, line), outro: STAGE 01 CLEAR -> NEXT: STAGE 02 METRO CITY STREETS (Balrog teaser) -> tea break -> results (THE END... FOR NOW!) -> initials.
- Music: original A-minor dawn theme; boss = engine boss track re-keyed -2.

## Tests (re-run)
- cd test && STOPAT="back to title" bash run.sh "?debug" 40000      (node auto-play, full stage)
- DEATHS=1 ... same (forced deaths, tag-ins)
- . /workspace/work/sstest/env.sh; NODE_PATH=/workspace/work/sstest/node_modules PART=1|2|3|4 [PICK=0-3] node shots.js
  (headless runs ~16 fps here; each part < 2 min)
- Note: headless Chromium in the sandbox cannot reach the internet, so the live site was checked with curl (200 + md5 match).

## Known gaps
- Stages 2-12 are map labels only (as briefed). The results card prefetches levels/level2.js, which 404s by design (one harmless console 'Failed to load resource').
- Legacy Shell Shock assets (atlas_zap/ramrod/amber/razor, hallway/room/stairs/drill) are still shipped because the frozen engine's hidden <img> tags reference them; they are never drawn in SF play.
- Enemy variety: scouts share one atlas (no hue tints), karateka share another.
- No 2-player.


## Engine changes (patch.py)
- Roster keys: BROTHERS[i].key; donny->ryu (HADOUKEN = real player projectile, STATE.pshots, cancels enemy fireballs), lenny->cammy (CANNON SPIKE rising corkscrew + forward), rafe->feilong (REKKAKEN forward dash), miko->deejay (MACHINE GUN UPPER hover multi-hit).
- Level 1 is a plugin (levels/level1.js); registerLevel accepts number >= 1; built-in TMNT hallway path is no longer reachable.
- def.midBoss: wave entry "midboss" spawns it (cfg.spawn honoured). Boss atlases ken/evil (BOSS_ATLAS_K), e.alpha + cfg.fadeOnDeath for teleports/vanish.
- Enemy shot kinds "hadou" / "hadoudark" (energy balls). Props: dummy / shoji / scrolls. Pickups carry it.food: tea/onigiri (slice = +25%), chicken/sushi (pizza = full).
- Map: 12 stops (LV_NAMES/LV_BOSS), shown after select before Stage 1 (?nomap skips). LS keys sfwb_*. Title: dawn mountains + flame "STREET FIGHTER / WORLD BRAWL" logo, new title theme.

## How to add Stage N
- Write game/levels/levelN.js calling SS.registerLevel({number:N, ...}) exactly like level1.js (API: /workspace/work/ss_level_api.md v1.1 + extras above: midBoss, prop kinds dummy/shoji/scrolls, pickup food, shot kinds hadou/hadoudark, e.alpha, cfg.fadeOnDeath).
- Results card prefetches levelN+1.js; if missing it says THE END... FOR NOW! and goes to initials.
- Test: cd test && STOPAT="back to title" bash run.sh "?level=N&debug" 40000

## RESUME RUN 2 (12-fighter roster) — checkpoints
- [x] Verified patch.py reproduces game/index.html byte-identical (before any roster change). numpy/scipy pip-installed for make_atlas.py.

## RESUME RUN 3 — painted special-move frames (2026-10-08)
- SOURCE OF TRUTH: game/index.html (restored from live site after sandbox restart wiped patch.py roster section). patch.py is NO LONGER used; edit game/index.html directly.
- Plan: art/specials/<key>_spec.png generated (chroma green, ref = fighter sheet) -> art/make_specials.py cuts frames, scales by fighter's idle height, appends to game/atlas_<key>.png as spec1..specN (+ fx sprites in game/atlas_fx.png). Wire via SPECIALS[key].frames.
- [x] Generated 12 fighter special sheets + fx sheet -> art/specials/spec_<key>.png (blanka on magenta, fx on black; others keyed by tool)
- [x] art/make_specials.py written; cut -> game/atlas_sp_<key>.png (sp1..sp3) + game/atlas_fx.png (hadou/sonic/yfire); rects in art/atlas_sp_rects.json. Blanka/DeeJay regenerated (spec_blanka3/spec_deejay3). Honda uses bottom row of its sheet.
- [x] Wired into game/index.html (direct edit): <img atlas-sp-*/atlas-fx>, ATLAS_SP, SPEC_ANIM, specPose(), drawPlayerAtlas uses painted frames during power; code rings/streaks/flip-mirror/FeiLong tilt skipped when painted; drawPShotPainted() replaces gradient Hadouken/Sonic Boom/Yoga Fire. Backup: index.pre_specials.html
- [x] First contact sheet: players invisible in some shots (inv blink at frozen t) + code swing-ring under painted specials -> drawSwingTrail skipped when painted; harness sets inv=0
- [x] test/shots_roster.js (new; brief referenced it but it did not exist) + play.js PICK=n support; index.html frame() honours STATE.dbgFreeze (debug harness only) for frozen mid-move shots. Chromium: cd /workspace/work/sstest && npx playwright install chromium (cache wiped by sandbox restarts)
- [x] Fix: Blanka painted frames were skipped (spec.frame='hurt' tripped the hurt guard) -> guard now checks real hurt state; white ellipse ring at line ~2899 also skipped when painted
- [x] shots_roster.js reworked: one page load, swaps p.bro = SS.api.BROTHERS[i] in place (sandbox load made per-fighter select runs time out)
- [x] Yoga Fire wind-up sprite hidden (breath frame carries it). atlas_sp_*.png palette-quantised (256c FASTOCTREE+dither, visually identical) 817KB -> ~208KB total incl. fx; atlas_fx.png kept RGBA (glow gradients).
- [x] Contact sheets: test/shots/roster/contact_full.png (12x3 phases) + contact_mid.png (4x3). Build: node shots_roster.js (PICKS=..) then python3 make_contact.py
- [x] Tests: node --check OK; play.js PICK=0..11 all reach "back to title", 0 exceptions (only missing = levels/level2.js, expected); shots_roster.js 0 page errors.
- [x] Deployed sf-worldbrawl.surge.sh; curl md5 verified index.html, atlas_fx.png, 12x atlas_sp_*.png.

## RESUME RUN 4 — redo Zangief LARIAT + Cammy CANNON SPIKE (2026-10-08)
- Scope: only game/atlas_sp_zangief.png, game/atlas_sp_cammy.png + their ATLAS_SP rects / SPEC_ANIM entries in game/index.html. SPECIALS (hitboxes/timing) untouched.
- [x] Backups: art/specials/bak_atlas_sp_{zangief,cammy}_v1.png, index.pre_redo2.html. BROTHERS idx: zangief=6, cammy=8.
- [x] Zangief: generated art/specials/spec_zangief2.png (2x4, chroma keyed by tool; ref zangief_sheet.png). make_specials JOB -> top row [0..3], sort "rows", ratio 1.0, GHOST_TINT zangief (green motion arcs -> pale). atlas_sp_zangief.png now sp1..sp4 = front / 3/4 / back / other 3/4, arms straight out, fists clenched, blur arcs. SPEC_ANIM zangief cycle sp1-sp4 (n 4), no mirrored reuse.
- [x] Cammy: 4 generations (spec_cammy2/3/4/6, magenta bg). 3 and 6 had a 3rd leg / same pose; none would give a perfectly straight body (all keep a hip bend). Tried a torso-straightening warp (art/straighten_cammy.py -> cammy_air_straight.png): read as a backbend in-game, rejected.
- [x] Final Cammy: art/compose_cammy5.py -> spec_cammy5.png = launch crouch (spec_cammy2 f1) + spec_cammy4 f1 (leg extended up-forward, other knee tucked, arms swept back, braids streaming) rotated -8 / +2 deg. make_specials JOB magenta, ratio 1.04, new COLOR_MATCH (0.75) pulls frames to atlas_cammy idle palette. SPEC_ANIM cammy seq unchanged (sp1 crouch <0.12, sp2 <0.55, sp3).
- [x] ATLAS_SP rects for zangief/cammy updated in game/index.html (only diff vs index.pre_redo2.html besides SPEC_ANIM zangief line). SPECIALS untouched. Atlases palette-quantised (24 KB / 15 KB).
- [x] Tests: node --check OK; play.js PICK=6 and PICK=8 reach title, 0 exceptions; shots_roster PICKS=6,8 PHASES=0.1,0.3,0.55,0.8 0 page errors. Crops: test/shots/redo2_mid_6.png, redo2_mid_8.png (full frames test/shots/roster/sp_{6,8}_{0..3}.png).
- [x] Deployed (cd game && surge . sf-worldbrawl.surge.sh); curl 200 + md5 match: index.html, atlas_sp_zangief.png, atlas_sp_cammy.png.

## RESUME RUN 5 — paint every remaining visual shortcut (2026-10-08, per ART_AUDIT SF section)
- NOTE: another worker (sf-freeze) edits game/index.html concurrently -> only targeted in-place edits (python str.replace on a fresh read), no whole-file rewrites; game loop / error handling left to them.
- [x] Generated 6 enemy sheets (2x3 like scout_sheet: idle/walk/attack / jump/hurt/down, chroma keyed by tool, ref scout/karateka sheets) -> art/enemies/enemy_{purple,blue,star,sword,dasher,heavy}_sheet.png. purple=Shadaloo brawler (purple fatigues), blue=navy armoured shock trooper, star=black shinobi + red scarf, sword=ronin w/ katana, dasher=orange tracksuit slide-tackler, heavy=big bearded karateka in white gi.
- [x] Generated art/props/: sf_props_sheet (makiwara target stand, shoji, scroll rack), sf_food_sheet (onigiri, tea, chicken, sushi), sf_shuriken, sf_darkhadou (black bg), sf_logo, sf_title_bg, sf_map_bg.
- [x] art/make_enemies_props.py (new, re-runnable): own green key + despill, components, idle=150 px -> game/atlas_e_{purple,blue,star,sword,dasher,heavy}.png (256c), game/atlas_props.png (dummy/shoji/scrolls/onigiri/tea/chicken/sushi/shuriken, stored 3x screen size), game/atlas_fxdark.png (dark Hadouken, black-bg->alpha), game/title_logo.png, game/title_bg.jpg + game/map_bg.jpg (1152x672 = 384x224 @ RES 3). Rects -> art/atlas_e_rects.json (pasted into index.html as ATLAS_E / ATLAS_PROPS / FXDARK).
- [x] index.html (targeted edits; backup index.pre_run5.html): <img> tags for the new files; drawNinjaAtlas uses ATLAS_E[type] (heavy keeps 1.18x + wind-up shudder; gunner/unknown types fall back to the old sheets); actor shadow picks the boss's own cfg.atlas (was atlasImg("ramrod")). drawProp -> painted dummy/shoji/scrolls (PROP_PK scrolls 0.8); drawItem -> painted food at 0.65; drawSlice + tea-break tray -> painted onigiri/tea/sushi; drawStar -> painted spinning shuriken; drawEShotPainted: Ken "hadou" = atlas_fx hadou, Evil "hadoudark" = atlas_fxdark (alpha pass + additive pass so it reads on the bright floor). drawNight -> title_bg.jpg (code dawn kept only as loading fallback); drawTitle -> title_logo.png (block logo fallback); drawMap -> map_bg.jpg. No hitbox/timing/control code touched.
- [x] Shell Shock leftovers: 9 <img> preloads removed (hallway, room, stairs, drill, ball, atlas_zap/ramrod/amber/razor); grep confirmed no other reference (all code paths use imgReady/atlasImg -> null-safe, and they are in the unreachable TMNT hallway path). Files moved to sf_brawler/shellshock_assets_removed/ (1.5 MB no longer shipped). stick.png (joystick) kept.
- [x] Tests: node --check OK; play.js PICK=0..11 all reach "back to title", 0 exceptions; test/shots_run5.js (new) 0 page errors; contact sheets test/shots/run5/contact_before.png / contact_after.png (make_contact_run5.py). shots.js PART=2 timed out waiting for a random Evil 'hado' state under sandbox load (not an error; dark ball verified in the frozen shot).
- [x] Deployed (npx surge@0.24.6 with SURGE_LOGIN/SURGE_TOKEN from /workspace/work/.surge_token, from game/): curl 200 + md5 match for index.html, 6 atlas_e, atlas_props, atlas_fxdark, title_bg, title_logo, map_bg, level1.js; removed Shell Shock files now 404.
- Left: Ken's Shoryuken flame + Evil aura/vanish are still code FX; prop break chunks are code particles; engine barrel/crate/trash/cone + gunner/ninja sheets only exist for non-SF paths; outro card text-only; stages 2-12 not built.

## LEVEL SELECT + SAVED PROGRESS (2026-10-08, lvlsel worker)
- Targeted in-place edits to game/index.html (backup /workspace/work/lvlsel/bak_sf_index.html); same block as Shell Shock (/workspace/work/lvlsel/block.js) with KEY sfwb_progress, 12 stages, word STAGE, 4x3 grid. Hooks: updateTitle -> openMenu(); drawTitle -> drawMenu(); updateSelect uses pickLevel() (map still only for stage 1); updateResults r.t===1 -> progSave().
- Built stages: PROG_BUILT = { 1: true }. When you ship levels/levelN.js ADD N THERE. Also on http(s) the menu HEAD-probes levels/levelN.js and unlocks any stage whose file exists (content-type javascript), so a deployed level2.js becomes pickable automatically.
- Unbuilt stages show COMING SOON and refuse to start (tap/Enter shows a "STAGE N IS COMING SOON" banner). CONTINUE after stage 1 -> stage 2 not built -> opens the picker with that banner.
- Existing harnesses still work (play.js "?debug" reaches back to title: Enter on title opens menu, next Enter = NEW GAME).
- [deploy] sf-worldbrawl.surge.sh published from staging copy /workspace/work/lvlsel/sf_stage (game/ minus the in-progress levels/level2.js+level3.js of the stage-2/3 worker, so stage 2 stays COMING SOON live). curl 200, index.html md5 d1f7c34f + level1.js match; level2.js 404 as intended. NOTE the shipped index.html includes whatever engine edits the stage-2/3 worker had made by then (node --check + play.js auto-play passed).

## GALLERY (title sprite parade + GALLERY menu entry) — 2026-10-08
- Shared with Shell Shock; full notes in /workspace/work/shared_art/NOTES.md "GALLERY". Code: /workspace/work/gallery/ (core.js + reg_sf.js, applied by patch.py as targeted edits).
- Registry `galRegistry()` in game/index.html: 12 fighters (atlas_<key> + atlas_sp_<key> specials), EVIL RYU (boss L1), KEN MASTERS (mini-boss L1), SODOM (levels/level2_sodom.png via levels/level2.js, frames auto-detected), BIRDIE (L3, appears once levels/level3.js ships), SCOUT, KARATEKA, 6 atlas_e_* enemies. New painted boss/enemy = one line.

## FREEZE FIX (iPhone freeze, Oct 8 2026, freeze worker)
Root cause (reproduced in WebKit/iPhone 13 emulation, pre-fix build, T. HAWK, ~4 s into Level 1): T. Hawk's landing special (specialLand) pushes a second shockwave ring with t = -6. drawStage drew it with ctx.ellipse(.., 8 + k*40, ..) where k = t/life = -0.27 -> radius -2.9 -> IndexSizeError. frame() called requestAnimationFrame(frame) only at its END, so the throw killed the loop for good = "freeze". (Headless spam: only pick 11 / T. HAWK threw, f621.) Shell Shock had the same bug via Donny's Vault Slam (same specialLand code).
Contributing iOS risks also fixed: one-shot SFX/music nodes were never disconnected (graph grew ~50 nodes/s: 4069 undisconnected nodes after 2 min), and TTS used cancel()+speak() with no stall guard.
Changes in game/index.html (small in-place edits, all tagged "FREEZE FIX"):
- Radii: CanvasRenderingContext2D.prototype arc/ellipse/arcTo/createRadialGradient clamp radii to >= 0 for every context (main, offscreen, level plugins); plus explicit Math.max(0, ..) on the shadow ellipse, ring fx, charge-up radius; delayed fx (t < 0) are skipped in draw.
- Loop: frame() schedules the next rAF FIRST; update, draw and audio/ui each run in their own try/catch; errors logged (first 5, then every 600th) and counted in window.__frameErrors; a throw mid-draw restores ctx state.
- Audio: reap(src, ...chain) disconnects the source and its gain/filter on 'ended'; LIVEV counts playing sources; voice() refuses new SFX when LIVEV >= 56; note() drops sequencer notes when LIVEV >= 80. NOISE buffer and pulse PeriodicWaves were already shared (reused).
- TTS: speak() never queues (skips if an utterance is active, speaking or pending), cancel() before speak, 5 s timeout cancels a stuck line, TTS turns off for the session if speak() blocks > 150 ms, throws, or 2 lines time out. Chip-voice blips and bubbles are unaffected.
- Arrays: capArrays() each frame: fx 240, pshots 48, debris 160, stars 64, balls 64, items 48, bodies 32, haz 64 (oldest dropped). enemies/queue/props/targets/zones not capped (gameplay state).
- Canvas: 42 canvases / ~4 MPx is constant over a 5 min soak (no repeated tint-canvas creation), so not a cause.
Harness: /workspace/work/freeze_test/soak2.js (+ bg2.sh). WebKit cannot reach localhost in this sandbox; soak2 routes fake hosts local-sf.test / local-ss.test / pre-sf.test / pre-ss.test to files on disk.
- [deploy 23:00] sf-worldbrawl.surge.sh from staging copy freeze_test/sf_stage (game/ minus levels/level2.js+level3.js, which are still in progress, so stage 2 stays COMING SOON). curl 200: index.html md5 5e60aa57, level1.js and atlas_sp_thawk.png md5 match; level2.js 404 as intended. Live WebKit T. HAWK soak, 85 s: no freeze, 0 page errors, 18 undisconnected audio nodes. INCIDENT: a first attempt at 22:58 published an EMPTY folder (rsync is not installed, so staging silently failed). It was live for about 2 min, then replaced. Stage with cp -a and node --check the staged index.html before publishing.

## STAGES 2-3 (stage-2/3 worker, 2026-10-08)
- Files: game/levels/level2.js (METRO CITY WAREHOUSE, boss SODOM) + level2_{warehouse,arena}.jpg, level2_sodom.png, level2_props.png; game/levels/level3.js (LONDON EAST END, boss BIRDIE) + level3_{street,pub}.jpg, level3_birdie.png, level3_props.png. Shipped size ~0.9 MB total.
- Art: generated sheets in art/stage2/ + art/stage3/ (s2_sodom_a 8 poses + s2_sodom_b 6 poses, same for birdie; bgs; props). The *_b sheets came back on WHITE (tool key failed), so art/stage_cut.py white_key() floods near-white from the border. Pipeline: art/make_stage_art.py (re-runnable): key -> components (dil 4) -> anchor (feet centroid / torso / whole-body), padded so drawFrame's centre = anchor -> one row, feet aligned, idle = 220 px -> 256c PNG; bgs -> 512 px tall jpg, corridor strips cross-faded 90 px so they tile, arenas centre-cropped to 917 px. Rects -> art/stage23_rects.json (pasted into levelN.js). Contact helper: art/stage_contact.py.
- Boss sheets have 14 frames: idle, walk, 6 move poses, hurt, fall, down, getup, ko, win. Drawn by each level's own cfg.draw (api.img + api.drawFrame, red telegraph via api.drawTinted; the engine's white hit flash still works because drawSilhouette calls draw). cfg.atlas "ken" is there only so the engine draws a contact shadow.
- SODOM (38 HP, 90 px): JITTE SLASH (16f tell, wide swing), DAIKYO BURNING (28f crouch, long low slide, jump it, 46f punish), JIGOKU SCRAPE (rising anti-air vs jump-ins), BUTSUMETSU BUSTER (command grab: holdPlayer, lift, leap, slam for 3 dmg), SHIRAHA CATCH (counter stance: hitting it undoes the damage and he counter-slashes, CAUGHT!), super MEIDO NO MIYAGE once below 35% (flash plus 3 lunging slashes). Hitting him in OPEN after a whiff = PUNISH +1 dmg +500. On-screen tip during catch.
- BIRDIE (40 HP, 86 px): BANDIT CHAIN (112 px lash along his row), BULL HEAD (flying headbutt, also his anti-air), BULL HORN, which charges up into THE BIRDIE (shoulder rush; it hits the wall and leaves him wide open), MURDERER CHAIN (overhead loop; close = choke hold, MASH attack to shorten, then a fling for 3 dmg), TAUNT (free punish window). Tip shown during the bull horn.
- Stage 2: 5 waves (purple/blue/sword/star/dasher/heavy; wave 3 is two 12 HP heavies, "Mad Gear foremen"; no painted mid-boss). CRANE hazard: when locked, every 5-8 s a shadow and red ring lock onto the player for 56f, then a steel-beam bundle drops (2 dmg plus knockdown; hits grunts for 3). Props: oil drums (barrel, roll), crates, sake barrels (trash) dropping onigiri/tea/sushi/chicken. Warehouse haze and spark overlay.
- Stage 3: 5 waves (wave 3 is a pair of 12 HP bouncer heavies). BLACK CAB hazard along the front lane: horn plus headlight glow plus red lane line and "!" for 60f, then the painted cab crosses at 7.5 px/f (2 dmg to the player, 4 to grunts). Props: ale casks (barrel, roll), dustbins (trash), milk-bottle crates. Drizzle overlay. Pub-interior arena.
- index.html edits (targeted, re-read each time; backup sf_brawler/index.pre_stage23.html): (1) drawProp: a level hook line `LVp.drawProp(API, pr, sx, sy)` lets a level paint its own props (returns true = handled); (2) LV_NAMES 2/3 -> METRO CITY WAREHOUSE / LONDON EAST END; (3) PROG_BUILT = {1,2,3}; (4) top-left "STAGES 4-12: COMING SOON". level1.js outro now says METRO CITY WAREHOUSE.
- Tests: node --check passes on game.js and level1-3. play.js passes (0 exceptions, reaches back to title): ?level=2 PICK 0/1/4/7/8 (each continues into stage 3), ?level=3 PICK 0/6/11, DEATHS=1 PICK 2 (tag-ins Guile/Blanka/Honda/Zangief), ?debug full run L1 -> L2 -> L3 -> title. play_moves.js (MOVES=...) forces every boss move: slash/burning/scrape/grab->lift/catch->counter/meido and chain/bullhead/bullhorn/murder->choke/taunt, 0 errors. play_haz.js logged 7 crane impacts in stage 2. Chromium: test/shots_stage23.js (LV=2|3 PICK=n) gives 0 page errors; shots in test/shots/stage2/, stage3/ (contact_boss.png = every painted boss state); shot_crane.js -> stage2/03b_crane.png.
- Harness note: the title now opens the menu, so shots_stage23.js presses Enter until scene === select. Run Chromium jobs with nohup and poll; sandbox load makes them take 3-4 min.
- Deployed from game/ (npx surge@0.24.6): curl 200 + md5 match for index.html, level1-3.js and all 8 stage 2-3 images.
- WARNING for other workers: /workspace/work/freeze_test/deploy.sh (and the lvlsel staging deploy) EXCLUDES levels/level2.js + level3.js. Re-running it as-is would take stages 2-3 off the live site. Drop those --exclude flags.
- Gaps: no painted mid-boss for either stage (heavy pairs instead); prop break chunks are still engine code particles; the Sodom arena has a seated armour display behind centre stage (static background art).
- [19:25 ET] Removed level2/3 excludes from freeze_test/deploy.sh — Stages 2-3 are LIVE; never exclude them. Stage with cp -a.
- [deploy 2026-10-08 ~23:40 EDT] gallery v1 live. node --check OK (index.html scripts + every levels/*.js). Playwright iPhone 13 landscape + touch (gallery/gtest.js): parade visible, GALLERY opens by tap, tile tap -> full-size pose cycling, scroll buttons, 0 page errors, JS heap ~3 MB. Published from cp -a staging copies gallery/stage_ss + gallery/stage_sf. curl md5 match: shellshock-live index.html 636055df (+ level15.js, level2_brickjaw.png); sf-worldbrawl index.html 8195991e (+ level2.js, level3_birdie.png). Backups: gallery/bak_*_pre_gallery.html. Known: title high-score overlay covers the parade plates while it shows; SF right spotlight overlaps the small FAN GAME text; on touch the bottom screen corners are the virtual buttons, so gallery scroll buttons live in the header.
- 21:27 ET: SF PAUSED by user; sf-engine/sf-entrances cancelled; SF local==live (8195991e). Leftover dir work_ent may exist.
