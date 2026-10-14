#!/bin/sh
# ES-DE "ROM" for the Browser Arcade system. Launches Street Fighter: World Brawl and blocks until it quits,
# so ES-DE resumes when you exit (hold Select+Start or Esc for 1 second).
APP="${BROWSER_ARCADE_APP:-$HOME/Applications/Browser Arcade.app}"
[ -d "$APP" ] || APP="/Applications/Browser Arcade.app"
exec "$APP/Contents/MacOS/Browser Arcade" --game=sfbrawl
