# SHELL SHOCK 3D — vertical 9:16 Short (2026-10-12)
- Source parts (renders/part*.mp4) DO include the arcade cabinet: cap.js captured a 2050x1944 viewport and clipped the cabinet screen
  (game area only ~812x473) + control panel; build_clips.py added blurred side fill. Cropping 9:16 from that = ~266x473 source → unusable.
- So: RE-CAPTURED in portrait. short/cap9.js = cap.js with viewport 1080x1920, cabinet art/controls hidden by CSS, #screen pulled to
  full viewport (game's own portrait path: canvas H grows to W*16/9, 3D camera aspect follows), CRT overlay off, renderer pixel cap
  1.25e6→2.1e6 via request interception (native 1080x1920 render). Same beats.js scripts / deterministic stepping. No game.js edits.
- short/run9.sh = serial captures under flock /workspace/work/toad-city/locks/chrome.flock (beat:a:z = only screenshot frames a..z-1).
- music: hf/music.wav (NOT renders/music.wav — that path doesn't exist). short/music_raw.wav = 3.0–16.5 s + 38.25–50.1 s (riser→boss→win→end chord), 25.33 s;
  -9.31 LUFS in → final mux applies -4.69 dB → ~-14 LUFS.
- make_short.py shots|overlays|final ; preview.py i.. draws crop boxes.
- Sandbox rebooted ~17:09 UTC; run9 restarted for daynight + title.
- 2026-10-12 14:20 ET — DONE. shellshock3d-short-9x16.mp4: 25.4 s, 1080x1920 H.264 High 30 fps + AAC 48k stereo, -14.1 LUFS integrated, 26.4 MB.
  19 shots (0.73–1.5 s, cuts on the 0.75 s half-bar grid) + 4.33 s end card. Contact sheet: shellshock3d-short-contact.png (10 frames, magenta = 10%/80% safe lines).
  Final encode goes to /tmp then copies (faststart rewrite hit "Input/output error" twice on the workspace FS). Sandbox rebooted twice during the run.
