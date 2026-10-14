#!/usr/bin/env python3
"""Generate the HyperFrames composition (pt/index.html) + timeline.json for Paradise Thunder."""
import json, html

W, H = 1080, 1920
# (id, image, duration, kenburns: (s0,s1,x0,x1,y0,y1))
SCENES = [
    ("p00", "p00_flyover", 3.4, None),
    ("p01", "p01_captain_load", 2.0, (1.0, 1.08, 40, -20, 0, -30)),
    ("p02", "p02_speedboat_gulf", 2.6, (1.08, 1.0, -40, 40, 0, 0)),
    ("p03", "p03_pool", 2.6, (1.0, 1.07, 0, 30, 30, 0)),
    ("p04", "p04_boarding", 1.4, (1.05, 1.0, 30, -30, 0, 0)),
    ("p04b", "p04b_dogs_left", 2.0, (1.0, 1.08, -20, 20, 0, 40)),
    ("p05", "p05_boat_ride", 2.0, (1.06, 1.0, -30, 30, 0, 0)),
    ("p06", "p06_golfcart", 2.6, (1.0, 1.08, 0, -10, -40, 20)),
    ("p06b", "p06b_cart_air", 1.8, (1.12, 1.02, 0, 0, 40, -40)),
    ("p07", "p07_meet", 2.0, (1.0, 1.06, 30, 0, 0, 0)),
    ("p07b", "p07b_slowmo_walk", 2.6, (1.02, 1.06, 0, 0, 10, -10)),
    ("p07c", "p07c_strikeout", 2.3, (1.06, 1.0, -30, 20, 0, 0)),
    ("p08a", "p08a_shot_slide", 2.3, (1.0, 1.08, 60, -40, 0, 0)),
    ("p08", "p08_shots", 1.8, (1.08, 1.0, 0, 0, -30, 20)),
    ("p09", "p09_standoff", 2.4, (1.0, 1.1, 0, 0, 0, 40)),
    ("p09b", "p09b_shirt_rip", 1.6, (1.04, 1.14, 0, 0, 0, 30)),
    ("p10", "p10_brawl", 2.8, (1.1, 1.0, 0, 0, 0, 0)),
    ("p11b", "p11b_dogs_swam", 2.0, (1.0, 1.08, 0, 0, 30, -20)),
    ("p11", "p11_aftermath", 2.2, (1.0, 1.04, 0, 0, 0, 0)),
    ("end", None, 1.2, None),
    ("p12", "p12_endcard", 3.4, (1.08, 1.0, 0, 0, -40, 0)),
]
t = 0.0
START = {}
for sid, img, d, kb in SCENES:
    START[sid] = (round(t, 3), d); t += d
TOTAL = round(t, 3)

def S(sid, off=0.0): return round(START[sid][0] + off, 3)

# speech bubbles: (scene, t_in offset, t_out offset or None=end, text, box(x,y,w,h), tip(x,y), style, font_px)
BUBBLES = [
    ("p03", 0.75, None, "HEY GUYS, HAVE YOU HEARD ABOUT THIS NEW AI?", (50, 290, 620, 240), (165, 1080), "speech", 62),
    ("p05", 0.25, None, "LIFE IS GOOD.", (330, 300, 560, 170), (625, 745), "speech", 84),
    ("p06", 0.2, None, "BOYS, WE'RE GOING ON AN ADVENTURE... AND WE'RE GOING BUCK WILD AT THAT BAR!", (40, 140, 780, 330), (760, 640), "speech", 58),
    ("p06b", 0.1, None, "BUCK WILD!", (60, 180, 640, 210), (845, 515), "shout", 120),
    ("p07", 0.35, None, "BROTHER!", (40, 330, 580, 200), (360, 720), "shout", 120),
    ("p07c", 0.4, None, "SO... COME HERE OFTEN?", (60, 250, 620, 210), (262, 625), "speech", 70),
    ("p08a", 0.35, None, "FIRST ROUND'S ON THE HOUSE... FOR HIM.", (60, 130, 640, 250), (135, 470), "speech", 64),
    ("p09", 0.3, None, "WHATCHA GONNA DO, BROTHER?", (110, 200, 860, 230), (560, 630), "shout", 84),
    ("p12", 0.9, None, "SAY YOUR PRAYERS AND EAT YOUR VITAMINS!", (130, 650, 800, 240), (135, 960), "shout", 68),
]
# 90s caption slabs: (scene, t_in, text, y, size)
CAPTIONS = [
    ("p00", 0.5, "ST. PETE BEACH, FL", 1560, 120),
    ("p03", 0.0, "MEANWHILE...", 1600, 130),
    ("p07", 0.05, "THE DON CESAR", 1600, 130),
    ("p08", 0.1, "LAST CALL", 1580, 160),
    ("p11b", 0.5, "THEY SWAM.", 1600, 140),
]

