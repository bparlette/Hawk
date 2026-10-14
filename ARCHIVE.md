# Hawk archive

Everything Hark built for Brad, in one place (archived 2026-10-14).

**Two places in this repo:**

- **`main`** (this branch, also the GitHub Pages site): live sites, all code, docs, design notes and small source files (`code/<project>/`).
- **`archive/full`** branch: `main` plus every project's images, audio, models, larger source files (also `code/<project>/`) and finished videos (`media/<project>/`). Kept off `main` because GitHub Pages refuses sites over 1 GB and `main` is already ~0.9 GB; putting it there would stop brad-demos from updating. Get it with `git clone -b archive/full https://github.com/bparlette/Hawk.git`.

## Live sites served from main (GitHub Pages)

| Folder | What | Live URL |
|---|---|---|
| `brad-demos/` | Brad's Demos hub: every game prototype, playable in the browser (games.json drives the list) | https://bparlette.github.io/Hawk/brad-demos/ |
| `games/` | older games index | https://bparlette.github.io/Hawk/games/ |
| root files (`viewer*.html`, `src/`, `dist/`, `previews/`, `README_*.md`, `qa/`, `tools/`, `relay/`, `content/`, `toadcity_kit.js`) | Toad City gang/boss character kits, viewers, QA tools and the AI relay files | https://bparlette.github.io/Hawk/viewer.html |

## code/ (full git history kept where it was a repo)

