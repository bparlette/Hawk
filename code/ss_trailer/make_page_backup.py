"""Build deploy/ (static trailer page for shellshock-trailer.surge.sh) from out/manifest.json."""
import json, os, shutil, html
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
DEP = os.path.join(HERE, "deploy")
PLAY = "https://shellshock-live.surge.sh"
man = json.load(open(os.path.join(OUT, "manifest.json")))

shutil.rmtree(DEP, ignore_errors=True)
for d in ("v", "img", "img/t"):
    os.makedirs(os.path.join(DEP, d), exist_ok=True)


def cp_video(rel):
    src = os.path.join(HERE, rel)
    name = os.path.basename(src)
    shutil.copy(src, os.path.join(DEP, "v", name))
    poster = src.replace(".mp4", ".jpg")
    pn = name.replace(".mp4", ".jpg")
    Image.open(poster).convert("RGB").save(os.path.join(DEP, "v", pn), quality=78)
    return "v/" + name, "v/" + pn


def mb(n):
    return "%.1f MB" % (n / 1048576)


def fmt(d):
    return "%d:%02d" % (int(d) // 60, int(round(d)) % 60)


full_v, full_p = cp_video(man["full"]["video"])
levels = sorted(man["levels"].items(), key=lambda kv: int(kv[0]))
sections = []
for n, L in levels:
    if "video" not in L:
        continue
    v, p = cp_video(L["video"])
    thumbs = []
    for s in L.get("stills", []):
        src = os.path.join(HERE, s)
        base = "L%s_%s" % (n, os.path.basename(s))
        im = Image.open(src).convert("RGB")
        im.save(os.path.join(DEP, "img", base), quality=80)
        im.resize((480, 270), Image.BILINEAR).save(os.path.join(DEP, "img/t", base), quality=74)
        label = os.path.basename(s)[3:-4].replace("_", " ").upper()
        thumbs.append('<a href="img/%s" target="_blank"><img loading="lazy" src="img/t/%s" alt="Level %s %s" width="480" height="270"><span>%s</span></a>' % (base, base, n, label.lower(), html.escape(label)))
    boss = html.escape(L.get("boss") or "")
    sections.append(f'''
<section class="lvl" id="level{n}">
  <div class="lvlhead"><span class="num">LEVEL {n}</span><h2>{html.escape(L.get("name", ""))}</h2>{f'<span class="boss">END BOSS: {boss}</span>' if boss else ''}</div>
  <video controls playsinline preload="none" poster="{p}" src="{v}"></video>
  <p class="meta">{fmt(L["duration"])} · {mb(L["size"])}</p>
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
video{{width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;display:block;box-shadow:0 10px 40px rgba(0,0,0,.6)}}
.hero{{margin:14px 0 18px;border:3px solid var(--y);border-radius:16px;overflow:hidden}}
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
.gal{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}}
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
footer{{text-align:center;color:#776;font-size:12px;padding:20px}}
</style></head>
<body>
<header><h1>Shell Shock Live</h1><div class="tag">Official hype trailer · {len(sections)} level{'s' if len(sections) != 1 else ''} and counting</div></header>
<main>
  <div class="hero"><video controls playsinline preload="metadata" poster="{full_p}" src="{full_v}"></video></div>
  <a class="play" href="{PLAY}">▶ PLAY NOW<small>Free in your browser · shellshock-live.surge.sh</small></a>
  <nav class="jump"><a href="#levels">All levels</a>{''.join(f'<a href="#level{n}">Level {n}: {html.escape(L.get("name", ""))}</a>' for n, L in levels if "video" in L)}</nav>
  {''.join(sections)}
  {guide_html}
  <a class="play" href="{PLAY}">▶ PLAY NOW<small>Grab a brother. Clear the hallway.</small></a>
</main>
<footer>Full trailer {fmt(man["full"]["duration"])} · footage captured from the game · original synthesized soundtrack</footer>
</body></html>'''
open(os.path.join(DEP, "index.html"), "w").write(page)
tot = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(DEP) for f in fs)
print("deploy/ written,", len(sections), "level sections,", mb(tot), "total")
