/* clean-view.js — AR clip-studio universal CLEAN VIEW + PINCH ZOOM.
   Owner feedback fix (2026-11-16): "all the buttons should instantly disappear
   after 2 seconds of launch and only appear if you tap the screen — full field
   of view. Also let us zoom the camera in and out so it fits the screen better."

   1) AUTO-HIDING CHROME: every piece of UI (app bars/headers, the Clip Import
      bar incl. its "source:" status line, the MARK cluster, bottom bars) fades
      out 2 s after launch and 2 s after the last interaction. Any tap —
      including on the background/camera area — brings it all back. Taps on
      buttons work normally and reset the timer. While the user is dragging or
      drawing (pointer down / moving with a pointer down) the UI never hides.
      Align mode (body.aligning / #stage.aligning, plus per-app pin hooks)
      pins the UI visible and resets zoom, so TV-quad corner math stays true.
      Clip Import's REC MODE (body.ci-cleanmode) is respected: chrome stays
      hidden while it is active; its own exit button is never hidden.

   2) PINCH ZOOM: two-finger pinch scales the WHOLE STAGE (camera video +
      every overlay layer together, TV-quad alignment preserved) from 1x to
      3x, anchored at the pinch midpoint. Single-finger drag on the background
      pans while zoomed. Double-tap on the background resets to 1x centred.
      Mouse wheel zooms on desktop. Nothing is persisted.

   Wiring (per app, after the universal-kit wiring script):
     <script src="clean-view.js"></script>
     <script>CleanView.init({ ... });</script>
   Options:
     mode: 'wrap' (default — scene elements are moved into a #cv-stage
           wrapper that receives the zoom transform) or 'stage' (transform an
           existing stage element, generic-four family).
     stageSel: selector for mode 'stage' (default '#stage').
     chrome: extra chrome selectors to auto-hide, per app.
     pinBodyClasses: extra body classes that pin the UI (e.g. 'placing').
     pinSelector: selector that pins the UI while it matches (e.g. '#placeBtn.on').
     noPan: selector whose targets never start a pan (e.g. telestrator's draw canvas).

   Public API: window.CleanView = { init, pin(on), poke, resetZoom, state }.
   window.CleanView.pin(true/false) is the hook a scaffold can call to pin the
   UI visible (e.g. while a modal interaction runs). */
