// Preload: bridges "quit" to the main process and injects the desktop-only tweaks into the page's main world.
// No game file is modified; the radio player and everything else in site/ run exactly as on the web.
'use strict';
const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('__toadcityHost', {
  quit: (why) => ipcRenderer.send('toadcity:quit', String(why || 'hotkey')),
  desktop: true,
});

function inject() {
  if (window.__toadcityDesktop) return;
  const HOLD_MS = 1000, IDLE_MS = 2000;
  const host = window.__toadcityHost;
  const css = `
    html.tc-nocursor, html.tc-nocursor * { cursor: none !important; }
    #tc-quit { position: fixed; z-index: 2147483647; left: 50%; bottom: 7vh; transform: translateX(-50%); padding: 10px 18px;
      border-radius: 10px; background: rgba(11,15,23,.85); border: 2px solid #ffd23c; color: #fff; font: 12px/1.3 'PX', 'Courier New', monospace;
      letter-spacing: .06em; pointer-events: none; opacity: 0; transition: opacity .12s; text-align: center; }
    #tc-quit .bar { height: 4px; margin-top: 8px; background: rgba(255,255,255,.25); border-radius: 2px; overflow: hidden; }
    #tc-quit .bar i { display: block; height: 100%; width: 0; background: #ffd23c; }
  `;
  const root = () => document.documentElement;
  // Cursor hidden from the first frame; it shows again only while the mouse moves, then hides after 2 s.
  if (root()) root().classList.add('tc-nocursor');
  function onReady() {
    root().classList.add('tc-nocursor', 'tc-desktop');
    const st = document.createElement('style'); st.id = 'tc-desktop-css'; st.textContent = css; (document.head || root()).appendChild(st);
    const q = document.createElement('div'); q.id = 'tc-quit'; q.innerHTML = 'HOLD TO QUIT<div class="bar"><i></i></div>'; document.body.appendChild(q);
    try { window.focus(); const gl = document.getElementById('gl'); if (gl && gl.focus) gl.focus({ preventScroll: true }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true }); else onReady();

  let idleT = 0;
  addEventListener('mousemove', () => {
    root().classList.remove('tc-nocursor'); clearTimeout(idleT);
    idleT = setTimeout(() => root().classList.add('tc-nocursor'), IDLE_MS);
  }, { capture: true, passive: true });

  // Quit: Esc held 1 s, or gamepad Select/Back (8) + Start (9) held 1 s. A quick Esc tap still reaches the game
  // (e.g. "ESC LEAVES" in the fort), and a quick Select still opens the map.
  let escDown = 0, padDown = 0, done = false;
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !escDown) escDown = performance.now(); }, true);
  addEventListener('keyup', (e) => { if (e.key === 'Escape') escDown = 0; }, true);
  addEventListener('blur', () => { escDown = 0; });
  function padCombo() {
    let pads = [];
    try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : []; } catch (_) {}
    for (const g of pads) {
      if (!g || !g.connected || !g.buttons) continue;
      const b = (i) => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
      if (b(8) && b(9)) return true;
    }
    return false;
  }
  function tick() {
    if (done) return;
    const now = performance.now();
    if (padCombo()) { if (!padDown) padDown = now; } else padDown = 0;
    const t0 = Math.min(escDown || Infinity, padDown || Infinity);
    const held = t0 === Infinity ? 0 : now - t0;
    const q = document.getElementById('tc-quit');
    if (q) { q.style.opacity = held > 200 ? '1' : '0'; const i = q.querySelector('i'); if (i) i.style.width = Math.min(100, held / HOLD_MS * 100) + '%'; }
    if (held >= HOLD_MS) {
      done = true;
      const why = padDown && (!escDown || padDown <= escDown) ? 'gamepad select+start' : 'esc';
      try { console.log('[toadcity] quitting via ' + why); } catch (_) {}
      if (host && host.quit) host.quit(why);
    }
  }
  setInterval(tick, 50);

  // ---------------- Xbox controller layer (standard Gamepad mapping, Bluetooth or USB) ----------------
  // Standard mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View, 9 Menu/Start, 10/11 stick clicks, 12-15 d-pad, 16 Xbox.
  // The game already reads A/B/X/Y, sticks, bumpers, triggers and View (map) itself. The wrapper adds:
  //   Start (tap)        -> pause / resume (a desktop pause screen; the game loop and its sound effects stop)
  //   View + Start (hold) -> quit to ES-DE (tick() above)
  // Start is left to the game where it already means something: Voltage Vic's intro and the fort's retry/done screens.
  const GLY = { A: '#5dc21e', B: '#e8262b', X: '#2f7cf6', Y: '#f2b70f' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', css2, { once: true }); else css2();
  function css2() {
    const st = document.createElement('style'); st.id = 'tc-xbox-css';
    st.textContent = `
      .tc-g { display: inline-flex; align-items: center; justify-content: center; width: 1.45em; height: 1.45em; border-radius: 50%;
        background: #1b1b1f; border: 2px solid currentColor; font: 800 0.8em/1 system-ui, -apple-system, sans-serif; vertical-align: middle;
        margin: 0 .12em; box-sizing: border-box; text-shadow: none; letter-spacing: 0; }
      #pkey.tc-gk { border-radius: 50% !important; background: #1b1b1f !important; border: 3px solid var(--tcg) !important; color: var(--tcg) !important;
        font-family: system-ui, -apple-system, sans-serif !important; font-weight: 800 !important; }
      #tc-pause { position: fixed; inset: 0; z-index: 2147483646; display: none; align-items: center; justify-content: center; flex-direction: column;
        background: rgba(11,15,23,.72); color: #fff; font: 14px/1.6 'PX', 'Courier New', monospace; letter-spacing: .06em; text-align: center; }
      #tc-pause.on { display: flex; }
      #tc-pause h1 { font: 28px/1.2 'PX', 'Courier New', monospace; color: #ffd23c; margin: 0 0 22px; text-shadow: 3px 3px 0 #14101f; }
      #tc-pause .row { margin: 6px 0; }
      #tc-pause .tc-pill { display: inline-block; padding: 1px 8px; border-radius: 9px; border: 2px solid #ccc; color: #eee; font: 700 .8em system-ui, sans-serif; }`;
    (document.head || document.documentElement).appendChild(st);
  }
  const pill = (t) => '<span class="tc-pill">' + t + '</span>';
  const glyph = (l) => '<span class="tc-g" style="color:' + GLY[l] + '">' + l + '</span>';
  function pauseEl() {
    let el = document.getElementById('tc-pause');
    if (!el && document.body) {
      el = document.createElement('div'); el.id = 'tc-pause';
      el.innerHTML = '<h1>PAUSED</h1>' +
        '<div class="row">' + pill('&#9776; START') + ' or ' + glyph('A') + ' resume</div>' +
        '<div class="row">hold ' + pill('&#10697; VIEW') + ' + ' + pill('&#9776; START') + ' for 1 s: quit to ES-DE</div>' +
        '<div class="row" style="opacity:.75;margin-top:18px">' + glyph('A') + ' jump · ' + glyph('X') + ' / ' + glyph('B') + ' swing · ' + glyph('Y') + ' act · LB/RB turn · ' + pill('VIEW') + ' map</div>';
      document.body.appendChild(el);
    }
    return el;
  }
  // pause = hold requestAnimationFrame callbacks (the game's frame loop) and suspend its AudioContexts; the radio keeps its own state.
  const rawRAF = window.requestAnimationFrame.bind(window);
  let paused = false, held = [];
  window.requestAnimationFrame = function (cb) { if (paused) { held.push(cb); return 0; } return rawRAF(cb); };
  const ctxs = [];
  for (const k of ['AudioContext', 'webkitAudioContext']) {
    const C = window[k]; if (!C) continue;
    const W = function (...a) { const c = new C(...a); ctxs.push(c); return c; };
    W.prototype = C.prototype; Object.setPrototypeOf(W, C); window[k] = W;
  }
  function setPaused(on) {
    if (paused === on) return; paused = on;
    const el = pauseEl(); if (el) el.classList.toggle('on', on);
    for (const c of ctxs) { try { on ? c.suspend() : c.resume(); } catch (_) {} }
    if (!on) { const q = held; held = []; for (const cb of q) rawRAF(cb); }
    try { console.log('[toadcity] ' + (on ? 'paused' : 'resumed')); } catch (_) {}
  }
  const gameOwnsStart = () => { try { return (typeof VIC !== 'undefined' && VIC.on) || (typeof FORT !== 'undefined' && FORT.on); } catch (_) { return false; } };
  let stDown = 0, stCombo = false, aPrev = false, bPrev = false;
  function padPoll() {
    let pads = [];
    try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : []; } catch (_) {}
    let st = false, vw = false, a = false, b = false;
    for (const g of pads) {
      if (!g || !g.connected || !g.buttons) continue;
      const p = (i) => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
      st = st || p(9); vw = vw || p(8); a = a || p(0); b = b || p(1);
    }
    const now = performance.now();
    if (st) { if (!stDown) { stDown = now; stCombo = false; } if (vw) stCombo = true; }
    else if (stDown) { // Start released: a short tap (no View during it) toggles pause
      if (!stCombo && now - stDown < 700 && (paused || !gameOwnsStart())) setPaused(!paused);
      stDown = 0;
    }
    if (paused && a && !aPrev) setPaused(false);
    aPrev = a; bPrev = b;
    window.__toadcityPad = { st, vw, a, b, paused };
  }
  setInterval(padPoll, 33);
  addEventListener('keydown', (e) => { if (paused && (e.key === 'Enter' || e.key === ' ')) setPaused(false); }, true);
  addEventListener('blur', () => { /* keep state; macOS focus changes should not unpause */ });

  // ---------------- Xbox glyphs on the game's own button prompts (only while the game says a pad is in use) ----------------
  const isPad = () => { try { return typeof DEV !== 'undefined' && DEV === 'pad'; } catch (_) { return false; } };
  const VERB0 = '(?:boost|hop|ram|ram-boost|fire|fires|swing|jump|act|quit|try|again|skip|aim|aims|brake|steer|leave|retry|start|confirm|back|throw|cast|reel|dodge|block|punch|kick)';
  const VERB = '(?:' + VERB0 + '|' + VERB0.toUpperCase() + ')';
  const RE = new RegExp('(^|[\\s·/(])([ABXY])(?=(?:\\s*/\\s*[ABXY])*(?::|\\s+' + VERB + '\\b))', 'g');
  function glyphText(node) {
    const t = node.nodeValue; if (!t || t.length > 160 || !/[ABXY]/.test(t)) return;
    RE.lastIndex = 0; if (!RE.test(t)) return; RE.lastIndex = 0;
    const span = document.createElement('span'); span.className = 'tc-gl';
    span.innerHTML = t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
      .replace(new RegExp('(^|[\\s·/(])([ABXY])(?=(?:\\s*/\\s*[ABXY])*(?::|\\s+' + VERB + '\\b))', 'g'), (m, pre, l) => pre + glyph(l))
      .replace(/(<\/span>)(\s*\/\s*)([ABXY])(?=[\s:])/g, (m, a, sep, l) => a + sep + glyph(l));
    if (span.innerHTML !== t) node.parentNode.replaceChild(span, node);
  }
  function sweep(root) {
    if (!isPad() || !root) return;
    const k = document.getElementById('pkey');
    if (k) { const l = (k.textContent || '').trim(); if (GLY[l]) { k.classList.add('tc-gk'); k.style.setProperty('--tcg', GLY[l]); } else k.classList.remove('tc-gk'); }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode && !n.parentNode.closest('script,style,#tc-pause,.tc-gl,#pkey') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const list = []; let n; while ((n = w.nextNode())) list.push(n);
    for (const x of list) glyphText(x);
  }
  let sweepQ = false;
  const mo = new MutationObserver(() => { if (sweepQ) return; sweepQ = true; setTimeout(() => { sweepQ = false; try { sweep(document.body); } catch (_) {} }, 120); });
  const startMO = () => { if (document.body) { mo.observe(document.body, { childList: true, subtree: true, characterData: true }); sweep(document.body); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startMO, { once: true }); else startMO();
  setInterval(() => { try { sweep(document.body); } catch (_) {} }, 1500); // DEV can flip to 'pad' without a DOM change

  window.__toadcityDesktop = { version: 2, padCombo, setPaused, isPaused: () => paused };
}

const code = '(' + inject.toString() + ')();';
try {
  if (contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: inject });
  else webFrame.executeJavaScript(code);
} catch (e) {
  try { webFrame.executeJavaScript(code); } catch (_) {}
}
