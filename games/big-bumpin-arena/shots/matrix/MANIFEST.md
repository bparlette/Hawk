# Big Bumpin' Arena — screenshot matrix manifest

Game: `games/big-bumpin-arena/` (bparlette/Hawk) @ `41349891f849a77021b6a41b8cbd183381407e0d`
Captured: 2026-11-10, headless Chromium (Playwright shell, Canvas2D, no SwiftShader), spectate mode (`?auto=1`), 1280x720.

- **24 stills** `<style>-<arena>.png` — mid-match play (sim polled to >=1100 ticks, state `play` before capture; per-combo seeds).
- **5 contact sheets** — `grid-<style>.png` (1x6 per style) and `grid-all.png` (4x6 master, rows = styles, columns = arenas); cells 640x360 with caption strips.
- **6 animated GIFs** `gif-<arena>.gif` — the four style packs cycling at 2000 ms/frame, loop 0, 1280x720. Frames are the *identical* sim moment per arena (same seed 7 + same `?ff=` fast-forward, rAF frozen, fixed manual steps; verified identical car/ball coordinates across styles). Aligned source frames kept locally in `gif-frames/` (intermediates, not repo-bound). Rink uses ff=1700 (tick 1705); the other five use ff=1500 (tick 1505) — rink's 1500 point landed on a goal banner, so it was re-picked in open play.

