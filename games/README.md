# Brad's browser games

Self-contained static folders. All links are relative, so each folder can be split out into its own repo or dropped into any static host. `index.html` is the arcade-cabinet hub that links every game (up/down or tap, A to select).

| Folder | What |
| --- | --- |
| `index.html` | Hub: cabinet select menu listing every game below |
| `shell-shock-live/` | Shell Shock Live (TMNT-inspired fan beat-'em-up, 15 levels, modes) |
| `shell-shock-16bit/` | Shell Shock 16-Bit (same engine, Genesis-style art) |
| `shell-shock-live-home/` | Live home page + trailer |
| `shell-shock-16bit-home/` | 16-bit home page + trailer |
| `shell-shock-3d/` | Shell Shock 3D, Level 1 "Big Apple, 3 A.M." (three.js) |
| `shell-shock-level-1/` | Shell Shock Level 1, the first single-file remake |
| `shell-shock-16-genesis/` | Shell Shock 16: real Sega Genesis ROM (`shellshock16.bin`, SGDK) + GPGX wasm web player |
| `shell-shock-16-speedrun/` | Shell Shock 16 Speed Run ROM + web player |
| `shell-shock-bakeoff/` | 3D style bake-offs A–K, incl. `cinema/` (Cinema City) and `toad32/` (Toad Street 32) |
| `toad-city-baltimore/` | Toad City Baltimore, built output of `hark/integration` (game + `home/` page) |
| `toad-city-chipkid-preview/` | Chip Kid duel preview build (`hark/chipkid-fun`); open with `?duel=chipkid` |
| `sf-world-brawl/` | Street Fighter: World Brawl (fan brawler on the Shell Shock engine) |
| `live-at-eleven/` | Live at Eleven · WKRK Action News (play `site/`) |
| `crystal-cave-25d/` | Crystal Cave 2.5D |
| `gulf-thunder/` | Gulf Thunder |
| `hollow-manor/` | Lights Out at Hollow Manor |
| `knockout/` | KNOCKOUT! Round One |
| `jungle-fury/` | Jungle Fury (16-bit, current); `original.html` is the first version |
| `tobers-nightmare/` | Tober's Nightmare (3D Halloween remake) |
| `pumpkin-patch-panic/` | Pumpkin Patch Panic |
| `retro-arcade/` | Retro Throwback Arcade: hub + Barrel Climb, Pipe Pests, Ring Rush, Gem Columns, Balloon Brawl, Turbo Coast, Duck Shoot |
| `sticker-brawler-sample/` | Sticker Brawler art sample |
| `demos/` | Brad's Demos source (build with `build.py`) |
| `sprites/` | Every Shell Shock sprite pose plus sprites.json |

Lint: `node shell-shock-live/tools/lint-random.mjs shell-shock-live`
