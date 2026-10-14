// Preload: bridges quit/launch to the main process and injects the app-only tweaks into the page's
// main world (no game files are modified).
'use strict';
const { contextBridge, ipcRenderer, webFrame } = require('electron');

const gameArg = (process.argv || []).find((a) => a.startsWith('--arcade-game='));
const GAME = gameArg ? gameArg.split('=')[1] : 'launcher';

contextBridge.exposeInMainWorld('__arcadeHost', {
  quit: (why) => ipcRenderer.send('arcade:quit', String(why || 'hotkey')),
  launch: (id) => ipcRenderer.send('arcade:launch', String(id)),
  game: GAME,
});

function arcadeInject(cfg) {
  if (window.__arcadeInjected) return; window.__arcadeInjected = true;
  const HOLD_MS = 1000, IDLE_MS = 2000;
  const host = window.__arcadeHost;
  const noTouch = !(navigator.maxTouchPoints > 0) && !('ontouchstart' in window);

  // ---- CSS: no browser chrome buttons, full-screen game, idle cursor hide ----
  const css = `
    #fsbtn, #trailerbtn { display: none !important; }
    html.arcade-nocursor, html.arcade-nocursor * { cursor: none !important; }
    html.arcade-notouch #cab { background: none !important; }
    html.arcade-notouch #cab > :not(#screen) { display: none !important; }
    html.arcade-notouch #screen { position: fixed !important; left: 0 !important; top: 0 !important;
      width: 100vw !important; height: 100vh !important; border-radius: 0 !important; z-index: 20 !important; }
    html.arcade-notouch #screen::after { border-radius: 0 !important; }
    #arcade-quit { position: fixed; z-index: 2147483647; left: 50%; bottom: 6vh; transform: translateX(-50%);
      padding: 10px 18px; border-radius: 10px; background: rgba(0,0,0,.78); color: #fff; font: 600 16px/1.2 -apple-system, Helvetica, Arial, sans-serif;
      letter-spacing: .04em; pointer-events: none; opacity: 0; transition: opacity .12s; }
    #arcade-quit .bar { height: 4px; margin-top: 8px; background: rgba(255,255,255,.25); border-radius: 2px; overflow: hidden; }
    #arcade-quit .bar i { display: block; height: 100%; width: 0; background: #ffd23a; }
  `;
  function root() { return document.documentElement; }
  function applyRoot() {
    const r = root(); if (!r) return false;
    if (cfg.game !== 'launcher') r.classList.add('fill'); // the game's own full-screen layout
    if (noTouch) r.classList.add('arcade-notouch');
    r.classList.add('arcade-app');
    return true;
  }
  if (!applyRoot()) {
    const mo = new MutationObserver(() => { if (applyRoot()) mo.disconnect(); });
    mo.observe(document, { childList: true, subtree: true });
  }
  function onReady() {
    applyRoot();
    const st = document.createElement('style'); st.id = 'arcade-css'; st.textContent = css; (document.head || root()).appendChild(st);
    const q = document.createElement('div'); q.id = 'arcade-quit'; q.innerHTML = 'HOLD TO QUIT<div class="bar"><i></i></div>'; document.body.appendChild(q);
    const refit = () => dispatchEvent(new Event('resize'));
    refit(); setTimeout(refit, 50); setTimeout(refit, 400);
    idle();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true }); else onReady();

  // ---- cursor: hide after 2 s without mouse movement ----
  let idleT = 0;
  function idle() {
    const r = root(); if (!r) return;
    r.classList.remove('arcade-nocursor'); clearTimeout(idleT);
    idleT = setTimeout(() => root() && root().classList.add('arcade-nocursor'), IDLE_MS);
  }
  ['mousemove', 'mousedown', 'wheel'].forEach((t) => addEventListener(t, idle, { capture: true, passive: true }));

  // ---- quit hotkeys: Esc held 1 s, or gamepad Select/Back (8) + Start (9) held 1 s ----
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
    const q = document.getElementById('arcade-quit');
    if (q) {
      q.style.opacity = held > 200 ? '1' : '0';
      const i = q.querySelector('i'); if (i) i.style.width = Math.min(100, held / HOLD_MS * 100) + '%';
    }
    if (held >= HOLD_MS) {
      done = true;
      const why = padDown && (!escDown || padDown <= escDown) ? 'gamepad select+start' : 'esc';
      try { console.log('[arcade] quitting via ' + why); } catch (_) {}
      if (host && host.quit) host.quit(why);
    }
  }
  setInterval(tick, 50);
  window.__arcade = { version: 1, game: cfg.game, padCombo };
}

const code = '(' + arcadeInject.toString() + ')(' + JSON.stringify({ game: GAME }) + ');';
try {
  if (contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: arcadeInject, args: [{ game: GAME }] });
  else webFrame.executeJavaScript(code);
} catch (e) {
  try { webFrame.executeJavaScript(code); } catch (_) {}
}
