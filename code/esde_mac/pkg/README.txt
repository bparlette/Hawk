BROWSER ARCADE for ES-DE (macOS)
================================
Two offline games, launched straight from ES-DE:
  - Shell Shock: Live Action
  - Street Fighter: World Brawl

Needs macOS 13 (Ventura) or newer, Apple Silicon or Intel. No internet needed.

INSTALL
-------
1. Quit ES-DE.
2. Unzip BrowserArcade-mac.zip (double-click it in Finder).
3. Open Terminal and run:
       xattr -cr ~/Downloads/BrowserArcade-mac
       bash ~/Downloads/BrowserArcade-mac/install.sh
   (Change the path if you unzipped it somewhere else.)
4. Start ES-DE. A new "Browser Arcade" system shows both games, with box art,
   marquees, screenshots, title screens and a video for Shell Shock.

What install.sh does:
  - Copies "Browser Arcade.app" (the right one for your Mac's chip) to ~/Applications
  - Copies the two game launchers to ~/ROMs/browsergames
    (or to the ROM folder set in ES-DE, if you changed it)
  - Adds the "browsergames" system to ~/ES-DE/custom_systems/es_systems.xml.
    If you already have that file, it is backed up first
    (es_systems.xml.backup-<date>) and the new system is merged in.
    Your other custom systems stay as they are.
  - Copies gamelist.xml to ~/ES-DE/gamelists/browsergames/
  - Copies the media to ~/ES-DE/downloaded_media/browsergames/
    (or to the media folder set in ES-DE, if you changed it)
  - Removes the download quarantine. If the app's signature doesn't check out
    on your Mac, it re-signs the app locally ("ad-hoc", no Apple ID needed).
  You can run it again at any time. Your saves are kept.

GATEKEEPER (the app is not signed by Apple)
-------------------------------------------
install.sh handles this for you. If macOS still says the app "can't be
opened" or "is damaged", do one of these:
  - In Terminal:  xattr -cr ~/Applications/"Browser Arcade.app"
  - Or in Finder, go to ~/Applications, right-click (Control-click)
    "Browser Arcade", choose Open, then click Open. You only need to do this once.
  - On macOS 15 or newer: System Settings > Privacy & Security > "Open Anyway".

CONTROLS
--------
  Controller or keyboard, the same as the web versions.
  QUIT BACK TO ES-DE: hold Select+Start (Back+Start) for 1 second,
                      or hold Esc for 1 second.
                      A quick tap of Esc still works as "back" in the game menus.
  The mouse pointer hides after 2 seconds without moving.

SAVES
-----
Progress, high scores and settings are kept between launches, in
~/Library/Application Support/Browser Arcade/<game>/

NOTES
-----
- These are not RetroArch cores and don't run inside RetroArch. ES-DE starts
  them directly, the same way it starts any other app. RetroArch is unaffected.
- The games run fullscreen with no browser bars or menus, and with audio on
  from the start. Everything is stored inside the app, so they work offline.
- The arcade cabinet frame and on-screen touch buttons from the web
  versions are hidden on a Mac, so the game fills the screen.
- To play without ES-DE, open ~/Applications/Browser Arcade.app and choose a game.
- In ES-DE you can choose "Browser Arcade (keep ES-DE running)" as the
  alternative emulator if you'd rather ES-DE stay open in the background.

FILES IN THIS ZIP
-----------------
  apps/arm64/Browser Arcade.app      Apple Silicon build
  apps/x64/Browser Arcade.app        Intel build
  roms/browsergames/*.sh             the ES-DE "ROMs" (small launcher scripts)
  custom_systems/es_systems.xml      the "browsergames" system
  gamelists/browsergames/gamelist.xml
  downloaded_media/browsergames/     covers, marquees, screenshots, titlescreens,
                                     miximages, fanart, videos
  install.sh, README.txt
