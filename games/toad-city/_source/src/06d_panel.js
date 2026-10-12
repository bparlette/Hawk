
// ---------------- arcade control panel (touch screens): the Shell Shock cabinet panel from Brad's demos shell, docked under the game.
// Ball-top stick (analog, relative: the touch-down point is the centre, the thumb past the radius drags it along) + round arcade buttons:
// SWING (red), JUMP (yellow), the two white buttons orbit the camera, and ACT, the big glowing context button on the SPECIAL spot.
// Stick and buttons are ~18% larger than the demos shell (hit areas to match). ----------------
const APANEL = (function () {
  const panel = $('apanel'), deck = $('adeck'); if (!panel || !deck) return null;
  const PW = 470, PH = 135, K = 1.18, TOP = 22;
  const BTN = { a: { x: 266, y: 73, el: $('acap-a') }, b: { x: 343, y: 69, el: $('acap-b') }, c: { x: 419, y: 70, el: $('aact'), big: true }, l: { x: 163, y: 33, el: $('acap-l'), small: true }, r: { x: 243, y: 33, el: $('acap-r'), small: true } };
  let S = 1;
  function layout() {
    if (!document.body.classList.contains('touch')) { document.documentElement.style.setProperty('--panel', '0px'); return; }
    S = Math.min(innerWidth / PW, (innerHeight * 0.3) / (PH + TOP), 2.0);
    deck.style.setProperty('--S', S + 'px');
    document.documentElement.style.setProperty('--panel', Math.round((PH + TOP) * S) + 'px');
  }
  layout(); addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(() => { layout(); dispatchEvent(new Event('resize')); }, 250));
  const toDeck = (e) => { const r = deck.getBoundingClientRect(); return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S }; };
  function btnAt(p, sliding) {
    let best = null, bd = 1e9;
    for (const n of ['l', 'r']) { const b = BTN[n], d = Math.hypot(p.x - b.x, (p.y - b.y) * 1.3); if (d < 30 * K && d < bd) { bd = d; best = n; } }
    if (best) return best;
    if (p.x < 205 && !sliding) return null; // left side = joystick
    for (const n of ['a', 'b', 'c']) { const b = BTN[n], d = Math.hypot(p.x - b.x, (p.y - b.y) * 1.2) - (b.big ? 8 : 0); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  const JR = 44 * K; // CSS px radius
  const JOY = { id: null, cx: 0, cy: 0 };
  function joyMove(x, y) {
    let dx = x - JOY.cx, dy = y - JOY.cy, d = Math.hypot(dx, dy);
    if (d > JR) { const over = (d - JR) / d; JOY.cx += dx * over; JOY.cy += dy * over; dx *= 1 - over; dy *= 1 - over; d = JR; }
    const k = d > JR * 0.18 ? 1 : 0; TOUCHS.x = (dx / JR) * k; TOUCHS.y = (dy / JR) * k;
    $('astick').style.transform = `rotate(${(TOUCHS.x * 22).toFixed(1)}deg) translateY(${(TOUCHS.y * 2).toFixed(1)}%) scaleY(${(1 - 0.12 * TOUCHS.y).toFixed(3)})`;
    const ring = $('aring'), r = deck.getBoundingClientRect(); ring.style.left = (JOY.cx - r.left) + 'px'; ring.style.top = (JOY.cy - r.top) + 'px'; ring.style.width = ring.style.height = JR * 2 + 'px';
  }
  const PTR = new Map();
  const anyOn = (n) => { for (const v of PTR.values()) if (v === n) return true; return false; };
  function down(n) { BTN[n].el.classList.add('on'); TOUCHS.btn[n] = true; DEV = 'touch'; if (n === 'a') PRESS.add('j'); if (n === 'b') PRESS.add('k'); if (n === 'c') PRESS.add('e'); try { navigator.vibrate && navigator.vibrate(n === 'c' ? 14 : 8); } catch (_) {} }
  function up(n) { BTN[n].el.classList.remove('on'); TOUCHS.btn[n] = false; }
  function setBtn(id, n) { const prev = PTR.get(id); if (prev === n) return; PTR.set(id, n); if (prev && !anyOn(prev)) up(prev); if (n) down(n); }
  panel.addEventListener('pointerdown', (e) => {
    e.preventDefault(); audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); if (CINE.intro && CINE.intro.t > 0.4) CINE.intro.skip = true;
    try { panel.setPointerCapture(e.pointerId); } catch (_) {}
    const b = btnAt(toDeck(e), false); if (b) { setBtn(e.pointerId, b); return; }
    if (JOY.id === null) { JOY.id = e.pointerId; JOY.cx = e.clientX; JOY.cy = e.clientY; TOUCHS.stick = 'panel'; $('aring').classList.add('on'); joyMove(e.clientX, e.clientY); DEV = 'touch'; }
  });
  panel.addEventListener('pointermove', (e) => {
    if (e.pointerId === JOY.id) { e.preventDefault(); joyMove(e.clientX, e.clientY); return; }
    if (PTR.has(e.pointerId)) { const b = btnAt(toDeck(e), true); if (b) setBtn(e.pointerId, b); }
  });
  const release = (e) => {
    if (e.pointerId === JOY.id) { JOY.id = null; TOUCHS.stick = null; TOUCHS.x = TOUCHS.y = 0; $('astick').style.transform = ''; $('aring').classList.remove('on'); }
    if (PTR.has(e.pointerId)) { const prev = PTR.get(e.pointerId); PTR.delete(e.pointerId); if (prev && !anyOn(prev)) up(prev); }
  };
  panel.addEventListener('pointerup', release); panel.addEventListener('pointercancel', release);
  // ACT label / icon / glow / cooldown ring (called from the HUD tick)
  let cur = '';
  function setAct(ctx, cdFrac) {
    const lab = ctx ? ctx.label : 'ACT', kind = ctx ? ctx.kind : 'none', key = lab + kind + (ctx && ctx.ready === false ? 'c' : '');
    const el = BTN.c.el; el.style.setProperty('--cd', cdFrac.toFixed(3));
    if (key === cur) return; cur = key;
    $('albl-c').textContent = lab; $('aico').innerHTML = ICONS[kind] || ICONS.act;
    el.classList.toggle('hot', !!ctx && ctx.ready !== false); el.classList.toggle('cool', !!ctx && ctx.ready === false);
  }
  return { layout, setAct, BTN, get S() { return S; } };
})();