def kb_vals(kb, sid):
    s0, s1, x0, x1, y0, y1 = kb
    def clamp(s, x, y):
        mx = (1288 * s - 1080) / 2; my = (1920 * s - 1920) / 2
        return max(-mx, min(mx, x)), max(-my, min(my, y))
    a = clamp(s0, x0, y0); b = clamp(s1, x1, y1)
    return s0, s1, a, b

def bubble_html(i, b):
    sid, tin, tout, text, (x, y, w, h), (tx, ty), style, fs = b
    fill = "#ffffff" if style == "speech" else "#ffe600"
    bw = 8 if style == "speech" else 10
    # tail base on bottom edge, nearest to tip
    bx = max(x + 70, min(x + w - 70, tx)); by = y + h
    half = 34 if style == "speech" else 44
    p1 = (bx - half, by - 4); p2 = (bx + half, by - 4)
    tail = f"{p1[0]},{p1[1]} {tx},{ty} {p2[0]},{p2[1]}"
    tail_fill = f"{p1[0]+bw},{p1[1]-bw-4} {tx},{ty-bw*1.8:.0f} {p2[0]-bw},{p2[1]-bw-4}"
    radius = "60px" if style == "speech" else "28px"
    rot = -2 if style == "shout" else 0
    ox, oy = tx, ty
    return f'''
    <div id="bub{i}" class="bub" style="transform-origin:{ox}px {oy}px;">
      <svg class="full" viewBox="0 0 {W} {H}"><polygon points="{tail}" fill="{fill}" stroke="#111" stroke-width="{bw}" stroke-linejoin="round"/></svg>
      <div class="bbox {style}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius};border-width:{bw}px;background:{fill};font-size:{fs}px;transform:rotate({rot}deg)"><span>{html.escape(text)}</span></div>
      <svg class="full" viewBox="0 0 {W} {H}"><polygon points="{tail_fill}" fill="{fill}"/></svg>
    </div>'''

parts = []; js = ['tl.set("#flash",{opacity:0},0);tl.set("#fadeout",{opacity:0},0);tl.set("#im_p11g",{opacity:0},0);']
for sid, img, d, kb in SCENES:
    st, dur = START[sid]
    if sid == "p00":
        parts.append(f'''<div id="sc_{sid}" class="clip scene" data-start="{st}" data-duration="{dur}" data-track-index="1" style="z-index:1">
      <img id="im_{sid}" src="assets/img/{img}.jpg" style="position:absolute;left:0;top:0;width:1080px;height:2184px;transform-origin:540px 1420px;"/></div>''')
        js.append(f'tl.fromTo("#im_{sid}",{{scale:1,y:0}},{{scale:1.35,y:-400,duration:{dur},ease:"sine.inOut"}},{st});')
        continue
    if sid == "end":
        parts.append(f'''<div id="sc_end" class="clip scene" data-start="{st}" data-duration="{dur}" data-track-index="1" style="z-index:1;background:#05030a">
      <div class="scan"></div>
      <div id="endtxt" class="endtxt">THE END<span id="endq">?</span></div></div>''')
        js.append(f'tl.fromTo("#endtxt",{{scale:2.4,opacity:0}},{{scale:1,opacity:1,duration:0.25,ease:"power4.out"}},{st});')
        js.append(f'tl.fromTo("#endq",{{rotation:0}},{{rotation:18,duration:0.12,yoyo:true,repeat:5,ease:"sine.inOut"}},{st+0.35});')
        continue
    s0, s1, (x0, y0), (x1, y1) = kb_vals(kb, sid)
    extra = ""
    if sid == "p11":
        extra = f'<img id="im_p11g" src="assets/img/p11_gray.jpg" class="kb" style="opacity:0"/>'
    parts.append(f'''<div id="sc_{sid}" class="clip scene" data-start="{st}" data-duration="{dur}" data-track-index="1" style="z-index:1">
      <div id="wr_{sid}" class="wrap"><img id="im_{sid}" src="assets/img/{img}.jpg" class="kb"/>{extra}</div></div>''')
    if sid == "p11":
        fz = 1.2  # freeze point
        js.append(f'tl.fromTo(["#im_p11","#im_p11g"],{{scale:{s0},x:{x0},y:{y0}}},{{scale:{s0+0.03},duration:{fz},ease:"none"}},{st});')
        js.append(f'tl.to(["#im_p11","#im_p11g"],{{scale:1.16,duration:0.12,ease:"power4.out"}},{st+fz});')
        js.append(f'tl.to("#im_p11g",{{opacity:1,duration:0.45,ease:"power1.in"}},{st+fz});')
        js.append(f'tl.set("#flash",{{opacity:0.9}},{st+fz});tl.to("#flash",{{opacity:0,duration:0.25}},{st+fz});')
        continue
    ease = "none" if sid == "p07b" else "sine.inOut"
    js.append(f'tl.fromTo("#im_{sid}",{{scale:{s0},x:{x0},y:{y0}}},{{scale:{s1},x:{x1},y:{y1},duration:{dur},ease:"{ease}"}},{st});')

