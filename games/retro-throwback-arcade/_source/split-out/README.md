# Retro Throwback Arcade

A gauntlet of original mini-games inspired by Nintendo and Sega classics.

- `index.html` is the player: the title screen, the level grid, progress, and the loader.
- `levels/NN-name.js` holds one game per file, loaded only when it's played and prefetched one level ahead.
- Deep link to any level: `index.html?level=6` or `index.html#level=6`.
- To add a level, add its file and one entry to `LEVELS` in index.html.
- Needs to be served over http(s) (GitHub Pages is fine). Opening the file directly with file:// won't load levels.
