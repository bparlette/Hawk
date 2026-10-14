#!/usr/bin/env python3
"""Generate the HyperFrames composition trailer/index.html for the GULF THUNDER trailer."""
import json

DUR = 50
# (id, src, start, dur, zoom)  zoom = brawl stages get a slow push toward the fighters
SHOTS = [
    ("sunset", "clips/sunset.mp4", 0, 4, 0),
    ("s1a", "clips/s1a.mp4", 6, 2, 0), ("s1b", "clips/s1b.mp4", 8, 2, 0),
    ("s4a", "clips/s4a.mp4", 12, 2, 0), ("s4b", "clips/s4b.mp4", 14, 2, 0),
    ("s2a", "clips/s2a.mp4", 16, 2, 1), ("s2b", "clips/s2b.mp4", 18, 2, 1),
    ("s3a", "clips/s3a.mp4", 20, 2, 0), ("s3b", "clips/s3b.mp4", 22, 2, 0),
    ("s5a", "clips/s5a.mp4", 26, 2, 1), ("s5b", "clips/s5b.mp4", 28, 2, 1),
] + [(f"m{i+1}", f"clips/m{i+1}.mp4", 30 + i * 0.5, 0.5, 0) for i in range(8)] + [
    ("s5c", "clips/s5c.mp4", 34, 2, 1),
    ("endbg", "clips/endbg.mp4", 42, 8, 0),
]
# full-screen art backgrounds for title cards (no white-hotel art anywhere)
ARTS = [
    ("art-gulf", "img/boat-painted-crop.jpg", 4, 2),
    ("art-kasbah", "img/souk.png", 10, 2),
    ("art-crew", "img/chase.jpg", 24, 2),
    ("art-logo", "img/boat-16bit-crop.png", 36, 6),
]
CALLOUTS = [("co1", "BOAT CHASES", 6.1), ("co2", "ROOFTOP SHOOTOUTS", 12.1), ("co3", "BEACH BRAWLS", 16.1),
            ("co4", "JET-SKI CHASES", 20.1), ("co5", "STUNT SHOWDOWNS", 26.1)]
BIG_HITS = [4, 10, 24, 34.17, 36, 42]
SMALL_HITS = [6, 8, 12, 14, 16, 18, 20, 22, 26, 28] + [30 + i * 0.5 for i in range(8)] + [35.5]

h = []
for sid, src, st, d, z in SHOTS:
    h.append(f'''      <div class="vw" id="w-{sid}"><video id="v-{sid}" class="clip shot" src="assets/{src}" muted playsinline data-start="{st}" data-duration="{d}" data-track-index="0"></video></div>''')
for aid, src, st, d in ARTS:
    h.append(f'''      <div class="clip art" id="{aid}" data-start="{st}" data-duration="{d}" data-track-index="1"><img class="artimg" id="{aid}-img" src="assets/{src}" alt="" /><div class="shade"></div></div>''')

h.append('''      <div class="clip layer" id="cold" data-start="0" data-duration="4" data-track-index="2">
        <div class="pix cold-line" id="cold1">SUNSET KEY, GULF OF MEXICO</div>
        <div class="pix cold-line red" id="cold2">THE RED TIDE WANTS IT ALL.</div>
      </div>
      <div class="clip layer card" id="card-gulf" data-start="4" data-duration="2" data-track-index="2">
        <div class="chrome big" id="gulf-t1">FROM THE</div><div class="chrome huge" id="gulf-t2">GULF...</div>
      </div>
      <div class="clip layer card" id="card-kasbah" data-start="10" data-duration="2" data-track-index="2">
        <div class="chrome big" id="kas-t1">TO THE</div><div class="chrome huge" id="kas-t2">KASBAH...</div>
      </div>
      <div class="clip layer card" id="card-crew" data-start="24" data-duration="2" data-track-index="2">
        <div class="chrome huge2" id="crew-t1">STORM STERLING</div>
        <div class="chrome big" id="crew-t2">&amp; MAC</div>
        <div class="pix crew-sub" id="crew-t3">ABOARD THE THUNDERHEAD</div>
      </div>''')
