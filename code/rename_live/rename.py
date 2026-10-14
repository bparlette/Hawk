#!/usr/bin/env python3
# Painted -> Live, visible text only. Each rule: (old, new, expected_count). Asserts exact counts.
import sys, json
W = '/workspace/work/'
G = W + 'aistudio-games/games/'

LIVE_HOME = [
    ('<a href="#versus">PAINTED VS 16-BIT</a></nav>', '<a href="#versus">LIVE VS 16-BIT</a></nav>', 1),
    ('Every hero, boss and goon, in the painted art.', 'Every hero, boss and goon, in the live art.', 1),
    ('<h2>PAINTED VS 16-BIT</h2><p class="gsub">Every pose, painted next to its 16-bit sprite.',
     '<h2>LIVE VS 16-BIT</h2><p class="gsub">Every pose, live next to its 16-bit sprite.', 1),
    ('/* THE CAST + PAINTED VS 16-BIT:', '/* THE CAST + LIVE VS 16-BIT:', 1),
    ('el("figcaption",null,"PAINTED")', 'el("figcaption",null,"LIVE")', 1),
    ('+" "+p.n+" painted";', '+" "+p.n+" live";', 1),
]
B16_HOME = [
    ('<a href="#versus">16-BIT VS PAINTED</a></nav>', '<a href="#versus">16-BIT VS LIVE</a></nav>', 1),
    ('<h2>16-BIT VS PAINTED</h2>', '<h2>16-BIT VS LIVE</h2>', 1),
    ('16-bit next to the original painted art.', '16-bit next to the original live art.', 1),
    ('▶ Play the painted version</a>', '▶ Play the Live version</a>', 1),
    ('/* THE CAST (16-bit) + 16-BIT VS PAINTED', '/* THE CAST (16-bit) + 16-BIT VS LIVE', 1),
    ('el("figcaption",null,"PAINTED")', 'el("figcaption",null,"LIVE")', 1),
    ('+" "+p.n+" painted";', '+" "+p.n+" live";', 1),
]
GAME = [('.length + " PAINTED", W - 34, 12', '.length + " LIVE", W - 34, 12', 1)]
HUB = [
    ('<b>PLAY SHELL SHOCK LIVE</b><small>THE PAINTED ORIGINAL</small>', '<b>PLAY SHELL SHOCK LIVE</b><small>THE ORIGINAL</small>', 1),
    ('<b>PAINTED HOME &amp; TRAILER</b>', '<b>TRAILER LIVE</b>', 1),
    ('<b>16-BIT HOME &amp; TRAILER</b>', '<b>TRAILER 16-BIT</b>', 1),
]
README = [
    ('| `shell-shock-live/` | Painted game |', '| `shell-shock-live/` | Live game |', 1),
    ('| `shell-shock-live-home/` | Painted home page + trailer |', '| `shell-shock-live-home/` | Live home page + trailer |', 1),
    ('Every sprite pose, painted and 16-bit', 'Every sprite pose, Live and 16-bit', 1),
]
SPRITES = [('">painted</a> | <a href="16bit/', '">live</a> | <a href="16bit/', 540)]
PATCH_HTML = LIVE_HOME[1:3]
PATCH_JS = LIVE_HOME[3:]
APPLY = [('# Re-apply THE CAST + PAINTED VS 16-BIT sections', '# Re-apply THE CAST + LIVE VS 16-BIT sections', 1)]
SECIDX = [("Works on the painted page and the 16-bit page", "Works on the Live page and the 16-bit page", 1),
          ("else 'PAINTED VS 16-BIT'", "else 'LIVE VS 16-BIT'", 1)]

JOBS = {
    W + 'trailer_v2/site_final/index.html': LIVE_HOME,
    G + 'shell-shock-live-home/index.html': LIVE_HOME,
    W + 'g16js/trailer/index.html': B16_HOME,
    G + 'shell-shock-16bit-home/index.html': B16_HOME,
    W + 'deploy/shell-shock-live-action/index.html': GAME,
    W + 'g16js/site/index.html': GAME,
    G + 'shell-shock-live/index.html': GAME,
    G + 'shell-shock-16bit/index.html': GAME,
    G + 'index.html': HUB,
    G + 'README.md': README,
    G + 'sprites/index.html': SPRITES,
    W + 'sprites/out/index.html': SPRITES,
    W + 'trailer_v2/sprites_patch/sprites.html': PATCH_HTML,
    W + 'trailer_v2/sprites_patch/sprites.js': PATCH_JS,
    W + 'trailer_v2/sprites_patch/apply.py': APPLY,
    W + 'trailer_v2/sprites_patch/secindex.py': SECIDX,
}
report = {}
for p, rules in JOBS.items():
    s = open(p, encoding='utf-8').read(); n = 0
    for old, new, c in rules:
        got = s.count(old)
        if got == 0 and s.count(new) >= c:
            continue  # already applied
        assert got == c, (p, old, got, c)
        s = s.replace(old, new); n += got
    open(p, 'w', encoding='utf-8').write(s); report[p] = n
print(json.dumps(report, indent=1))
