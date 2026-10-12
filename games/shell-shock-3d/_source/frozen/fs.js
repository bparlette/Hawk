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
    ["fullscreenchange", "webkitfullscreenchange"].forEach((t) => document.addEventListener(t, () => { if (!fsEl() && root.classList.contains("fill") && root.dataset.fsReal) setFill(false); root.dataset.fsReal = fsEl() ? "1" : ""; if (fsEl()) onOrient(); refit(); }));
    if (navigator.standalone || matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches) setFill(true);
    // Turning the phone sideways locks the game into full screen; turning it back upright restores the cabinet
    // (unless the player turned full screen on themselves with the button).
    const land = matchMedia("(orientation: landscape) and (pointer: coarse)");
    let auto = false;
    function onOrient() {
      const on = root.classList.contains("fill");
      if (land.matches && !on) { auto = true; setFill(true); }
      else if (!land.matches && on && auto) { auto = false; setFill(false); }
    }
    btn.addEventListener("pointerup", () => { auto = false; }, true);
    if (land.addEventListener) land.addEventListener("change", onOrient); else land.addListener(onOrient);
    // Android/Chrome: in landscape without real full screen, the next tap goes truly full screen and locks landscape.
    // Listens in the capture phase, never cancels or stops the event, so gameplay input is untouched. No-op on iPhone.
    function tapFull(e) {
      try {
        if (!land.matches || fsEl() || (e.target && e.target.closest && e.target.closest("#fsbtn"))) return;
        const r = root.requestFullscreen || root.webkitRequestFullscreen; if (!r) return;
        const done = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {}); } catch (_) {} };
        const pr = r.call(root, { navigationUI: "hide" });
        if (pr && pr.then) pr.then(done, () => {}); else done();
      } catch (_) {}
    }
    ["pointerup", "touchend"].forEach((t) => document.addEventListener(t, tapFull, { capture: true, passive: true }));
    addEventListener("orientationchange", () => setTimeout(onOrient, 50));
    onOrient();
  })();