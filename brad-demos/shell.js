/* Brad's demo shell: one page, every prototype.
   - picker (landing + menu) built from games.json
   - at most 2 iframes: the active game + 1 suspended (rAF parked, audio suspended); older ones destroyed
   - one shared arcade control panel (Shell Shock cabinet art) that injects KeyboardEvents into the active game
*/
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage"), picker = $("picker"), pickBody = $("pickBody"), panel = $("panel"), deck = $("deck");
  var GAMES = [], CATS = [], BY_ID = {};
  var active = null;     // { g, frame, held:Set, timers:[] }
  var suspended = null;  // same shape
  var LOG = (window.__demoLog = []);
  function log(s) { LOG.push(Date.now() % 100000 + " " + s); if (LOG.length > 200) LOG.shift(); }

  // ---------------------------------------------------------------- key table (code -> key / keyCode)
  var KT = {
    ArrowUp: ["ArrowUp", 38], ArrowDown: ["ArrowDown", 40], ArrowLeft: ["ArrowLeft", 37], ArrowRight: ["ArrowRight", 39],
    Enter: ["Enter", 13], Space: [" ", 32], Escape: ["Escape", 27], Backspace: ["Backspace", 8], Tab: ["Tab", 9],
    ShiftLeft: ["Shift", 16], ShiftRight: ["Shift", 16], ControlLeft: ["Control", 17], AltLeft: ["Alt", 18]
  };
  for (var c = 65; c <= 90; c++) { var ch = String.fromCharCode(c); KT["Key" + ch] = [ch.toLowerCase(), c]; }
  for (var d = 0; d <= 9; d++) KT["Digit" + d] = [String(d), 48 + d];

  function frameWin(s) { try { return s && s.frame && s.frame.contentWindow; } catch (_) { return null; } }
  function sendKey(s, code, type, repeat) {
    var w = frameWin(s); if (!w || !code) return;
    var doc; try { doc = w.document; } catch (_) { return; }
    if (!doc) return;
    var kt = KT[code] || [code, 0];
    var Ctor = w.KeyboardEvent || KeyboardEvent;
    var ev;
    try {
      ev = new Ctor(type, { key: kt[0], code: code, keyCode: kt[1], which: kt[1], bubbles: true, cancelable: true, composed: true, repeat: !!repeat });
    } catch (_) { return; }
    try { Object.defineProperty(ev, "keyCode", { get: function () { return kt[1]; } }); Object.defineProperty(ev, "which", { get: function () { return kt[1]; } }); } catch (_) {}
    // Dispatch on the focused element (or body): it bubbles through document to window, so listeners on
    // window, document, body or a focused canvas all see it exactly once.
    var t = doc.activeElement && doc.activeElement !== doc.documentElement ? doc.activeElement : (doc.body || doc);
    try { t.dispatchEvent(ev); } catch (_) {}
  }
  function keyDown(code) { if (!active || !code) return; if (active.held.has(code)) return; active.held.add(code); sendKey(active, code, "keydown"); }
  function keyUp(code) { if (!active || !code) return; if (!active.held.has(code)) return; active.held.delete(code); sendKey(active, code, "keyup"); }
  function releaseAll(s) { if (!s) return; s.held.forEach(function (k) { sendKey(s, k, "keyup"); }); s.held.clear(); }
  function tap(code, ms) { keyDown(code); setTimeout(function () { keyUp(code); }, ms || 90); }

  // ---------------------------------------------------------------- per-game key map
  var DEF = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
  var DEF_LBL = { attack: "ATTACK", jump: "JUMP", special: "SPECIAL", start: "START", select: "" };
  function km(g, name) {
    var k = g && g.keys || {};
    if (Object.prototype.hasOwnProperty.call(k, name)) return k[name];
    return DEF[name] || null;
  }

  // ---------------------------------------------------------------- game lifecycle
  function makeFrame(g) {
    var f = document.createElement("iframe");
    f.title = g.title;
    f.setAttribute("allow", "autoplay; fullscreen; gamepad; screen-wake-lock");
    f.className = "active";
    f.src = g.path;
    return f;
  }
  function destroy(s) {
    if (!s) return;
    s.timers.forEach(clearTimeout); s.timers = [];
    try { releaseAll(s); } catch (_) {}
    var f = s.frame;
    try { f.src = "about:blank"; } catch (_) {}
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 50);
    log("destroy " + s.g.id);
  }
  function pauseS(s) {
    if (!s) return;
    releaseAll(s);
    var w = frameWin(s);
    try { w && w.__demo && w.__demo.pause(); } catch (_) {}
    try { w && w.dispatchEvent(new w.Event("blur")); } catch (_) {}
  }
  function resumeS(s) {
    if (!s) return;
    var w = frameWin(s);
    try { w && w.__demo && w.__demo.resume(); } catch (_) {}
  }
  function focusGame() {
    if (!active) return;
    try { active.frame.contentWindow.focus(); } catch (_) {}
  }

  function start(id) {
    var g = BY_ID[id]; if (!g) return;
    closePicker(true);
    if (active && active.g.id === id) { resumeS(active); focusGame(); return; }
    if (suspended && suspended.g.id === id) {
      // swap: the suspended game comes back instantly
      var back = suspended;
      suspended = null;
      if (active) { pauseS(active); active.frame.className = "suspended"; suspended = active; }
      active = back; active.frame.className = "active";
      resumeS(active); applyGame(active.g); focusGame();
      log("swap to " + id);
      persist();
      return;
    }
    // new game: drop the oldest, suspend the current
    if (suspended) { destroy(suspended); suspended = null; }
    if (active) { pauseS(active); active.frame.className = "suspended"; suspended = active; }
    var s = { g: g, frame: makeFrame(g), held: new Set(), timers: [], loaded: false };
    active = s;
    applyGame(g);
    $("loading").hidden = false;
    s.frame.addEventListener("load", function () {
      if (s.frame.src === "about:blank" || s !== active && s !== suspended) return;
      s.loaded = true;
      if (s === active) { $("loading").hidden = true; focusGame(); }
      runAutostart(s);
    });
    stage.appendChild(s.frame);
    log("start " + id);
    persist();
    maybeOrientationTip(g);
  }
  // Autostart: [delayMs, code] steps. Delays are paced in the game's own frames (60 fps => 16.7 ms each,
  // counted by demo-embed.js), so a slow device or a long asset load doesn't swallow the presses.
  // A wall-clock fallback (3x the delay) covers games whose loop doesn't use requestAnimationFrame.
  function runAutostart(s) {
    var seq = (s.g.autostart || []).slice(), i = 0, f0 = -1, tStep = Date.now();
    if (!seq.length) return;
    function frames() { var w = frameWin(s); try { return w && w.__demo ? w.__demo.frames : -1; } catch (_) { return -1; } }
    function tick() {
      if (i >= seq.length || (s !== active && s !== suspended)) return;
      if (s === active && !(frameWin(s) && frameWin(s).__demo && frameWin(s).__demo.paused)) {
        var fr = frames(); if (f0 < 0) f0 = fr;
        var need = Math.round(seq[i][0] / 16.7);
        if ((fr >= 0 && fr - f0 >= need) || ((fr < 0 || fr === f0) && Date.now() - tStep > seq[i][0] * 3)) {
          var code = seq[i][1]; i++;
          sendKey(s, code, "keydown"); setTimeout(function () { sendKey(s, code, "keyup"); }, 80);
          log("autostart " + s.g.id + " " + code + " @f" + fr);
          f0 = frames(); tStep = Date.now();
        }
      } else { tStep = Date.now(); }
      s.timers.push(setTimeout(tick, 50));
    }
    tick();
  }
  function restart() {
    if (!active) return;
    var id = active.g.id, old = active;
    active = null; destroy(old);
    start(id);
  }
  function persist() { try { localStorage.setItem("demo_last", active ? active.g.id : ""); } catch (_) {} }

  // ---------------------------------------------------------------- top bar + panel labels for the current game
  function applyGame(g) {
    $("title").textContent = g.title;
    document.title = g.title + " · Brad's Demos";
    $("restartBtn").hidden = false;
    var ex = $("extras"); ex.textContent = "";
    (g.extras || []).forEach(function (x) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = x.label;
      var down = function (e) { e.preventDefault(); b.classList.add("on"); keyDown(x.key); };
      var up = function (e) { e.preventDefault(); b.classList.remove("on"); keyUp(x.key); };
      b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
      ex.appendChild(b);
    });
    var L = g.labels || {};
    ["attack", "jump", "special", "start", "select"].forEach(function (n) {
      var key = km(g, n), lbl = $("lbl-" + n), cap = $("cap-" + n);
      var text = Object.prototype.hasOwnProperty.call(L, n) ? L[n] : (n === "select" ? "BACK" : DEF_LBL[n]);
      if (!key) text = n === "select" ? "" : (n === "start" ? "" : "—");
      // the cabinet art already prints ATTACK / JUMP / SPECIAL: only cover it when this game differs
      lbl.textContent = (text === DEF_LBL[n] && n !== "start") ? "" : text;
      cap.classList.toggle("off", !key);
    });
  }

  // ---------------------------------------------------------------- picker
  function buildPicker() {
    pickBody.textContent = "";
    CATS.forEach(function (cat) {
      var list = GAMES.filter(function (g) { return g.category === cat; });
      if (!list.length) return;
      var h = document.createElement("div"); h.className = "cat"; h.textContent = cat + " · " + list.length; pickBody.appendChild(h);
      var grid = document.createElement("div"); grid.className = "grid"; pickBody.appendChild(grid);
      list.forEach(function (g) {
        var b = document.createElement("button"); b.type = "button"; b.className = "card"; b.dataset.id = g.id;
        var im = document.createElement("img"); im.className = "th"; im.alt = ""; im.loading = "lazy"; im.decoding = "async";
        im.width = 320; im.height = 200;
        if (g.thumb) im.src = g.thumb;
        var nm = document.createElement("span"); nm.className = "nm"; nm.textContent = g.title;
        b.appendChild(im); b.appendChild(nm);
        var sh = document.createElement("span"); sh.className = "share"; sh.textContent = "⤴"; sh.title = "Copy share link";
        sh.addEventListener("click", function (e) {
          e.stopPropagation();
          var url = location.origin + location.pathname + "#" + g.id;
          function done(ok) {
            sh.textContent = ok ? "✓" : "✕";
            setTimeout(function () { sh.textContent = "⤴"; }, 1200);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
          } else {
            var ta = document.createElement("textarea"); ta.value = url; document.body.appendChild(ta);
            ta.select(); try { done(document.execCommand("copy")); } catch (_) { done(false); }
            document.body.removeChild(ta);
          }
        });
        b.appendChild(sh);
        b.addEventListener("click", function () { start(g.id); });
        grid.appendChild(b);
      });
    });
    var f = document.createElement("div"); f.className = "foot";
    f.textContent = GAMES.length + " games. Only the game you're playing runs; the last one stays paused for a quick switch back.";
    pickBody.appendChild(f);
  }
  function openPicker() {
    if (active) pauseS(active);
    [].forEach.call(pickBody.querySelectorAll(".card"), function (c) {
      c.classList.toggle("now", !!active && c.dataset.id === active.g.id);
      var old = c.querySelector(".badge"); if (old) old.remove();
      var tag = active && c.dataset.id === active.g.id ? "PLAYING" : suspended && c.dataset.id === suspended.g.id ? "PAUSED" : "";
      if (tag) { var s = document.createElement("span"); s.className = "badge" + (tag === "PAUSED" ? " sus" : ""); s.textContent = tag; c.appendChild(s); }
    });
    $("pickClose").hidden = !active;
    picker.hidden = false;
  }
  function closePicker(silent) {
    picker.hidden = true;
    if (!silent && active) { resumeS(active); focusGame(); }
  }
  $("menuBtn").addEventListener("click", function () { if (picker.hidden) openPicker(); else if (active) closePicker(); });
  $("pickClose").addEventListener("click", function () { closePicker(); });
  $("restartBtn").addEventListener("click", restart);

  // ---------------------------------------------------------------- arcade panel input
  var PW = 470, PH = 135;
  var BTN = {
    attack: { x: 266, y: 73, el: $("cap-attack") },
    jump: { x: 343, y: 69, el: $("cap-jump") },
    special: { x: 421, y: 73, el: $("cap-special") },
    start: { x: 163, y: 33, el: $("cap-start"), small: true },
    select: { x: 243, y: 33, el: $("cap-select"), small: true }
  };
  var S = 1;
  function layout() {
    var vw = innerWidth, vh = innerHeight;
    var coarse = matchMedia("(pointer: coarse)").matches;
    S = Math.min(vw / PW, (vh * (coarse ? 0.3 : 0.24)) / PH, 2.0);
    deck.style.setProperty("--S", S + "px");
    document.documentElement.style.setProperty("--ph", Math.round(PH * S) + "px");
  }
  addEventListener("resize", layout);
  addEventListener("orientationchange", function () { setTimeout(layout, 200); });
  layout();

  function toDeck(e) {
    var r = deck.getBoundingClientRect();
    return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S };
  }
  function btnAt(p, sliding) {
    // white buttons: only near them
    var best = null, bd = 1e9;
    ["start", "select"].forEach(function (n) {
      var b = BTN[n], dd = Math.hypot(p.x - b.x, (p.y - b.y) * 1.3);
      if (dd < 30 && dd < bd) { bd = dd; best = n; }
    });
    if (best) return best;
    if (p.x < 205 && !sliding) return null; // left side = joystick
    ["attack", "jump", "special"].forEach(function (n) {
      var b = BTN[n], dd = Math.hypot(p.x - b.x, (p.y - b.y) * 1.2);
      if (dd < bd) { bd = dd; best = n; }
    });
    return best;
  }

  // joystick: touch-down point is the centre (relative stick), thumb past the radius drags the centre along
  var JOY = { id: null, cx: 0, cy: 0, dirs: { up: false, down: false, left: false, right: false } };
  var JR = 44; // CSS px radius
  function setDirs(nd) {
    if (!active) return;
    var g = active.g;
    ["up", "down", "left", "right"].forEach(function (k) {
      if (nd[k] === JOY.dirs[k]) return;
      JOY.dirs[k] = nd[k];
      var code = km(g, k);
      if (code) { if (nd[k]) keyDown(code); else keyUp(code); }
    });
    var dx = (nd.right ? 1 : 0) - (nd.left ? 1 : 0), dy = (nd.down ? 1 : 0) - (nd.up ? 1 : 0);
    $("stick").style.transform = "rotate(" + dx * 22 + "deg) translateY(" + dy * 2 + "%) scaleY(" + (1 - 0.12 * dy) + ")";
  }
  function joyMove(x, y) {
    var dx = x - JOY.cx, dy = y - JOY.cy, d = Math.hypot(dx, dy);
    if (d > JR) { var over = (d - JR) / d; JOY.cx += dx * over; JOY.cy += dy * over; dx *= 1 - over; dy *= 1 - over; d = JR; }
    var nd = { up: false, down: false, left: false, right: false };
    if (d > JR * 0.22) { // dead zone
      // 8-way with generous diagonals: cardinals 36° wide, diagonals 54° wide
      var a = Math.atan2(dy, dx) * 180 / Math.PI;
      nd.right = a > -72 && a < 72;
      nd.left = a > 108 || a < -108;
      nd.down = a > 18 && a < 162;
      nd.up = a < -18 && a > -162;
    }
    setDirs(nd);
    var ring = $("ring"), r = deck.getBoundingClientRect();
    ring.style.left = (JOY.cx - r.left) + "px"; ring.style.top = (JOY.cy - r.top) + "px";
    ring.style.width = ring.style.height = JR * 2 + "px";
  }
  var PTR = new Map(); // pointerId -> button name
  function setBtn(id, name) {
    var prev = PTR.get(id);
    if (prev === name) return;
    PTR.set(id, name);
    if (prev && !anyOn(prev)) btnUp(prev);
    if (name) btnDown(name);
  }
  function anyOn(name) { var n = 0; PTR.forEach(function (v) { if (v === name) n++; }); return n > 0; }
  function btnDown(name) { BTN[name].el.classList.add("on"); if (active) keyDown(km(active.g, name)); buzz(8); }
  function btnUp(name) { BTN[name].el.classList.remove("on"); if (active) keyUp(km(active.g, name)); }
  function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} }

  panel.addEventListener("pointerdown", function (e) {
    e.preventDefault(); // keep focus inside the game iframe (desktop keyboard keeps working)
    try { panel.setPointerCapture(e.pointerId); } catch (_) {}
    var p = toDeck(e), b = btnAt(p, false);
    if (b) { setBtn(e.pointerId, b); return; }
    if (JOY.id === null) {
      JOY.id = e.pointerId; JOY.cx = e.clientX; JOY.cy = e.clientY;
      $("ring").classList.add("on"); joyMove(e.clientX, e.clientY);
    }
  });
  panel.addEventListener("pointermove", function (e) {
    if (e.pointerId === JOY.id) { e.preventDefault(); joyMove(e.clientX, e.clientY); return; }
    if (PTR.has(e.pointerId)) {
      var b = btnAt(toDeck(e), true);
      if (b) setBtn(e.pointerId, b); // slide between buttons; stays on the last one until it reaches another
    }
  });
  function release(e) {
    if (e.pointerId === JOY.id) { JOY.id = null; setDirs({ up: false, down: false, left: false, right: false }); $("ring").classList.remove("on"); }
    if (PTR.has(e.pointerId)) { var prev = PTR.get(e.pointerId); PTR.delete(e.pointerId); if (prev && !anyOn(prev)) btnUp(prev); }
  }
  panel.addEventListener("pointerup", release);
  panel.addEventListener("pointercancel", release);
  panel.addEventListener("lostpointercapture", release);
  panel.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  ["touchstart", "touchmove", "gesturestart", "dblclick"].forEach(function (t) {
    document.addEventListener(t, function (e) { if (e.target.closest && e.target.closest("#pickBody, button, a")) return; if (e.cancelable) e.preventDefault(); }, { passive: false });
  });

  // physical keyboard while focus is on the shell (e.g. after clicking the top bar): forward to the game
  addEventListener("keydown", function (e) {
    if (!picker.hidden) { if (e.key === "Escape" && active) closePicker(); return; }
    if (!active || e.metaKey || e.ctrlKey) return;
    if (/^Arrow|^Space$/.test(e.code)) e.preventDefault();
    if (e.repeat) return;
    keyDown(e.code);
  });
  addEventListener("keyup", function (e) { if (active) keyUp(e.code); });
  addEventListener("blur", function () { /* focus moved into the iframe: nothing held by the shell */ if (active) { JOY.id = null; } });
  document.addEventListener("visibilitychange", function () { if (document.hidden && active) releaseAll(active); });

  // ---------------------------------------------------------------- orientation tip
  var tipped = {};
  function maybeOrientationTip(g) {
    if (tipped[g.id] || g.orientation !== "landscape" || innerWidth > innerHeight || !matchMedia("(pointer: coarse)").matches) return;
    tipped[g.id] = 1;
    var t = $("toast"); t.textContent = "Tip: turn sideways for a bigger screen"; t.hidden = false; t.style.opacity = 1;
    setTimeout(function () { t.style.opacity = 0; setTimeout(function () { t.hidden = true; }, 450); }, 2600);
  }

  // ---------------------------------------------------------------- boot
  window.__demoShell = {
    start: start, openPicker: openPicker, closePicker: closePicker,
    get active() { return active && active.g.id; }, get suspended() { return suspended && suspended.g.id; },
    frames: function () { return stage.querySelectorAll("iframe").length; },
    key: function (code, ms) { tap(code, ms); }, keyDown: keyDown, keyUp: keyUp
  };
  fetch("games.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (m) {
    GAMES = m.games; CATS = m.categories || [];
    GAMES.forEach(function (g) { BY_ID[g.id] = g; if (CATS.indexOf(g.category) < 0) CATS.push(g.category); });
    buildPicker();
    var hash = (location.hash.match(/^#(?:play=)?([\w-]+)$/) || [])[1];
    if (hash && BY_ID[hash]) start(hash); else openPicker();
  }).catch(function (e) { pickBody.textContent = "Couldn't load the game list."; log("manifest error " + e); });
})();
