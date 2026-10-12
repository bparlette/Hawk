# Brad's Demos — every game prototype on one page

Live: **https://brad-demos.surge.sh**

One page that holds every prototype: a picker (also the landing screen), instant start, switching mid-play,
and one shared arcade control panel (the Shell Shock cabinet's joystick + ATTACK / JUMP / SPECIAL, plus the two
white START / SELECT buttons) docked at the bottom for every game. The game fills the full width and all the
height between the slim top bar and the controls. Deep link straight into a game: `https://brad-demos.surge.sh/#knockout`.

## Add a game (one step) and redeploy

```bash
cd /workspace/work/demos
./add-game.sh <id> "<Title>" "<Category>" <built-site-folder> [--file page.html] [--query '?x=1'] [--embed preset] [--deploy]
# e.g.
./add-game.sh cinema-city "J · Cinema City" "Bake-off" /workspace/work/ss3d-bakeoff/j_cinema/site --embed cab --deploy
./add-game.sh live-at-eleven "Live at Eleven" "Other games" /workspace/work/live11/site --deploy
```

That appends an entry to `src/games.json`, copies the built folder into `site/g/<id>/` (originals are never
touched), injects the embed hook, takes a thumbnail, and with `--deploy` publishes. Then tune the entry in
`src/games.json` if the defaults don't fit (keys, labels, autostart) and run `./build.py --resync <id> && ./deploy.sh`.

Defaults the script writes: arrows on the stick, ATTACK = J, JUMP = K, SPECIAL = L, START = Enter, no autostart.

## Files

| Path | What |
| --- | --- |
| `src/index.html`, `src/shell.css`, `src/shell.js` | The shell: top bar, picker, iframe manager, control panel, key injection |
| `src/games.json` | **The manifest.** One entry per game (see below) |
| `src/demo-embed.js` | Injected as the first script of every game copy: rAF gate + audio suspend for pause/resume |
| `src/assets/` | Control panel art (cropped from the Shell Shock cabinet) and the joystick sprite |
| `src/thumbs/<id>.webp` | 320px thumbnails (made by `tools/thumbs.js`) |
| `build.py` | Builds `site/` (copies games, injects the hook + embed CSS, writes the runtime `site/games.json`) |
| `add-game.sh` | One-step add (manifest entry + copy + thumbnail [+ deploy]) |
| `deploy.sh` | `surge ./site brad-demos.surge.sh` with the saved token, then a curl check |
| `tools/probe.js`, `tools/test.js`, `tools/thumbs.js` | Playwright: per-game probe, the full shell test, thumbnails |
| `tools/detach.py` | Runs a long test fully detached with the Chromium env (shell calls are capped at 2 min) |
| `site/` | Build output (deployed). `site/g/<id>/` are the game copies |

## Manifest entry

```json
{
  "id": "knockout", "title": "Knockout! Round One", "category": "Other games",
  "source": "/workspace/work/knockout/site",      // built static folder (copied to site/g/<id>/)
  "file": "07q.html",                             // optional: copy just this page as index.html
  "query": "?level=1",                            // optional URL params (e.g. ?nosw&noboot for the Shell Shock engine)
  "embed": "knockout",                            // CSS preset that hides the game's own touch controls (build.py EMBED_CSS)
  "css": "html.demo-embed #myControls{display:none!important}",   // optional extra embed CSS
  "patches": [["find", "replace"]],               // optional text patches applied to the copied index.html
  "orientation": "portrait",                      // hint: landscape games show a "turn sideways" tip on phones
  "keys": { "up": "ArrowUp", "down": "ArrowDown", "left": "ArrowLeft", "right": "ArrowRight",
            "attack": "KeyJ", "jump": "KeyK", "special": "KeyC", "start": "Enter", "select": "KeyP" },
  "labels": { "attack": "L PUNCH", "jump": "R PUNCH", "special": "GUARD", "start": "STAR", "select": "PAUSE" },
  "extras": [{ "label": "MUTE", "key": "KeyM" }], // extra buttons in the top bar
  "autostart": [[900, "Enter"], [900, "Enter"]]   // [delay ms after load, key] presses that skip title screens
}
```

Keys are `KeyboardEvent.code` names (`KeyJ`, `ArrowLeft`, `Enter`, `Space`, `Escape`, `ShiftLeft`, `Digit1`).
The shell fills in `key` and `keyCode` too, so games that read `e.key`, `e.code` or `e.keyCode` all work.
A direction set to `null` is disabled (Crystal Cave: up would jump).

## Embed presets (build.py)

`cab` (Shell Shock engine: drops the cabinet photo, stretches the CRT to the frame), `cel`, `cave`, `knockout`,
`hollow`, `g16`, `rta`. All rules are scoped to `html.demo-embed`, which `demo-embed.js` only sets inside the
shell, so opening `site/g/<id>/` directly still behaves like the original.

## Memory

- Nothing is preloaded: the picker shows lazy-loaded 320px webp thumbnails only.
- Only the active game's iframe runs. The previously played game stays as a hidden, **suspended** iframe
  (requestAnimationFrame parked by `demo-embed.js`, its AudioContexts suspended, held keys released, a blur sent)
  so switching back is instant. Picking a third game destroys the oldest (`src = about:blank`, then removed).
  So there are never more than 2 iframes. Opening the picker also pauses the active game.

## Re-sync a game after its source changes

```bash
./build.py --resync shell-shock-3d && ./deploy.sh      # or --resync all
python3 tools/detach.py T/thumbs.log node tools/thumbs.js 8731 shell-shock-3d   # optional: refresh its thumbnail (local server must be running), then ./build.py
```

Shell Shock 3D was copied mid-update on 2026-10-10 (another agent was working on `/workspace/work/ss3d`): re-sync it.

## Portrait fill (2026-10-10)

Games fill a tall phone (390x844) instead of showing black bands; landscape/desktop are unchanged (everything is gated on a portrait viewport).
Patch tools live in `/workspace/work/pfill/` (idempotent; backups of the originals in `pfill/backup/`):

- `patch_cab3d.py <site_dir>`: bake-offs A-H (`site_free|paper|gta|skyline`, `e_gta32/site_gta32`, `f_free16/site_f`, `g_hd2d/site_hd2d`, `h_iso/site_iso`).
  HUD canvas height follows the container (`H` = 384 x container aspect, 224 in landscape), the camera keeps its own FOV but
  `updateProjectionMatrix` widens the vertical FOV in portrait (tan x (A0/aspect)^0.7), menus/cards draw 384x224 in the middle
  with shaded bands, banners sit on the bottom edge. **Re-run it after `ss3d-bakeoff/build.py` rebuilds A-D.**
- `patch_2d.py ss-live ss16 knockout hollow rta`: inline `pfill-bg.js` backdrop (blurred mirror of the frame's own edges) for
  Shell Shock Live / 16-Bit and the 7 Retro Arcade pages; Knockout paints crowd tiers above the ring (canvas sits on the bottom);
  Hollow Manor gets a CSS mansion-wall backdrop with a picture-frame border. Full-screen button in portrait now uses all the height.
- I Cel City and Crystal Cave already filled portrait; only their "turn sideways" tip was dropped (`orientation: any`).

## Testing

```bash
python3 /workspace/work/ss3d-bakeoff/i_cel/serve.py 8731 /workspace/work/demos/site     # local server (detaches)
python3 tools/detach.py T/test.log node tools/test.js 8731 both                          # full shell test (detached; read T/test.log)
python3 tools/detach.py T/thumbs.log node tools/thumbs.js 8731 all                      # regenerate every thumbnail, then ./build.py
```
