# Toad City Drone Racer — progress

Spin-off of Toad City Baltimore (Brad 2026-10-13: "Same exact Baltimore assets city and code").
Source: /workspace/work/toad-city/game-int (branch hark/integration) at commit in SOURCE_COMMIT (e1aaac3). Toad City repo untouched (read-only copy).

## Layout
- src/01_core.js … 03f_landmarks_hd_b3.js, 05_fx.js — copied verbatim from Toad City src/ (renderer, toon/cel material, ink hulls, atlas + signage,
  city kit, Inner Harbor, piers, HD landmarks incl. Domino Sugars / Camden Yards / M&T / Power Plant / WTC / Aquarium / Lexington Market, day-night sky, night FX, comic FX + sfx).
  Only change: 01_core POST shader gained a comic pass (halftone corners, speed lines, boost tint, crash flash) via new uniforms.
- src/06_hf.js — collision from the real geometry: two orthographic height passes (top + bottom) → solid if between; keeps air under bridges.
- src/07_drone.js — hero/rival/ghost quad model (toon + ink hull, canopy painted like the Toad City face).
- src/08_course.js — Inner Harbor Grand Prix (21 gates), the Pratt St skywalk (new, flown under), gate rings/glow/labels, gate-crossing maths.
- src/09_input.js — keyboard, gamepad, touch dual floating sticks.
- src/10_flight.js — arcade (assist: aim + altitude hold) and acro (rate mode) flight.
- src/11_audio.js — motor synth, race SFX, Baltimore-club beat (all WebAudio).
- src/12_game.js — race rules, AI rivals on a curvature speed profile, ghost record/playback, camera + juice, HUD, menus, loop.
- tools/build.sh → site/game.js; tools/run.sh <scenario> → headless QA (tools/qa.js); tools/probe.js + annot.py = course design maps.

## Status
- [x] standalone boot of copied city modules, 0 console errors (probe), HF passes 1.46 s
- [x] game code written (race, AI, ghost, medals, results, retry, pause, touch/kb/pad)
- [x] course + full QA suite (tools/suite.sh, 2026-10-14 05:32-05:48; results qa/suite_full.json, shots qa/s_*.png):
  3-lap autopilot 1:49.34 (laps 36.48/36.44/36.42), 3rd, SILVER, 0 crashes, 0 errors; RETRY -> countdown (1280 + 390 touch).
  Portrait: touch stick flight (25 m/s), pause/resume, 1-lap finish, RETRY ok, no horizontal overflow. TIME UP loss ok. Crash -> +2.0 s, respawn at last gate, 0.84 s invuln.
  Medals (auto from line time REF 99.2 s): gold 1:41.50 / silver 1:55.50 / bronze 2:13.00. Rivals skill .93/.88/.83 + rubber band.
  FPS in this sandbox is swiftshader-only (1-3 fps): not representative of a real GPU.
- [x] fixes 2026-10-14: HUD POS shows final place after finish; touch hint wraps on phones; suite.sh no longer blocks on server start.
- [x] Short: shorts/toad-city-drone-short.mp4 (1080x1920, 15 s, 360 frames dusk). Not uploaded (no YouTube).
- [x] published to bparlette/Hawk main commit 7d09298 (parent 4a12e32 paperboy), category Originals, entry right after toad-city-paperboy.
  Live: https://bparlette.github.io/Hawk/brad-demos/g/toad-city-drone/index.html
