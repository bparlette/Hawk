import sys,re
CSS = """
  #fsbtn { position: fixed; z-index: 50; top: calc(env(safe-area-inset-top, 0px) + 10px); right: calc(env(safe-area-inset-right, 0px) + 10px);
    width: 44px; height: 44px; border-radius: 12px; border: 1px solid rgba(255,255,255,.28); background: rgba(10,10,14,.55);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center;
    padding: 0; cursor: pointer; touch-action: manipulation; opacity: .8; }
  #fsbtn:active { transform: scale(.92); }
  #fsbtn svg { width: 22px; height: 22px; fill: none; stroke: #fff; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
  #fsbtn .ic-out { display: none; }
  html.fill #fsbtn .ic-in { display: none; }
  html.fill #fsbtn .ic-out { display: block; }
  html.fill, html.fill body { height: 100dvh; }
"""
BTN = """<button id="fsbtn" aria-label="Full screen" type="button"><svg class="ic-in" viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg><svg class="ic-out" viewBox="0 0 24 24"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg></button>
"""
JS = """
  // ---------- Full-screen toggle (top right) ----------
  (function () {
    const btn = document.getElementById("fsbtn"), root = document.documentElement;
    const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
    const refit = () => { dispatchEvent(new Event("resize")); setTimeout(() => dispatchEvent(new Event("resize")), 300); };
    function setFill(on) {
      root.classList.toggle("fill", on);
      btn.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
      if (on) scrollTo(0, 1);
      refit();
    }
    function toggle() {
      const on = !root.classList.contains("fill");
      try {
        if (on) {
          const r = root.requestFullscreen || root.webkitRequestFullscreen;
          if (r) { const p = r.call(root, { navigationUI: "hide" }); if (p && p.catch) p.catch(() => {}); }
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock("any").catch(() => {});
        } else if (fsEl()) {
          const x = document.exitFullscreen || document.webkitExitFullscreen;
          if (x) { const p = x.call(document); if (p && p.catch) p.catch(() => {}); }
        }
      } catch (e) {}
      setFill(on);
    }
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("pointerup", (e) => { e.preventDefault(); e.stopPropagation(); toggle(); });
    btn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    ["fullscreenchange", "webkitfullscreenchange"].forEach((t) => document.addEventListener(t, () => { if (!fsEl() && root.classList.contains("fill") && root.dataset.fsReal) setFill(false); root.dataset.fsReal = fsEl() ? "1" : ""; refit(); }));
    if (navigator.standalone || matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches) setFill(true);
  })();
"""
OLD_FIT = """    const S = Math.min(vw / 470, vh / 900);
    cabEl.style.setProperty("--S", S + "px");
    cabEl.style.left = ((vw - 470 * S) / 2 - 150 * S) + "px";
    cabEl.style.top = ((vh - 900 * S) / 2 - 140 * S) + "px";"""
NEW_FIT = """    // Normal: the whole cabinet face. Fill mode: crop tight to the CRT + control panel so the game fills the screen.
    const fill = document.documentElement.classList.contains("fill");
    const RX = fill ? 160 : 150, RW = fill ? 450 : 470, RY = fill ? 490 : 140, RH = fill ? 510 : 900;
    const S = Math.min(vw / RW, vh / RH);
    cabEl.style.setProperty("--S", S + "px");
    cabEl.style.left = ((vw - RW * S) / 2 - RX * S) + "px";
    cabEl.style.top = ((vh - RH * S) / 2 - RY * S) + "px";"""
META = """<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
"""
for f in sys.argv[1:]:
    h = open(f).read()
    if 'id="fsbtn"' in h: print("already", f); continue
    assert OLD_FIT in h, f
    h = h.replace(OLD_FIT, NEW_FIT)
    h = h.replace('user-scalable=no" />', 'user-scalable=no, viewport-fit=cover" />\n' + META, 1)
    h = h.replace("</style>", CSS + "</style>", 1)
    h = h.replace("<body>\n", "<body>\n" + BTN, 1)
    i = h.rfind("</script>")
    # insert JS inside the last inline script before its closing IIFE if any; simplest: separate script
    h = h.replace("</body>", "<script>" + JS + "</script>\n</body>", 1)
    open(f, "w").write(h); print("patched", f)
