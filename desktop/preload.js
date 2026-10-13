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
  window.__toadcityDesktop = { version: 1, padCombo };
}

const code = '(' + inject.toString() + ')();';
try {
  if (contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: inject });
  else webFrame.executeJavaScript(code);
} catch (e) {
  try { webFrame.executeJavaScript(code); } catch (_) {}
}
