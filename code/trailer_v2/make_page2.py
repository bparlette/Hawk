"""Build deploy/ (static trailer page for shellshock-trailer.surge.sh) from out/manifest.json."""
import json, os, shutil, html
from PIL import Image

import sys
HERE = sys.argv[1]  # build output root (has out/, screens/)
OUT = os.path.join(HERE, "out")
DEP = sys.argv[2]
PLAY = "https://shellshock-live.surge.sh"
man = json.load(open(os.path.join(OUT, "manifest.json")))

shutil.rmtree(DEP, ignore_errors=True)
for d in ("v", "img", "img/t"):
    os.makedirs(os.path.join(DEP, d), exist_ok=True)


def cp_video(rel):
    src = os.path.join(HERE, rel)
    name = os.path.basename(src)
    dst = os.path.join(DEP, "v", name)
    if name.startswith("level"):  # lighter web encode of the per-level mini movies (page weight)
        import subprocess
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-maxrate", "2400k", "-bufsize", "4800k",
                        "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", dst], check=True)
    else:
        shutil.copy(src, dst)
    poster = src.replace(".mp4", ".jpg")
    pn = name.replace(".mp4", ".jpg")
    Image.open(poster).convert("RGB").save(os.path.join(DEP, "v", pn), quality=78)
    return "v/" + name, "v/" + pn


def mb(n):
    return "%.1f MB" % (n / 1048576)


def fmt(d):
    return "%d:%02d" % (int(d) // 60, int(round(d)) % 60)


full_v, full_p = cp_video(man["full"]["video"])
# ---- hero: the game's own cabinet as an HTML/CSS frame around the screen-only cut (no cabinet baked in)
GAME = os.environ.get("GAME_SRC", "/workspace/work/trailer_v2/final_game")
os.makedirs(os.path.join(DEP, "cab"), exist_ok=True)
# exact game art (cabinet_special.png RGBA, stick.png): fetched from the LIVE game, local snapshot as fallback
import urllib.request
for fn in ("cabinet_special.png", "stick.png"):
    try:
        urllib.request.urlretrieve(PLAY + "/" + fn, os.path.join(DEP, "cab", fn))
    except Exception:
        shutil.copy(os.path.join(GAME, fn), os.path.join(DEP, "cab", fn))
FS = man["full_screen"]
scr_v, scr_p = cp_video(FS["video"])
# VP9/WebM twin of the screen cut (same frames) for browsers without H.264 (iOS/Safari pick the MP4 source first)
import subprocess
scr_w = scr_v.replace(".mp4", ".webm")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", os.path.join(DEP, scr_v), "-c:v", "libvpx-vp9", "-b:v", "1400k", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1",
                "-c:a", "libopus", "-b:a", "96k", os.path.join(DEP, scr_w)], check=True)
shutil.copy(os.path.join(HERE, FS["inputs"]), os.path.join(DEP, "v", "full_screen_inputs.json"))
INP = json.load(open(os.path.join(HERE, FS["inputs"])))
assert INP["frames"] > 0
levels = sorted(man["levels"].items(), key=lambda kv: int(kv[0]))
sections = []
for n, L in levels:
    if "video" not in L:
        continue
    # page level clips + stills are GAME-ONLY (no cabinet), landscape 1068x624 (build2.py `game` mode); cabinet cut only as fallback
    v, p = cp_video(L.get("game_video") or L["video"])
    GAME_ONLY = bool(L.get("game_video"))
    thumbs = []
    for s in (L.get("game_stills") or L.get("stills", [])):
        src = os.path.join(HERE, s)
        base = ("L%s_%s" % (n, os.path.basename(s))).replace(" ", "_")
        im = Image.open(src).convert("RGB")
        FW, FH, TW, TH = (im.width, im.height, 360, int(round(360 * im.height / im.width))) if GAME_ONLY else (720, 1280, 225, 400)
        im.resize((FW, FH), Image.LANCZOS).save(os.path.join(DEP, "img", base), quality=82, optimize=True, progressive=True)
        im.resize((TW, TH), Image.LANCZOS).save(os.path.join(DEP, "img/t", base), quality=78, optimize=True)
        label = os.path.basename(s)[3:-4].replace("_", " ").upper()
        thumbs.append('<a href="img/%s" target="_blank"><img loading="lazy" src="img/t/%s" alt="Level %s %s" width="%d" height="%d"><span>%s</span></a>' % (base, base, n, label.lower(), TW, TH, html.escape(label)))
    boss = html.escape(L.get("boss") or "")
    sections.append(f'''
<section class="lvl" id="level{n}">
  <div class="lvlhead"><span class="num">LEVEL {n}</span><h2>{html.escape(L.get("name", ""))}</h2>{f'<span class="boss">END BOSS: {boss}</span>' if boss else ''}</div>
  <video controls playsinline preload="none" poster="{p}" src="{v}"></video>
  <p class="meta">{fmt(L["duration"])} · {mb(os.path.getsize(os.path.join(DEP, v)))}</p>
  <div class="gal">{''.join(thumbs)}</div>
</section>''')


