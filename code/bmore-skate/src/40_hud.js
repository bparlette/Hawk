
// ======================= TOAD CITY SKATE: input (keyboard, touch stick + buttons, gamepad) + the HUD =======================
const SKH = (function () {
  const KEYS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D',
    Space: 'ollie', KeyJ: 'flip', KeyK: 'grab', KeyL: 'grind', ShiftLeft: 'special', ShiftRight: 'special', Semicolon: 'special', KeyI: 'special' };
  const dir = { L: 0, R: 0, U: 0, D: 0 }, stick = { x: 0, y: 0, id: null }, pad = { x: 0, y: 0, prev: [] };
  let onKey = null; // main hooks: pause / retry / start
  function press(k) { SKI.pressed.add(k); SKI.held[k] = 1; }
  function release(k) { SKI.held[k] = 0; }
  addEventListener('keydown', (e) => {
    const k = KEYS[e.code];
    if (onKey && onKey(e)) { e.preventDefault(); return; }
    if (!k) return; e.preventDefault();
    if (k.length === 1) dir[k] = 1; else if (!e.repeat) press(k);
  });
  addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (!k) return; if (k.length === 1) dir[k] = 0; else release(k); });
  addEventListener('blur', () => { for (const k in dir) dir[k] = 0; for (const k in SKI.held) SKI.held[k] = 0; stick.x = stick.y = 0; stick.id = null; knob(0, 0); });
  // touch: a fixed stick base (re-centres to the thumb), buttons with pointer capture (multi-touch)
  const zone = $('stickZone'), base = $('stickBase'), kn = $('stickKnob');
  let c0 = { x: 0, y: 0 }; const RAD = 54;
  function knob(x, y) { kn.style.transform = `translate(${x * RAD}px, ${-y * RAD}px)`; }
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault(); if (stick.id !== null) return; stick.id = e.pointerId; zone.setPointerCapture(e.pointerId);
    const r = base.getBoundingClientRect(); let cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (Math.hypot(e.clientX - cx, e.clientY - cy) > r.width * 0.75) { // re-centre the base under the thumb
      const zr = zone.getBoundingClientRect(); const nx = clamp(e.clientX - zr.left - r.width / 2, 4, zr.width - r.width - 4), ny = clamp(e.clientY - zr.top - r.height / 2, 4, zr.height - r.height - 4);
      base.style.left = nx + 'px'; base.style.top = ny + 'px'; base.style.bottom = 'auto'; cx = zr.left + nx + r.width / 2; cy = zr.top + ny + r.height / 2; }
    c0 = { x: cx, y: cy }; moveStick(e);
  });
  function moveStick(e) { let dx = (e.clientX - c0.x) / RAD, dy = -(e.clientY - c0.y) / RAD; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } stick.x = dx; stick.y = dy; knob(dx, dy); }
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) moveStick(e); });
  const endStick = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob(0, 0); base.style.left = ''; base.style.top = ''; base.style.bottom = ''; };
  zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick); zone.addEventListener('lostpointercapture', endStick);
  for (const b of document.querySelectorAll('.tb')) {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('dn'); press(k); SKA.unlock(); });
    const up = () => { b.classList.remove('dn'); release(k); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  }
  let touchUI = TOUCH; document.body.classList.toggle('touch', touchUI);
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !touchUI) { touchUI = true; document.body.classList.add('touch'); } }, { capture: true });
  // gamepad (standard mapping): A ollie, X flip, B grab, Y grind, RB / RT special, stick / d-pad steer
  const PADK = [[0, 'ollie'], [2, 'flip'], [1, 'grab'], [3, 'grind'], [5, 'special'], [7, 'special']];
  function pollPad() {
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g && g.connected) : null; if (!gp) { pad.x = pad.y = 0; return; }
    pad.x = Math.abs(gp.axes[0]) > 0.18 ? gp.axes[0] : 0; pad.y = Math.abs(gp.axes[1]) > 0.18 ? -gp.axes[1] : 0;
    if (gp.buttons[14] && gp.buttons[14].pressed) pad.x = -1; if (gp.buttons[15] && gp.buttons[15].pressed) pad.x = 1; if (gp.buttons[12] && gp.buttons[12].pressed) pad.y = 1; if (gp.buttons[13] && gp.buttons[13].pressed) pad.y = -1;
    for (const [i, k] of PADK) { const on = !!(gp.buttons[i] && gp.buttons[i].pressed); if (on && !pad.prev[i]) press(k); if (!on && pad.prev[i]) release(k); pad.prev[i] = on; }
    if (gp.buttons[9] && gp.buttons[9].pressed && !pad.prev[9] && onKey) onKey({ code: 'Escape', preventDefault() {} }); pad.prev[9] = !!(gp.buttons[9] && gp.buttons[9].pressed);
  }
  function read() { // fold every source into SKI.sx / sy
    pollPad();
    let x = dir.R - dir.L + stick.x + pad.x, y = dir.U - dir.D + stick.y + pad.y;
    SKI.sx = clamp(x, -1, 1); SKI.sy = clamp(y, -1, 1);
  }
  // ---------------- HUD ----------------
  const E = { scoreN: $('scoreN'), spec: $('spec'), specF: $('specF'), timer: $('timer'), goals: $('goals'), trick: $('trick'), trickL: $('trickL'), trickP: $('trickP'), bal: $('bal'), balK: $('balK'), banner: $('banner'), toast: $('toast'), count: $('count'), bSpec: $('bSpec') };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  let bannerT = 0, toastT = 0, trickHold = 0, lastScore = -1, lastSpec = -1, lastTime = '', lastTrick = '';
  function banner(html, t = 1.3) { E.banner.innerHTML = html; E.banner.classList.add('on'); bannerT = t; }
  function toast(html, t = 2.6) { E.toast.innerHTML = html; E.toast.classList.add('on'); toastT = t; }
  function count(txt) { E.count.textContent = txt; E.count.classList.remove('on'); void E.count.offsetWidth; E.count.classList.add('on'); if (!txt) E.count.classList.remove('on'); }
  function goalsChips(G) {
    E.goals.innerHTML = G.list.map((g) => g.id === 'skate'
      ? `<div class="gc${g.done ? ' done' : ''}">${'SKATE'.split('').map((c) => `<b class="${SKP.S.letters.has(c) ? 'on' : ''}">${c}</b>`).join('')}</div>`
      : `<div class="gc${g.done ? ' done' : ''}">${g.chip}</div>`).join('');
  }
  function trickShow(cls) {
    const S = SKP.S, c = S.combo;
    if (c.list.length) {
      const L = c.list, shown = L.length > 7 ? ['…'].concat(L.slice(-6)) : L; const txt = shown.join(' + ');
      if (txt !== lastTrick) { E.trickL.textContent = txt; lastTrick = txt; }
      E.trickP.innerHTML = `${fmt(c.pts + c.live)} <span>× ${Math.max(1, c.mult)}</span>`; E.trick.className = 'ui on'; trickHold = 0;
    } else if (cls) { E.trick.className = 'ui on ' + cls; trickHold = 1.3; }
    else if (trickHold <= 0) { E.trick.className = 'ui'; lastTrick = ''; }
  }
  function onBank(total, mult) { E.trickP.innerHTML = `+${fmt(total)}`; trickShow('bank'); }
  function onBail(lost) { E.trickP.innerHTML = lost > 0 ? fmt(lost) : 'BAIL'; trickShow('bail'); }
  function update(rdt, G) {
    const S = SKP.S;
    if (S.score !== lastScore) { E.scoreN.textContent = fmt(S.score); lastScore = S.score; }
    const sp = Math.round(S.special * 100); if (sp !== lastSpec) { E.specF.style.width = sp + '%'; lastSpec = sp; }
    E.spec.classList.toggle('on', S.specialOn); E.bSpec.classList.toggle('on', S.specialOn);
    const tl = Math.max(0, G.timeLeft), ts = `${Math.floor(Math.ceil(tl) / 60)}:${String(Math.ceil(tl) % 60).padStart(2, '0')}`;
    if (ts !== lastTime) { E.timer.textContent = ts; lastTime = ts; E.timer.classList.toggle('low', tl <= 10 && G.state === 'play'); }
    if (trickHold > 0) trickHold -= rdt;
    trickShow();
    // balance meter (grind = sideways, manual = fore/aft)
    const showBal = S.mode === 'grind' || S.mode === 'manual';
    E.bal.style.display = showBal ? 'block' : 'none';
    if (showBal) { E.bal.classList.toggle('v', S.mode === 'manual'); E.balK.style.left = (50 + clamp(S.bal, -1, 1) * 46) + '%'; E.bal.classList.toggle('warn', Math.abs(S.bal) > 0.7); }
    if (bannerT > 0) { bannerT -= rdt; if (bannerT <= 0) E.banner.classList.remove('on'); }
    if (toastT > 0) { toastT -= rdt; if (toastT <= 0) E.toast.classList.remove('on'); }
  }
  function keysHtml() {
    return document.body.classList.contains('touch')
      ? 'Left thumb: <b>stick</b> steer · up push · down brake<br><b>OLLIE</b> pop · <b>FLIP</b>/<b>GRAB</b> + stick in the air · <b>GRIND</b> near a rail (or on flat ground to manual) · fill the meter for <b>SPECIAL</b>'
      : '<b>←→</b>/<b>A D</b> steer · <b>↑</b> push · <b>↓</b> brake · <b>SPACE</b> ollie<br><b>J</b> flip · <b>K</b> grab (+ arrows) · <b>L</b> grind / manual · <b>SHIFT</b> special · <b>P</b> pause · <b>M</b> mute';
  }
  return { read, update, banner, toast, count, goalsChips, onBank, onBail, keysHtml, setOnKey: (f) => { onKey = f; }, fmt, stick, dir };
})();