(function () {
  'use strict';
  if (window.CleanView) return;

  var HIDE_MS = 2000;
  /* Chrome that auto-hides in every app (universal-kit roots + scaffold bars). */
  var CHROME = ['#ci-root', '#ar-mark-root', '#topbar', '#bar', '.bar', '.topbar',
    '.btnrow', '.pillrow', '.controls', '#sheet', '#rate', '#hint', '.chip'];
  /* Body children that are NOT scene: never moved into the zoom wrapper.
     (Align overlays stay out so their viewport-coordinate drag math stays true;
     toasts/stamps are feedback and stay unscaled; #ci-exitclean is REC MODE's
     escape hatch.) */
  var WRAP_SKIP = '#ci-root, #ci-exitclean, #ar-mark-root, #ar-mark-stamp, ' +
    '#topbar, #bar, .bar, #toast, #alignui, #alignhint, #ar-align-ui, ' +
    '#quadSvg, .handle';
  /* Targets that never start a pan / never count as a background double-tap. */
  var INTERACTIVE = 'button, input, select, textarea, a, label, [contenteditable], ' +
    '.handle, .quad-handle, .ar-handle, #ci-root, #ar-mark-root, #alignui, ' +
    '#ar-align-ui, #topbar, #bar, .bar, .topbar, .btnrow, .pillrow, .controls, #sheet';

  var opts = {}, stageEl = null, inited = false;
  var hidden = false, timer = 0, pinApi = false;
  var scale = 1, tx = 0, ty = 0;
  var pointers = new Map();
  var pinch = null, pan = null, gesturePinched = false, lastTap = 0;

  /* ---------------- chrome hide/show ---------------- */
  function injectCSS(extraChrome) {
    var sels = CHROME.concat(extraChrome || []);
    var base = sels.join(',\n');
    var hide = sels.map(function (s) { return 'body.cv-hidden ' + s; }).join(',\n');
    var css =
      '#cv-stage{position:fixed;inset:0;z-index:0;touch-action:none;transform-origin:0 0;}\n' +
      base + '{transition:opacity .15s ease;}\n' +
      hide + '{opacity:0!important;visibility:hidden!important;pointer-events:none!important;' +
      'transition:opacity .15s ease,visibility 0s linear .16s;}\n';
    var st = document.createElement('style');
    st.id = 'cv-style';
    st.textContent = css;
    document.head.appendChild(st);
  }
  function show() {
    if (hidden) { hidden = false; document.body.classList.remove('cv-hidden'); }
  }
  function hide() {
    if (!hidden) { hidden = true; document.body.classList.add('cv-hidden'); }
  }
  function pinned() {
    if (pinApi) return true;
    if (document.body.classList.contains('aligning')) return true;
    var pc = opts.pinBodyClasses || [];
    for (var i = 0; i < pc.length; i++) if (document.body.classList.contains(pc[i])) return true;
    if (stageEl && stageEl.classList && stageEl.classList.contains('aligning')) return true;
    if (opts.pinSelector && document.querySelector(opts.pinSelector)) return true;
    return false;
  }
  function cleanMode() { return document.body.classList.contains('ci-cleanmode'); }
  /* Deadline-based watchdog, driven by BOTH a timer chain and a rAF chain:
     whichever the browser schedules first wins. (A lone setTimeout can fire
     seconds late on a CPU-starved page that is busy decoding video; rAF is
     already running in every one of these apps.) */
  var deadline = 0;
  function schedule(ms) { deadline = performance.now() + (ms || HIDE_MS); }
  function tick() {
    if (cleanMode()) { hide(); return; }
    if (pinned() || pointers.size > 0) {
      show();
      if (pinned()) resetZoom();
      schedule(400); /* stay alive while pinned / dragging */
      return;
    }
    if (performance.now() >= deadline) hide();
  }
  function startWatchdog() {
    (function timerLoop() { tick(); timer = setTimeout(timerLoop, 250); })();
    (function rafLoop() { tick(); requestAnimationFrame(rafLoop); })();
  }
  function poke() {
    if (cleanMode()) { hide(); schedule(500); return; }
    show();
    schedule();
  }

  /* ---------------- zoom ---------------- */
  function clampPan() {
    if (scale <= 1) { scale = 1; tx = 0; ty = 0; return; }
    var W = window.innerWidth, H = window.innerHeight;
    tx = Math.min(0, Math.max(W * (1 - scale), tx));
    ty = Math.min(0, Math.max(H * (1 - scale), ty));
  }
  function applyZoom() {
    if (!stageEl) return;
    clampPan();
    if (scale === 1 && tx === 0 && ty === 0) stageEl.style.transform = '';
    else stageEl.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + scale.toFixed(4) + ')';
  }
  function resetZoom() {
    if (scale === 1 && tx === 0 && ty === 0) return;
    scale = 1; tx = 0; ty = 0; applyZoom();
  }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  /* Background for tap / double-tap purposes: anything that isn't a control. */
  function isBgTarget(t) {
    if (!t || t === document || t === document.body || t === document.documentElement) return true;
    if (t.closest && t.closest(INTERACTIVE)) return false;
    return true;
  }
  /* Background for PAN purposes: additionally excludes per-app noPan zones
     (e.g. telestrator's draw canvas — a drag there must draw, not pan; pinch
     and double-tap reset still work there). */
  function isPanTarget(t) {
    if (!isBgTarget(t)) return false;
    if (opts.noPan && t.closest && t.closest(opts.noPan)) return false;
    return true;
  }

  function bindEvents() {
    document.addEventListener('pointerdown', function (e) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      poke();
      if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        pinch = { d: dist(pts[0], pts[1]), mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2 };
        gesturePinched = true;
        pan = null;
      } else if (pointers.size === 1 && scale > 1 && !pinned() && isPanTarget(e.target)) {
        pan = { x: e.clientX, y: e.clientY };
      }
    }, true);
    document.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      poke(); /* any drag/draw activity keeps the chrome alive */
      if (pinch && pointers.size === 2) {
        var pts = Array.from(pointers.values());
        var d = dist(pts[0], pts[1]);
        var mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
        if (pinch.d > 0 && !pinned()) {
          var ns = Math.min(3, Math.max(1, scale * d / pinch.d));
          var r = ns / scale;
          tx = mx - r * (pinch.mx - tx);
          ty = my - r * (pinch.my - ty);
          scale = ns;
          applyZoom();
        }
        pinch.d = d; pinch.mx = mx; pinch.my = my;
      } else if (pan && pointers.size === 1) {
        tx += e.clientX - pan.x;
        ty += e.clientY - pan.y;
        pan.x = e.clientX; pan.y = e.clientY;
        applyZoom();
      }
    }, true);
    function endPointer(e) {
      var wasDown = pointers.has(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        pan = null;
        if (wasDown && !gesturePinched && isBgTarget(e.target)) {
          var now = performance.now();
          if (now - lastTap < 350) { resetZoom(); lastTap = 0; }
          else lastTap = now;
        }
        gesturePinched = false;
      }
      if (wasDown) poke();
    }
    document.addEventListener('pointerup', endPointer, true);
    document.addEventListener('pointercancel', endPointer, true);
    document.addEventListener('wheel', function (e) {
      if (pinned() || cleanMode()) return;
      if (e.target && e.target.closest && e.target.closest(INTERACTIVE)) return;
      e.preventDefault();
      var ns = Math.min(3, Math.max(1, scale * (e.deltaY < 0 ? 1.12 : 0.89)));
      var r = ns / scale;
      tx = e.clientX - r * (e.clientX - tx);
      ty = e.clientY - r * (e.clientY - ty);
      scale = ns;
      applyZoom();
      poke();
    }, { passive: false });
    window.addEventListener('resize', applyZoom);
  }

  /* ---------------- init ---------------- */
  function init(o) {
    if (inited) return;
    inited = true;
    opts = o || {};
    injectCSS(opts.chrome);
    if (opts.mode === 'stage') {
      stageEl = document.querySelector(opts.stageSel || '#stage');
      if (stageEl) stageEl.style.touchAction = 'none';
    } else {
      stageEl = document.createElement('div');
      stageEl.id = 'cv-stage';
      var kids = Array.prototype.slice.call(document.body.childNodes);
      document.body.insertBefore(stageEl, document.body.firstChild);
      kids.forEach(function (n) {
        if (n.nodeType !== 1 || n === stageEl) return;
        var tag = n.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'INPUT' || tag === 'TEMPLATE') return;
        if (n.matches && n.matches(WRAP_SKIP)) return;
        stageEl.appendChild(n);
      });
      /* Reparenting a live <video> can pause it on some browsers — nudge it. */
      var cam = stageEl.querySelector('video');
      if (cam && cam.srcObject && cam.paused) { try { cam.play().catch(function () {}); } catch (e) {} }
    }
    if (stageEl) stageEl.style.transformOrigin = '0 0';
    bindEvents();
    var mo = new MutationObserver(function () {
      if (pinned()) { show(); resetZoom(); schedule(400); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (opts.mode === 'stage' && stageEl) mo.observe(stageEl, { attributes: true, attributeFilter: ['class'] });
    show();
    schedule();
    startWatchdog();
  }

  window.CleanView = {
    init: init,
    pin: function (on) {
      pinApi = !!on;
      if (pinApi) { show(); resetZoom(); schedule(400); }
      else schedule();
    },
    poke: poke,
    resetZoom: resetZoom,
    state: function () {
      return {
        hidden: hidden, scale: scale, tx: tx, ty: ty, pinned: pinned(),
        stage: stageEl ? (stageEl.id || stageEl.tagName) : null
      };
    }
  };
})();
