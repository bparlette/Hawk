#!/usr/bin/env python3
"""Engine patches for Levels 9-15 integration (idempotent). Usage: ss_integ_patch.py index.html"""
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
orig = s
def rep(old, new, tag):
    global s
    if new in s:
        print("already:", tag); return
    n = s.count(old)
    if n != 1: raise SystemExit(f"{tag}: expected 1 match, got {n}")
    s = s.replace(old, new); print("patched:", tag)

# (c) boss bar label: remember the last boss name so a vanished mid-level boss never falls back to ZAP-ROLLER
rep('const HUDS = { shown: 10, flash: new Array(10).fill(0), tick: 0, boss: 0, bossMax: 0, slide: 0 };',
    'const HUDS = { shown: 10, flash: new Array(10).fill(0), tick: 0, boss: 0, bossMax: 0, slide: 0, lastName: "" };', "huds-lastName")
rep('    const bossOn = zaps.length > 0;\n',
    '    const bossOn = zaps.length > 0;\n    if (rr) HUDS.lastName = rr.name || "RAMROD"; else if (zaps.length) HUDS.lastName = "ZAP-ROLLER";\n', "huds-remember")
rep('ptext(rr ? (rr.name || "RAMROD") : "ZAP-ROLLER", bx, by + 8, 1, "#c8ccd6", "left");',
    'ptext(rr ? (rr.name || "RAMROD") : HUDS.lastName || "ZAP-ROLLER", bx, by + 8, 1, "#c8ccd6", "left");', "huds-label")
rep('} else if (!bossOn) { HUDS.bossMax = 0; HUDS.boss = 0; }',
    '} else if (!bossOn) { HUDS.bossMax = 0; HUDS.boss = 0; HUDS.lastName = ""; }', "huds-reset")

# (d) stage map: all 15 stages are named up front (a loaded def still overrides its own name)
rep('const LV_NAMES = { 1: "HALLWAY FIRE" }, LV_FINAL = {};',
    'const LV_NAMES = { 1: "HALLWAY FIRE", 2: "STREET RUMBLE", 3: "SEWER SHOWDOWN", 4: "SUNSET SHRED", 5: "DOCKSIDE DOUBLE-CROSS", 6: "FROSTBITE BOULEVARD", 7: "SCRAPYARD SMASH", 8: "FORTRESS OF RAZORBACK",\n'
    '    9: "SHADOWS OF EDO", 10: "PIRATE SHIP", 11: "WILD WEST TRAIN", 12: "FUTURE NYC 2105", 13: "DIMENSION X", 14: "TECHNODROME PORTAL", 15: "SHREDDER\'S TOWER" }, LV_FINAL = { 15: true };', "map-names")
rep('    ptext("? = COMING SOON", 8, 36, 1, "#8a8aa8", "left");\n',
    '    if (Object.keys(LV_NAMES).length < N) ptext("? = COMING SOON", 8, 36, 1, "#8a8aa8", "left");\n    else if (LV_FINAL[N]) ptext("RED RING = FINALE", 8, 36, 1, "#ff8a7a", "left");\n', "map-legend")

# (b) a transient load failure of the next level must not turn the card into THE END... FOR NOW: retry once
rep('    const done = (ok) => {\n      if (rec.state !== "js") return;\n',
    '    const done = (ok) => {\n      if (rec.state !== "js") return;\n'
    '      if (!(ok && LEVELS[n - 1]) && !rec.retried && LV_NAMES[n]) { // known stage: one cache-busted retry before giving up\n'
    '        rec.retried = 1; try { tag.remove && tag.remove(); } catch (_) {}\n'
    '        const t2 = document.createElement("script"); rec.tag = t2;\n'
    '        t2.onload = () => { rec.state = "js"; done2(true); }; t2.onerror = () => done2(false);\n'
    '        t2.src = LV_SRC(n) + "?r=" + Date.now(); (document.head || document.body).appendChild(t2); return;\n'
    '      }\n', "inject-retry")
# done2 = same completion path without retry
rep('    tag.onload = () => done(true); tag.onerror = () => done(false);\n',
    '    const done2 = (ok) => { rec.retried = 1; done(ok); };\n    tag.onload = () => done(true); tag.onerror = () => done(false);\n', "inject-done2")

# (a) final:true results card: the true ending, then score entry
rep('    if (r.t > 60) ptext(fin ? "THE END" : gone ? "THE END... FOR NOW!" : "NEXT: LEVEL " + n1 + (nx ? " - " + nx.name : ""), W / 2, 142, 1, "#ff8c1a");',
    '    if (r.t > 60) { if (fin) { ptext("THE END", W / 2, 138, 2, Math.floor(STATE.t / 16) % 2 ? "#ffe060" : "#ff8c1a"); ptext("CONGRATULATIONS! THE CITY IS SAFE.", W / 2, 155, 1, "#7fd85a"); }\n'
    '      else ptext(gone ? "THE END... FOR NOW!" : "NEXT: LEVEL " + n1 + (nx || LV_NAMES[n1] ? " - " + (nx ? nx.name : LV_NAMES[n1]) : ""), W / 2, 142, 1, "#ff8c1a"); }', "results-final")

# (8) WATCH TRAILER title link
rep('  html.fill #fsbtn .ic-out { display: block; }\n',
    '  html.fill #fsbtn .ic-out { display: block; }\n'
    '  #trailerbtn { position: fixed; z-index: 50; left: 50%; transform: translateX(-50%);\n'
    '    bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);\n'
    '    display: none; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 999px;\n'
    '    border: 2px solid #ffd23c; background: rgba(10,10,14,.72); color: #ffd23c; text-decoration: none;\n'
    '    font: 800 14px/1 system-ui, -apple-system, sans-serif; letter-spacing: 2px;\n'
    '    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); touch-action: manipulation; }\n'
    '  #trailerbtn:active { transform: translateX(-50%) scale(.94); }\n'
    '  html.on-title #trailerbtn { display: inline-flex; }\n', "trailer-css")
fs = [l for l in s.split("\n") if l.startswith('<button id="fsbtn"')]
assert len(fs) == 1
rep(fs[0] + "\n", fs[0] + '\n<a id="trailerbtn" href="https://shellshock-trailer.surge.sh" target="_blank" rel="noopener" aria-label="Watch the trailer">&#9654; WATCH TRAILER</a>\n', "trailer-html")
rep('    scene.update();\n', '    scene.update();\n    document.documentElement.classList.toggle("on-title", STATE.scene === "title");\n', "trailer-toggle")
rep('  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));\n',
    '  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));\n'
    '  { const tb = document.getElementById("trailerbtn");\n'
    '    if (tb) ["pointerdown", "touchstart", "mousedown"].forEach((ev) => tb.addEventListener(ev, (e) => e.stopPropagation(), { passive: true })); }\n', "trailer-stop")
rep('    titleT++; if (titleT > 480) titleScoresFirst = false;\n',
    '    titleT++; if (titleT > 480) titleScoresFirst = false;\n    if (pressed.has("t")) { window.open("https://shellshock-trailer.surge.sh", "_blank"); return; }\n', "trailer-key")

if s != orig:
    open(p, "w", encoding="utf-8").write(s)
