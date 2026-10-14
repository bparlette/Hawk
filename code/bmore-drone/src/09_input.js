
// ======================= input: keyboard, gamepad (standard mapping), touch dual sticks =======================
// Everything lands in IN as Mode-2 drone axes:  lx = yaw, ly = throttle/lift (left stick)   rx = roll/strafe, ry = pitch/forward (right stick)
// plus boost. Arcade keys: W/S forward, A/D turn, Up/Down (or Space/C) altitude, Left/Right (or Q/E) strafe.
// Acro keys (Mode 2): W/S throttle, A/D yaw, arrows pitch/roll.
const IN = { lx: 0, ly: 0, rx: 0, ry: 0, boost: false, src: 'kb', touchL: null, touchR: null, pad: null };
const KEYS = new Set(), PRESS = new Set();
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(); if (!e.repeat) PRESS.add(k); KEYS.add(k); IN.src = 'kb';
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
});
addEventListener('keyup', (e) => KEYS.delete(e.key.toLowerCase()));
addEventListener('blur', () => KEYS.clear());
const kv = (a, b) => (KEYS.has(a) ? 1 : 0) - (KEYS.has(b) ? 1 : 0);
const dz = (v, d = 0.12) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));
// touch sticks: the left / right halves of the lower screen; a stick appears where the thumb lands (floating)
const STICKS = (function () {
  const mk = (id) => { const el = document.getElementById(id); return { el, knob: el && el.querySelector('.knob'), id: null, x0: 0, y0: 0, x: 0, y: 0 }; };
  const L = mk('stL'), R = mk('stR'), RAD = 56;
  function place(s, show) { if (!s.el) return; s.el.style.opacity = show ? '1' : ''; if (show) { s.el.style.left = s.x0 - 70 + 'px'; s.el.style.top = s.y0 - 70 + 'px'; } else { s.el.style.left = s.el.style.top = ''; } s.knob.style.transform = `translate(${s.x * RAD}px, ${s.y * RAD}px)`; }
  function down(e) {
    if (!document.body.classList.contains('racing')) return;
    for (const t of e.changedTouches) {
      if (t.target.closest && t.target.closest('.btn, button, #hudTop')) continue;
      const s = t.clientX < innerWidth / 2 ? L : R; if (s.id !== null) continue;
      s.id = t.identifier; s.x0 = t.clientX; s.y0 = t.clientY; s.x = s.y = 0; place(s, true); IN.src = 'touch';
    }
  }
  function move(e) { for (const t of e.changedTouches) for (const s of [L, R]) if (s.id === t.identifier) {
    let dx = (t.clientX - s.x0) / RAD, dy = (t.clientY - s.y0) / RAD; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } s.x = dx; s.y = dy; place(s, true); } }
  function up(e) { for (const t of e.changedTouches) for (const s of [L, R]) if (s.id === t.identifier) { s.id = null; s.x = s.y = 0; place(s, false); } }
  addEventListener('touchstart', down, { passive: true }); addEventListener('touchmove', move, { passive: true }); addEventListener('touchend', up); addEventListener('touchcancel', up);
  return { L, R, reset() { for (const s of [L, R]) { s.id = null; s.x = s.y = 0; place(s, false); } } };
})();
const PADPREV = [];
function pollInput(acro) {
  let lx = 0, ly = 0, rx = 0, ry = 0, boost = false;
  if (acro) { ly = kv('w', 's'); lx = kv('d', 'a'); ry = kv('arrowup', 'arrowdown'); rx = kv('arrowright', 'arrowleft'); }
  else {
    ry = Math.max(-1, Math.min(1, kv('w', 's'))); lx = kv('d', 'a'); ly = clamp(kv('arrowup', 'arrowdown') + kv(' ', 'c'), -1, 1); rx = clamp(kv('arrowright', 'arrowleft') + kv('e', 'q'), -1, 1);
  }
  boost = KEYS.has('shift') || (acro && KEYS.has(' '));
  // gamepad (standard mapping: axes 0/1 left, 2/3 right; RT 7 / A 0 boost; Start 9 pause; Y 3 camera)
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; IN.pad = null;
  for (const p of pads) { if (!p || !p.connected) continue; IN.pad = p;
    const a = p.axes; const plx = dz(a[0] || 0), ply = -dz(a[1] || 0), prx = dz(a[2] || 0), pry = -dz(a[3] || 0);
    // acro: Mode 2 (left throttle/yaw, right pitch/roll). arcade: left stick flies (forward + turn), right stick altitude + strafe
    if (plx || ply || prx || pry) { if (acro) { lx = plx; ly = ply; rx = prx; ry = pry; } else { lx = plx; ry = ply; rx = prx; ly = pry; } IN.src = 'pad'; }
    const b = (i) => p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.4);
    if (b(7) || b(0) || b(5)) boost = true;
    [[9, 'escape'], [3, 'v'], [0, 'enter'], [1, 'backspace'], [8, 'r']].forEach(([i, k]) => { const v = !!b(i); if (v && !PADPREV[i]) PRESS.add(k); PADPREV[i] = v; });
    break;
  }
  // touch sticks override when held
  if (acro) { if (STICKS.L.id !== null) { lx = STICKS.L.x; ly = -STICKS.L.y; } if (STICKS.R.id !== null) { rx = STICKS.R.x; ry = -STICKS.R.y; } }
  else { if (STICKS.L.id !== null) { lx = STICKS.L.x; ry = -STICKS.L.y; } if (STICKS.R.id !== null) { rx = STICKS.R.x; ly = -STICKS.R.y; } }
  if (IN.touchBoost) boost = true;
  IN.lx = lx; IN.ly = ly; IN.rx = rx; IN.ry = ry; IN.boost = boost;
}
