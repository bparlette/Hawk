// Trailer beats. setup/tick are page-side JS bodies (S = STATE, P = player, cap = __cap, B = {f: capture frame, n: scratch}).
// tick runs before EVERY 60 Hz sim tick (i = sub-tick 0/1); B.f = capture frame (30 fps), -1.. during warm-up is 0 after.
const BASE = '?cap&nolock&nohint&noarrow';
const stash = 'window.__stash = S.enemies.splice(0);';
const touch = 'S.showTouch = true;';
module.exports = {
  brawl: {
    q: BASE + '&bot&shot=street', warm: 40, frames: 100,
    setup: '__ss.BOTR.i = 999; __ss.placeOn(P, "street", 24, 0.5);',
    tick: 'if (P.hp < 8) P.hp = 16;',
  },
  manhole: {
    q: BASE + '&shot=street', warm: 20, frames: 100,
    setup: stash + '__ss.placeOn(P, "street", 30.5, 1.6);',
    tick: 'if (i) return; if (B.f < 0) return; if (B.f < 22) cap.key("arrowright", true); else cap.key("arrowright", false); if (B.f === 24) cap.tap("l");',
  },
  skate: {
    q: BASE + '&shot=sew40', warm: 10, frames: 110,
    log: '(() => { const P = __ss.STATE.player; return [P.layer, +P.gx.toFixed(1), +P.gz.toFixed(1), "gy", +P.gy.toFixed(2), "air", !!(P.sk && P.sk.air), JSON.stringify(__ss.STATE.skStat)].join(" "); })()',
    setup: stash + '__ss.placeOn(P, "sewer", 36.4, 1.2); __ss.pickupBoard(); const K = P.sk; K.x = 31.5; K.z = 0.2; K.vx = 7.2; K.vz = 0; K.vy = 0; K.y = -6; K.air = false; K.n = [0,1,0];',
    tick: 'if (i) return; const K = P.sk; if (!K) return; cap.key("arrowright", true); if (K.air && !B.n && P.gx > 42.9) { B.n = 1; cap.tap("j"); } cap.key("arrowup", B.f >= 34 && B.f < 82); cap.key("arrowdown", B.f >= 82 && B.f < 98);',
  },
  freeflow: {
    q: BASE + '&shot=street', warm: 10, frames: 110,
    setup: touch + '__ss.placeOn(P, "street", 24, 0.5);',
    tick: 'if (i) return; if (P.hp < 8) P.hp = 16; const warn = S.enemies.some((e) => e.warnT > 0); if (warn && !B.cd) { cap.tap("c"); B.cd = 14; } else if (__ss.FF.meter >= 8 && !P.ffL && B.f > 60) { cap.tap("l"); } else if (B.f % 7 === 0) cap.tap("j"); if (B.cd) B.cd--;',
    log: '(() => { const P = __ss.STATE.player; return [P.layer, +P.gx.toFixed(1), +P.gz.toFixed(1), "combo", __ss.FF.combo, "meter", __ss.FF.meter, JSON.stringify(__ss.FFSTAT), __frameErrors.n].join(" "); })()',
  },
  title: { q: '?cap&nohint&noarrow', warm: 30, frames: 96, setup: '', tick: 'if (!i && B.f === 76) cap.tap("j");', log: '__ss.STATE.scene' },
  exitsewer: {
    q: BASE + '&shot=sewend', warm: 10, frames: 90,
    setup: stash + '__ss.placeOn(P, "sewer", 162, -90.5);',
    tick: 'if (i) return; if (B.f < 0) return; if (!B.n) { const l = go(162, -94.9, 0.8); if (S.near && l < 0.6) { B.n = 1; cap.tap("l"); } }',
    log: '(() => { const P = __ss.STATE.player; return [P.layer, +P.gx.toFixed(1), +P.gz.toFixed(1), __ss.STATE.near && __ss.STATE.near.kind, !!P.climb].join(" "); })()',
  },
  subway: {
    q: BASE + '&bot&shot=platform', warm: 20, frames: 110,
    setup: '__ss.BOTR.i = 999; S.trainWarned = true; S.train = { state: "run", dir: -1, n: 1, x: P.gx + 70, t: 0, hornd: true, warned: true };',
    tick: 'if (P.hp < 8) P.hp = 16;',
  },
  elevator: {
    q: BASE + '&shot=lobby', warm: 10, frames: 110,
    setup: stash,
    tick: 'if (i) return; if (B.f < 0) return; if (!B.n) { const l = go(141.2, -22.3, 0.9); if (S.near && l < 1.2) { B.n = 1; cap.tap("l"); } }',
    log: '(() => { const P = __ss.STATE.player; return [P.layer, +P.gx.toFixed(1), +P.gz.toFixed(1), __ss.STATE.near && __ss.STATE.near.kind, !!P.climb].join(" "); })()',
  },
  roofleap: {
    q: BASE + '&shot=roof', warm: 10, frames: 80,
    setup: stash + '__ss.placeOn(P, "roof", 98, -22);',
    tick: 'if (B.f < 0) return; go(114, -22); if (!i && P.gx > 105.2 && P.z === 0 && !B.n) { B.n = 1; cap.tap("k"); }',
    log: '(() => { const P = __ss.STATE.player; return [P.layer, +P.gx.toFixed(1), +P.gz.toFixed(1), +P.z.toFixed(1), "chaseK", __ss.CAMS.chaseK.toFixed(2)].join(" "); })()',
  },
  stealth: {
    q: BASE + '&shot=roof&time=0.9&timefreeze', warm: 10, frames: 100,
    setup: touch + '__ss.placeOn(P, "roof", 84, -13);',
    tick: `if (B.f === -1 && !B.s && S.zone.id) { const e = S.enemies.find((o) => o.sentry && o.idle && o.hp > 0 && o.type === (window.__SENT || "star")); if (e) { B.s = e; for (const o of S.enemies) if (o.sentry) { o.lookT = 1; o.look0 = o.look; } const g = __ss.toGlobal(S.zone, e.x, e.y); B.g = g; B.lk = e.look; __ss.placeOn(P, "roof", g.gx - Math.cos(e.look) * 2.8, g.gz - Math.sin(e.look) * 2.8); } }
      for (const o of S.enemies) if (o.sentry && o.look0 !== undefined) { o.lookT = 1; o.look = o.look0; }
      if (!B.s || B.f < 0) return; cap.key("x", B.f < 70);
      if (!B.n && B.f > 8) { go(B.g.gx - Math.cos(B.lk) * 1.0, B.g.gz - Math.sin(B.lk) * 1.0, 0.8); if (!i && S.near && S.near.kind === "silent" && B.f > 36) { B.n = 1; cap.tap("l"); } }`,
    log: '(() => { const P = __ss.STATE.player; return [P.layer, +P.gx.toFixed(1), +P.gz.toFixed(1), __ss.STATE.near && __ss.STATE.near.kind, "crouch", !!P.crouch, "td", __ss.STL.td, "det", __ss.STL.det.toFixed(2)].join(" "); })()',
  },
  comic: {
    q: BASE + '&bot&shot=street&cam=comic&time=0.8&timefreeze', warm: 40, frames: 90,
    setup: touch + '__ss.BOTR.i = 999; __ss.placeOn(P, "street", 24, 0.5);',
    tick: 'if (P.hp < 8) P.hp = 16;',
  },
  oneshot: {
    q: BASE + '&shot=street&cam=oneshot', warm: 20, frames: 110,
    setup: touch + stash + '__ss.placeOn(P, "street", 30.5, 1.6);',
    tick: 'if (i) return; if (B.f < 0) return; if (B.f < 22) cap.key("arrowright", true); else cap.key("arrowright", false); if (B.f === 24) cap.tap("l");',
  },
  van: {
    q: BASE + '&shot=street&time=0.79&timefreeze', warm: 10, frames: 100,
    setup: stash + 'const V = __ss.VAN; __ss.placeOn(P, "street", V.it.x, V.it.z); __ss.vanEnter(); Object.assign(V, { x: 26, z: 1.5, yaw: 0, vx: 11, vz: 0, lights: true }); let k = 0; for (const [dx, dz] of [[13, 1.0], [14.5, 2.4], [16, 0.2], [20, 1.6]]) { const e = window.__stash.filter((o) => o.hp > 0)[k++]; if (!e) break; const l = __ss.toLocal(S.zone, V.x + dx, V.z + dz); e.x = l.x; e.y = l.y; e.idle = false; e.post = null; S.enemies.push(e); }',
    tick: 'if (i) return; if (B.f < 0) return; cap.key("arrowup", true); if (B.f === 4) cap.tap("j"); const d = B.f >= 36 && B.f < 56; cap.key("k", d); cap.key("arrowright", d); cap.key("arrowleft", B.f >= 60 && B.f < 72);',
    log: '(() => { const V = __ss.VAN; return ["van", V.on, V.x.toFixed(1), V.z.toFixed(1), "yaw", V.yaw.toFixed(2), "sp", V.sp.toFixed(1), "hits", V.hits, "lat", V.maxLat.toFixed(2), "bumps", V.bumps].join(" "); })()',
  },
  daynight: {
    q: BASE + '&shot=street&time=0.45&timefreeze', warm: 10, frames: 100,
    setup: stash + '__ss.placeOn(P, "street", 22, 1.0);',
    tick: 'const k = Math.max(0, Math.min(1, B.f / 90)); __ss.DAY.t = 0.45 + 0.47 * k * k * (3 - 2 * k); if (B.f >= 0) go(40, 1.0, 0.45);',
    log: '(() => { const D = __ss.DAY; return ["t", D.t.toFixed(3), "lamp", D.lamp.toFixed(2), "night", D.night.toFixed(2)].join(" "); })()',
  },
  fire: {
    q: BASE + '&bot&shot=fire', warm: 60, frames: 110,
    setup: '__ss.BOTR.i = 999; __ss.placeOn(P, "street", 72, -1);',
    tick: 'if (P.hp < 8) P.hp = 16;',
    log: '(() => { const P = __ss.STATE.player, S = __ss.STATE; return [P.layer, +P.gx.toFixed(1), +P.gz.toFixed(1), S.enemies.filter((e) => !e.idle).map((e) => e.type + ":" + e.state + ":" + e.hp).join(",")].join(" "); })()',
  },
  boss: {
    q: BASE + '&bot&shot=lot&time=0.62&timefreeze', warm: 110, frames: 120,
    setup: '__ss.BOTR.i = 999; window.__noBot = true;',
    tick: `if (P.hp < 8) P.hp = 16; const R = S.enemies.find((e) => e.type === "ramrod" && e.hp > 0); window.__noBot = B.f < 28; if (!R || B.f < 0 || B.f >= 28) return;
      const g = __ss.toGlobal(S.zone, R.x, R.y), d = Math.hypot(P.gx - g.gx, P.gz - g.gz);
      if (d < 5.5) go(P.gx + (P.gx - g.gx), P.gz + (P.gz - g.gz), 0.5);`,
    log: '(() => { const P = __ss.STATE.player, S = __ss.STATE; return [P.layer, +P.gx.toFixed(1), +P.gz.toFixed(1), S.enemies.filter((e) => !e.idle).map((e) => e.type + ":" + e.state + ":" + e.hp).join(",")].join(" "); })()',
  },
  win: {
    q: BASE + '&bot&shot=lot&time=0.62&timefreeze', warm: 120, frames: 240,
    setup: '__ss.BOTR.i = 999;',
    tick: 'if (P.hp < 8) P.hp = 16; if (B.f === 0) for (const e of S.enemies) if (e.type === "ramrod" && e.hp > 2) e.hp = 2;',
    log: '(() => { const P = __ss.STATE.player, S = __ss.STATE; return [S.scene, P.layer, +P.gx.toFixed(1), +P.gz.toFixed(1), S.enemies.filter((e) => !e.idle).map((e) => e.type + ":" + e.state + ":" + e.hp).join(",")].join(" "); })()',
  },
};
