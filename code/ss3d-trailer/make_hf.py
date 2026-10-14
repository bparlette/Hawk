# make_hf.py -> hfproj/index.html (HyperFrames composition) from timeline.json
import json, sys, os, shutil
T = json.load(open('/workspace/work/ss3d-trailer/timeline.json'))
PARTS = [['title', 'brawl', 'manhole', 'skate', 'freeflow', 'exitsewer'], ['subway', 'elevator', 'roofleap', 'stealth', 'comic', 'oneshot'], ['van', 'daynight', 'fire', 'boss', 'win', 'end']]
PART = int(sys.argv[1]) if len(sys.argv) > 1 else None
if PART is not None: T['beats'] = [x for x in T['beats'] if x[0] in PARTS[PART]]
SUB = {'freeflow': 'CHAIN · COUNTER · TAKEDOWN', 'roofleap': 'CHASE CAM', 'comic': 'COMIC', 'oneshot': 'ONE-SHOT', 'stealth': 'SILENT TAKEDOWNS',
       'skate': 'WALL RIDES · KICKFLIPS', 'van': 'DRIFT · SMASH · HONK', 'daynight': 'NEON CITY AFTER DARK', 'subway': 'DODGE THE EXPRESS', 'elevator': 'RIDE TO THE ROOF',
       'exitsewer': 'CLIMB OUT ON BLOCK 2', 'boss': 'RAMROD', 'fire': 'SCORCHER', 'brawl': 'FREE-ROAM NYC', 'manhole': 'ONE MANHOLE AWAY', 'win': ''}
t = 0; vids = []; caps = []; tl = ['tl.set("#flash", {opacity: 0}, 0);']
total = sum(d for _, d, _ in T['beats'])
for k, (b, d, cap) in enumerate(T['beats']):
    s = round(t, 3)
    if b != 'end':
        vids.append(f'<div class="vw" id="w-{b}"><video id="v-{b}" class="clip shot" src="assets/clips/{b}.mp4" muted playsinline data-start="{s}" data-duration="{d}" data-track-index="0"></video></div>')
        if k > 0:
            tl.append(f'tl.fromTo("#w-{b}", {{scale: 1.045}}, {{scale: 1, duration: 0.32, ease: "power3.out"}}, {s});')
            tl.append(f'tl.fromTo("#flash", {{opacity: 0.75}}, {{opacity: 0, duration: 0.16, ease: "power1.out", immediateRender: false}}, {s});')
    if cap:
        sub = SUB.get(b, '')
        cid = f'cap-{b}'
        caps.append(f'<div class="clip capwrap" id="{cid}" data-start="{s + 0.08:.3f}" data-duration="{d - 0.12:.3f}" data-track-index="2"><div class="capbar" id="{cid}-bar"><span class="captxt">{cap}</span></div>' + (f'<div class="chip" id="{cid}-chip">{sub}</div>' if sub else '') + '</div>')
        a = s + 0.08
        tl.append(f'tl.fromTo("#{cid}-bar", {{x: -1400, skewX: -18}}, {{x: 0, skewX: -8, duration: 0.24, ease: "power4.out"}}, {a:.3f});')
        if sub: tl.append(f'tl.fromTo("#{cid}-chip", {{x: 1200}}, {{x: 0, duration: 0.24, ease: "power4.out"}}, {a + 0.12:.3f});')
        tl.append(f'tl.to("#{cid}-bar", {{x: 1500, duration: 0.18, ease: "power2.in"}}, {s + d - 0.26:.3f});')
        if sub: tl.append(f'tl.to("#{cid}-chip", {{x: -1500, duration: 0.18, ease: "power2.in"}}, {s + d - 0.26:.3f});')
    if b == 'title':
        tl.append('tl.fromTo("#logo", {scale: 2.4, opacity: 0}, {scale: 1, opacity: 1, duration: 0.45, ease: "back.out(1.6)"}, 0.1);')
        tl.append('tl.fromTo("#tag", {opacity: 0, y: 40}, {opacity: 1, y: 0, duration: 0.3}, 0.55);')
        tl.append('tl.to("#logo", {scale: 0.5, opacity: 0, y: -260, duration: 0.35, ease: "power2.in"}, 1.75);')
        tl.append('tl.to("#tag", {opacity: 0, duration: 0.2}, 1.75);')
        tl.append('tl.fromTo("#titledim", {opacity: 0.72}, {opacity: 0, duration: 0.4}, 1.75);')
    if b == 'end':
        tl.append(f'tl.fromTo("#flash", {{opacity: 0.9}}, {{opacity: 0, duration: 0.25, immediateRender: false}}, {s});')
        tl.append(f'tl.fromTo("#endlogo", {{scale: 1.8, opacity: 0}}, {{scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)"}}, {s + 0.05:.3f});')
        tl.append(f'tl.fromTo("#endplay", {{y: 80, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.3, ease: "power3.out"}}, {s + 0.35:.3f});')
        tl.append(f'tl.fromTo("#endurl", {{y: 80, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.3, ease: "power3.out"}}, {s + 0.5:.3f});')
        tl.append(f'tl.to("#endplay", {{scale: 1.06, duration: 0.1875, yoyo: true, repeat: 7, ease: "sine.inOut"}}, {s + 0.9:.3f});')
        endS, endD = s, d
    t += d
names = [x[0] for x in T['beats']]
TITLE = '''<div class="clip" id="titlecard" data-start="0" data-duration="2.3" data-track-index="1" style="position:absolute;inset:0">
        <div id="titledim"></div>
        <img id="logo" src="assets/img/logo.png" alt="SHELL SHOCK 3D" />
        <div id="tag">AN ORIGINAL 3D ARCADE BRAWLER</div>
      </div>''' if 'title' in names else ''