| Folder | What | Live URL | How to run |
|---|---|---|---|
| `code/toad-city/` | Toad City Baltimore game repo (hark/integration + desktop app, CI, shorts tool), merged with history. Branches `toadcity/*` hold every feature branch | https://toad-city-baltimore.surge.sh | `./build.sh` then serve `site/`; desktop app: `desktop/README.md` |
| `code/aistudio/` | aistudio-games repo (Shell Shock, Jungle Fury, Retro Arcade and more), with history; also branch `aistudio/main` | https://bparlette.github.io/Aistudio/ | open `games/<game>/index.html` |
| `code/toad-city-kit-sonnet/` | Sonnet's Task A/B city kit delivery (rowhouses, props, vehicles), with history | - | open `examples/` |
| `code/babyvid/` | (no README; working folder) *(main + archive/full)* | - | `python3 make.py` |
| `code/bak_secidx/` | (no README; working folder) *(main)* | - | assets / notes; no runnable entry point |
| `code/bgs/` | (no README; working folder) *(archive/full only)* | - | assets / notes; no runnable entry point |
| `code/blox-raid/` | (no README; working folder) *(main)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/bmore-drone/` | Toad City Drone Racer — progress *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/bmore-paperboy/` | Toad City Paperboy — progress *(main)* | - | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/bmore-parkour/` | Toad City Rooftops — progress *(main + archive/full)* | - | `./build.sh`; serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/bmore-skate/` | Toad City Skate — progress *(main + archive/full)* | - | `./build.sh` |
| `code/bmore-zombies/` | Toad City: Dead Streets — progress *(main)* | - | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/bmore_demos/` | (no README; working folder) *(main)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/boss_ent/` | (no README; working folder) *(main + archive/full)* | - | `python3 l10.py` |
| `code/brad-story/` | Paradise Thunder — progress *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/brief/` | (no README; working folder) *(main)* | - | assets / notes; no runnable entry point |
| `code/ci_int_pigeon/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/ck_tmp/` | (no README; working folder) *(main + archive/full)* | https://toad-city-chipkid.surge.sh | assets / notes; no runnable entry point |
| `code/cmp/` | (no README; working folder) *(archive/full only)* | - | assets / notes; no runnable entry point |
| `code/cobblestone-preview/` | (no README; working folder) *(archive/full only)* | https://toad-city-cobblestone.surge.sh | serve the folder (`python3 -m http.server`) and open index.html |
| `code/demurrageshield/` | DemurrageShield core engine (v0.1) *(main + archive/full)* | - | `python3 examples_demo.py` |
| `code/drift-surv/` | (no README; working folder) *(main)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/ending_cap/` | (no README; working folder) *(main + archive/full)* | - | `./run.sh` |
| `code/enemies/` | (no README; working folder) *(main + archive/full)* | https://shellshock-live.surge.sh | `python3 batchview.py` |
| `code/esde_mac/` | (no README; working folder) *(main + archive/full)* | - | `python3 build_media.py` |
| `code/final/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/fmv-review/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/freedoom-short/` | (no README; working folder) *(main + archive/full)* | - | `python3 edit.py` |
| `code/freeze_test/` | (no README; working folder) *(main + archive/full)* | https://sf-worldbrawl.surge.sh, https://shellshock-live.surge.sh | `npm install && npm start`; `./deploy.sh` |
| `code/g16/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/g16js/` | (no README; working folder) *(main + archive/full)* | https://shellshock16bit-trailer.surge.sh, https://shellshock16bit.surge.sh | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/g16sr/` | 2026-10-09 17:10 ET — Milestone 3 (full run passes): all 15 levels + 16 boss fights (L15 Shredder -> Super Shredder) reach in GPGX headless bot; end screen + SR *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/gallery/` | (no README; working folder) *(main + archive/full)* | - | `python3 contact.py` |
| `code/genesis_demo/` | (no README; working folder) *(main + archive/full)* | - | `python3 bg.py` |
| `code/grok-relay-site/` | (no README; working folder) *(main)* | https://toad-city-grok-relay-7c41e9.surge.sh, https://toad-city-r2-gemini-g3-qa-standing-template-66ef31.surge.sh | assets / notes; no runnable entry point |
| `code/hubtest/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/integ_harness/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/integ_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/intents/` | (no README; working folder) *(main)* | - | `python3 part_a.py` |
| `code/knockout/` | (no README; working folder) *(archive/full only)* | https://knockout-round1.surge.sh | `./deploy.sh`; serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/lessons/` | (no README; working folder) *(main)* | - | assets / notes; no runnable entry point |
| `code/levels_staging/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lexref/` | (no README; working folder) *(archive/full only)* | - | assets / notes; no runnable entry point |
| `code/live11/` | Live at Eleven (partial-level prototype) *(main)* | https://shellshock-live-at-eleven.surge.sh | `./build.sh`; `./deploy.sh`; serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/lvl10_11_ko/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/lvl10_art/` | (no README; working folder) *(main + archive/full)* | - | `python3 atlas.py` |
| `code/lvl10_harness/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lvl10_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl11_art/` | (no README; working folder) *(archive/full only)* | - | assets / notes; no runnable entry point |
| `code/lvl11_harness/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lvl11_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl12_art/` | (no README; working folder) *(archive/full only)* | - | assets / notes; no runnable entry point |
| `code/lvl12_harness/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lvl12_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl13_art/` | (no README; working folder) *(main + archive/full)* | - | `python3 pack.py` |
| `code/lvl13_harness/` | (no README; working folder) *(main + archive/full)* | - | `python3 grid.py` |
| `code/lvl13_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl14_art/` | (no README; working folder) *(main + archive/full)* | https://shellshock-live.surge.sh | `python3 anchors.py` |
| `code/lvl14_harness/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lvl14_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl15_art/` | (no README; working folder) *(main + archive/full)* | - | `python3 sprites.py` |
| `code/lvl15_art2/` | (no README; working folder) *(main + archive/full)* | - | `python3 cal.py` |
| `code/lvl15_harness/` | (no README; working folder) *(main + archive/full)* | - | `python3 grid.py` |
| `code/lvl15_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl1_art/` | (no README; working folder) *(main + archive/full)* | - | `python3 heads.py` |
| `code/lvl1_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl2_art/` | (no README; working folder) *(main + archive/full)* | - | `python3 pack.py` |
| `code/lvl2_h/` | (no README; working folder) *(main)* | - | assets / notes; no runnable entry point |
| `code/lvl2_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl3_art/` | (no README; working folder) *(main + archive/full)* | https://shellshock-live.surge.sh | `python3 calib.py` |
| `code/lvl3_h/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lvl3_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl4_art/` | (no README; working folder) *(main + archive/full)* | - | `python3 pack.py` |
| `code/lvl4_harness/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lvl4_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl5_art/` | (no README; working folder) *(main + archive/full)* | - | `python3 pack.py` |
| `code/lvl5_harness/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lvl5_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl6_art/` | (no README; working folder) *(main + archive/full)* | - | `python3 anchors_view.py` |
| `code/lvl6_harness/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lvl6_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl7_art/` | (no README; working folder) *(main + archive/full)* | - | `python3 pack.py` |
| `code/lvl7_harness/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lvl7_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl8_art/` | (no README; working folder) *(main + archive/full)* | - | `python3 pack.py` |
| `code/lvl8_harness/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lvl8_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvl9_art/` | (no README; working folder) *(main + archive/full)* | - | `python3 bg.py` |
| `code/lvl9_harness/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/lvl9_test/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/lvlsel/` | (no README; working folder) *(main)* | - | `python3 patch.py` |
| `code/mashup-brawler/` | (no README; working folder) *(main + archive/full)* | https://mashup-brawler.surge.sh | `./build.sh` |
| `code/menu5/` | (no README; working folder) *(archive/full only)* | - | assets / notes; no runnable entry point |
| `code/nola/` | (no README; working folder) *(main)* | - | assets / notes; no runnable entry point |
| `code/optimus/` | (no README; working folder) *(main + archive/full)* | - | `python3 build.py` |
| `code/otr/` | (no README; working folder) *(main)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/pfill/` | (no README; working folder) *(main + archive/full)* | https://shellshock-free-city.surge.sh, https://shellshock-paper-city.surge.sh | `python3 contact.py` |
| `code/phase2/` | (no README; working folder) *(main + archive/full)* | https://shellshock-live.surge.sh | `./deploy.sh` |
| `code/polytrack-plus/` | PolyTrack Remake — Hark Edition (fan remake) · progress *(main)* | - | `npm install && npm start` |
| `code/pratt_fin_ocr/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/pratt_fin_txt/` | (no README; working folder) *(main)* | - | assets / notes; no runnable entry point |
| `code/pratt_img/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/pratt_report/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/pratt_txt/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/props_2_6_8/` | (no README; working folder) *(main + archive/full)* | - | `python3 contact.py` |
| `code/props_3_7/` | (no README; working folder) *(main + archive/full)* | - | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/props_4/` | (no README; working folder) *(main + archive/full)* | - | `python3 comps.py` |
| `code/props_5/` | (no README; working folder) *(main + archive/full)* | - | `python3 pack.py` |
| `code/props_9_13/` | (no README; working folder) *(main + archive/full)* | - | `python3 bg13.py` |
| `code/r2test/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/re-requiem/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/rename_live/` | (no README; working folder) *(main)* | - | `python3 rename.py` |
| `code/restructure/` | Levels 8–15: Zone 1 → Twist → Zone 2 → Arena (Phase 1: design + art) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/reviews/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/rg-pete/` | (no README; working folder) *(main + archive/full)* | https://toad-city-baltimore.surge.sh | `./build.sh`; serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/rg-pigeon/` | (no README; working folder) *(main + archive/full)* | https://toad-city-baltimore.surge.sh | `./build.sh`; serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/roblox/` | Roblox (bparlette/Roblox) — review/improve progress *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/rta-standalone/` | (no README; working folder) *(main + archive/full)* | - | `python3 make_new.py` |
| `code/sf_brawler/` | At the same time can you work on a knock off of the turtle game. Same great gameplay and graphics but for street fighter characters. This 12-stage campaign tran *(main)* | https://sf-worldbrawl.surge.sh | `python3 patch.py` |
| `code/shared_art/` | (no README; working folder) *(main + archive/full)* | https://shellshock-live.surge.sh | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/shellshock/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/shorts/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/socal-painted/` | SoCal Summer Games → California Games Remastered — Hark Edition (fan remake) *(main + archive/full)* | - | `./build.sh` |
| `code/spk/` | (no README; working folder) *(main + archive/full)* | - | `python3 bench.py` |
| `code/sprites/` | (no README; working folder) *(main + archive/full)* | - | `python3 crop.py` |
| `code/ss3d/` | DONE — https://shellshock-3d.surge.sh/ — commit 7dc30b4 (not pushed) *(main + archive/full)* | https://shellshock-3d.surge.sh, https://brad-demos.surge.sh | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/ss3d-bakeoff/` | (no README; working folder) *(main + archive/full)* | https://toad-street-32.surge.sh, https://shellshock-cel-city.surge.sh | `./deploy.sh`; serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/ss3d-trailer/` | SHELL SHOCK 3D trailer — progress *(main + archive/full)* | https://shellshock-3d.surge.sh | `./run.sh`; serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/ss3d_preview/` | (no README; working folder) *(archive/full only)* | - | assets / notes; no runnable entry point |
| `code/ss_api_test/` | (no README; working folder) *(main)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/ss_assets/` | Shell Shock Live — background art for Levels 3–8 *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/ss_compat/` | (no README; working folder) *(main)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/ss_engine/` | (no README; working folder) *(main + archive/full)* | https://shellshock-live.surge.sh | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/ss_feat_test/` | (no README; working folder) *(main + archive/full)* | - | `python3 patch.py` |
| `code/ss_live_backup_features_levels/` | (no README; working folder) *(main)* | - | assets / notes; no runnable entry point |
| `code/ss_liveaction_intro/` | (no README; working folder) *(main + archive/full)* | - | `python3 audio.py` |
| `code/ss_trailer/` | Shell Shock Live: hype-trailer pipeline *(main + archive/full)* | https://shellshock-trailer.surge.sh, https://shellshock-live.surge.sh | `npm install && npm start` |
| `code/sstest/` | (no README; working folder) *(main + archive/full)* | - | `npm install && npm start` |
| `code/sticker-sample/` | (no README; working folder) *(main + archive/full)* | https://sticker-brawler-sample.surge.sh | serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/stoop-preview/` | (no README; working folder) *(archive/full only)* | https://toad-city-stoop.surge.sh | serve the folder (`python3 -m http.server`) and open index.html |
| `code/survivors-plus/` | Vampire Survivors Remake — Hark Edition (fan remake) · progress *(main)* | - | `python3 publish.py` |
| `code/tc_pp/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/th_scratch/` | (no README; working folder) *(main + archive/full)* | - | `python3 clean.py` |
| `code/tip-trailer/` | GULF THUNDER trailer progress *(main + archive/full)* | https://gulf-thunder.surge.sh | `python3 gen.py` |
| `code/toad-city-workspace/` | Toad City Baltimore PROGRESS *(main + archive/full)* | https://toad-city-baltimore.surge.sh, https://toad-city-int-preview.surge.sh | assets / notes; no runnable entry point |
| `code/tober/` | (no README; working folder) *(archive/full only)* | - | assets / notes; no runnable entry point |
| `code/trailer_v2/` | (no README; working folder) *(main + archive/full)* | https://shellshock-trailer.surge.sh | `python3 analyze.py` |
| `code/trailers/` | (no README; working folder) *(archive/full only)* | - | assets / notes; no runnable entry point |
| `code/ventures/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/vicbeat/` | (no README; working folder) *(main)* | - | `python3 analyze.py` |
| `code/viral-shorts/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/vo2/` | (no README; working folder) *(main)* | - | serve the folder (`python3 -m http.server`) and open index.html |
| `code/wasteland-van/` | ROADKILL RIG — Hark Original (id `wasteland-van`) — progress *(main)* | - | `./build.sh`; `./run.sh`; serve the folder (`python3 -m http.server`) and open index.html in site/ |
| `code/webp_test/` | (no README; working folder) *(main + archive/full)* | - | assets / notes; no runnable entry point |
| `code/xvid/` | (no README; working folder) *(archive/full only)* | - | assets / notes; no runnable entry point |
| `code/yt_channel/` | (no README; working folder) *(main)* | - | assets / notes; no runnable entry point |
| `code/zipsite/` | (no README; working folder) *(main)* | - | serve the folder (`python3 -m http.server`) and open index.html |

