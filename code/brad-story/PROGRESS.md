# Paradise Thunder — progress
Note: generate_image has no size control; outputs are 848x1264 (2:3) and 720x1456 for the tall flyover. Upscaled in the edit.
Refs cropped to refs/ (brad.jpg, jon.jpg, dave.jpg from IMG_1688; phone UI cropped from screenshots).
- p00_flyover.png (720x1456) — OK: pink house, pool+palms, dock+pontoon, canal, Gulf sunset. No text.
- p01_captain_load.png — OK: big blond horseshoe mustache captain, red/yellow bandana, yellow tank, shades; Hawaiian-shirt partner; black/chrome twin hull. Likeness NOT refused.
- p02_speedboat_gulf.png — OK: pink Don on horizon, boat with spray.
- p03_pool.png v1 — Jon painted with a beard (ref is clean-shaven); retry 1 queued.
- p03_pool.png v2 — OK: Brad (bottom-left, beard), Jon (center, clean-shaven, silver), Dave (right, grin), both dogs on deck. v1 kept as _p03_pool_v1.png.
- p04_boarding.png — OK: white pontoon w/ black T-top, Jon at helm (light-blue tee), Brad grey hoodie + cooler, Dave white tee/red shorts hopping aboard.
- p04b_dogs_left.png — OK (Brad's addition): yellow lab + black dog forlorn on dock, pontoon pulling away, guys waving.
- p05_boat_ride.png — OK: selfie-style, Brad front, Jon middle, Dave back, wake behind.
- p06_golfcart.png — OK: Jon driving, Brad passenger, Dave standing on back fist up, pink Don ahead.
- p07_meet.png — OK: thatched bar, captain + partner meet the three, Brad/Jon handshake, pink Don behind.
- p08_shots v1 — only 4 people/4 glasses (Dave missing); retry 1 queued. (_p08_shots_v1.png)
- p09_standoff v1 — captain's bandana has letter-like marks; retry 1 queued. (_p09_standoff_v1.png)
- p08_shots.png v2 — OK: all five, glasses clinking, pink Don behind.
- p09_standoff.png v2 — OK (plain bandana, captain cupping ear, 4 thugs, stools knocked). Minor: Jon got light stubble.
- p10_brawl.png — OK: captain slams thug on breaking table, Brad punching, Jon tackling, partner flying kick, Dave at bar. Chaotic but anatomy reads.
- p11_aftermath.png — OK: thugs in a heap, five arm-in-arm laughing, captain flexing, pink Don.
- p12_endcard.png — OK: five from behind on the beach, black speedboat + white pontoon offshore, pink Don glowing, open sky for title.
All 14 panels done (p00..p12 incl. p04b). Next: music + HyperFrames.
- music.wav generated (36.5 s, original numpy synth: 120 BPM synthwave pads/arp + distorted power-chord guitar, whip + impact hits at 27.5–29.6 s)

## Revision 2 (poster wardrobe) — 15:15
Poster refs: refs/poster_top.jpg (title cropped off; captain+partner+heads), refs/poster_captain.jpg (child greyed out). refs/trio.jpg = Brad|Jon|Dave crops side by side.
v1 captain panels archived in panels/_v1/. Regenerating p01, p07–p12 (p02 kept: captain not visible).
HyperFrames: `browser ensure` failed — Chrome Headless Shell unavailable on linux arm64 and apt needs root (attempt 1).
- p01 r2 v1 — poster wardrobe right but "THUNDER" lettering baked on hull + explosion; rejected (_rejects/). Retry 2 generated.
- p08_shots.png r2 — OK: poster captain (blue bandana, open white shirt, chain, watch), straw-hat partner, trio, bikini crowd cheering. Kept as the toast panel.
- p09_standoff.png r2 — OK: poster wardrobe, cupped ear, thugs, bikini women ducking drinks.
- p07 r2 v1 — no bartender (Brad added her after), captain double-watch/odd hands; regenerated with bartender.
- p01_captain_load.png r2 v2 — OK: poster-accurate captain (blue bandana, open white sleeveless, chain, watch, neon board shorts) + straw-hat partner, blank hull, red cooler.
- p07_meet.png r2 v2 — OK: brunette bartender at bar (left), captain–Brad handshake, partner back-slaps Jon (Jon seen from behind), Dave laughing, bikini crowd, pink Don.
- p08a_shot_slide.png (gag 4) — OK: bartender slides shots, Jon catches without looking, Brad/Dave gape, captain laughing, girls cheering. Minor: more than five glasses; Dave's hair reads silver.
- p06b_cart_air.png (gag 7) — OK: cart launching off dune, Dave fists up yelling, pink Don behind.
- p07b v1 (gag 3) — reads well but a small child in background, captain holding hands with a girl, extra shirtless guy; rejected, retry 1.
- p07c_strikeout.png (gag 2) — OK: straw-hat partner finger-guns, polka-dot blonde walks past to Dave who waves.
- p09b_shirt_rip.png (gag 5) — OK: captain ripping white shirt, blue bandana, chain, watch, board shorts; girls cheering, thugs backing off.
- p11b_dogs_swam.png (gag 8) — OK: soaking wet lab + black dog trot in from water, everyone staring, wrecked bar.
- p07b_slowmo_walk.png v2 — OK: five walking toward camera, sun flare, bikini girls lowering sunglasses, pink Don, adults only. Small baked "TIKI BAR" sign patched out with PIL (original kept in _rejects/).
- p10_brawl.png r2 — OK: shirtless poster captain slams thug on table, Brad punching, Jon tackling, Dave flips one, straw-hat partner flying kick, girls ducking.
- p11_aftermath.png r2 — OK: thugs heaped, five arm-in-arm laughing, captain flexing in torn shirt, girls cheering. (a couple of tiny red specks near a thug's face, cartoonish)
- p12_endcard.png r2 — OK: five from behind incl. blue-bandana captain + straw hat, both dogs, black speedboat + pontoon, pink Don, open sky for title.
All panels final. Next: HyperFrames composition.
- music v2 (47.0 s) generated to video/pt/assets/music.wav from timeline.json; composition generated by video/gen.py → video/pt/index.html
- HyperFrames render attempt 1 (Playwright Chromium 129 via HYPERFRAMES_BROWSER_PATH): reached frame 281/1410 then got SIGTERM from my shell timeout (not detached). Re-running with setsid.
- attempt 2: killed again (render_cancelled_parent_exited) — sandbox can't keep background jobs past a 120 s command. Trying segmented capture + --resume in ≤110 s chunks.

## Revision 3 — character sheets (15:50)
Brad asked for locked character sheets before any more painting. Video render paused at chunked-HyperFrames setup (local hyperframes@0.8.145 installed in video/pt).
Sheets v1: jon, captain, lab, blackdog OK. Retrying: brad (tiny/photoreal figures), dave (hair came out silver like Jon), partner (4 views + stray props), bartender (baked "FACIAL REFERENCE" text; first bikini prompt was refused by content policy, so the bartender wears a knotted tropical shirt + tank + white shorts).
Sheets v2: brad (painted, knees-up, beard) OK; dave (sandy-blond, clean-shaven) OK; bartender (clean, no text) OK; partner v2 came out wide with tiny figures → cropped/upscaled to the two figures (original in characters/_rejects/).
characters/sheet_contact.png built (8 labeled cells). STOPPED here per Brad: awaiting approval before any new panels or video render.

## Revision 4 — sheet-matched repaints + final render (16:15–)
Character sheets approved by Brad as-is (untouched). Composite refs in _review/ (ref_trio.jpg = brad|jon|dave sheets, ref_capt_partner.jpg, ref_crew.jpg incl. bartender).
Repainted against sheets (old versions in panels/_v2/):
- p09_standoff — Jon clean-shaven, Brad likeness fixed.
- p08a_shot_slide — bartender in tied tropical shirt/tank/white shorts; Dave hair fixed to sandy-blond via follow-up edit (still >5 shot glasses, minor).
- p07b_slowmo_walk — Brad likeness; five heroes per sheets, adults only, no signage.
- p07_meet — bartender outfit per sheet (was bikini); Dave hair fixed via edit.
- p08_shots — close-up toast; Dave sandy-blond, Brad likeness.
- p05_boat_ride — selfie close-up; Brad/Jon/Dave per sheets.
- p06_golfcart, p06b_cart_air, p04_boarding, p07c_strikeout — Dave's silver hair → sandy-blond (+Brad face in p06/p04, partner face in p07c).
- p10_brawl — repainted per sheets (Dave sandy-blond). p10_whip.jpg regenerated (horizontal box blur r=45).
- p11_aftermath — repainted per sheets; red specks near thug face painted out. p11_gray.jpg regenerated (sepia L*(1,.93,.84), contrast 1.25).
Kept: p00, p01, p02, p03 (close-up, acceptable match), p04b, p09b, p11b, p12. Bubble tips re-checked against new compositions (_review/bubbles.jpg) — all still point at the right speaker.
Note: numpy vanished from system python mid-session; installed to brad-story/.pylib (export PYTHONPATH=/workspace/work/brad-story/.pylib).
Render: video/render_seg.sh (HF_SEGMENTED_CAPTURE=true, HF_SEGMENT_FRAMES=120 → 12×4 s segments, HYPERFRAMES_RENDER_DETACHED=1 to stop the parent-exit watchdog, --resume --keep-segments), launched via video/launch.sh (setsid nohup). Log: video/render_final.log. Segments: video/pt/renders/.hf-segments/<hash>/segment_000NN.mp4.
- Render try 1 (20:45): segments 0–4 came out washed out. Cause: the four `tl.fromTo("#flash",{opacity:X},…)` tweens immediate-rendered their FROM value (white flash ~0.9) when the timeline was built, and segmented capture seeks each fresh page straight to the segment start, so early segments never passed a tween that reset it. Fix in gen.py: flashes are now `tl.set(opacity X) + tl.to(opacity 0)` and the timeline opens with `tl.set` opacity 0 for #flash, #fadeout, #im_p11g. Old gen.py kept as video/gen_v3_backup.py.
- Render try 2 (21:00–21:10): all 12 segments clean. Contact check found the p02 THUNDER-NAV terminal line running off the right edge (spaces were &nbsp; so it never wrapped). Fixed in gen.py (normal spaces, white-space:normal); re-rendered and spliced in segment 1 only (4–8 s; the change touches nothing else).
- Final segments copied to video/segments_final/. Concat + music mux: video/finish.sh (launch: video/launch_finish.sh) → libx264 CRF 21 / maxrate 5.5M, yuv420p High, AAC 192k 48 kHz, faststart. It writes to /tmp first, then copies; writing the faststart trailer straight to /workspace failed twice with an I/O error.
- FINAL: /workspace/work/brad-story/paradise-thunder.mp4 — 1080x1920, H.264 High yuv420p + AAC, 47.0 s, 26.9 MB (26,864,213 bytes). Audio mean -19.9 dB, peak -1.2 dB.
- contact.png = 21 frames, one per scene at 75 % through it. Captions and bubbles are legible and nothing is cut off. Faces match the sheets. The p10 frame looks pale because it lands on a brawl impact flash at 37.45 s, which is intended.
- Known cosmetic quirk: while the p02 terminal is typing, the block cursor sits where the end of the untyped text will be, not right after the visible letters (about 1.6 s).

## Revision 5 — fast ffmpeg recut (22:12–22:25 UTC)
Brad switched mid-task from a HyperFrames re-render + new score to an ffmpeg-only recut. No re-render, no new music, no cursor fix.
- Backup of the previous final: paradise-thunder_v3.mp4 (47.0 s, 26.9 MB).
- Scene clips cut from v3 using timeline.json (frame-accurate), in video/cut4/ (plan.py → parts.json, cut.py). Bubble/text scenes (p02, p03, p05, p06, p06b, p07, p07c, p08a, p09, p10, p12) hold +1.0 s on a frozen frame (tpad clone). The freeze is on the last frame, except p12, which freezes at 2.6 s, before the fade to black. Note: tpad inside the trim pass did not extend; it had to be a second pass on each clip.
- New order: p00, p03, p04, p04b, p05, p06, p06b, p01, p02, p07, p07b, p07c, p08a, p08, p09, p09b, p10, p11b, p11, p12. THE END? card dropped.
- The captions are baked into the v3 render, so "MEANWHILE..." still sits on p03, now right after p00. Moving it to p01 would need a HyperFrames re-render.
- p07c repainted (Brad): straw-hat partner per char_partner.png, same pose and position, with about 6 adult women in beachwear around the bar. Old panel saved as panels/_v2/p07c_strikeout_v3.png/.jpg (panels/_v2/p07c_strikeout.png is the older r2 panel). New panel: panels/p07c_strikeout.png + video/pt/assets/img/p07c_strikeout.jpg. The first try (fewer women) is in panels/_rejects/p07c_strikeout_v4.png. The scene was rebuilt in PIL+ffmpeg (video/cut4/p07c.py), recreating the same Ken Burns move, vignette, bubble pop at 0.4 s, box and tail. It is 2.3 s + a 1 s hold. Its tail points at his hat, side-by-side checked against v3.
- Audio: the v3 music was cut at the same scene boundaries (video/cut4/audio.py → a_new.wav), so the brawl hits stay on their cuts. Each 1 s hold loops the last 1.0 s of its scene's audio (2 beats at 120 BPM), with 12 ms fades at the joins.
- Encode: video/cut4/finish4.sh → /tmp then copy; libx264 veryfast CRF 20 High yuv420p, AAC 192k 48 kHz, +faststart.
- FINAL v4: paradise-thunder.mp4 — 1080x1920, 56.8 s (1704 frames), 26.5 MB (26,543,229 bytes); audio 56.8 s. Scene times are in video/timeline_v4.json. contact.png was regenerated from it (one frame per scene at 75 %): order is correct, there is no THE END card, and the bubbles are legible. blackdetect finds only the intended final fade (56.63–56.77 s). Brightness spikes are single-frame flashes only.