# ---- Level guide (bottom of page), parsed from the game's level plugins ----
import re, glob
LVL_SRC = os.environ.get("LEVEL_SRC", "/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/levels")
guide = {1: {"name": "HALLWAY FIRE", "tag": "THE GANG KIDNAPPED AMBER. TIME TO SHELL UP.", "boss": "RAMROD", "mid": "SCORCHER", "color": "#ff5a3a"}}
for f in glob.glob(os.path.join(LVL_SRC, "level*.js")):
    m = re.match(r"level(\d+)\.js$", os.path.basename(f))
    if not m: continue
    n = int(m.group(1)); src = open(f, encoding="utf-8", errors="ignore").read()
    card = re.search(r'card:\s*\{\s*title:\s*"([^"]+)"\s*,\s*tagline:\s*"([^"]*)"(?:\s*,\s*color:\s*"([^"]+)")?', src)
    bosses = [b for b in re.findall(r'name:\s*"([^"]+)"\s*,\s*base:', src)]
    if not card: continue
    guide[n] = {"name": card.group(1), "tag": card.group(2), "boss": " · ".join(dict.fromkeys(bosses)) or "", "color": card.group(3) or "#ff3a8a", "final": bool(re.search(r'final\s*:\s*true', src))}
for n, L in man["levels"].items():
    if int(n) in guide and L.get("boss") and not guide[int(n)]["boss"]: guide[int(n)]["boss"] = L["boss"]
TOTAL = max(15, max(guide) if guide else 0)
rows = []
for n in range(1, TOTAL + 1):
    g = guide.get(n)
    if g:
        extra = f'<span class="gmid">MID-BOSS: {html.escape(g["mid"])}</span>' if g.get("mid") else ""
        fin = '<span class="gfin">FINALE</span>' if g.get("final") else ""
        rows.append(f'<li style="--c:{g["color"]}"><span class="gnum">{n:02d}</span><div><b>{html.escape(g["name"])}</b>{fin}<i>{html.escape(g["tag"])}</i><span class="gboss">BOSS: {html.escape(g["boss"])}</span>{extra}</div></li>')
    else:
        rows.append(f'<li class="soon"><span class="gnum">{n:02d}</span><div><b>COMING SOON</b><i>New stage in development</i></div></li>')
guide_html = f'<section class="guide" id="levels"><h2>THE LEVELS</h2><p class="gsub">{len(guide)} of {TOTAL} stages playable now</p><ol>{"".join(rows)}</ol></section>'

