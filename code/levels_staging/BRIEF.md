# Parallel level build brief (Shell Shock Live)
- Read FIRST: /workspace/work/ss_level_api.md (plugin API + lifecycle) and the reference level
  /workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/levels/level2.js.
- Art: /workspace/work/ss_assets/ (README.md lists floor bands/hazard ideas). Copy your images into your level as levels/levelN_*.jpg.
- NEVER edit index.html, /workspace/built/sites/..., /workspace/work/deploy/, or other levels' files. Never deploy.
- Work in your own private copy: cp -r /workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf /workspace/work/lvlN_test
  and put levelN.js + assets in its levels/. Also copy level2.js there unchanged so prefetch chains work.
- Test harness: /workspace/work/sstest/ (play.js auto-play, shot.js headless Chromium screenshots; `. ./env.sh` first). Point it at your copy with ?level=N&nocache&debug.
  Copy harness files into your own folder if you need to modify them; don't break the shared ones.
- Requirements: original content only (no TMNT names/trademarks; brothers are Lenny/Rafe/Miko/Donny). 3–4 waves + hazards + a distinct END BOSS with intro line, 3+ attack patterns, KO line, and an outro line leading to the next level. Keep the game's feel (hit-stop, telegraphs, fair hazards). Everything you allocate must be released in onUnload. Keep total level JS < ~60KB and images as JPG.
- Done when: node --check passes; full auto-play of ?level=N reaches boss, boss KO, outro, pizza, results with no page errors; you viewed 3+ Chromium screenshots (gameplay, hazard, boss) with read_file and fixed visual issues.
- DELIVER: copy final files into /workspace/work/levels_staging/levelN/ (levelN.js + its images + 3 screenshots shot_*.png + NOTES.md: boss name, hazards, any API gaps you worked around). If the API lacks something essential, implement it inside your level via hooks; do NOT patch the engine — list the gap in NOTES.md.
- If you get stuck looping on the same failure more than twice, stop and report what you have.