Repo destination for every file below: `games/big-bumpin-arena/shots/matrix/<filename>` in bparlette/Hawk (new subfolder; nothing in Fable's existing `shots/` is overwritten). PNG/GIF binaries must go via the browser-upload route — do not push via the connector.

| File | Repo destination | Bytes | SHA-256 |
|---|---|---|---|
| cel-rink.png | games/big-bumpin-arena/shots/matrix/cel-rink.png | 275383 | 9d04dc1eab7bb63aa55fc41b8ad2d530a03d54c28956625f020b131f4a58a58e |
| cel-lot.png | games/big-bumpin-arena/shots/matrix/cel-lot.png | 343883 | f6a45e8c0aae3d4ff1f0ed1ff2236c571171c6ab429e8f4c123fb4b206531383 |
| cel-pond.png | games/big-bumpin-arena/shots/matrix/cel-pond.png | 441127 | fe97ec3937d491a5ba1645a9af07ce0568ba5dca8b09dc517cec3e9a9f803b12 |
| cel-derby.png | games/big-bumpin-arena/shots/matrix/cel-derby.png | 406416 | a24cde16e02925f84e16cdfd933aa8d0bd783f29e4b7e16c5a0f30e53dc47952 |
| cel-pinch.png | games/big-bumpin-arena/shots/matrix/cel-pinch.png | 337582 | 0bfee4e5c91dd068b7abab82c31425d2ee18c10762fc5711e47559af4c4a2b2e |
| cel-midway.png | games/big-bumpin-arena/shots/matrix/cel-midway.png | 395850 | a6d373cc2321ea02fb9ae4ce0d8fc578fe588216f79d35370f28f787ba4d2664 |
| glossy-rink.png | games/big-bumpin-arena/shots/matrix/glossy-rink.png | 648753 | a9c0a183aaf136ae8ce457bf972dc64f2190bbec7aa24e0fbed23232ddf66cfa |
| glossy-lot.png | games/big-bumpin-arena/shots/matrix/glossy-lot.png | 785453 | f89aa3f97e4066c4c03edba239877e0b0df191e4b7aaabab2b9372fa9a2cc1d4 |
| glossy-pond.png | games/big-bumpin-arena/shots/matrix/glossy-pond.png | 724419 | 4e5501ae0cac283e13fa835cf8b53b2e0913e68739862c862c6550cccd61a1ee |
| glossy-derby.png | games/big-bumpin-arena/shots/matrix/glossy-derby.png | 881283 | 60bbfc2a920ac74255615c48602bcc71288ecfef988f8957c1cfd644109c6cc0 |
| glossy-pinch.png | games/big-bumpin-arena/shots/matrix/glossy-pinch.png | 822585 | 37421392e01d6d356dde00ffdd14246495784ead23d0b5afeb8f1965760d1203 |
| glossy-midway.png | games/big-bumpin-arena/shots/matrix/glossy-midway.png | 856947 | 003d9f283449bad440ae86179f8d3f7ff73aa9073ddda08717d0d1e690f2b20d |
| pixel-rink.png | games/big-bumpin-arena/shots/matrix/pixel-rink.png | 34404 | aef19097a5fa0cb29369666fa81af8337b47a3e44ec85091087391af481fd52b |
| pixel-lot.png | games/big-bumpin-arena/shots/matrix/pixel-lot.png | 48690 | b546fd11fa1dcf9a39ad859d747fbb0fbaafe3cc427ad03faf7d66b8997511e4 |
| pixel-pond.png | games/big-bumpin-arena/shots/matrix/pixel-pond.png | 81033 | fab4956a09338b909bbd1fcf1b715dd6cbf9049c5f956909bdfeef0d0016e95c |
| pixel-derby.png | games/big-bumpin-arena/shots/matrix/pixel-derby.png | 75308 | 41838246c79f17e6fed8b0b20d639b190be4f7e3125857b2639e3a43b3366f7c |
| pixel-pinch.png | games/big-bumpin-arena/shots/matrix/pixel-pinch.png | 48364 | 61aee485d4ed460025bc8acfed9d13b2c6892debe89f26c1771ac558b31bed6c |
| pixel-midway.png | games/big-bumpin-arena/shots/matrix/pixel-midway.png | 77966 | 076d1abeff3cba9b6f20fae58e9bc920771b5ec8d82f244e785f4982abf90dc3 |
| fairground-rink.png | games/big-bumpin-arena/shots/matrix/fairground-rink.png | 596000 | 74b50bc11ab0681b00c26a058a138acd2026ecc565f2d7376735822f99ff0ed0 |
| fairground-lot.png | games/big-bumpin-arena/shots/matrix/fairground-lot.png | 716162 | 9ff926da70d1731c2821fcd227885706b1ac4cfc62eb0681416c4de652856145 |
| fairground-pond.png | games/big-bumpin-arena/shots/matrix/fairground-pond.png | 730620 | 29f9910b8a6c7da840377882a3e184d1cf0bdc2b246dc302e5ae3632b3888969 |
| fairground-derby.png | games/big-bumpin-arena/shots/matrix/fairground-derby.png | 748518 | 632d3e1c3957461748da055254084a7bbd6f2a1356e7ac956362ad0388d4365a |
| fairground-pinch.png | games/big-bumpin-arena/shots/matrix/fairground-pinch.png | 685430 | 2b30360c126012cf5751dbe09edd110a2a23513e1fb9935ae2e40a26904d20a8 |
| fairground-midway.png | games/big-bumpin-arena/shots/matrix/fairground-midway.png | 723390 | 48c2d34059fcff311088692732d315a2888766f483d2c0a02ced51a91bb3d250 |
| grid-cel.png | games/big-bumpin-arena/shots/matrix/grid-cel.png | 878330 | 58e9056841e21e2573e087bd008f6feb6d2395e3eabc0dabb03462d2f24492ab |
| grid-glossy.png | games/big-bumpin-arena/shots/matrix/grid-glossy.png | 1288698 | 347fe691b0157be3a15bd8f6f3090e40d1d8032169bfa51c60480a94d6427bc4 |
| grid-pixel.png | games/big-bumpin-arena/shots/matrix/grid-pixel.png | 582373 | abb12ecf9fccf323639b4f1e1e2deccd05a987534b80e586d7e21cfd64a72c99 |
| grid-fairground.png | games/big-bumpin-arena/shots/matrix/grid-fairground.png | 1242923 | 35dceeb8e97ee991d5d3edcb128a930f4f3b54c72d49dfbc239d8f49bbb0e5d7 |
| grid-all.png | games/big-bumpin-arena/shots/matrix/grid-all.png | 3993497 | 6f7baafac95de9ed36b519f75cfb68449e20ad9350a8ec504b6b1a97088e1f56 |
| gif-rink.gif | games/big-bumpin-arena/shots/matrix/gif-rink.gif | 792381 | 31e8daf5681f53abf37d033e8516935769cea2a730f9312e361ba1fc99ef043a |
| gif-lot.gif | games/big-bumpin-arena/shots/matrix/gif-lot.gif | 1041367 | f49c1fce845f8962a1eee7bb8ac2811d1350c816e7acb8086c4c876f90a6fd8e |
| gif-pond.gif | games/big-bumpin-arena/shots/matrix/gif-pond.gif | 1011637 | 7252eab30c2050625cb7aee217c97f1ffb79de09a8824c3da86e17fdac001c8e |
| gif-derby.gif | games/big-bumpin-arena/shots/matrix/gif-derby.gif | 1097558 | ac8c200832426b2e4e107b193c7aff7de6c8fc7f6ec6b122ca29e7101abe4f9d |
| gif-pinch.gif | games/big-bumpin-arena/shots/matrix/gif-pinch.gif | 935631 | b25407eac5e7bdfe778fff95cf04ff1c60620e4597068a2460db96572ff6f42d |
| gif-midway.gif | games/big-bumpin-arena/shots/matrix/gif-midway.gif | 892343 | f88df65315d6077d2453b7e684d82f0578524d1ec0d537b1824bf472501c3c0c |

Total: 35 files, 25242304 bytes.
