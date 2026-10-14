# Shell Shock Live: hype-trailer pipeline

Builds the trailer site **shellshock-trailer.surge.sh**: the full-game trailer, a mini hype movie per level,
and a screenshot gallery per level, plus a PLAY button linking https://shellshock-live.surge.sh.
Shell Shock Live only (the original pixel game is not used anywhere).

## Rerun after new levels ship

```bash
cd /workspace/work/ss_trailer
./capture.sh                                   # default game dir: /workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf
./capture.sh /path/to/merged/game/dir          # any game copy with index.html + levels/levelN.js
STAGING=/workspace/work/levels_staging ./capture.sh   # overlay staged levels (levelN/levelN.js + images) before capture
LEVELS="3 4" ./capture.sh                      # recapture only some levels (others keep their raw/ captures)
SKIP_CAPTURE=1 ./capture.sh                    # re-edit only (stills, movies, page) from existing raw/
DEPLOY=1 ./capture.sh                          # ...and publish deploy/ to shellshock-trailer.surge.sh
```

Timing on the shared 2-vCPU sandbox, measured Oct 8: 4 to 10 min to capture each level depending on load (2 levels run in parallel),
about 1 to 3 min to render each level movie, and 2 to 4 min for the full trailer. Raw captures are about 500 MB per level in `raw/`, and you can delete them after a build.
The full trailer's per-level budget shrinks as levels are added (150 beats total), so it stays about 60 to 75 s with 8 levels. Background long runs: `setsid nohup ./capture.sh > logs/run.log 2>&1 &`.
Levels are auto-discovered: level 1 is built in, plus every `levels/levelN.js` in the game dir or staging.
Level names come from `name: "..."` in `levelN.js`; boss names come from the in-game boss object at capture time.

Manual deploy:
```bash
export SURGE_LOGIN=rbparle@gmail.com SURGE_TOKEN=$(cat /workspace/work/.surge_token)
timeout 100 npx -y surge@0.24.6 /workspace/work/ss_trailer/deploy shellshock-trailer.surge.sh
```

## How it works

| Step | File | What it does |
|---|---|---|
| 1 | `snapshot.sh [GAME_DIR]` | Copies the game to `_serve/live` (the source is never modified), overlays `$STAGING` levels, patches the **copy** so `const STATE = {` becomes `const STATE = window.__CAP_STATE = {`, and serves it on `http://127.0.0.1:8765`. |
| 2 | `run_captures.sh N...` → `capture.js` | Headless Chromium (Playwright 1.47.2, cached chromium-1134; extra libs in `libs/`). Hijacks `requestAnimationFrame` and `performance.now`, so the game is stepped frame by frame (deterministic and independent of CPU load). An in-page bot plays: title → select (cycles brothers) → stage, chases the nearest enemy, mashes combos, jump-attacks, and uses the power move. It's invincible except for **3 scripted KOs at about 20 s**, which trigger the every-3rd-KO tag-in. If progress stalls for 40 s it force-clears the screen. It saves every 2nd frame (60→30 fps) as JPEG to `raw/levelN/frames/` and writes per-frame metadata (scene, phase, attack, combo, hurt and dying counts, boss name/hp/state, intro, cutscene, pizza, results, tag-in, pit) to `raw/levelN/meta.jsonl`. |
| 3 | `build.py` | Finds moments from the metadata: title, select, level card, best action windows (scored on hits, KOs, and combos), tag-in, hazard falls, **mid-bosses** (e.g. L1 Zap-Rollers), the **end boss** (the last boss run), boss intro, best boss-fight windows, boss KO, cutscene/outro, pizza, and results. It renders with PIL piped to ffmpeg (1280x720, 30 fps, H.264 `-preset veryfast -crf 20` + maxrate cap, AAC, `+faststart`): slam cards, punch-zoom cuts, white-flash transitions, screen shake, 0.35x orange-tinted slow-mo on boss KOs, "BOSS: NAME" and "K.O.!" cards. Music is **original, synthesized** in `synth.py` (150 BPM chip-rock, cuts on the beat, impact/whoosh SFX on the slams), loudness-normalized to -14 LUFS. |
| 4 | `make_page.py` | Writes `deploy/` (index.html, `v/*.mp4` + posters, `img/` stills + thumbs), mobile-first, `playsinline`, posters, `preload="none"` for level videos. |

Outputs: `out/level{N}.mp4`, `out/full_trailer.mp4` (+ `.jpg` posters, `out/manifest.json`), `screens/levelN/NN_label.jpg`
(6–10 stills per level), `_tmp/contact_*.jpg` (contact sheets for checking).

## Game hooks that would make capture easier (recommended for future levels)
The pipeline needs **none** of these: it works from the patched copy. They would make it more robust:
1. `?debug` already exposes `window.__SS = { STATE, spawnBoss, LEVELS, ... }`. If every level keeps `STATE.enemies[i].boss = true`
   and `.name` on its end boss (like BRICKJAW), boss detection is exact. Level 1's Ramrod is detected by `type === "ramrod"`.
2. Emit events the capture can log instead of inferring them: `window.dispatchEvent(new CustomEvent("ss:event", {detail:{type:"bossKO"|"tagIn"|"finisher"|"hazard"|"stageClear", ...}}))`.
3. `?invincible` and `?autoplay` flags (a built-in attract-mode bot) would give nicer, more human-looking fights than the external bot.
4. `?seed=N` to make enemy AI randomness reproducible (captures then pick the same moments every rerun).
5. `?section=B` / `?boss=1` to jump straight to a level's boss arena, which cuts capture time from ~5 min to ~1 min when only boss shots are needed.
6. A flag that hides the speaker/fullscreen chrome on the canvas for clean frames.

## Notes
- `shellshock-live.surge.sh` and `shellshock.surge.sh` returned 403 "project paused" on Oct 8 2026 (the Surge account needs email verification),
  so capture defaults to the local game folder. `USE_LOCAL=0 ./snapshot.sh` would mirror the live site instead once it's back.
- Title-screen "WATCH TRAILER" button: see `title_link_snippet.md`.