page = f'''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>SHELL SHOCK LIVE — Trailer</title>
<meta name="description" content="Hype trailer, level-by-level mini movies and screenshots for Shell Shock Live. Play free in your browser.">
<meta property="og:title" content="SHELL SHOCK LIVE — Trailer"><meta property="og:image" content="{full_p}">
<meta name="theme-color" content="#0b0710">
<style>
:root{{--y:#ffd23c;--r:#ff3b28;--bg:#0b0710;--card:#160f1d}}
*{{box-sizing:border-box}}html,body{{margin:0;background:var(--bg);color:#eee;font:16px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}
body{{background:radial-gradient(ellipse at top,#3a1408 0,#0b0710 60%) fixed}}
header{{text-align:center;padding:28px 16px 10px}}
h1{{font:900 clamp(34px,8vw,76px)/0.95 Impact,'Anton','Arial Black',sans-serif;letter-spacing:1px;margin:0;color:var(--y);text-shadow:0 4px 0 #000,0 0 30px rgba(255,120,0,.45);text-transform:uppercase}}
.tag{{color:#ffb38a;letter-spacing:3px;font-size:13px;text-transform:uppercase;margin-top:8px}}
main{{max-width:1100px;margin:0 auto;padding:0 14px 60px}}
video{{width:100%;max-width:440px;margin:0 auto;aspect-ratio:9/16;background:#000;border-radius:12px;display:block;box-shadow:0 10px 40px rgba(0,0,0,.6)}}
.hero{{margin:14px auto 18px;border:3px solid var(--y);border-radius:16px;overflow:hidden;max-width:446px}}
.hero video{{border-radius:0}}
.play{{display:block;text-align:center;margin:18px auto 34px;max-width:520px;padding:20px 24px;border-radius:14px;background:linear-gradient(180deg,#ffdd55,#ff9a1a);color:#1a0b00;
 font:900 clamp(26px,6vw,40px)/1 Impact,'Arial Black',sans-serif;letter-spacing:2px;text-decoration:none;box-shadow:0 6px 0 #a34a00,0 12px 30px rgba(255,140,0,.45);text-transform:uppercase}}
.play:active{{transform:translateY(4px);box-shadow:0 2px 0 #a34a00}}
.play small{{display:block;font:600 13px system-ui,sans-serif;letter-spacing:1px;margin-top:6px;opacity:.75;text-transform:none}}
.lvl{{background:var(--card);border-radius:16px;padding:16px;margin:0 0 26px;border:1px solid #2b1f36}}
.lvlhead{{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin:2px 4px 12px}}
.num{{color:var(--y);font-weight:800;letter-spacing:3px;font-size:13px}}
.lvl h2{{margin:0;font:900 clamp(24px,5vw,38px)/1 Impact,'Arial Black',sans-serif;letter-spacing:1px}}
.boss{{color:var(--r);font-weight:800;letter-spacing:2px;font-size:13px}}
.meta{{color:#998;font-size:12px;margin:6px 4px 12px}}
.gal{{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}}
.gal a{{position:relative;display:block;border-radius:8px;overflow:hidden;background:#000}}
.gal img{{width:100%;height:auto;display:block}}
.gal span{{position:absolute;left:6px;bottom:5px;font-size:10px;letter-spacing:1px;font-weight:700;color:#fff;text-shadow:0 1px 2px #000}}
nav.jump{{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:0 0 22px}}
nav.jump a{{color:#eee;text-decoration:none;border:1px solid #3a2b48;border-radius:20px;padding:6px 12px;font-size:13px}}
.guide{{background:var(--card);border-radius:16px;padding:18px 16px;margin:10px 0 26px;border:1px solid #2b1f36}}
.guide h2{{margin:0 4px;font:900 clamp(26px,6vw,40px)/1 Impact,'Arial Black',sans-serif;letter-spacing:1px}}
.gsub{{margin:6px 4px 14px;color:#a99;font-size:13px}}
.guide ol{{list-style:none;margin:0;padding:0;display:grid;gap:10px}}
.guide li{{display:flex;gap:12px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:#140d1b;border-left:4px solid var(--c,#ff3a8a)}}
.guide li.soon{{opacity:.45;border-left-color:#555}}
.gnum{{font:900 22px/1 Impact,'Arial Black',sans-serif;color:var(--c,#ff3a8a);min-width:30px}}
.guide b{{display:block;font:900 18px/1.1 Impact,'Arial Black',sans-serif;letter-spacing:.5px}}
.guide i{{display:block;font-style:normal;color:#cbb;font-size:13px;margin:3px 0 5px}}
.gboss,.gmid,.gfin{{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.6px;padding:2px 7px;border-radius:6px;background:#2b1f36;margin:0 6px 2px 0;color:#ffd23a}}
.gfin{{background:#ffd23a;color:#140d1b;margin-left:8px;vertical-align:middle}}
.cabwrap{{margin:6px auto 10px;width:min(100%,560px)}}
#cab{{--S:1px;position:relative;width:100%;aspect-ratio:704/1520;background:url(cab/cabinet.jpg) 0 0/100% 100% no-repeat;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}}
.x-stick{{position:absolute;left:26.99%;top:57.50%;width:8.24%;height:5.39%;transform-origin:50% 95.1%;transition:transform 70ms ease-out;pointer-events:none;z-index:3}}
.x-cap,.x-ring{{position:absolute;pointer-events:none;border-radius:50%}}
.x-cap{{z-index:2;opacity:0;background:url(cab/cabinet.jpg) no-repeat;background-size:calc(704 * var(--S)) calc(1520 * var(--S));background-position:calc(var(--x) * -1 * var(--S)) calc(var(--y) * -1 * var(--S));transition:transform 50ms linear,filter 50ms linear}}
.x-cap.on{{opacity:1;transform:translateY(calc(3 * var(--S)));filter:brightness(.72);box-shadow:inset 0 calc(2 * var(--S)) calc(5 * var(--S)) rgba(0,0,0,.65),inset 0 0 calc(3 * var(--S)) rgba(0,0,0,.4)}}
.x-ring{{z-index:1;opacity:0;background:radial-gradient(circle,#0b0b0e 55%,#050507 72%,rgba(0,0,0,.6) 100%)}}
.x-ring.on{{opacity:1}}
.x-fx{{position:absolute;pointer-events:none;transform:translate(-50%,-50%);border-radius:50%;aspect-ratio:1;opacity:0;transition:opacity 60ms linear;z-index:4}}
.x-btn{{width:9%}}
.x-btn.on{{opacity:1;box-shadow:0 0 0 1px var(--c),0 0 calc(14 * var(--S)) calc(5 * var(--S)) var(--c),inset 0 0 calc(8 * var(--S)) calc(2 * var(--S)) var(--c)}}
#screen{{position:absolute;left:23.72%;top:34.41%;width:53.41%;height:17.83%;overflow:hidden;background:#000;--row:calc(2 * var(--S))}}
#screen video{{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;display:block;background:#000;max-width:none;aspect-ratio:auto;border-radius:0;box-shadow:none;margin:0}}
#screen::after{{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;
 background:radial-gradient(120% 90% at 30% 18%,rgba(255,255,255,.10),rgba(255,255,255,.03) 35%,transparent 60%),radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.25) 100%),repeating-linear-gradient(to bottom,transparent 0 var(--row),rgba(0,0,0,.09) var(--row) calc(var(--row) * 2)),repeating-linear-gradient(to right,rgba(255,40,40,.05) 0 1px,rgba(40,255,80,.05) 1px 2px,rgba(60,90,255,.05) 2px 3px);
 box-shadow:inset 0 0 28px 8px rgba(0,0,0,.35),inset 0 0 10px 2px rgba(0,0,0,.3),inset 0 0 4px 1px rgba(0,0,0,.6);border-radius:6%/9%}}
#snd{{position:absolute;z-index:6;left:50%;top:53.2%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;border:2px solid var(--y);background:rgba(10,8,14,.82);color:var(--y);font:800 13px/1 system-ui,-apple-system,sans-serif;letter-spacing:2px;cursor:pointer;touch-action:manipulation;white-space:nowrap}}
#snd .ic{{display:inline-flex}}
#snd.on{{opacity:.55;border-color:#888;color:#ddd}}
#snd:active{{transform:translateX(-50%) scale(.94)}}
.dl{{text-align:center;color:#a99;font-size:13px;margin:0 8px 6px}}
.dl a{{color:var(--y)}}
footer{{text-align:center;color:#776;font-size:12px;padding:20px}}
</style></head>
<body>
<header><h1>Shell Shock Live</h1><div class="tag">Official hype trailer · filmed on the cabinet · {('all %d levels, start to finale' % len(sections)) if len(sections) >= 15 else ('%d level%s and counting' % (len(sections), 's' if len(sections) != 1 else ''))}</div></header>
<main>
  <div class="cabwrap"><div id="cab">
    <div id="screen" class="crt"><video id="hv" autoplay muted loop playsinline webkit-playsinline preload="auto" poster="{scr_p}" aria-label="Shell Shock Live trailer playing on the arcade cabinet"><source src="{scr_v}" type="video/mp4"><source src="{scr_w}" type="video/webm"></video></div>
    <div class="x-fx x-btn" id="fx-a" style="left:59.2%;top:62.8%;--c:rgba(255,60,50,.75)"></div>
    <div class="x-fx x-btn" id="fx-b" style="left:70%;top:62.5%;--c:rgba(255,215,40,.75)"></div>
    <div class="x-fx x-btn" id="fx-p" style="left:81.1%;top:62.8%;--c:rgba(60,140,255,.75)"></div>
    <div class="x-ring" id="ring-a" style="left:55.966%;top:61.974%;width:6.676%;height:1.842%"></div>
    <div class="x-ring" id="ring-b" style="left:66.619%;top:61.579%;width:6.818%;height:1.842%"></div>
    <div class="x-ring" id="ring-p" style="left:77.841%;top:61.842%;width:6.676%;height:1.842%"></div>
    <div class="x-cap" id="cap-a" style="left:55.966%;top:61.974%;width:6.676%;height:1.842%;--x:394;--y:942"></div>
    <div class="x-cap" id="cap-b" style="left:66.619%;top:61.579%;width:6.818%;height:1.842%;--x:469;--y:936"></div>
    <div class="x-cap" id="cap-p" style="left:77.841%;top:61.842%;width:6.676%;height:1.842%;--x:548;--y:940"></div>
    <img class="x-stick" id="stick" src="cab/stick.png" alt="" draggable="false">
    <button id="snd" type="button" aria-label="Tap for sound"><span class="ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg></span><span class="tx">TAP FOR SOUND</span></button>
  </div></div>
  <p class="dl">Downloads (cabinet cut, sound on): <a href="{full_v}" download>Full trailer · {fmt(man["full"]["duration"])} · {mb(os.path.getsize(os.path.join(DEP, full_v)))}</a> · every level's mini movie is below</p>
  <a class="play" href="{PLAY}">▶ PLAY NOW<small>Free in your browser · shellshock-live.surge.sh</small></a>
  <nav class="jump"><a href="#levels">All levels</a>{''.join(f'<a href="#level{n}">Level {n}: {html.escape(L.get("name", ""))}</a>' for n, L in levels if "video" in L)}</nav>
  {''.join(sections)}
  {guide_html}
  <a class="play" href="{PLAY}">▶ PLAY NOW<small>Grab a brother. Clear the hallway.</small></a>
</main>
<footer>Full trailer {fmt(man["full"]["duration"])} · cabinet controls on this page replay the bot's logged inputs frame by frame · real gameplay captured in the game's arcade cabinet, no cheats · original synthesized soundtrack</footer>
<script>
(function(){{
  var IN={json.dumps(INP["data"])}, FPS={INP["fps"]};
  var cab=document.getElementById("cab"), v=document.getElementById("hv"), st=document.getElementById("stick"), snd=document.getElementById("snd");
  var B={{a:["fx-a","cap-a","ring-a"],b:["fx-b","cap-b","ring-b"],p:["fx-p","cap-p","ring-p"]}};
  for(var k in B) B[k]=B[k].map(function(id){{return document.getElementById(id);}});
  function size(){{ cab.style.setProperty("--S",(cab.clientWidth/704)+"px"); }}
  size(); window.addEventListener("resize",size); if(window.ResizeObserver) new ResizeObserver(size).observe(cab);
  var last=-1;
  function show(t){{
    var f=Math.floor(t*FPS+0.02); if(f<0) f=0; if(f>=IN.length) f=IN.length-1;
    var c=IN.charCodeAt(f)-48; if(c===last) return; last=c;
    var s=c%9, bits=(c/9)|0, dx=Math.floor(s/3)-1, dy=s%3-1;
    st.style.transform="rotate("+(dx*22)+"deg) translateY("+(dy*2)+"%) scaleY("+(1-0.12*dy)+")";
    var on={{a:bits&1,b:bits&2,p:bits&4}};
    for(var k in B) for(var i=0;i<3;i++) B[k][i].classList.toggle("on",!!on[k]);
    cab.setAttribute("data-inp",c);
  }}
  window.__cabShow=show;
  if("requestVideoFrameCallback" in HTMLVideoElement.prototype){{
    var cb=function(now,md){{ show(md.mediaTime); v.requestVideoFrameCallback(cb); }};
    v.requestVideoFrameCallback(cb);
  }} else {{
    (function loop(){{ if(!v.paused) show(v.currentTime); requestAnimationFrame(loop); }})();
  }}
  v.addEventListener("timeupdate",function(){{ show(v.currentTime); }});
  v.addEventListener("seeked",function(){{ show(v.currentTime); }});
  v.muted=true; v.defaultMuted=true; v.setAttribute("muted","");
  function kick(){{ var p=v.play(); if(p&&p.catch) p.catch(function(){{}}); }}
  kick(); document.addEventListener("visibilitychange",function(){{ if(!document.hidden) kick(); }});
  function setSound(on){{
    v.muted=!on; snd.classList.toggle("on",on);
    snd.querySelector(".ic").innerHTML=on?'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>':'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
    snd.querySelector(".tx").textContent=on?"SOUND ON":"TAP FOR SOUND";
    snd.setAttribute("aria-label",on?"Mute":"Tap for sound"); kick();
  }}
  snd.addEventListener("click",function(e){{ e.stopPropagation(); setSound(v.muted); }});
  document.getElementById("screen").addEventListener("click",function(){{ setSound(v.muted); }});
}})();
</script>
</body></html>'''
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cabmatch import finalize  # 22:05 video lock + 22:20 game-identical cabinet hero
page = finalize(page)
open(os.path.join(DEP, "index.html"), "w").write(page)
tot = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(DEP) for f in fs)
print("deploy/ written,", len(sections), "level sections,", mb(tot), "total")
