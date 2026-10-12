(() => {
  const mobile = document.body.classList.contains('touch') && window.__botMobile;
  const B = window.__bot = { log: [], holdFor: null, taken: {}, done: false, counters: {} };
  const CODES = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', punchL: 'KeyJ', punchR: 'KeyK', star: 'Space' };
  let pid = 10;
  function down(a) {
    if (mobile) { const b = document.querySelector(`[data-a="${a}"]`); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: ++pid, pointerType: 'touch' })); }
    else dispatchEvent(new KeyboardEvent('keydown', { code: CODES[a], key: a === 'star' ? ' ' : CODES[a], bubbles: true, cancelable: true }));
  }
  function up(a) {
    if (mobile) { const b = document.querySelector(`[data-a="${a}"]`); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: pid, pointerType: 'touch' })); }
    else dispatchEvent(new KeyboardEvent('keyup', { code: CODES[a], key: CODES[a], bubbles: true, cancelable: true }));
  }
  const tap = (a, ms) => { down(a); setTimeout(() => up(a), ms); };
  let busy = 0, lastAdv = 0, headNext = true, hayTried = -1, atkId = 0, lastState = '';
  const cnt = (k) => (B.counters[k] = (B.counters[k] || 0) + 1);
  setInterval(() => {
    const S = window.__ko.S, now = performance.now();
    if (S.hold) return;
    if (S.scene === 'title' || S.scene === 'intro' || S.scene === 'tip') {
      if (S.scene === 'intro' && S.st > 1.2 && !B.taken.intro) { S.hold = true; B.holdFor = 'intro'; return; }
      if (S.scene === 'intro' && !B.taken.intro) return;
      if (now - lastAdv > 900) { lastAdv = now; tap('punchL', 40); }
      return;
    }
    if (S.scene === 'end') { B.done = true; return; }
    const o = S.opp, h = S.hero;
    if (o.state + o.atk !== lastState) { if (o.state === 'windup') atkId++; lastState = o.state + o.atk; }
    if (S.phase === 'over') { if (S.endT > 0.7 && !B.taken.ko && (S.result.type === 'KO' || S.result.type === 'TKO')) { S.hold = true; B.holdFor = 'ko'; } return; }
    if (S.count && S.count.who === 'hero') { if (now > busy) { tap('punchL', 30); busy = now + 70; } return; }
    if (S.phase !== 'fight' || now < busy) return;
    if (o.state === 'windup') {
      const rem = o.dur - o.t;
      if (o.atk === 'hook' && rem <= 0.2 && !B.taken.fight) { S.hold = true; B.holdFor = 'fight'; return; }
      if (o.atk === 'hay') {
        if (hayTried !== atkId && o.t > 0.35 && h.state === 'idle' && !h.tired && Math.random() < 0.6) { hayTried = atkId; down('up'); setTimeout(() => { tap('punchR', 40); setTimeout(() => up('up'), 60); }, 20); busy = now + 300; cnt('hayInterrupt'); return; }
        if (rem < 0.26 && h.state === 'idle') { down('down'); setTimeout(() => up('down'), 420); busy = now + 600; cnt('duck'); }
        return;
      }
      if (rem < 0.2 && (h.state === 'idle' || h.state === 'block')) { const d = Math.random() < 0.5 ? 'left' : 'right'; down(d); setTimeout(() => up(d), 320); busy = now + 520; cnt('dodge'); }
      return;
    }
    if (['miss', 'dizzy', 'stun', 'taunt'].includes(o.state) && h.state === 'idle' && !h.tired) {
      if (h.stars > 0 && o.hp <= 8 + 10 * h.stars) { tap('star', 40); busy = now + 700; cnt('star'); return; }
      const hand = Math.random() < 0.5 ? 'punchL' : 'punchR';
      if (headNext) { down('up'); setTimeout(() => { tap(hand, 40); setTimeout(() => up('up'), 60); }, 15); } else tap(hand, 40);
      headNext = !headNext; busy = now + 265; cnt('punch');
    }
  }, 16);
})();
