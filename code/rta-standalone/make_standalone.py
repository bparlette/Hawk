#!/usr/bin/env python3
"""Make a standalone single-game HTML from the combined arcade file.
usage: make_standalone.py <combined index.html> <level number 1-based> <out.html>
Keeps the shared helpers + shell, drops every other game object, and sets GAMES=[that game].
The shell's title grid then shows a single tile; the standalone build should replace the title
with a game-specific title card (tap to play)."""
import re, sys
src, n, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
L = open(src, encoding="utf-8").read().split("\n")
g = next(i for i, l in enumerate(L) if re.match(r"\s*var GAMES\s*=\s*\[", l))
names = [x.strip() for x in re.search(r"\[(.*)\]", L[g]).group(1).split(",") if x.strip()]
starts = []
for nm in names:
    i = next(i for i, l in enumerate(L) if re.match(r"\s*var %s\s*=\s*\{" % re.escape(nm), l))
    j = i
    while j > 0 and (L[j-1].strip().startswith("/*") or L[j-1].strip() == ""):
        j -= 1
    starts.append(j)
keep = names[n-1]
a, b = starts[n-1], (starts[n] if n < len(names) else g)
body = L[:starts[0]] + L[a:b] + [re.sub(r"\[.*\]", "[%s]" % keep, L[g])] + L[g+1:]
html = "\n".join(body)
html = re.sub(r"<title>[^<]*</title>", "<title>%s</title>" % re.search(r'title:\s*"([^"]*)"', "\n".join(L[a:b])).group(1).title(), html, 1)
open(out, "w", encoding="utf-8").write(html)
print("wrote", out, keep)
