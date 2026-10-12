
// (identical to the BOSS_CLEAR block at the top of hark/bobby-derby's src/06g_derby.js: keep ONE copy when the boss branches merge)
// ---------------- boss clear + crime meter hooks (minimal: the per-district crime HUD is phase 6) ----------------
// BOSS_CLEAR.clear(lmId, info) marks a landmark's boss beaten: LANDMARKS[i].boss.cleared, that district's crime level -> 0,
// remembered in localStorage, a 'tcb:bossclear' window event + any BOSS_CLEAR.on(fn) listeners. Every boss fight calls it on a win.
const BOSS_CLEAR = (function () {
  const LS = 'tcb_boss_clear'; let saved = []; try { saved = JSON.parse(localStorage.getItem(LS) || '[]') || []; } catch (e) {}
  const C = { cleared: new Set(saved), crime: {}, log: [], fns: [] };
  for (const L of LANDMARKS) { C.crime[L.id] = C.cleared.has(L.id) ? 0 : 100; if (L.boss && C.cleared.has(L.id)) L.boss.cleared = true; }
  C.cityCrime = () => { const v = Object.values(C.crime); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; };
  C.on = (fn) => { C.fns.push(fn); };
  C.clear = (lmId, info = {}) => {
    const L = LANDMARKS.find((l) => l.id === lmId); if (!L) return false;
    const first = !C.cleared.has(lmId); C.cleared.add(lmId); C.crime[lmId] = 0; if (L.boss) L.boss.cleared = true;
    try { localStorage.setItem(LS, JSON.stringify([...C.cleared])); } catch (e) {}
    const d = Object.assign({ lm: lmId, boss: L.boss && L.boss.name, first, city: C.cityCrime(), at: +S.time.toFixed(1) }, info); C.log.push(d);
    for (const f of C.fns) { try { f(d); } catch (e) { console.error(e); } }
    try { dispatchEvent(new CustomEvent('tcb:bossclear', { detail: d })); } catch (e) {}
    return true;
  };
  return C;
})();