END = f'''<div class="clip" id="endcard" data-start="{endS}" data-duration="{endD}" data-track-index="1" style="position:absolute;inset:0">
        <img id="endbg" src="assets/img/endbg.png" alt="" />
        <img id="endlogo" src="assets/img/logo.png" alt="SHELL SHOCK 3D" />
        <div id="endplay"><span>PLAY FREE</span></div>
        <div id="endurl">shellshock-3d.surge.sh</div>
      </div>''' if 'end' in names else ''
AUDIO = f'<audio id="music" src="assets/music.wav" data-start="0" data-duration="{total}" data-track-index="9" data-volume="1"></audio>' if PART is None else ''
html = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face {{ font-family: "Bungee"; src: url("assets/fonts/Bungee.ttf"); }}
      @font-face {{ font-family: "Anton"; src: url("assets/fonts/Anton.ttf"); }}
      @font-face {{ font-family: "PressStart"; src: url("assets/fonts/PressStart2P.ttf"); }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 1920px; height: 1080px; overflow: hidden; background: #000; }}
      #root {{ position: relative; width: 1920px; height: 1080px; overflow: hidden; background: #000; }}
      .vw {{ position: absolute; inset: 0; transform-origin: 50% 30%; }}
      .shot {{ position: absolute; inset: 0; width: 1920px; height: 1080px; }}
      .capwrap {{ position: absolute; inset: 0; pointer-events: none; }}
      .capbar {{ position: absolute; left: 0; right: 0; top: 590px; margin: 0 auto; width: max-content; padding: 10px 46px 14px; background: linear-gradient(180deg, #e8202a, #a00818);
        border: 6px solid #111; box-shadow: 10px 10px 0 #111, 0 0 40px rgba(255,60,40,.45); transform: skewX(-8deg); }}
      .captxt {{ display: block; font-family: "Bungee", sans-serif; font-size: 68px; line-height: 1; color: #fff; letter-spacing: 2px;
        text-shadow: 4px 4px 0 #111, -2px -2px 0 #111, 2px -2px 0 #111, -2px 2px 0 #111; }}
      .chip {{ position: absolute; left: 0; right: 0; top: 700px; margin: 0 auto; width: max-content; padding: 8px 22px; background: #ffd23a; border: 4px solid #111;
        font-family: "PressStart", monospace; font-size: 22px; color: #111; box-shadow: 6px 6px 0 #111; }}
      #flash {{ position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }}
      #titledim {{ position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,.35), rgba(0,0,0,.85)); }}
      #logo {{ position: absolute; left: 50%; top: 170px; width: 1100px; margin-left: -550px; filter: drop-shadow(0 12px 0 #000) drop-shadow(0 0 40px rgba(120,255,120,.35)); }}
      #tag {{ position: absolute; left: 0; right: 0; top: 720px; text-align: center; font-family: "PressStart", monospace; font-size: 30px; color: #ffe27a; text-shadow: 4px 4px 0 #000; }}
      #endbg {{ position: absolute; inset: 0; width: 1920px; height: 1080px; object-fit: cover; filter: blur(6px) brightness(.45) saturate(1.2); transform: scale(1.06); }}
      #endlogo {{ position: absolute; left: 50%; top: 110px; width: 1000px; margin-left: -500px; filter: drop-shadow(0 12px 0 #000) drop-shadow(0 0 50px rgba(120,255,120,.4)); }}
      #endplay {{ position: absolute; left: 0; right: 0; top: 640px; text-align: center; }}
      #endplay span {{ display: inline-block; font-family: "Bungee", sans-serif; font-size: 92px; color: #fff; padding: 8px 48px 16px; background: linear-gradient(180deg, #e8202a, #a00818);
        border: 7px solid #111; box-shadow: 12px 12px 0 #111; transform: skewX(-8deg); text-shadow: 5px 5px 0 #111; }}
      #endurl {{ position: absolute; left: 0; right: 0; top: 830px; text-align: center; font-family: "PressStart", monospace; font-size: 44px; color: #ffd23a; text-shadow: 5px 5px 0 #000; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1920" data-height="1080">
      {chr(10).join('      ' + v for v in vids).strip()}
      {TITLE}
      {END}
      {chr(10).join('      ' + c for c in caps).strip()}
      <div class="clip" id="flashwrap" data-start="0" data-duration="{total}" data-track-index="3" style="position:absolute;inset:0;pointer-events:none"><div id="flash"></div></div>
      {AUDIO}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      {chr(10).join('      ' + x for x in tl).strip()}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''
H = '/workspace/work/ss3d-trailer/hfproj'
if PART is None: dst = H
else:
    dst = f'/workspace/work/ss3d-trailer/hfpart{PART}'; os.makedirs(dst + '/assets/clips', exist_ok=True)
    for f in ['hyperframes.json', 'package.json', 'meta.json']: shutil.copy(f'{H}/{f}', dst)
    for d in ['fonts', 'img']: shutil.copytree(f'{H}/assets/{d}', f'{dst}/assets/{d}', dirs_exist_ok=True)
    shutil.copy(f'{H}/assets/gsap.min.js', dst + '/assets/')
    for n in names:
        if n != 'end': shutil.copy(f'{H}/assets/clips/{n}.mp4', f'{dst}/assets/clips/')
open(dst + '/index.html', 'w').write(html)
print(dst, 'index.html', total, 's', len(vids), 'clips', len(caps), 'captions')