for cid, txt, st in CALLOUTS:
    h.append(f'''      <div class="clip layer" id="{cid}" data-start="{st}" data-duration="1.8" data-track-index="3"><div class="callout" id="{cid}-box"><span class="pix callout-txt">{txt}</span></div></div>''')
h.append('''      <div class="clip layer" id="logo" data-start="36" data-duration="6" data-track-index="3">
        <svg id="bolt" viewBox="0 0 200 400" width="560" height="1120"><polygon points="120,0 30,220 95,220 60,400 175,150 108,150 150,0" fill="#ffd848" stroke="#1a0820" stroke-width="10" stroke-linejoin="round"/></svg>
        <div id="logo-box">
          <div class="logo-word" id="logo-gulf">GULF</div>
          <div class="logo-word" id="logo-thunder">THUNDER</div>
        </div>
        <div class="pix tag" id="logo-tag">AN ORIGINAL 16-BIT ACTION HOMAGE</div>
      </div>
      <div class="clip layer" id="endcard" data-start="42" data-duration="8" data-track-index="3">
        <div class="end-logo" id="end-logo">GULF THUNDER</div>
        <div class="playfree" id="end-play">PLAY FREE</div>
        <div class="pix url" id="end-url">gulf-thunder.surge.sh</div>
        <div class="pix endsub" id="end-sub">5 STAGES · PHONE OR DESKTOP</div>
      </div>''')

tl = []
A = tl.append
# cold open
A('tl.fromTo("#w-sunset", {scale:1.12}, {scale:1.0, duration:4, ease:"none"}, 0);')
A('tl.fromTo("#cold1", {opacity:0, y:20}, {opacity:1, y:0, duration:0.6, ease:"steps(6)"}, 0.4);')
A('tl.fromTo("#cold2", {opacity:0, y:20}, {opacity:1, y:0, duration:0.6, ease:"steps(6)"}, 2.0);')
A('tl.to("#cold", {opacity:0, duration:0.25}, 3.7);')
# title cards: slam in
for card, t1, t2, st in [("card-gulf", "#gulf-t1", "#gulf-t2", 4), ("card-kasbah", "#kas-t1", "#kas-t2", 10)]:
    A(f'tl.fromTo("{t1}", {{scale:2.6, opacity:0}}, {{scale:1, opacity:1, duration:0.22, ease:"power4.in"}}, {st});')
    A(f'tl.fromTo("{t2}", {{scale:3.2, opacity:0}}, {{scale:1, opacity:1, duration:0.25, ease:"power4.in"}}, {st + 0.35});')
    A(f'tl.to("{t2}", {{scale:1.08, duration:1.3, ease:"none"}}, {st + 0.6});')
for aid, _, st, d in ARTS:
    A(f'tl.fromTo("#{aid}-img", {{scale:1.0}}, {{scale:1.12, duration:{d}, ease:"none"}}, {st});')
A('tl.fromTo("#crew-t1", {x:-1200}, {x:0, duration:0.3, ease:"power3.out"}, 24.0);')
A('tl.fromTo("#crew-t2", {x:1200}, {x:0, duration:0.3, ease:"power3.out"}, 24.4);')
A('tl.fromTo("#crew-t3", {opacity:0}, {opacity:1, duration:0.4, ease:"steps(4)"}, 24.9);')
# brawl push-ins
for sid, src, st, d, z in SHOTS:
    if z:
        A(f'tl.fromTo("#w-{sid}", {{scale:1.18}}, {{scale:1.34, duration:{d}, ease:"none"}}, {st});')
# callouts: 16-bit slide from left in steps, hold, wipe out right
for cid, txt, st in CALLOUTS:
    A(f'tl.fromTo("#{cid}-box", {{x:-1100}}, {{x:0, duration:0.25, ease:"steps(5)"}}, {st});')
    A(f'tl.fromTo("#{cid}-box", {{scale:1}}, {{scale:1.06, duration:0.12, yoyo:true, repeat:3, ease:"steps(1)"}}, {st + 0.3});')
    A(f'tl.to("#{cid}-box", {{x:1100, duration:0.2, ease:"steps(4)"}}, {st + 1.55});')