# whip transition p09b -> p10: blurred versions slide
w0 = S("p10")
parts.append(f'''<div id="whipA" class="clip scene" data-start="{round(w0-0.18,3)}" data-duration="0.18" style="z-index:5"><img src="assets/img/p09b_whip.jpg" class="kb" id="whA"/></div>
<div id="whipB" class="clip scene" data-start="{w0}" data-duration="0.2" style="z-index:5"><img src="assets/img/p10_whip.jpg" class="kb" id="whB"/></div>''')
js.append(f'tl.fromTo("#whA",{{x:0}},{{x:-1100,duration:0.18,ease:"power2.in"}},{round(w0-0.18,3)});')
js.append(f'tl.fromTo("#whB",{{x:1100}},{{x:0,duration:0.2,ease:"power2.out"}},{w0});')

# impacts in brawl
hits = [0.25, 0.85, 1.45, 2.05]
for k, h in enumerate(hits):
    th = round(w0 + h, 3)
    js.append(f'tl.set("#flash",{{opacity:0.85}},{th});tl.to("#flash",{{opacity:0,duration:0.14}},{th});')
    js.append(f'tl.fromTo("#wr_p10",{{x:-26,y:14}},{{x:0,y:0,duration:0.22,ease:"elastic.out(1,0.3)"}},{th});')
# shirt rip & shot flashes
for th in (S("p09b", 0.05), S("p06b", 0.0), S("p08", 0.0)):
    js.append(f'tl.set("#flash",{{opacity:0.7}},{th});tl.to("#flash",{{opacity:0,duration:0.2}},{th});')
# comic POW bursts in brawl
POWS = [("WHAM!", 0.22, 640, 760, -12, "#ff2d55"), ("POW!", 1.42, 80, 1180, 10, "#ffe600")]
for k, (txt, off, x, y, rot, col) in enumerate(POWS):
    st = round(w0 + off, 3)
    parts.append(f'<div id="pow{k}" class="clip pow" data-start="{st}" data-duration="0.55" style="left:{x}px;top:{y}px;color:{col};z-index:20;transform:rotate({rot}deg)">{txt}</div>')
    js.append(f'tl.fromTo("#pow{k}",{{scale:0.2}},{{scale:1,duration:0.16,ease:"back.out(3)"}},{st});')

# iOS notification on brawl
nb = S("p10", 0.9)
parts.append(f'''<div id="ios" class="clip ios" data-start="{nb}" data-duration="{round(START['p10'][1]-0.9,3)}" style="z-index:30">
  <div class="ios-head"><div class="ios-icon">AI</div><div class="ios-app">AI ASSISTANT</div><div class="ios-now">now</div></div>
  <div class="ios-title">Brad's iPhone</div>
  <div class="ios-body">I've booked your table... and an ambulance for them.</div></div>''')
