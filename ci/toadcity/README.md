# Toad City CI harness (bparlette/Hawk, branch toadcity/ci)
Runner scripts used by .github/workflows/toadcity-tests.yml. See handoff doc CI_REMOTE.md in the Toad City workspace.
- run_boss.js <port> <boss> <win|lose> <w> <h> <outDir> [extra] [sim]
- run_city.js <port> <w> <h> <outDir>

## Finale job (2026-10-13)
`run_finale.js <port> <w> <h> <out>`: planned as `finale-390` + `finale-1280` whenever `site/game.js` contains `finaleauto` (hark/finale, src/09z_finale.js)
and the city jobs run (or `bosses` lists `finale`). Plays `?finale=1&finaleauto=1` (dock + fireworks, DRONE UNLOCKED card, credits, CITY SAVED, scripted drone hop),
then a plain `?finale=1` load to check tap-to-skip (dock -> credits -> city). Shots: `finale_<w>x<h>_{fireworks,card,credits,drone,city}.png`.

## Finale flyover check is frame-robust (2026-10-14)
The autopilot advances min(frame dt, 0.05 s) per frame, so the old 3 s wall-clock window was 3-4 swiftshader frames at 1280x720 and `moved > 3 m`
flipped on frame count (3 frames = 2.4 m, 4 = 3.1 m). The flyover is now sampled over >= 3 s AND >= 6 rendered frames (cap 15 s); threshold unchanged.
