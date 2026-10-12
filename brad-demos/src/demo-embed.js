/* demo-embed.js — injected as the FIRST script of every game copy on the demo site.
   Gives the parent shell a same-origin handle to suspend/resume the game:
   - rAF gate: while suspended, requestAnimationFrame callbacks are parked (the game loop stops)
   - AudioContexts created by the game are tracked and suspended/resumed
   - blur/focus + visibility-ish events so games release held keys
   Only active when the page is inside the demo shell (window.parent !== window). */
(function () {
  "use strict";
  if (window.parent === window) return; // opened directly: behave exactly like the original game
  var root = document.documentElement;
  root.classList.add("demo-embed");
  window.__DEMO_EMBED = true;

  var realRAF = window.requestAnimationFrame.bind(window);
  var realCAF = window.cancelAnimationFrame.bind(window);
  var paused = false, parked = [], seq = 1e9, frames = 0, lastT = -1;
  // frame counter (one per distinct rAF timestamp): the shell paces autostart key presses in game frames,
  // so a slow phone or a long asset load doesn't eat the presses
  window.requestAnimationFrame = function (cb) {
    if (!paused) return realRAF(function (t) { if (t !== lastT) { lastT = t; frames++; } cb(t); });
    var id = ++seq; parked.push({ id: id, cb: cb }); return id;
  };
  window.cancelAnimationFrame = function (id) {
    if (id > 1e9) { parked = parked.filter(function (p) { return p.id !== id; }); return; }
    realCAF(id);
  };

  var acs = [];
  ["AudioContext", "webkitAudioContext"].forEach(function (n) {
    var C = window[n]; if (!C) return;
    var W = function () {
      var ac = new (Function.prototype.bind.apply(C, [null].concat([].slice.call(arguments))))();
      acs.push(ac); return ac;
    };
    W.prototype = C.prototype;
    try { Object.setPrototypeOf(W, C); } catch (_) {}
    window[n] = W;
  });

  // last few key events the game window saw (lets tests confirm the shell's controls reach the game)
  var keylog = [];
  ["keydown", "keyup"].forEach(function (t) {
    window.addEventListener(t, function (e) { keylog.push(t[3] + ":" + e.code); if (keylog.length > 60) keylog.shift(); }, true);
  });

  window.__demo = {
    keylog: keylog,
    get paused() { return paused; },
    get frames() { return frames; },
    pause: function () {
      if (paused) return; paused = true;
      acs.forEach(function (ac) { try { if (ac.state === "running") { ac.__demoWasRunning = true; ac.suspend(); } } catch (_) {} });
      try { document.querySelectorAll("audio,video").forEach(function (m) { if (!m.paused) { m.__demoWas = 1; m.pause(); } }); } catch (_) {}
      try { window.dispatchEvent(new Event("blur")); } catch (_) {}
    },
    resume: function () {
      if (!paused) return; paused = false;
      acs.forEach(function (ac) { try { if (ac.__demoWasRunning) { ac.__demoWasRunning = false; ac.resume(); } } catch (_) {} });
      try { document.querySelectorAll("audio,video").forEach(function (m) { if (m.__demoWas) { m.__demoWas = 0; m.play().catch(function () {}); } }); } catch (_) {}
      var q = parked; parked = [];
      q.forEach(function (p) { realRAF(p.cb); });
      try { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("resize")); } catch (_) {}
    },
    audio: acs
  };
  // Games that ask for real fullscreen would fail inside the iframe anyway; keep them quiet.
  try {
    var noFs = function () { return Promise.resolve(); };
    Element.prototype.requestFullscreen = noFs;
    if (Element.prototype.webkitRequestFullscreen) Element.prototype.webkitRequestFullscreen = noFs;
  } catch (_) {}
})();
