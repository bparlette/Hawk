#!/usr/bin/env python3
"""Build Brad's demo site into ./site from ./src + games.json.

  ./build.py                     build shell; copy any game whose folder is missing in site/g/
  ./build.py --resync ID [ID..]  re-copy those games from their source folders (use 'all' for every game)

Each game is copied from its manifest "source" (a built static folder; or a single "file" in it)
into site/g/<id>/, then its index.html gets:
  - <script src="../../demo-embed.js"> as the first thing in <head> (suspend/resume hooks)
  - a <style id="demo-embed-css"> block (preset from EMBED_CSS + optional manifest "css")
    that hides the game's own touch controls / cabinet frame, only when embedded (html.demo-embed)
  - optional preset text patches (PATCHES)
The originals are never modified. Thumbnails live in src/thumbs/<id>.webp (see tools/thumbs.js).
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC, SITE = os.path.join(HERE, "src"), os.path.join(HERE, "site")

E = "html.demo-embed "
EMBED_CSS = {
    # Shell Shock engine family: the arcade cabinet photo + CRT. Drop the cabinet, stretch the screen to the iframe.
    "cab": f"""
{E}body{{background:#000!important}}
{E}#cab{{background:none!important}}
{E}#cab>.x-stick,{E}#cab>.x-cap,{E}#cab>.x-ring,{E}#cab>.x-fx,{E}#fsbtn,{E}#trailerbtn,{E}#proto{{display:none!important}}
{E}#screen{{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;border-radius:0!important;z-index:20!important}}
{E}#screen::after{{border-radius:0!important}}
""",
    "cel": f"{E}#touch,{E}#proto,{E}#hint{{display:none!important}}",
    "cave": f"{E}#touch,{E}#help{{display:none!important}}",
    "knockout": f"{E}#pad,{E}#help,{E}#bar{{display:none!important}}",
    "hollow": f"{E}#touch{{display:none!important}}",
    "g16": f"{E} .pad,{E}#hint,{E}#ov .small{{display:none!important}}",
    "rta": f"{E}#pad,{E}#misc{{display:none!important}} {E}#wrap{{justify-content:center!important;padding-top:0!important}}",
}
PATCHES = {
    # RTA pages reserve 56px for their pause/mute row; embedded, that row is hidden.
    "rta": [("ah = window.innerHeight - padH - 56", "ah = window.innerHeight - padH - (window.__DEMO_EMBED ? 4 : 56)")],
}

def load_manifest():
    with open(os.path.join(SRC, "games.json"), encoding="utf-8") as f:
        return json.load(f)

def copy_game(g):
    dst = os.path.join(SITE, "g", g["id"])
    if os.path.isdir(dst):
        shutil.rmtree(dst)
    src = g["source"]
    if g.get("file"):
        os.makedirs(dst)
        shutil.copy2(os.path.join(src, g["file"]), os.path.join(dst, "index.html"))
    else:
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns("CNAME", ".git", "node_modules", "*.map"))
    idx = os.path.join(dst, "index.html")
    html = open(idx, encoding="utf-8").read()
    css = EMBED_CSS.get(g.get("embed"), "") + "\n" + g.get("css", "")
    inject = '<script src="../../demo-embed.js"></script>\n<style id="demo-embed-css">' + css + "</style>\n"
    m = re.search(r"<head[^>]*>", html, re.I)
    if not m:
        raise SystemExit(f"{g['id']}: no <head> in index.html")
    # put the hook right after <meta charset> if present so it runs before any game script
    mc = re.search(r"<meta[^>]+charset[^>]*>", html, re.I)
    at = mc.end() if mc and mc.start() > m.start() else m.end()
    html = html[:at] + "\n" + inject + html[at:]
    for a, b in PATCHES.get(g.get("embed"), []) + [tuple(p) for p in g.get("patches", [])]:
        if a not in html:
            print(f"  WARN {g['id']}: patch target not found: {a[:60]}")
        html = html.replace(a, b)
    open(idx, "w", encoding="utf-8").write(html)
    print(f"  copied {g['id']:<22} <- {src}{'/' + g['file'] if g.get('file') else ''}")

RUNTIME_KEYS = ("id", "title", "category", "keys", "labels", "extras", "autostart", "orientation", "note")

def main():
    args = sys.argv[1:]
    resync = set()
    if args and args[0] == "--resync":
        resync = set(args[1:]) or {"all"}
    man = load_manifest()
    os.makedirs(os.path.join(SITE, "g"), exist_ok=True)
    ids = [g["id"] for g in man["games"]]
    assert len(ids) == len(set(ids)), "duplicate game id"
    for g in man["games"]:
        dst = os.path.join(SITE, "g", g["id"])
        if not os.path.isdir(dst) or "all" in resync or g["id"] in resync:
            copy_game(g)
    # games no longer in the manifest
    for d in os.listdir(os.path.join(SITE, "g")):
        if d not in ids:
            shutil.rmtree(os.path.join(SITE, "g", d)); print("  removed", d)
    # shell files
    for name in os.listdir(SRC):
        if name in ("games.json", "thumbs"):
            continue
        s, d = os.path.join(SRC, name), os.path.join(SITE, name)
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        else:
            shutil.copy2(s, d)
    os.makedirs(os.path.join(SITE, "thumbs"), exist_ok=True)
    out = {"categories": man["categories"], "games": []}
    for g in man["games"]:
        r = {k: g[k] for k in RUNTIME_KEYS if k in g}
        r["path"] = "g/" + g["id"] + "/index.html" + g.get("query", "")
        t = os.path.join(SRC, "thumbs", g["id"] + ".webp")
        if os.path.exists(t):
            shutil.copy2(t, os.path.join(SITE, "thumbs", g["id"] + ".webp"))
            r["thumb"] = "thumbs/" + g["id"] + ".webp?v=" + str(int(os.path.getmtime(t)))
        out["games"].append(r)
    with open(os.path.join(SITE, "games.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print(f"built {len(out['games'])} games -> {SITE}")

if __name__ == "__main__":
    main()
