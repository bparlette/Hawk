# Toad City CI harness (bparlette/Hawk, branch toadcity/ci)
Runner scripts used by .github/workflows/toadcity-tests.yml. See handoff doc CI_REMOTE.md in the Toad City workspace.
- run_boss.js <port> <boss> <win|lose> <w> <h> <outDir> [extra] [sim]
- run_city.js <port> <w> <h> <outDir>

## Finale job (2026-10-13)
`run_finale.js <port> <w> <h> <out>`: planned as `finale-390` + `finale-1280` whenever `site/game.js` contains `finaleauto` (hark/finale, src/09z_finale.js)
and the city jobs run (or `bosses` lists `finale`). Plays `?finale=1&finaleauto=1` (dock + fireworks, DRONE UNLOCKED card, credits, CITY SAVED, scripted drone hop),
then a plain `?finale=1` load to check tap-to-skip (dock -> credits -> city). Shots: `finale_<w>x<h>_{fireworks,card,credits,drone,city}.png`.
