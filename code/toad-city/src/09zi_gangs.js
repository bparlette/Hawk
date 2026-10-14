// ---------------- item l part 2: GANG TURF (the five Task C gangs + the live thug posts) and thug-driven district crime ----------------
// Every street thug post belongs to the gang that holds the nearest landmark (Harbor Rats north shore, Pier Gulls piers, Cobblestone Catfish
// Fells Point/Pendry, Masked Bandits west side + Lexington, Key Hwy Otters south shore). Stand-in thugs keep the shared rig (Opus gang rigs drop in
// later behind buildGangThug(gangId, member)); each gets its gang colour on its hp pip. Knocking thugs out chips their district's crime from 100
// down to 40; beating the district boss takes it to 0 (BOSS_CLEAR). The HUD chip (09zh) shows GANGWIRE.districtCrime / cityCrime and the gang row.
// Test hooks: window.__gang = { gangs(), of(id), kos(), crime(id), city(), ko(id, n), reset() }.
const GANGWIRE = (function () {
  const GANGS = [
    { id: 'harbor_rats', name: 'HARBOR RATS', short: 'RATS', accent: '#ffd23c', lm: ['harborplace', 'constellation', 'wtc', 'monument'] },
    { id: 'pier_gulls', name: 'PIER GULLS', short: 'GULLS', accent: '#2f5bd3', lm: ['aquarium', 'powerplant', 'fourseasons'] },
    { id: 'cobble_catfish', name: 'COBBLESTONE CATFISH', short: 'CATFISH', accent: '#1fd3c6', lm: ['fells', 'pendry', 'fort'] },
    { id: 'masked_bandits', name: 'MASKED BANDITS', short: 'BANDITS', accent: '#ff9f1c', lm: ['orioles', 'ravens', 'science', 'lexington', 'duckpin'] },
    { id: 'key_hwy_otters', name: 'KEY HWY OTTERS', short: 'OTTERS', accent: '#c47a3a', lm: ['domino', 'underarmour', 'fedhill', 'rashfield'] },
  ];
  const LS = 'tcb_gang_kos', FLOOR = 40; let kos = {}; try { kos = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) {}
  const byLm = {}; for (const g of GANGS) for (const l of g.lm) byLm[l] = g;
  const posts = {}; // landmark id -> thug posts in its district
  function nearestLm(x, z) { let best = null, bd = 1e9; for (const L of LANDMARKS) { if (!byLm[L.id] || L.id === 'rashfield' && false) continue; const d = Math.hypot(L.x - x, L.z - z); if (d < bd) { bd = d; best = L; } } return best; }
  for (const e of enemies) { const L = nearestLm(e.post.x, e.post.z); if (!L) continue; e.gang = byLm[L.id]; e.turf = L.id; posts[L.id] = (posts[L.id] || 0) + 1; }
  const need = (id) => Math.max(6, 3 * (posts[id] || 0)); // knock-outs that break a district's street gang
  function districtCrime(id) {
    if (typeof BOSS_CLEAR === 'undefined') return 100; if (BOSS_CLEAR.cleared.has(id) || BOSS_CLEAR.crime[id] === 0) return 0;
    if (!byLm[id]) return BOSS_CLEAR.crime[id] === undefined ? 100 : BOSS_CLEAR.crime[id];
    return 100 - Math.round((100 - FLOOR) * Math.min(1, (kos[id] || 0) / need(id)));
  }
  function cityCrime() { if (typeof BOSS_CLEAR === 'undefined') return 100; const k = Object.keys(BOSS_CLEAR.crime); return k.length ? Math.round(k.reduce((a, id) => a + districtCrime(id), 0) / k.length) : 0; }
  const ev = []; const G = { GANGS, byLm, posts, kos, ev, districtCrime, cityCrime, need, gangAt: (id) => byLm[id] || null };
  // gang colour strip on each thug's hp pip
  if (typeof drawHp === 'function') { const _d = drawHp; drawHp = function (e) { _d(e); if (!e.gang) return; const c = e.hpC.getContext('2d'); c.fillStyle = e.gang.accent; c.fillRect(0, 0, 128, 3); e.hpT.needsUpdate = true; }; }
  function koIn(id, n) { const before = districtCrime(id); kos[id] = (kos[id] || 0) + (n || 1); try { localStorage.setItem(LS, JSON.stringify(kos)); } catch (e) {}
    if (before > FLOOR && districtCrime(id) === FLOOR) { const L = LANDMARKS.find((l) => l.id === id), g = byLm[id]; ev.push('broken:' + id); if (typeof banner === 'function' && g && L) banner(g.short + ' BROKEN!', 2.6); } }
  // count every thug knock-out once (a dead thug respawns after 14 s, which clears the flag)
  const seen = new Set();
  setInterval(() => { for (const e of enemies) { if (e.state === 'dead') { if (!seen.has(e.id)) { seen.add(e.id); if (e.turf) koIn(e.turf, 1); } } else if (seen.has(e.id)) seen.delete(e.id); } }, 250);
  window.__gang = { gangs: () => GANGS.map((g) => g.id), of: (id) => (byLm[id] ? byLm[id].id : null), kos: () => Object.assign({}, kos), crime: districtCrime, city: cityCrime, need, ko: (id, n) => koIn(id, n), posts: () => Object.assign({}, posts),
    reset: () => { for (const k of Object.keys(kos)) delete kos[k]; try { localStorage.removeItem(LS); } catch (e) {} }, tagged: () => enemies.filter((e) => e.gang).length, total: () => enemies.length };
  return G;
})();
