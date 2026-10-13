# Toad City Baltimore: macOS desktop app + ES-DE

The three.js web game wrapped in Electron so it launches from **ES-DE** (EmulationStation Desktop Edition) on a Mac like any
other game: fullscreen, no cursor, controller live at once, and quitting drops straight back into ES-DE.

## Install on the Mac (one line)
```bash
curl -fsSL https://raw.githubusercontent.com/bparlette/Hawk/toadcity/desktop/install_mac.sh | bash
```
Quit ES-DE first. `install_mac.sh` is idempotent (run it again to update). It:
1. downloads the newest `desktop-v*` pre-release from bparlette/Hawk (`ToadCityBaltimore-mac-universal.zip` + `ToadCityBaltimore-esde.zip`);
2. installs `~/Applications/Toad City Baltimore.app` and removes the quarantine attribute (`xattr -dr com.apple.quarantine`), re-signing ad-hoc if needed;
3. merges the `toadcity` system into `~/ES-DE/custom_systems/es_systems.xml` and the `TOADCITY` find rule into
   `~/ES-DE/custom_systems/es_find_rules.xml` (backs up an existing file first, keeps your other systems, and only writes when something changes);
4. copies the ROM stub to `~/ROMs/toadcity/Toad City Baltimore.toadcity`, the gamelist to `~/ES-DE/gamelists/toadcity/`, and the media
   (screenshot, marquee, video, title screen, cover, fanart, miximage) to `~/ES-DE/downloaded_media/toadcity/`. If you moved the ROM or
   media folder in ES-DE's settings, those folders are used instead.

`uninstall_mac.sh` removes all of it again (saves are kept unless `--purge`).

**Gatekeeper:** the app is not signed or notarized by Apple. The installer removes the quarantine. By hand:
`xattr -dr com.apple.quarantine ~/Applications/"Toad City Baltimore.app"`, or right-click the app in Finder > Open once.

