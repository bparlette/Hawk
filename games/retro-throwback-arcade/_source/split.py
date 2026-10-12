#!/usr/bin/env python3
"""Split the single-file Retro Throwback Arcade into index.html + levels/NN-name.js.
Each level file holds its game object verbatim (`var name = {...};`). The player
fetches a level only when it is needed and evaluates it inside the shell's closure,
so levels keep access to the shared helpers (ctx, text, beep, SFX, ...)."""
import re, sys, os, json, shutil

src, out = sys.argv[1], sys.argv[2]
lines = open(src, encoding="utf-8").read().split("\n")

gidx = next(i for i, l in enumerate(lines) if re.match(r"\s*var GAMES\s*=\s*\[", l))
names = [n.strip() for n in re.search(r"\[(.*)\]", lines[gidx]).group(1).split(",") if n.strip()]

starts = []
for n in names:
    i = next(i for i, l in enumerate(lines) if re.match(r"\s*var %s\s*=\s*\{" % re.escape(n), l))
    j = i
    while j > 0 and (lines[j-1].strip().startswith("/*") or lines[j-1].strip() == ""):
        j -= 1
    starts.append((n, i, j))

def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

os.makedirs(os.path.join(out, "levels"), exist_ok=True)
manifest = []
for k, (n, i, j) in enumerate(starts):
    end = starts[k+1][2] if k + 1 < len(starts) else gidx
    body = "\n".join(lines[j:end]).rstrip() + "\n"
    title = re.search(r'title:\s*"([^"]*)"', body).group(1)
    goal = re.search(r'goal:\s*"([^"]*)"', body).group(1)
    fname = "levels/%02d-%s.js" % (k + 1, slug(title))
    hdr = ("/* Retro Throwback Arcade - Level %d: %s\n"
           "   Loaded by ../index.html and evaluated inside the player's scope.\n"
           "   Must define `var %s = {...}` (title, goal, init(api), update(input), draw(ctx)). */\n") % (k + 1, title, n)
    open(os.path.join(out, fname), "w", encoding="utf-8").write(hdr + body)
    manifest.append({"file": fname, "name": n, "title": title, "goal": goal})

first = starts[0][2]
loader = """        /* ================= LEVEL LOADER =================
           Levels live in levels/NN-name.js. Add a game: drop in its file and add one
           line here. Deep link: index.html?level=N or #level=N. */
        var LEVELS = %s;
        var GAMES = LEVELS.map(function (L) { return { title: L.title, goal: L.goal, stub: true, init: function () {}, update: function () {}, draw: function () {} }; });
        var loading = {};
        function loadLevel(i, cb) {
          if (!GAMES[i] || !GAMES[i].stub) { if (cb) cb(); return; }
          if (loading[i]) { loading[i].push(cb); return; }
          loading[i] = [cb];
          fetch(LEVELS[i].file).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
            .then(function (code) {
              GAMES[i] = eval(code + "\\n;" + LEVELS[i].name);
              var q = loading[i]; loading[i] = null; q.forEach(function (f) { if (f) f(); });
            })
            .catch(function (e) { loading[i] = null; console.error("Level load failed", LEVELS[i].file, e); });
        }
""" % json.dumps(manifest, indent=2).replace("\n", "\n        ")

shell = lines[gidx+1:]
shell_txt = "\n".join(shell)
old = re.search(r"function startLevel\(\)\s*\{\s*GAMES\[gi\]\.init\(api\);(.*?)\}", shell_txt)
if not old:
    sys.exit("startLevel pattern not found; update split.py")
rest = old.group(1)
new = ("function startLevel() { var i = gi; state = \"loading\"; loadLevel(i, function () { if (gi !== i) return; "
       "GAMES[i].init(api);%s if (i + 1 < GAMES.length) loadLevel(i + 1); }); }" % rest)
shell_txt = shell_txt[:old.start()] + new + shell_txt[old.end():]

html = "\n".join(lines[:first]) + "\n" + loader + shell_txt
open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(html)
open(os.path.join(out, "README.md"), "w").write(
    "# Retro Throwback Arcade\n\nA gauntlet of original mini-games inspired by Nintendo and Sega classics.\n\n"
    "- `index.html` is the player: the title screen, the level grid, progress, and the loader.\n"
    "- `levels/NN-name.js` holds one game per file, loaded only when it's played and prefetched one level ahead.\n"
    "- Deep link to any level: `index.html?level=6` or `index.html#level=6`.\n"
    "- To add a level, add its file and one entry to `LEVELS` in index.html.\n"
    "- Needs to be served over http(s) (GitHub Pages is fine). Opening the file directly with file:// won't load levels.\n")
print(json.dumps(manifest, indent=1))
