# Shell Shock Live trailer v2 (cabinet cut, real-play bot) — NOTES

Task: rebuild shellshock-trailer.surge.sh. Filmed inside the mobile arcade cabinet (portrait), joystick/buttons in sync with bot inputs,
no-cheat bot (spacing, retreats left/centre, jumps/dodges telegraphs, boss fought mid-screen), all 15 levels + Super Shredder phase 2,
current art. Old pipeline (reference only, untouched): /workspace/work/ss_trailer.

## Log
- 17:02 ET: started. Reference images: NOTE the assignment had them swapped — IMG_8824.jpeg is actually the old trailer page (Cold Front pinned right),
  IMG_8827.jpeg is the cabinet screen recording (SHELL SHOCK marquee, pipe/turtle bezel, joystick + ATTACK/JUMP/SPECIAL).
- Private dev copy of the game: trailer_v2/game_dev (copied from deploy/shell-shock-live-action at 17:01 ET). Final capture will use a fresh copy.
- 17:05 ET: cabinet rig = compositor from the game's OWN cabinet DOM (ref.js): portrait 720x1280 viewport of the mobile cabinet page
  (marquee + pipe/turtle bezel + control panel). Shots: canvas black + white (recovers the CRT overlay exactly: out = black + game*(white-black)),
  9 joystick tilt states (game's own transform `rotate(dx*22deg) translateY(dy*2%) scaleY(1-0.12dy)` on #stick) and each button's own
  pressed state (.on on #cap-x/#ring-x/#fx-x). Per frame the logged bot input picks the stick state + pressed caps; a trailer-only additive
  colour glow is added on lit buttons (the game's own lit ring is faint). Capture CSS (copy only): transitions off, fullscreen/trailer buttons hidden.
- 17:15 ET: capture2.js bot: key events only (no hp clamp, no forced KOs, no teleports, no state writes). Infinite lives (x∞) are a game rule,
  so deaths just tag in. Boss logic: hold left-centre so the boss (which closes to ~46px) stands at screen centre; engage in walk/hurt windows,
  3-hit combo then step back; dodge tele/charge by changing lane or hopping, kick windups by backing off/jumping, slam: run from target and jump the ring,
  shots: hop at <13 frames or change lane; lobbed arcs: step off the landing spot. Taps held 3 frames (J and K never overlap = no accidental SPECIAL).
- 17:20 ET: GAME BUG found (not fixed, game files untouched): Donny's SPECIAL landing (specialLand, index.html ~l.3323) pushes a ring fx with t:-6;
  drawStage ring branch then calls ctx.ellipse with a negative radius -> IndexSizeError -> frame() throws before requestAnimationFrame -> the game
  FREEZES. Repro: play as DONNY, use SPECIAL. Bot avoids Donny's special.
- 17:35 ET: meta-only test runs (fast) on the dev copy: ALL 15 levels cleared by real play, incl. SHREDDER -> SUPER SHREDDER phase 2 (test/levelN).
- 17:45 ET: determinism attempt (seeded Math.random, asset-load pausing) still diverged after ~100 s in L6 (3 tries) -> dropped per loop rule;
  instead "adaptive" saving: only frames the edit can use are rasterized+saved (card, capped wave fights, boss intro, boss centred frames (sx 80-304, cap),
  all frames from <35% boss HP through KO/cutscene, results). The game canvas is only rasterized when read, so this is the speed win.
- 18:00 ET: dev cabinet capture of L6 (adaptive, 3746 saved frames, 6 min) + build2.py edit validated: level6.mp4 8.0 s portrait 720x1280,
  stick/buttons in sync, contact sheet boss centred in all frames. Pipeline: lane.sh/final.sh (capture), build2.py (edit), make_page2.py (page).
- 18:04 ET: deploy folder still being edited by art workers (index.html 22:01 UTC). Running meta-only regression of the bot on a fresh copy (reg/) while waiting.
- 18:05 ET: regression (meta-only) on a fresh copy of the deploy (reg/): all 15 levels cleared incl. SUPER SHREDDER phase 2.
- 18:09 ET: FINAL capture started: fresh copy of deploy/shell-shock-live-action -> final_game (snapshot 18:09 ET), served :8776 from serve_final,
  cabinet refs ref_final, captures raw_final/levelN via final.sh (2 lanes, resumable lane.sh). Art workers were still touching
  index.html / level11 props at snapshot time; at the end I diff final_game vs deploy and recapture any level whose files changed.
- 18:30 ET: final L1 (7.6 min) and L15 (12.7 min, SHREDDER + SUPER SHREDDER phase 2) captured; L1 mini-movie check (chk_out/) looks right.
- 18:45 ET: system load ~10 (other workers); L4 took 18 min. From L11/L2 onward (levels launched after this) caps reduced: wave frames 900, boss-centred 1800, KO run from <25% HP (was 1500/2600/35%).
- 18:52 ET: sandbox restart killed lanes mid L11/L2; relaunched final.sh (resumes, skips the 5 finished levels).
- 19:40 ET: all 15 levels captured (raw_final). Building L7 mini, stills, full cut + contact sheet (build_final.sh).
- 19:50 ET: contact sheet v1: L5/L9/L10 KO landed near the edge (Grimwale sx94, Karai charge to sx355, Armaggon sx50). Edit fix: KO slow-mo only when the boss is centred through the KO; otherwise the closing shot is the last centred exchange (no edge shots). Rebuilding 5/9/10 + stills + full.
- 2026-10-08 19:57 ET (session 2): RECAPTURE for the final game build (freeze fix, painted themed enemies all levels, painted props L2-13, new L13 bg).
  numpy reinstalled. Bot: Donny's SPECIAL re-enabled (canSpecial = any bro; game fix verified: ring radius Math.max(0,k)). Old logs -> logs/old_v1.
  Cleared final_game/serve_final/ref_final/raw_final/out_final; fresh snapshot == deploy (diff clean). final.sh relaunched (2 lanes, 2 CPUs).
  build_final.sh now builds ALL level minis (was 5 9 10 only).
- 20:20 ET: NEW PAGE REQUIREMENT: hero video plays inside the game's own cabinet as HTML/CSS (cabinet_special.png art + stick.png + the game's
  x-cap/x-ring/x-fx DOM & CSS), <video> fills exactly #screen (23.72/34.41/53.41/17.83 %). build2.py `screen` mode renders the same full-cut
  timeline screen-only (1068x770 = #screen box at 2x, game canvas letterboxed as the game draws it, no cabinet) -> out/full_screen.mp4 +
  full_screen_inputs.json (one char per video frame, chr(48+v), v=(dx+1)*3+(dy+1)+9*(a+2b+4p)). Every render also writes <name>_inputs.json.
  Page JS drives stick transform + .on classes via requestVideoFrameCallback (rAF/timeupdate fallback). autoplay muted loop playsinline,
  TAP FOR SOUND button. Cabinet-baked full cut + level minis stay as downloads/section videos. Backups: build2.py.bak_precab, make_page2.py.bak_precab.
- 20:39 ET: sandbox restart killed L7 mid-capture (14/15 done); numpy reinstalled, final.sh relaunched (resumes L7 only).
- 20:47 ET: restart also wiped Playwright chromium; reinstalled (npx playwright install chromium; host-validation warning is harmless). Relaunched final.sh for L7.
- 21:00 ET: contact v2: only L3 GULCH GATOR phase-2 flagged (sx 93): boss hugs the left wall all phase 2 except the last ~55 frames before KO. Bug in boss_window: frame predicate used hi-length (excluded the final stretch). Fixed to per-frame lo<=i<=hi. Rebuilding all.
- 21:25 ET: another sandbox restart (npx cache gone). surge CLI now installed in trailer_v2/surge_cli (persistent); deploy via deploy_surge.sh. Local iPhone test needs Range server (rangeserve.py) — python http.server can't seek.
- 22:05 ET: user: trailer must never expand out of cabinet. Locked hero+minis: no native controls/fullscreen/PiP/AirPlay, hero pointer-events:none (taps = sound toggle), minis tap play/pause, webkitbeginfullscreen -> exit. Deployed, curl md5 b0b44ae9. Backup index.html.bak_prefs. Keep this in any rebuild (make_page2.py not yet updated).
- 22:20 ET: CABINET MATCH: hero = the game's own cabinet exactly as shellshock-live lays it out in portrait "normal" mode. cab/cabinet_special.png (RGBA, from live game;
  cabinet.jpg dropped) + game's #cab/#screen/x-cap/x-ring/x-fx/x-stick CSS verbatim (fx glow .48 like the game, was .75) + game fit in a viewport-tall #hero:
  S=min(vw/470,vh/900), left=(vw-470S)/2-150S, top=(vh-900S)/2-140S, --row=canvasH/224. Refit only on width change / big height change (Safari toolbar ignored).
  Title header + rest of page below the hero. Implemented as cabmatch.py finalize() (also re-applies the 22:05 video lock) — called at the end of make_page2.py,
  or `python3 cabmatch.py site_final/index.html`. Verified WebKit iPhone14 390x844: #cab/#screen/stick/caps rects identical to the game to 0.01px
  (cabtest.js, uses pw_new/ = playwright 1.64 + webkit, launch with env proxy + bypass 127.0.0.1). Side-by-side pagetest/cab_match.png. Backups *.bak_precabmatch.
- 22:35 ET: user: ONLY the hero is in the cabinet. Level clips + stills are game-only: build2.py new mode `game` (build_game.sh [levels]) renders level clips + stills
  from the raw captures at 1068x624 (game canvas only, 2x, no cabinet/no letterbox) -> out_final/out/game/levelN.mp4(+jpg,_inputs) and out_final/screens/game/levelN/*.jpg,
  manifest levels[N].game_video/game_stills. make_page2.py prefers game_* (minis crf23/2400k, stills full-res + 360px thumbs), page shows them at 1068/624 aspect
  (cabmatch GAME_ONLY_CSS). Backup build2.py.bak_pregame. Inline lock unchanged (no fullscreen/PiP).
- 22:55 ET: site_final regenerated by make_page2.py (out_final -> site_final, CNAME + index backups copied in; previous dir kept as site_final_old_pregame).
  Verified local + LIVE in WebKit iPhone14 390x844: cabinet rects == game, neutral-input hero vs game title differs in 945 px (edge AA) outside screen/game-only UI pills;
  hero video inline+autoplay, stick/buttons animate; 15 minis 1068x624 at 1.712 aspect, inline (no fs/PiP); 115 stills 1068x624 + 360x210 thumbs. Side-by-side pagetest/cab_match.png.
  Deployed: live index md5 9809c584e8d965e7cb26e210452d3694 == local; v/full_screen.mp4 200 (Range 206), level clips/stills/cab art 200 with matching sizes.
  Note: plain `make_page2.py` rmtree's DEP and does not write CNAME — copy CNAME back (surge deploy target is passed explicitly anyway).
- 2026-10-09 12:2x ET: added lazy THE CAST + PAINTED VS 16-BIT sections after THE LEVELS guide (site_final/index.html + site_final/sprites.json).
  Source in sprites_patch/ (sprites.css/html/js); pre-change page = sprites_patch/index.html.bak_presprites. make_page2.py does NOT include them:
  after regenerating the page run `python3 sprites_patch/apply.py`. Test: sprites_patch/test.js (WebKit, local rangeserve on :8791; sprite PNGs routed to /workspace/work/sprites/out since sandbox WebKit has no TLS). Deployed + verified.
- 2026-10-09 ~14:00 ET: jump-to section index (TRAILER / LEVEL MOVIES / THE LEVELS / THE CAST / PAINTED VS 16-BIT) directly under the top PLAY NOW,
  smooth scroll with a settle/correct loop (lazy CAST build shifts #versus). Source: sprites_patch/secindex.py (idempotent; also re-applies the
  #fullplay in-cabinet Full trailer link, which make_page2.py does not generate). apply.py now runs it automatically, also when sprites are already applied.
  Same script was run on g16js/trailer/index.html and both aistudio-games home copies. Tests: /workspace/work/hubtest/home_test.js (env: hubtest/env.sh).