## Controls in the desktop build
- Controller, keyboard and mouse work exactly as on the web (Gamepad API, standard mapping). No click is needed first: the window takes focus on launch.
- **Quit to ES-DE:** hold **Select+Start** (Back+Start / View+Menu) for 1 second, or hold **Esc** for 1 second. A "HOLD TO QUIT" bar shows while held.
  A quick Esc tap still reaches the game (the fort's "ESC LEAVES"), and a quick Select still opens the map. Cmd+Q also quits.
- The cursor is hidden; it only appears while the mouse is moving and hides again after 2 s.
- Audio starts without a click (`autoplay-policy=no-user-gesture-required`). The B-More 410 radio is unchanged: its YouTube/Bandcamp
  players stream when the Mac is online, as on the web. The game itself is fully bundled and runs offline.
- Saves (localStorage) live in `~/Library/Application Support/Toad City Baltimore/`. The game is served from a fixed loopback address
  (`http://127.0.0.1:47391`) so saves keep the same origin every launch.

## How the app works
- `main.js`: a tiny HTTP server on 127.0.0.1 serves the bundled `site/` (an http origin keeps the YouTube iframe API happy); the window is
  kiosk + fullscreen, titled "Toad City Baltimore", single instance. The top-level page can never navigate away from the game; external
  links open in the default browser.
- `preload.js`: injected into the page without touching any game file: cursor hiding, the hold-to-quit bar, and the Esc / Select+Start combos.
- Test env vars: `TOADCITY_WINDOWED=1`, `TOADCITY_TEST=1` (console logging), `TOADCITY_QUERY="duel=chipkid"`, `TOADCITY_DATA=<dir>`, `TOADCITY_PORT`.

## Build
The workflow `.github/workflows/toadcity-desktop.yml` (branch `toadcity/desktop`, runs on every push that touches desktop/, es-de/ or the
scripts) runs on `macos-latest`: copies the latest `site/` from `toadcity/integration`, `npm install`, makes the `.icns`,
`node package.mjs darwin universal` (@electron/packager, arm64 + x64 merged with lipo), ad-hoc signs, checks `lipo -info` and that site/
is inside the bundle, test-runs `install_mac.sh` twice and `uninstall_mac.sh` against a throwaway HOME, then uploads the zips as an
artifact and publishes a **pre-release `desktop-v<run number>`** in bparlette/Hawk. To ship a newer game build, push to
`toadcity/integration` and then push any change here (or re-run the latest workflow run).

Local: `cp -r ../site site && npm install && npx electron .` (or `TOADCITY_WINDOWED=1 npx electron .`).
Linux headless smoke test: `node test/smoke.js <electron binary>` (Playwright `_electron`, ozone headless, SwiftShader).

## ES-DE files (`../es-de/`)
| File | Goes to | What |
|---|---|---|
| `custom_systems/es_systems.xml` | `~/ES-DE/custom_systems/` | `toadcity` system, `%ROMPATH%/toadcity`, extension `.toadcity`, theme `ports`. Default command `%EMULATOR_TOADCITY% %ROM%` (runs the app binary; ES-DE waits for it). Alternative command `%EMULATOR_OS-SHELL% %ROM%` runs the stub, which does `open -W -a "Toad City Baltimore"`. |
| `custom_systems/es_find_rules.xml` | `~/ES-DE/custom_systems/` | `TOADCITY` staticpath rule: `~/Applications/…app/Contents/MacOS/Toad City Baltimore`, then `/Applications/…`. |
| `roms/toadcity/Toad City Baltimore.toadcity` | `~/ROMs/toadcity/` | the game entry (a 6-line bash script, used only by the alternative command) |
| `gamelists/toadcity/gamelist.xml` | `~/ES-DE/gamelists/toadcity/` | name, description, developer/publisher Brad Parlette, genre, players 1-4 |
| `downloaded_media/toadcity/*` | `~/ES-DE/downloaded_media/toadcity/` | screenshots, marquees, videos, titlescreens, covers, fanart, miximages |
| `make_media.py` | (build tool) | redraws the media + app icon. Logo/marquee/icon are drawn procedurally from the game's own title in its own UI font (Press Start 2P, OFL) and HUD colours; no logo files are copied. Screenshot/fanart are game captures; the 10 s video is cut from the game's own landmark drone-cam frames. |

Paths follow the current ES-DE user guide (custom systems in `~/ES-DE/custom_systems/`, find rules complementing the bundled
ones, `staticpath` entries naming the binary inside the `.app`, media in `~/ES-DE/downloaded_media/<system>/<type>/<game name>.<ext>`):
https://gitlab.com/es-de/emulationstation-de/-/blob/master/USERGUIDE.md and https://gitlab.com/es-de/emulationstation-de/-/blob/master/INSTALL.md#es_find_rulesxml

## RetroArch: honest status
- **There is no libretro core that runs a WebGL/JavaScript game**, so Toad City cannot run *inside* RetroArch, and this repo does not fake one.
- **RetroArch on macOS cannot launch an external app on its own.** Its playlists only start content through a libretro core; a playlist
  entry pointing at a `.app` or a script does nothing useful. The libretro team says so directly: "RetroArch doesn't support launching
  anything but libretro cores on its own" (https://forums.libretro.com/t/attempting-to-launch-an-external-program/37219).
- The only workaround is a third-party "launcher" core that shells out to a script, e.g.
  [libretro-script-launcher](https://github.com/yzzyx-network/libretro-script-launcher) or
  [libretro-bash-launcher](https://github.com/SwedishGojira/libretro-bash-launcher). They are not in RetroArch's Core Updater, have to be
  compiled by hand, are aimed at Linux ("it should work on MacOS as well", untested by its author), and RetroArch sits on a black screen
  until the script exits. Not recommended for this Mac.
- **Use ES-DE as the frontend.** ES-DE launches RetroArch for the emulated systems *and* launches native apps like this one, with the same
  controller-driven menus, so one frontend covers everything.