js.append(f'tl.fromTo("#ios",{{y:-320}},{{y:0,duration:0.35,ease:"back.out(1.4)"}},{nb});')

# talking-boat terminal on p02
tb = S("p02", 0.2)
term = "ETA TO THE DON: 4 MINUTES. RECOMMEND SUNSCREEN... BROTHER."
spans = "".join(f'<span class="ch" id="ch{k}">{html.escape(c) if c != " " else " "}</span>' for k, c in enumerate(term))
parts.append(f'''<div id="term" class="clip term" data-start="{tb}" data-duration="{round(START['p02'][1]-0.2,3)}" style="z-index:30">
  <div class="term-h">&#9632; THUNDER-NAV // VOICE LINK</div><div class="term-b">&gt; {spans}<span id="cur">&#9608;</span></div></div>''')
js.append(f'tl.fromTo("#term",{{scaleY:0}},{{scaleY:1,duration:0.15}},{tb});')
for k in range(len(term)):
    js.append(f'tl.set("#ch{k}",{{opacity:1}},{round(tb+0.2+k*0.028,3)});')

# bubbles
for i, b in enumerate(BUBBLES):
    sid, tin, tout = b[0], b[1], b[2]
    st = S(sid, tin); end = S(sid, START[sid][1]) if tout is None else S(sid, tout)
    parts.append(f'<div class="clip layer" data-start="{st}" data-duration="{round(end-st,3)}" style="z-index:25">{bubble_html(i, b)}</div>')
    js.append(f'tl.fromTo("#bub{i}",{{scale:0.1,opacity:0}},{{scale:1,opacity:1,duration:0.2,ease:"back.out(2.2)"}},{st});')

# captions
for i, (sid, tin, text, y, fs) in enumerate(CAPTIONS):
    st = S(sid, tin); end = S(sid, START[sid][1])
    parts.append(f'<div id="cap{i}" class="clip cap" data-start="{st}" data-duration="{round(end-st,3)}" style="top:{y}px;font-size:{fs}px;z-index:22"><span>{html.escape(text)}</span></div>')
    js.append(f'tl.fromTo("#cap{i}",{{x:-1200,skewX:-25}},{{x:0,skewX:-8,duration:0.28,ease:"power3.out"}},{st});')

# title on end card
tt = S("p12", 0.1)
parts.append(f'''<div id="title" class="clip title" data-start="{tt}" data-duration="{round(TOTAL-tt,3)}" style="z-index:24">
  <div class="t1">PARADISE</div><div class="t2">THUNDER</div></div>''')
js.append(f'tl.fromTo("#title",{{scale:3,opacity:0}},{{scale:1,opacity:1,duration:0.35,ease:"power4.out"}},{tt});')
js.append(f'tl.set("#flash",{{opacity:0.9}},{round(tt+0.3,3)});tl.to("#flash",{{opacity:0,duration:0.35}},{round(tt+0.3,3)});')
# fade to black at end
parts.append(f'<div id="fadeout" class="clip full" data-start="{round(TOTAL-0.6,3)}" data-duration="0.6" style="background:#000;z-index:60;opacity:0"></div>')
js.append(f'tl.to("#fadeout",{{opacity:1,duration:0.6}},{round(TOTAL-0.6,3)});')
# flash layer + film grain/vignette across
parts.append(f'<div id="flash" class="clip full" data-start="0" data-duration="{TOTAL}" style="background:#fff;opacity:0;z-index:50"></div>')
parts.append(f'<div class="clip full vignette" data-start="0" data-duration="{TOTAL}" style="z-index:40"></div>')
parts.append(f'<audio id="music" class="clip" src="assets/music.wav" data-start="0" data-duration="{TOTAL}" data-volume="1"></audio>')

