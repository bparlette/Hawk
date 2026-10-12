# J · Cinema City — AI partner (RIDGE) PROGRESS

## 2026-10-10 16:40 UTC — resumed after sandbox reboot
- Found prior work: src/06c_partner.js (RIDGE AI), hooks in 06_game/06b_cine, HUD pip in index.html, README section, tests partner.js / duo.js / duo2.js.
- site/game.js == cat src/0*.js (in sync). Last edits 16:34 UTC (06c_partner.js).
- Earlier test logs: pA_d (1280x720) all phases pass, 0 errors; pB_d (boost, leap-follow, tag, game over) pass, 0 errors;
  pA_m (390x844) pass but intro_end partner offscreen + 1 blocking sample (pre-16:34 fix). pB_m was mid-run.
- Plan: let pB_m finish, re-run full suites on the current build at both sizes, bot.js + cine.js regression, screenshots, deploy, demo, copy+commit.
- 16:46 UTC: pB_m (390x844 over/boost/tag) finished on current build: all pass, 0 errors. Started T/chain1.sh (partner A phases m+d, B d, cine.js d+m, bot.js d+m) on build md5 995668a2.
- 17:01 UTC: qA_m (390x844 intro/follow/tp/kos/revive) PASS on current build: partner on screen after intro, follow mean 3.05 m (91% in band, 0 camera-blocking), far teleport, 2 partner KOs, AI revives hero 1.6 s, player revives partner 1.6 s, 0 errors, no overflow.
- 17:06 UTC: sandbox rebooted again (~17:01) mid qA_d; chain1 killed. Restarting server + remaining tests (chain2).
- 17:08 UTC: README: portrait-fill note + test notes. partner.js shot() now closes the A–J menu before capturing.
- 17:27 UTC: qA_d (1280x720 intro/follow/tp/kos/revive) PASS: partner on screen after intro, follow mean 3.59 m (82% in band, 0 blocking), far teleport, 2 partner KOs, AI revive 1.6 s, player revive 1.6 s, 0 errors, no overflow.
- 17:40 UTC: qB_d (1280x720 game over/boost/leap-follow/tag) PASS, 0 errors, no overflow. Added fin.js (clean tag-finisher frames, one thug left) for the finisher screenshot; started it.
- 17:48 UTC: fin.js PASS (tagged, 0 errors). bakeoff-cinema-city.png <- T/duo_d.png (duo2.js, both turtles mid-fight, current build); bakeoff-cinema-finisher.png <- T/fin_d_hit.png (tag-team hit + flip). Both viewed.
- 17:50 UTC: qcine_d (cine.js 1280x720 regression: intro, door kick, vault, climb, roof leap, QTE finisher) PASS, 0 errors. Deploying.
- 17:52 UTC: deployed; curl md5 MATCH for index.html, game.js, three.module.min.js (HTTP 200). Running demos add-game.sh (bg, log T/addgame.log).
- 18:02 UTC: qcine_m (390x844) PASS, 0 errors. add-game.sh: added cinema-city, copied site, thumb OK; its background demo deploy was killed by another sandbox reboot (~17:59, deploy-run.log empty) -> re-running demos ./deploy.sh detached. Copied build to aistudio cinema/ (game.js/index.html md5 match). Restarting bot.js d+m (chain3).
- 18:09 UTC: demos deploy attempt 1 (post-reboot) FAILED ('Deployment did not succeed'); retrying. qbot_d stopped at 240 s wall / 17.9 s sim (machine overloaded) - 2 kills, 2 tag finishers, 0 errors, but did not finish the 4-corner tour; will re-run with a longer cap.
- 18:12 UTC: demo page live: brad-demos.surge.sh games.json lists cinema-city; g/cinema-city/game.js live md5 == local == j_cinema/site (995668a2) (the concurrent ss3d demos deploy at ~18:08 published it after my add-game; my retry not needed).
- 18:13 UTC: qbot_m also hit the 240 s wall cap (sim 30.5 s: 3 corners, 3 kills, 3 tag finishers, 0 errors). Re-running bot d+m with a 900 s cap (T/chain4.sh -> qbot_d2/qbot_m2).
- 18:15 UTC: aistudio-games commit a8ae3b5 (only games/shell-shock-bakeoff/cinema, 10 files). Not pushed.
