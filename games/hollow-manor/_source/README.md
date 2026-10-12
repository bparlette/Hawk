# Lights Out at Hollow Manor

An original 8-bit (NES-style) top-down horror game. The power is out in an old mansion: find the circuit breaker in the basement and throw it.

Live: https://hollow-manor.surge.sh

- Plain HTML + canvas + WebAudio, no dependencies. 256x240 internal canvas, nearest-neighbour scaled.
- 36 rooms over three floors (2F, 1F, B1), all art and sound generated in code.
- `src/*.js` is concatenated into `game.js` by `build.sh`.

## Controls
Arrows/WASD move · F or Space flashlight · E use (doors, items, notes, hide in wardrobes) · M map · N sound on/off.
Touch: D-pad, LIGHT, USE, MAP, SOUND.

## How to win
1. Read the note in the Foyer: the cellar key is in the Study (2F, west wing: Landing → Gallery → Master Bedroom → Nursery → Playroom → Sewing Room → Study). Use the desk.
2. The cellar trapdoor is in the Kitchen (1F, Foyer → Dining → Kitchen).
3. The breaker (B1 Breaker Room) is missing its handle (Conservatory, 1F west wing) and its main fuse (Crawlspace, B1 west, past the Wine Cellar).
4. Fit both and throw the breaker.

The tall figure appears in blackouts and creeps closer while your light is off; hold the beam on it or hide in a wardrobe. If it catches you, you wake at the last staircase with your items.

## Test hooks
`?bot&speed=8` plays itself to the ending · `?debug=breaker` starts at the breaker with all items · `?room=<id>&x=&y=` · `?noflicker` `?nothreat` `?seed=N` `?touch` · `window.__hm` API.