CSS = """
@font-face{font-family:Bangers;src:url(assets/fonts/Bangers-Regular.ttf)}
@font-face{font-family:Anton;src:url(assets/fonts/Anton-Regular.ttf)}
@font-face{font-family:Russo;src:url(assets/fonts/RussoOne-Regular.ttf)}
@font-face{font-family:VT323;src:url(assets/fonts/VT323-Regular.ttf)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#000}
#root{position:relative;width:1080px;height:1920px;overflow:hidden}
.scene,.layer,.full{position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden}
.wrap{position:absolute;left:0;top:0;width:1080px;height:1920px}
.kb{position:absolute;left:-104px;top:0;width:1288px;height:1920px;transform-origin:50% 50%}
.bub{position:absolute;left:0;top:0;width:1080px;height:1920px}
svg.full{position:absolute;left:0;top:0;width:1080px;height:1920px}
.bbox{position:absolute;border-style:solid;border-color:#111;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px 30px;font-family:Bangers;letter-spacing:2px;line-height:1.02;color:#111;box-shadow:10px 12px 0 rgba(0,0,0,.35)}
.bbox.shout{color:#d4001a;-webkit-text-stroke:2px #111}
.cap{position:absolute;left:0;width:1080px;text-align:center;font-family:Anton;letter-spacing:6px}
.cap span{display:inline-block;padding:6px 40px 12px;background:linear-gradient(180deg,#ff2d6f,#b0005a);color:#fff7c2;border:6px solid #fff;box-shadow:12px 12px 0 #000;text-shadow:5px 5px 0 #2a0030}
.pow{position:absolute;font-family:Bangers;font-size:190px;-webkit-text-stroke:8px #111;text-shadow:12px 12px 0 #111}
.ios{position:absolute;left:36px;top:70px;width:1008px;padding:26px 32px 30px;border-radius:44px;background:rgba(245,245,247,.93);box-shadow:0 18px 50px rgba(0,0,0,.45);font-family:-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif;color:#111}
.ios-head{display:flex;align-items:center;gap:18px;font-size:30px;color:#6b6b70;letter-spacing:1px}
.ios-icon{width:58px;height:58px;border-radius:14px;background:linear-gradient(135deg,#7b2ff7,#f107a3);color:#fff;font-weight:800;font-size:28px;display:flex;align-items:center;justify-content:center}
.ios-app{flex:1;font-weight:600}
.ios-now{font-size:28px}
.ios-title{margin-top:14px;font-size:40px;font-weight:700}
.ios-body{margin-top:6px;font-size:42px;line-height:1.2}
.term{position:absolute;left:60px;top:150px;width:960px;padding:24px 34px 34px;background:rgba(0,14,4,.86);border:4px solid #39ff6a;box-shadow:0 0 30px rgba(57,255,106,.55),inset 0 0 40px rgba(57,255,106,.15);font-family:VT323;color:#39ff6a;text-shadow:0 0 10px #39ff6a;transform-origin:50% 0}
.term-h{font-size:40px;border-bottom:3px solid #39ff6a;padding-bottom:8px;margin-bottom:14px;letter-spacing:3px}
.term-b{font-size:72px;line-height:1.05;letter-spacing:2px;white-space:normal;overflow-wrap:break-word}
.ch{opacity:0}
.title{position:absolute;left:0;top:200px;width:1080px;text-align:center;font-family:Anton;transform-origin:50% 40%}
.t1,.t2{font-size:200px;line-height:.95;letter-spacing:8px;background:linear-gradient(180deg,#fff 0%,#9ff3ff 38%,#1a6fd1 50%,#ffe28a 62%,#ff7a00 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:5px #1a0033;filter:drop-shadow(10px 10px 0 #ff2d6f)}
.t1{font-size:150px;font-family:Russo;letter-spacing:14px}
.endtxt{position:absolute;left:0;top:760px;width:1080px;text-align:center;font-family:Russo;font-size:190px;color:#ff2d6f;text-shadow:0 0 30px #ff2d6f,8px 8px 0 #2a0040;letter-spacing:6px}
#endq{display:inline-block;color:#ffe600;text-shadow:0 0 30px #ffe600,8px 8px 0 #2a0040}
.scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 2px,transparent 2px 6px)}
.vignette{background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.45) 100%)}
"""

doc = f"""<!doctype html>
<html lang="en" data-resolution="portrait">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=1080, height=1920"/>
<script src="assets/gsap.min.js"></script>
<style>{CSS}</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="1080" data-height="1920" data-fps="30">
{''.join(parts)}
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body></html>"""
open("pt/index.html", "w").write(doc)
json.dump({"total": TOTAL, "scenes": {k: v for k, v in START.items()}, "hits": [round(w0 + h, 3) for h in hits]}, open("timeline.json", "w"), indent=1)
print("TOTAL", TOTAL); print(json.dumps(START))