# logo slam
A('tl.fromTo("#logo-box", {scale:4, opacity:0}, {scale:1, opacity:1, duration:0.3, ease:"power4.in"}, 36.0);')
A('tl.fromTo("#bolt", {opacity:0, scale:0.6}, {opacity:1, scale:1, duration:0.12, ease:"none"}, 36.3);')
A('tl.to("#bolt", {opacity:0.25, duration:0.08, yoyo:true, repeat:5, ease:"steps(1)"}, 36.45);')
A('tl.to("#logo-box", {scale:1.06, duration:5.2, ease:"none"}, 36.6);')
A('tl.fromTo("#logo-tag", {opacity:0, y:30}, {opacity:1, y:0, duration:0.5, ease:"steps(5)"}, 38.4);')
A('tl.to("#logo", {opacity:0, duration:0.2}, 41.8);')
# end card
A('tl.fromTo("#end-logo", {opacity:0, y:-60}, {opacity:1, y:0, duration:0.35, ease:"power3.out"}, 42.1);')
A('tl.fromTo("#end-play", {scale:3, opacity:0}, {scale:1, opacity:1, duration:0.25, ease:"power4.in"}, 42.6);')
A('tl.fromTo("#end-url", {opacity:0}, {opacity:1, duration:0.5, ease:"steps(5)"}, 43.3);')
A('tl.fromTo("#end-sub", {opacity:0}, {opacity:1, duration:0.5, ease:"steps(5)"}, 44.0);')
A('tl.to("#end-play", {scale:1.07, duration:0.25, yoyo:true, repeat:9, ease:"sine.inOut"}, 45.0);')
A('tl.to("#fade", {opacity:1, duration:1.2, ease:"none"}, 48.8);')
# flashes + shakes on the hits
for t in BIG_HITS:
    A(f'tl.fromTo("#flash", {{opacity:0.9}}, {{opacity:0, duration:0.3, ease:"power2.out"}}, {t});')
    A(f'tl.fromTo("#stage", {{x:-18, y:12}}, {{x:0, y:0, duration:0.35, ease:"elastic.out(1.2,0.3)"}}, {t});')
for t in SMALL_HITS:
    A(f'tl.fromTo("#flash", {{opacity:0.45}}, {{opacity:0, duration:0.12, ease:"power1.out"}}, {t});')

import re
_first = {}
for i, l in enumerate(tl):
    m = re.match(r'tl\.fromTo\("([^"]+)",.*, ([0-9.]+)\);$', l)
    if m:
        tg, pos = m.group(1), float(m.group(2))
        if tg not in _first or pos < _first[tg][1]: _first[tg] = (i, pos)
for i, l in enumerate(tl):
    m = re.match(r'tl\.fromTo\("([^"]+)",.*, ([0-9.]+)\);$', l)
    if m and (_first[m.group(1)][0] != i or m.group(1) in ('#flash', '#stage')):
        j = l.rfind('}')
        tl[i] = l[:j] + ', immediateRender:false' + l[j:]
