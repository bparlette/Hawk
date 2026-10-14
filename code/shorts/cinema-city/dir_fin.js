if (D.f === 0) { const U = new URLSearchParams(location.search); if (U.has('slowat')) { window.__SLOWAT = +U.get('slowat'); window.__SLOWDT = +U.get('slowdt'); window.__STOPN = +(U.get('stopn') || 1e9); } if (U.has('tid')) D.tid = +U.get('tid'); }
const tid = D.tid != null ? D.tid : 0;
if (D.f === 0) {
  H.inv = 1e9; for (const e of C.enemies) if (e.id !== tid) { e.set('dead'); e.root.visible = false; e.respawn = 1e9; }
  if (D.tid === 4) { H.pos.set(-12.5, 0, 1.6); H.yaw = -Math.PI / 2; P.pos.set(-11.0, 0, 3.8); P.yaw = -Math.PI / 2; C.CAM.yaw = Math.PI / 2; C.CAM.pivot.set(-12.5, 1.55, 1.6); }
  else { H.pos.set(-2.8, 0, 19.6); H.yaw = Math.PI; P.pos.set(-5.0, 0, 21.0); }
  if (window.__SLOWAT == null) window.__CAPNR = false;
}
if (D.tid === 4 && window.__SLOWAT == null) window.__CAPNR = D.f < 12;
if (window.__SLOWAT != null) { window.__CAPNR = D.f < window.__SLOWAT - 1; if (D.f >= window.__SLOWAT) window.__CAPDT = window.__SLOWDT; if (D.f >= window.__SLOWAT + window.__STOPN) return 'END'; }
const e = C.enemies.find((x) => x.id === tid);
const mv = (tx, tz, stop) => { const dx = tx - H.pos.x, dz = tz - H.pos.z, d = Math.hypot(dx, dz); if (d < stop) { window.__CAPMV = null; return d; } const f = C.camFwd(C.CAM.yaw), r = [-f[1], f[0]]; window.__CAPMV = [(dx * r[0] + dz * r[1]) / d, (dx * f[0] + dz * f[1]) / d]; return d; };
if (C.CINE.fin) { window.__CAPMV = null; if (D.finAt == null) { D.finAt = D.f; console.log('DIR finAt ' + D.f); } return; }
if (!e || !e.alive) { window.__CAPMV = null; if (D.deadAt == null) { D.deadAt = D.f; console.log('DIR deadAt ' + D.f); } if (D.f > D.deadAt + 12) return 'END'; return; }
if (e.state === 'dying' || e.dead) { window.__CAPMV = null; return; }
if (C.QTE && e.state === 'dizzy') {
  const d = mv(e.pos.x, e.pos.z, 1.5);
  const pd = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  if (d < 1.6 && (pd < 8 || D.f - (D.qAt || D.f) > 40)) { C.press('e'); console.log('DIR press e ' + D.f + ' pd ' + pd.toFixed(1)); }
  if (D.qAt == null) D.qAt = D.f;
  return;
}
const d = mv(e.pos.x, e.pos.z, 1.4);
if (d < 1.9 && D.f % 7 === 0) C.press('j');
