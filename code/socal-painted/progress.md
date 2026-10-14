# SoCal Summer Games → California Games Remastered — Hark Edition (fan remake)

id: socal-summer-games-plus · title: "★ California Games Remastered — Hark Edition (fan remake)"
Original (untouched, live at g/socal-summer-games/): /workspace/work/socal-painted/orig.html
Source parts: /workspace/work/socal-painted/src/  → build.sh → build/index.html

## Brief changes
- 21:02 Brad: "It's supposed to be California Games remastered." → faithful remaster of Epyx 1987 California Games:
  order Half Pipe, Foot Bag, Surfing, Roller Skating, BMX, Flying Disc; original mechanics/scoring; name+sponsor entry,
  all events / one event, trophies after each event, champion by 5/3/1 points. Procedural only, parody sponsors, no Epyx logo/assets,
  no "Louie Louie" (original surf-rock tune written from scratch).
- Rules source: C64 manual text http://protovision.textfiles.com/piracy/SOFTDOCS/californiagames.txt
  (half pipe 1:15 or 3 falls; kick turn 100-300, hand plant 400-700, aerial 400-999; foot bag 1:15, any kick 10, half axle 250,
  full axle 500, horseshoe 500, jester 2000, double arch 2500, doda 5000, off-screen catch 1500, drops cost time; surfing 1:30 or
  4 wipeouts, judged on ride length/turns/speed/tube/near break/air; skating 3 falls, avoid 10-30, jump 20-60, spinning jump 40-120;
  BMX 2:00, 1 serious or 3 easy falls, wheelie 100-200, jump 200-400, table top 500-1000, 360 1000-2000, backflip 1500-3000,
  forward flip 3000-6000, 60 pts/sec left, stop-on-pad bonus; disk 3 attempts, 3-colour meter, catch 150/250/250/350/350 + throw pts).

## Bugs verified in the original (line numbers in orig.html)
1. Music clock is setInterval (l.300), not the audio clock: jitter/drift, keeps firing while hidden; every voice wired straight to destination (no master/compressor).
2. playNoiseBurst builds a new random AudioBuffer on every snare/wipeout (l.~388).
3. Wipeouts never end an event and never cost time/score: triggerWipeout (l.1124) only resets combo → no real fail.
4. Title "Full 6-Event Tour" and "Single Event" both just initEventState(0) (l.2128); Single never opens a picker; Tour never advances on its own, "NEXT EVENT" wraps %6 forever, no final champion.
5. CPU tour total is fabricated as cpuScore*(eventId+1); 3rd podium slot invents "SURFER JOE 3100" with 1 player; "BEST" scores pre-seeded with fake numbers (l.1031).
6. Viral bot overwrites input.Up/Down/Left/Right every frame (l.1920) and leaving viral via DECK MENU leaves them stuck; uses Math.random presses; the bot also overrides a human.
7. Touch: touchstart/touchend only (no touchcancel/pointer capture) → stuck keys; mouseup only on the button; touch HUD always shown on desktop; the Z touch button's tag is missing its closing ">" (l.~206).
8. Per-frame allocations: createPattern every frame (l.694), ~8 gradients/frame, trails push+splice every frame, particles splice, forEach closures, toLocaleString each frame.
9. Half pipe tricks ignore rotation: Z/X/C award on press, unlimited spam per air; X adds exactly 2π so the landing check always passes; Left rotation decays via `else trickAngle *= 0.9` (frame-rate dependent, asymmetric).
10. All events award tricks instantly on press (BMX backflip does rot -= 2π instantly, skating 360 on press) — no landing quality.
11. Variable dt (clamped 0.05) not fixed timestep; hitstop `return`s before render (frozen-blank logic) .
12. Courses run out: BMX has 40 obstacles (~13.6k px) and skating 45 hazards (~13k px) but riders cover ~18-27k px in 60 s → empty track after ~30-40 s.
13. Foot bag: holding Up counts as a kick every frame → hold Up to auto-juggle.
14. Disc: AIM_ANGLE phase is dead code; meter is a single press.
15. "FILES (2)" source exporter: index.html is a live outerHTML snapshot; README claims no external assets while page loads Tailwind CDN + Google Fonts.
16. Tailwind play CDN + Google Fonts: network dependent, production warning in console.
17. No visibilitychange pause, no key clear on blur.
18. 16-bit mode renders 320x180 regardless of aspect (stretched in portrait), no palette snap, HUD text unreadable.
19. Canvas sized without devicePixelRatio (blurry); viral 9:16 resize runs before the 0.35 s CSS transition ends → wrong canvas size.
20. Hot-seat: no names/sponsors, P2 starts instantly with no hand-off.
21. Event order/mechanics don't match 1987 California Games (Surfing 2nd, Footbag 3rd, etc.).

## Status log
- 21:10 read original + manual, plan written. Building src parts.
- 21:21 Brad: "The standard is always Baltimore and turtles 3d and cel city." Studied live shots (qa/ref/m390.png, m1280.png):
  cel-shaded three.js (MeshToonMaterial 3-band + halftone, inverted-hull ink outlines), chunky italic outlined HUD (top-left chip,
  top-right name + skewed bar + round avatar badge), round coloured touch buttons + floating stick, big outlined banners.
  DECISION: switch rendering from painted Canvas2D to 2.5D three.js cel-shading (same r160 module build as Cel City, shipped beside
  index.html), reusing Cel City's toon material/outline/skeleton approach; event sims stay 2D (x,y) in units, S=0.03 m/unit.
  H 16-bit toggle = low-res render target + 32-colour palette snap pass. QA chrome: PLAYWRIGHT_BROWSERS_PATH=/workspace/work/freeze_test/pw-browsers
  LD_LIBRARY_PATH=/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu, under the chrome flock.
- 22:00-23:15 All 6 events built (sim + cel 3D scene + bot + HUD), podium/champion, menus. Headless logic harness qa/sim.js
  (stubbed THREE/DOM, runs an event with the bot in <1 s) + qa/trace.js used to tune bots/physics. Bot results (perfect-ish play):
  halfpipe ~26.7k, footbag ~8.5k, surf ~1.5-1.7k (3 rides, waves close out at 26 s), skating ~3.9k (finish), BMX ~13.2k (finish 71 s), disk ~1.3k.
  CPU pars set ~55-90% of bot: 11000/5000/1050/2500/9000/1150. Fixes from QA: surf start pearl, air horizontal velocity locked at launch,
  footbag kick windows widened (were ~60 ms), BMX/skating courses lengthened to ~70 s, halfpipe wobble 680.
  Browser QA: qa/run.sh (foreground) / qa/bg.sh (background, poll qa/logs) — chrome lock is heavily shared.
  Brad 22:36: cut a 1080x1920 Short from QA captures → qa/capshort.js (432x768 @2.5x, slow game-time frames) → shorts/.
- 04:45-05:20 (Oct 14) final pass: qa/final.js at 390x844 touch (attract, menu, ready card, surf x4, 16-bit, podium) — 0 console errors;
  READY_LEAK check: after attract→menu→LET'S GO, ready state In.held=[] ax=ay=0 (no bot leak). Surf wave reads (lip + face visible 2-8 s).
  Fixed portrait podium: canvas "TROPHIES" title overlapped the sign and sponsor labels collided → portrait shows names + score only (table has sponsors).
  Thumb: qa/thumb-src.png (half-pipe aerial, 1280) → thumbs/socal-summer-games-plus.webp.
  Published with push-hawk.sh + merge.py (flock demos/.edit.lock): Hawk main 9ed8893, entry before socal-summer-games; local demos/site + src updated.
  No Short (sandbox overloaded).