html = f'''<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face {{ font-family: "Anton"; src: url("assets/fonts/Anton.ttf"); }}
      @font-face {{ font-family: "Bungee"; src: url("assets/fonts/Bungee.ttf"); }}
      @font-face {{ font-family: "PressStart"; src: url("assets/fonts/PressStart2P.ttf"); }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 1080px; height: 1920px; overflow: hidden; background: #000; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; background: #000; }}
      #stage {{ position: absolute; inset: 0; }}
      .vw {{ position: absolute; inset: 0; transform-origin: 50% 82%; }}
      .shot {{ position: absolute; inset: 0; width: 1080px; height: 1920px; object-fit: cover; image-rendering: pixelated; }}
      .art {{ position: absolute; inset: 0; overflow: hidden; }}
      .artimg {{ position: absolute; inset: 0; width: 1080px; height: 1920px; object-fit: cover; display: block; }}
      .shade {{ position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,4,20,0.55) 0%, rgba(10,4,20,0.15) 40%, rgba(10,4,20,0.65) 100%); }}
      .layer {{ position: absolute; inset: 0; }}
      .pix {{ font-family: "PressStart", monospace; color: #fff; text-shadow: 5px 5px 0 #1a0820; }}
      .cold-line {{ position: absolute; left: 0; right: 0; text-align: center; font-size: 34px; line-height: 1.3; }}
      #cold1 {{ top: 300px; color: #ffe9b0; }}
      #cold2 {{ top: 380px; }}
      .red {{ color: #ff5a4a; }}
      .card {{ display: flex; flex-direction: column; align-items: center; justify-content: center; }}
      .chrome {{ font-family: "Anton", sans-serif; text-transform: uppercase; line-height: 0.95; text-align: center;
        background: linear-gradient(180deg, #ffffff 0%, #cfe8ff 38%, #4a5a7a 50%, #ffd27a 62%, #ff6a2a 100%);
        -webkit-background-clip: text; background-clip: text; color: transparent;
        -webkit-text-stroke: 4px #1a0820; filter: drop-shadow(10px 10px 0 #c8102e) drop-shadow(0 0 30px rgba(0,0,0,0.6)); }}
      .big {{ font-size: 150px; letter-spacing: 6px; display: block; }}
      .huge {{ font-size: 250px; letter-spacing: 4px; display: block; }}
      .huge2 {{ font-size: 150px; letter-spacing: 2px; display: block; }}
      .crew-sub {{ margin-top: 50px; font-size: 32px; color: #ffd848; display: block; }}
      .callout {{ position: absolute; left: 60px; right: 60px; top: 1120px; padding: 34px 20px; background: #c8102e;
        border: 8px solid #ffd848; box-shadow: 14px 14px 0 #1a0820; text-align: center; }}
      .callout-txt {{ font-size: 50px; line-height: 1.2; color: #fff; display: block; }}
      #bolt {{ position: absolute; left: 260px; top: 380px; }}
      #logo-box {{ position: absolute; left: 0; right: 0; top: 640px; text-align: center; }}
      .logo-word {{ font-family: "Bungee", sans-serif; display: block; line-height: 1; text-align: center;
        background: linear-gradient(180deg, #ffffff 0%, #a8d8ff 30%, #2a3a6a 50%, #ffe08a 56%, #ff8a2a 80%, #c8102e 100%);
        -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-stroke: 5px #1a0820;
        filter: drop-shadow(12px 12px 0 #1a0820) drop-shadow(0 0 40px rgba(255,120,40,0.55)); }}
      #logo-gulf {{ font-size: 280px; letter-spacing: 10px; }}
      #logo-thunder {{ font-size: 170px; letter-spacing: 2px; }}
      .tag {{ position: absolute; left: 0; right: 0; top: 1290px; text-align: center; font-size: 30px; color: #ffd848; }}
      .end-logo {{ position: absolute; left: 0; right: 0; top: 200px; text-align: center; font-family: "Bungee", sans-serif; font-size: 112px; line-height: 1;
        background: linear-gradient(180deg, #ffffff 0%, #a8d8ff 35%, #2a3a6a 50%, #ffe08a 56%, #ff8a2a 85%);
        -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-stroke: 4px #1a0820; filter: drop-shadow(8px 8px 0 #1a0820); }}
      .playfree {{ position: absolute; left: 0; right: 0; top: 400px; text-align: center; font-family: "Bungee", sans-serif; font-size: 150px; line-height: 1;
        color: #ffd848; -webkit-text-stroke: 5px #1a0820; filter: drop-shadow(10px 10px 0 #c8102e); }}
      .url {{ position: absolute; left: 0; right: 0; top: 625px; text-align: center; font-size: 42px; color: #fff; }}
      .endsub {{ position: absolute; left: 0; right: 0; top: 1730px; text-align: center; font-size: 26px; color: #ffe9b0; }}
      #flash {{ position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }}
      #fade {{ position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
      <div id="stage">
{chr(10).join(h)}
      </div>
      <audio id="music" src="assets/music.wav" data-start="0" data-duration="{DUR}" data-track-index="9" data-volume="1"></audio>
      <div id="flash"></div>
      <div id="fade"></div>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      {chr(10).join("      " + l for l in tl).lstrip()}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''
open("trailer/index.html", "w").write(html)
print("wrote trailer/index.html", len(html), "bytes;", len(SHOTS), "shots")