## media/ (finished videos, on branch archive/full)

| Folder | Videos |
|---|---|
| `media/bmore-drone/` | 1 |
| `media/bmore-zombies/` | 1 |
| `media/brad-story/` | 4 |
| `media/freedoom-short/` | 1 |
| `media/g16js/` | 38 |
| `media/polytrack-plus/` | 1 |
| `media/re-requiem/` | 3 |
| `media/shorts/` | 45 |
| `media/ss3d-trailer/` | 20 |
| `media/ss_trailer/` | 31 |
| `media/tip-trailer/` | 21 |
| `media/toad-city-workspace/` | 1 |
| `media/trailer_v2/` | 33 |
| `media/viral-shorts/` | 5 |

## Elsewhere on GitHub (not duplicated here)

- **bparlette/Roblox** — the Roblox game project (all work pushed to its main).
- **bparlette/Aistudio** — the Aistudio games site (https://bparlette.github.io/Aistudio/); the local aistudio-games repo is also in `code/aistudio/`.
- **bparlette/Offtherip** — https://bparlette.github.io/Offtherip
- **bparlette/free-mac-voice** — on-device Mac voice control.

## Branches in this repo

- `main` — live Pages site + archive (this file).
- `archive/full` — main + all assets and finished videos.
- `toadcity/*` — every Toad City feature branch (all merged into `code/toad-city/`).
- `aistudio/main` — aistudio-games history.
- `claude/*`, `grok/*`, `review/*`, `hark/*` — AI relay, review snapshots and Hark work branches; all merged into main.

## Not archived

- Third-party clones (emsdk, doomgeneric, Genesis-Plus-GX, hyperframes, SGDK, toolchains, node_modules, Chrome libraries).
- Raw capture frames, test/QA screenshots, build output, backups, logs, caches.
- Secrets (surge token, keys) — deploy scripts read the token from a file that is not in the repo; set `SURGE_TOKEN` yourself to redeploy.
- Videos over 50 MB or intermediate renders (see the archive report).
