// ---------------- GR1 writing wired in: thug bark bubbles, boss intro/defeat lines, landmark blurbs (radio bumpers live in 08_radio.js) ----------------
// One speech bubble on screen at a time (a DOM card that follows the speaker's head), lines picked by a cycling index per gang + kind
// (no repeats until a list wraps), per-thug cooldown, KO > HIT > TAUNT > IDLE priority. Polls thug states once per rendered frame,
// so the fight code in 06_game.js is untouched.
const BARK = (function () {
  const css = document.createElement('style');
  css.textContent = `
  #bark { position: fixed; z-index: 12; left: 0; top: 0; pointer-events: none; max-width: min(190px, 52vw); box-sizing: border-box; padding: 5px 9px 6px;
    background: #fffdf2; color: #14101f; border: 2.5px solid #000; border-radius: 11px; box-shadow: 3px 3px 0 #000;
    font: 800 13px/1.22 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: .1px; text-align: center; white-space: normal; overflow-wrap: break-word;
    opacity: 0; transform: translate(-50%, -100%) scale(.7); transform-origin: 50% 100%; transition: opacity .14s, transform .16s cubic-bezier(.2,1.5,.4,1); will-change: left, top; }
  #bark.on { opacity: 1; transform: translate(-50%, -100%) scale(1); }
  #bark::after { content: ""; position: absolute; left: var(--tx, 50%); bottom: -10px; width: 12px; height: 10px; margin-left: -6px; background: #fffdf2;
    clip-path: polygon(0 0, 100% 0, 30% 100%); filter: drop-shadow(0 2.5px 0 #000); }
  #bark::before { content: ""; position: absolute; left: var(--tx, 50%); bottom: -13.5px; width: 17px; height: 13px; margin-left: -8px; background: #000; clip-path: polygon(0 0, 100% 0, 30% 100%); }
  #bark.hit { background: #fff1c2; } #bark.hit::after { background: #fff1c2; }
  #bark.ko { background: #e9e4ff; color: #2a1650; font-style: italic; } #bark.ko::after { background: #e9e4ff; }
  #bark.boss { max-width: min(250px, 70vw); background: #2a1650; color: #fff; border-color: #000; box-shadow: 3px 3px 0 #000, inset 0 0 0 2px #ff3d6e; font-size: 14px; }
  #bark.boss::after { background: #2a1650; }
  #bark b { display: block; font: 8px/1.5 'PX', monospace; color: #ff3d6e; letter-spacing: .5px; margin-bottom: 1px; }
  #bark.boss b { color: #ffd23c; }
  #lmkb { left: 50%; top: calc(21% + 16px); transform: translate(-50%, 0); width: min(360px, calc(100vw - 28px)); box-sizing: border-box; padding: 6px 10px 7px;
    background: rgba(20,16,31,.84); border: 2px solid #000; box-shadow: 3px 3px 0 #000, inset 0 0 0 1px #ff9ad0; color: #fff; text-align: center;
    font: 700 12.5px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; opacity: 0; transition: opacity .35s; }
  #lmkb.on { opacity: 1; }
  #lmkb i { display: block; font-style: normal; color: #ffe08a; margin-top: 2px; }
  @media (max-width: 480px) { #bark { font-size: 12px; padding: 4px 8px 5px; } #bark.boss { font-size: 13px; } #lmkb { top: calc(21% + 12px); font-size: 12px; } }`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'bark'; el.className = 'ui'; el.setAttribute('aria-live', 'polite'); document.body.appendChild(el);
  const lb = document.createElement('div'); lb.id = 'lmkb'; lb.className = 'ui'; document.body.appendChild(lb);

  // ---- gangs: the game's thugs have no gang of their own, so each post takes the gang whose turf the GR1 lines describe (nearest landmark);
  // anything unmapped (or a gang missing from the pack) falls back to harbor_rats
  const TURF = { harborplace: 'harbor_rats', constellation: 'harbor_rats', wtc: 'harbor_rats', monument: 'harbor_rats', // north shore
    aquarium: 'pier_gulls', powerplant: 'pier_gulls',                                                                  // the piers
    fourseasons: 'cobble_catfish', pendry: 'cobble_catfish', fells: 'cobble_catfish',                                   // Harbor East / Fells Point
    orioles: 'masked_bandits', ravens: 'masked_bandits', science: 'masked_bandits',                                     // the west side, stadiums
    fedhill: 'key_hwy_otters', domino: 'key_hwy_otters', underarmour: 'key_hwy_otters', fort: 'key_hwy_otters' };       // south shore, Key Hwy
  const gangOf = (e) => { let best = null, bd = 1e9; for (const L of LANDMARKS) { const d = Math.hypot(L.x - e.post.x, L.z - e.post.z); if (d < bd) { bd = d; best = L; } }
    const g = best && TURF[best.id]; return g && GR1.gangs[g] ? g : 'harbor_rats'; };
  for (const e of enemies) { e.gang = gangOf(e); e.bkSt = e.state; e.bkHp = e.hp; e.bkCd = 0; }

  // ---- bosses: match GR1 boss ids to the boss named on each landmark ("The Raven King" -> raven_king, "Dr. Shellacious" -> dr_shellacious)
  const norm = (s) => s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const BOSSM = { matched: [], noLandmark: [] };
  for (const id of Object.keys(GR1.bosses)) { const L = LANDMARKS.find((l) => l.boss && norm(l.boss.name) === id);
    if (L) { L.boss.id = id; L.boss.lines = GR1.bosses[id]; BOSSM.matched.push(id + '@' + L.id); } else BOSSM.noLandmark.push(id); }
  const LMM = { matched: LANDMARKS.filter((l) => GR1.landmarks[l.id]).map((l) => l.id), noBlurb: LANDMARKS.filter((l) => !GR1.landmarks[l.id]).map((l) => l.id),
    noLandmark: Object.keys(GR1.landmarks).filter((k) => !LANDMARKS.some((l) => l.id === k)) };

  // ---- line picking: a cycling index per list, each list starting at its own fixed offset
  const IDX = {}; const pick = (key, arr) => { if (!arr || !arr.length) return null; if (IDX[key] === undefined) { let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0; IDX[key] = h % arr.length; } else IDX[key] = (IDX[key] + 1) % arr.length; return arr[IDX[key]]; };

  const PRI = { idle: 0, taunt: 1, hit: 2, ko: 3, boss: 4 }, LIFE = { idle: 2.6, taunt: 2.2, hit: 1.5, ko: 2.4, boss: 3.6 };
  const CD = 3.5, GAP = 0.7, IDLE_GAP = 5.5; // per-thug cooldown (s), quiet gap after any bubble, extra gap between idle chatter
  const B = { cur: null, t: 0, quietT: 0, idleT: 2, shown: 0, log: [], counts: { idle: 0, taunt: 0, hit: 0, ko: 0, boss: 0 }, on: true };
  const _p = new THREE.Vector3();

  function show(kind, text, who, at, label) { // at: { e } (follows a thug) or { x, y, z } (a fixed spot)
    B.cur = { kind, text, who, at, life: LIFE[kind], t0: S.time }; B.t = 0; B.shown++; B.counts[kind]++;
    B.log.push({ at: +S.time.toFixed(2), kind, who: who && who.id !== undefined ? 'thug' + who.id + ':' + who.gang : String(who), text }); if (B.log.length > 60) B.log.shift(); // plain strings only (never the Fighter)
    el.className = 'ui ' + kind; el.innerHTML = (label ? '<b>' + label + '</b>' : '') + text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    place(); void el.offsetWidth; el.classList.add('on');
  }
  function hide() { if (!B.cur) return; B.cur = null; el.classList.remove('on'); B.quietT = GAP; }
  function want(kind, e) { // a thug wants to speak: honour the one-bubble rule, priorities and cooldowns
    if (!B.on || CINE.intro) return false;
    if (e && e.bkCd > 0 && kind !== 'ko') return false;
    if (B.cur) { if (B.cur.who === e && e) return PRI[kind] > PRI[B.cur.kind]; return PRI[kind] > PRI[B.cur.kind] && B.t > 0.45 && kind !== 'idle'; }
    return B.quietT <= 0 || kind === 'ko';
  }
  function bark(e, kind) {
    if (!want(kind, e)) return false;
    const g = GR1.gangs[e.gang] || GR1.gangs.harbor_rats, line = pick(e.gang + '.' + kind, g[kind]); if (!line) return false;
    show(kind, line, e, { e }); e.bkCd = CD; if (kind === 'idle') B.idleT = IDLE_GAP; return true;
  }
  function bossSay(lmId, kind) { // kind 'intro' | 'defeat'; phase-5 boss fights call BARK.bossIntro / bossDefeat
    const L = LANDMARKS.find((l) => l.id === lmId || (l.boss && l.boss.id === lmId)); if (!L || !L.boss || !L.boss.lines) return null;
    const line = pick(L.boss.id + '.' + kind, L.boss.lines[kind]); if (!line) return null;
    const bp = L.boss.at || L.boss; show('boss', line, L.boss.id, bp.pos ? { e: bp } : { x: L.boss.x, y: (L.boss.y || CURB) + 2.4, z: L.boss.z }, L.boss.name.toUpperCase()); return line;
  }

  let rect = null, rectT = 0;
  function place() {
    const c = B.cur; if (!c) return;
    let x, y, z; if (c.at.e) { const e = c.at.e; x = e.pos.x; z = e.pos.z; y = e.pos.y + (e.y || 0) + (c.kind === 'ko' || e.state === 'down' || e.state === 'dying' ? 1.1 : 2.25 * (e.scale || 1)); } else ({ x, y, z } = c.at);
    _p.set(x, y, z).project(camera);
    if (!rect || rectT <= 0) { rect = renderer.domElement.getBoundingClientRect(); rectT = 0.5; }
    const behind = _p.z > 1; el.style.visibility = behind ? 'hidden' : 'visible'; if (behind) return;
    const w = el.offsetWidth || 150, h = el.offsetHeight || 40, m = 6;
    let sx = rect.left + (_p.x * 0.5 + 0.5) * rect.width, sy = rect.top + (-_p.y * 0.5 + 0.5) * rect.height - 8;
    const top0 = rect.top + (document.body.classList.contains('radio') ? 40 : 6) + h; // keep clear of the radio bar
    const cx = Math.min(Math.max(sx, rect.left + w / 2 + m), rect.right - w / 2 - m), cy = Math.min(Math.max(sy, top0), rect.bottom - m - 10);
    el.style.left = cx.toFixed(1) + 'px'; el.style.top = cy.toFixed(1) + 'px';
    el.style.setProperty('--tx', Math.min(Math.max(50 + (sx - cx) / w * 100, 14), 86).toFixed(1) + '%'); // tail points at the speaker
  }

  function tick(rdt) {
    const dt = SIM ? rdt * SIM : rdt; rectT -= rdt;
    B.quietT -= dt; B.idleT -= dt;
    for (const e of enemies) {
      e.bkCd -= dt; const was = e.bkSt, st = e.state, hpDrop = e.hp < e.bkHp; e.bkSt = st; e.bkHp = e.hp;
      if (st === was && !hpDrop) { // steady: idle chatter only, from a visible thug standing near the hero
        if (st === 'idle' && B.idleT <= 0 && e.root.visible) { const d = Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z); if (d < 13 && d > 3) bark(e, 'idle'); }
        continue; }
      if (st === 'idle' && was === 'dead') e.bkKo = false; // respawned
      const koNow = !e.bkKo && ((e.dead && (st === 'down' || st === 'dying')) || st === 'drown' || st === 'dead');
      if (koNow) { e.bkKo = true; if (st !== 'dead' || was !== 'dying') bark(e, 'ko'); }
      else if (e.bkKo || st === 'dead') continue;
      else if (st === 'hurt' || (st === 'dizzy' && was !== 'dizzy') || hpDrop) bark(e, 'hit');
      else if ((st === 'chase' && (was === 'idle' || was === 'return')) || (st === 'windup' && was === 'chase')) bark(e, 'taunt');
    }
    if (B.cur) { B.t += dt; if (B.t > B.cur.life) hide(); else place(); }
  }

  // ---- landmark blurbs: shown under the name popup; returns how long the popup should stay up
  function lmBlurb(L) {
    const w = L && GR1.landmarks[L.id];
    if (!w) { lb.classList.remove('on'); return 0; }
    lb.innerHTML = w.blurb.map((s, i) => (i ? '<i>' : '<span>') + s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + (i ? '</i>' : '</span>')).join('');
    lb.classList.add('on'); B.lmk = L.id; B.lmkN = (B.lmkN || 0) + 1; return 6.5;
  }
  const api = { B, tick, bark, show, hide, bossSay, bossIntro: (id) => bossSay(id, 'intro'), bossDefeat: (id) => bossSay(id, 'defeat'), lmBlurb, BOSSM, LMM, TURF,
    gangs: () => enemies.map((e) => e.gang), el, lb };
  window.__barks = api;
  return api;
})();
