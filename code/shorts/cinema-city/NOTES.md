# Cinema City YouTube Short (2026-10-11)
Output: cinema_city_short.mp4 (1080x1920, 30 fps, H.264 + AAC 48k, 22.93 s), cinema_city_short_poster.png. Not uploaded.
Pipeline: site/ = LOCAL copy of j_cinema/site (live game untouched). Patches in the copy only: deterministic stepping (__CAPM, __capStep, __CAPDT), scripted stick (__CAPMV), render skip (__CAPNR), camFwd/startFinisher exposed. cap.css hides HUD/touch/hint/proto.
cap.js <name> <frames> <query> [director] -> frames/<name>/fNNNN.jpg (540x960 CSS @2x = 1080x1920, sim=2 -> 1/30 s per frame, Math.random seeded -> runs replay identically).
Directors: dir_fin.js (QTE finisher; tid=4 = bruiser), dir_ko.js (combo KO, unused: thug hidden behind turtles). Replays = same run re-simulated with slowat/slowdt (true slow-mo frames from the engine).
Edit: edit.json -> build.py (overlays from overlays.py, synth.py original score, loudnorm) -> /tmp then copied (JuiceFS faststart write fails).
Serve: python3 /workspace/work/ss3d-bakeoff/j_cinema/serve.py 8871 /workspace/work/shorts/cinema-city/site
