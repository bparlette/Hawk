import sys
OLD = """    const fill = document.documentElement.classList.contains("fill");
    const RX = fill ? 160 : 150, RW = fill ? 450 : 470, RY = fill ? 490 : 140, RH = fill ? 510 : 900;
    const S = Math.min(vw / RW, vh / RH);
    cabEl.style.setProperty("--S", S + "px");
    cabEl.style.left = ((vw - RW * S) / 2 - RX * S) + "px";
    cabEl.style.top = ((vh - RH * S) / 2 - RY * S) + "px";"""
NEW = """    const fill = document.documentElement.classList.contains("fill");
    const scrEl = document.getElementById("screen");
    if (fill) {
      // Fill mode: the game screen is pulled out of the cabinet and sized to the full width
      // (or as much height as is left above the control panel); the cabinet shows only its control panel at the bottom.
      const PX = 150, PW = 470, PY = 850, PH = 160;
      const portrait = vh >= vw;
      const S = portrait ? vw / PW : Math.min(vw / PW, (vh * 0.34) / PH);
      cabEl.style.setProperty("--S", S + "px");
      cabEl.style.left = ((vw - PW * S) / 2 - PX * S) + "px";
      cabEl.style.top = (vh - PH * S - PY * S) + "px";
      const availH = vh - PH * S;
      let gw = vw, gh = vw * 224 / 384;
      if (gh > availH) { gh = availH; gw = gh * 384 / 224; }
      scrEl.style.cssText = "position:fixed;z-index:20;left:" + ((vw - gw) / 2) + "px;top:" + Math.max(0, (availH - gh) / 2) + "px;width:" + gw + "px;height:" + gh + "px;border-radius:0";
    } else {
      scrEl.style.cssText = "";
      const S = Math.min(vw / 470, vh / 900);
      cabEl.style.setProperty("--S", S + "px");
      cabEl.style.left = ((vw - 470 * S) / 2 - 150 * S) + "px";
      cabEl.style.top = ((vh - 900 * S) / 2 - 140 * S) + "px";
    }"""
CSS_OLD = "  html.fill, html.fill body { height: 100dvh; }\n"
CSS_NEW = CSS_OLD + "  html.fill body { background: #000; }\n  html.fill #screen::after { border-radius: 0; }\n"
for f in sys.argv[1:]:
    h = open(f).read()
    assert OLD in h, f
    h = h.replace(OLD, NEW).replace(CSS_OLD, CSS_NEW, 1)
    open(f, "w").write(h); print("ok", f)
