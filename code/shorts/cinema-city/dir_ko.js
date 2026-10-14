if (D.f === 0) { const U = new URLSearchParams(location.search); if (U.has('slowat')) { window.__SLOWAT = +U.get('slowat'); window.__SLOWDT = +U.get('slowdt'); window.__STOPN = +(U.get('stopn') || 1e9); } }
const tid = 1;
if (D.f === 0) {
  H.inv = 1e9; for (const e of C.enemies) if (e.id !== tid) { e.set('dead'); e.root.visible = false; e.respawn = 1e9; }
  const e = C.enemies.find((x) => x.id === tid); e.dizzied = true;
  H.pos.set(1.2, 0, 23.5); H.yaw = Math.PI; P.pos.set(-1.5, 0, 25.0);
}
if (window.__SLOWAT != null) { window.__CAPNR = D.f < window.__SLOWAT - 1; if (D.f >= window.__SLOWAT) window.__CAPDT = window.__SLOWDT; if (D.f >= window.__SLOWAT + window.__STOPN) return 'END'; }
const e = C.enemies.find((x) => x.id === tid);
const mv = (tx, tz, stop) => { const dx = tx - H.pos.x, dz = tz - H.pos.z, d = Math.hypot(dx, dz); if (d < stop) { window.__CAPMV = null; return d; } const f = C.camFwd(C.CAM.yaw), r = [-f[1], f[0]]; window.__CAPMV = [(dx * r[0] + dz * r[1]) / d, (dx * f[0] + dz * f[1]) / d]; return d; };
if (!e.alive || e.state === 'dead') { window.__CAPMV = null; if (D.deadAt == null) { D.deadAt = D.f; console.log('DIR deadAt ' + D.f + ' by ' + (e.lastBy === H ? 'hero' : 'partner')); } if (D.f > D.deadAt + 6) return 'END'; return; }
if (e.dead) { window.__CAPMV = null; if (D.downAt == null) { D.downAt = D.f; console.log('DIR koHit ' + D.f + ' by ' + (e.lastBy === H ? 'hero' : 'partner') + ' hp ' + e.hp); } return; }
const d = mv(e.pos.x, e.pos.z, 1.4);
if (d < 1.9 && D.f % 7 === 0) C.press('j');
if (D.f % 30 === 0) console.log('DIR hp ' + e.hp + ' st ' + e.state);
