// ======================= BOSSX (Brad 2026-10-15 "bosses ... interactively fight more"): a shared reactivity layer for the brawl bosses on the DUELS core.
// Each brawl boss calls BOSSX.hurt(st, dmg) when it is about to hit Harold and BOSSX.hit(st, dmg, hpField) when Harold lands a hit. On top of every boss's own moves:
//   PARRY: swing within 0.2 s before a hit lands -> no damage, "PARRY!", the boss is STAGGERED for 1.8 s (Harold's hits x1.6)
//   GUARD: 7+ hits in an unbroken string -> the boss guards the next few swings ("GUARD!") and shoves back: mix in moves, don't just mash
//   SITTING DUCK: stand still (no stick) 3 s and hits on you do x1.5 ("MOVE IT!")
//   ENRAGED: the first time the boss drops under half of its (phase) health: "ENRAGED!" and the whole fight runs ~10% faster
// Off for auto / bot test runs (?<boss>auto=, ?duelbot=) so the CI scripts stay deterministic.
const BOSSX = (function () {
  const OFF = Q.get('bossx') === '0' || [...Q.keys()].some((k) => /auto$|^duelbot$/.test(k)) || (BOT && !Q.has('bossx'));
  const B = { cur: null, swingT: -9, still: 0, t: 0, stagT: 0, string: 0, lastHit: -9, guardN: 0, rage: false, max: {}, stats: { parries: 0, guards: 0, ducks: 0, rages: 0 }, log: [] };
  const pop = (txt, cls = 'word') => { try { DUELS.pop(txt, new THREE.Vector3(0, 2.4, 0), cls); } catch (e) {} };
  function frame(dt, I) { if (OFF) return; const cur = DUELS.cur; if (cur !== B.cur) { B.cur = cur; B.swingT = -9; B.still = 0; B.stagT = 0; B.string = 0; B.guardN = 0; B.rage = false; B.max = {}; }
    B.t += dt; if (I && (I.a || I.b)) B.swingT = B.t; B.still = I && Math.hypot(I.mx || 0, I.my || 0) < 0.15 ? B.still + dt : 0; B.stagT = Math.max(0, B.stagT - dt); if (B.t - B.lastHit > 1.1) B.string = 0; }
  function hurt(st, dmg) { if (OFF) return dmg;
    if (B.t - B.swingT < 0.2 && B.t - B.swingT >= 0) { B.stats.parries++; B.stagT = 1.8; B.swingT = -9; pop('PARRY!', 'g'); sfx('ko'); try { DUELS.shake(0.3); } catch (e) {} B.log.push('parry'); return 0; }
    if (B.still > 3) { B.stats.ducks++; pop('MOVE IT!', 'r'); B.log.push('duck'); return Math.round(dmg * 1.5); }
    return B.rage ? Math.round(dmg * 1.1) : dmg; }
  function hit(st, dmg, field) { if (OFF) return dmg; B.lastHit = B.t; B.string++;
    const hp = st[field]; if (typeof hp === 'number') { if (!(B.max[field] >= hp) || hp > B.max[field]) B.max[field] = Math.max(B.max[field] || 0, hp); if (!B.rage && B.max[field] > 0 && hp - dmg < B.max[field] * 0.5) { B.rage = true; B.stats.rages++; try { DUELS.banner('ENRAGED!<small>FASTER NOW</small>', 1.4); } catch (e) {} B.log.push('rage'); } }
    if (B.stagT > 0) return Math.round(dmg * 1.6);
    if (B.guardN > 0) { B.guardN--; pop('GUARD!', ''); sfx('swing'); return 0; }
    if (B.string >= 7) { B.string = 0; B.guardN = 3; B.stats.guards++; B.log.push('guard'); }
    return dmg; }
  const tempo = () => (OFF || !B.rage || B.stagT > 0 ? 1 : 1.1);
  window.__bossx = B; return { frame, hurt, hit, tempo, B, get off() { return OFF; } };
})();
