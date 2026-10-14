# GULF THUNDER YouTube Short
## v2 (2026-10-11) — all 5 stages, gameplay before each boss
Output: gulf_thunder_short.mp4 (1080x1920, 30 fps, H.264 High + AAC 192k, 55.4 s, 11.7 MB), gulf_thunder_poster.png (title + "5 STAGES. 5 BOSSES. / PLAY FREE"), gulf_thunder_poster_ko.png (Stage 1 KO), contact_sheet.png.
v1 kept: gulf_thunder_short_v1.mp4, gulf_thunder_poster_v1.png, gulf_thunder_poster_ko_v1.png, contact_sheet_v1.png (v1 rebuild = build.py + make.sh, frames/).
Rebuild v2: ./make2.sh  (timeline in build2.py; v2/out/timeline.json lists segments by stage).
Captures: v2/c/<name> from cap.js (fixed windows, every 2 steps = real speed) and v2/capko.js (every step until boss KO + N frames; KO frame stored in sfx.json "ko"). All seed=3, god+bot, stage=N. Windows: v2/caps2.txt, plus hk (stage5 6880,75,2) and i5b (stage5 2680,90,2).
Capture-copy changes in game/ (local only, live site untouched; backup of core.js before: v2/core.js.bak):
- core.js: render() is RNG-neutral in capture mode (PRNG state saved/restored around the screenshot render).
- core.js: in capture mode setTimeout runs on game time (queue drained in step()), so frame-stepped capture behaves like real-time play and is fully deterministic (no wall-clock).
- kasbah.js: the test bot no longer backs into the wall against the Gun Broker (turns to face him) — without it the bot stalemates and the boss never dies.
Notes: Stage 3 gameplay is the jet-ski run, which comes right after the Gator Gunboat in the game (pre-boss stretch is only ~8 s and thin). Only repeated source frames = the KO moments re-shown by the 2 REPLAYs (S3 Gator Gunboat, S5 Victor Kade).
