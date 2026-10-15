// ======================= GEAR (Brad 2026-10-15, phase 2): weapon pickups, Toad Powers, the Fells Point rooftop route, dirt bikes.
// All in the open world (normal camera / controls / HUD, no mode switch). Both players use everything (P2 = Mavis on pad 2).
// WEAPONS (limited uses, from elites / parties / brawls or lying in alleys; HUD chip top right shows icon + uses):
//   CRAB MALLET (6): wide knockback swing   OLD BAY GRENADE (3): sneeze cloud, thugs stagger (finisher window)
//   STOOP BRICK (4): heavy straight throw    NATTY BOH CAN LAUNCHER (20): rapid cans, thugs slip and fall      (attack button uses the weapon)
// TOAD POWERS (permanent, one hidden pickup each, saved in localStorage tcb_powers):
//   DASH (Shift / RT): i-frame burst   TOAD TONGUE (G / LT): yank a thug to you, or zip to a green rooftop hook   GROUND POUND: jump-attack from a roof / high drop = big AoE slam
// ROOFTOP ROUTE: Fells Point rowhouse roofs, plank bridges with jump gaps over the streets, hooks for the tongue, climb ladder (ACT) at the Fells square end,
//   10 crab tokens up top (tcb_roof_tokens). Jump at a taller roof's wall to mantle up. Walk off an edge to drop to the street.
// DIRT BIKES: parked bikes + a roaming Pratt St crew (knock a rider off to take his bike). ACT = on / off, stick / D-pad steer, hold A / Space = WHEELIE
//   (balance meter, multiplier grows while you hold it in the green, over-rotate = wipe out); ride into thugs to knock them down.
// Test hooks: window.__gear = { give(f, k), powers(), unlock(k), route, bikes, mount(f, i), tokens(), ST }.
const GEAR = (function () {
  const X = THUGX, ST = { fired: {}, powers: {}, zips: 0, yanks: 0, dashes: 0, pounds: 0, tokens: 0, mounts: 0, wheelies: 0, wipeouts: 0, bikeKOs: 0, best: 0, log: [] };
  const log = (s) => { ST.log.push(s); if (ST.log.length > 40) ST.log.shift(); X.log(s); };
  const pads = () => (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []);
  const P1PAD = () => pads().filter((g) => g && COOP.padRole(g) === 'p1');
  const P2PAD = () => (COOP.on && COOP.C.p2 !== null ? pads()[COOP.C.p2] : null);
  const bp = (g, i) => !!(g && g.buttons[i] && g.buttons[i].pressed);
  const prev = new Map(); // edge detection per fighter + button
  function edge(f, key, now) { const k = (f === hero ? 'h' : 'p') + key, was = prev.get(k); prev.set(k, now); return now && !was; }
  const inp = (f) => { // held / edge buttons for either player
    if (f === hero) { const g = P1PAD(); const jumpH = KEYS.has(' ') || KEYS.has('k') || TOUCHS.btn.b || g.some((q) => bp(q, 0));
      return { jumpH, dash: edge(f, 'd', KEYS.has('shift') || g.some((q) => bp(q, 7))), tongue: edge(f, 't', KEYS.has('g') || g.some((q) => bp(q, 6))), act: edge(f, 'a', KEYS.has('e') || KEYS.has('f') || g.some((q) => bp(q, 3)) || TOUCHS.btn.c) }; }
    const g = P2PAD(); return { jumpH: bp(g, 0), dash: edge(f, 'd', bp(g, 7)), tongue: edge(f, 't', bp(g, 6)), act: edge(f, 'a', bp(g, 3)) };
  };
  const worldDir = (f) => { const I = f === hero ? IN : COOP.IN2, yaw = f === hero || !COOP.C.split ? CAM.yaw : COOP.CAM2.yaw, fw = camFwd(yaw), r = [-fw[1], fw[0]]; return [r[0] * I.mx + fw[0] * I.my, r[1] * I.mx + fw[1] * I.my]; };
  const css = document.createElement('style'); css.textContent = `#slbike{position:fixed;left:50%;bottom:22%;transform:translateX(-50%);z-index:30;display:none;pointer-events:none;font:900 italic 14px/1.1 system-ui,sans-serif;color:#fff;text-shadow:0 2px 0 #000;text-align:center}
#slbike .bar{width:180px;height:12px;margin:3px auto;border:2px solid #14101f;border-radius:7px;background:linear-gradient(90deg,#3a3a48 0 36%,#3fd13a 36% 80%,#ff3d6e 80%);position:relative}#slbike .bar i{position:absolute;top:-4px;width:4px;height:18px;background:#fff;border:1px solid #14101f}`;
  document.head.appendChild(css);
  const bikeHud = document.createElement('div'); bikeHud.id = 'slbike'; document.body.appendChild(bikeHud);
  const wHud = document.createElement('div'); wHud.id = 'slwpn'; document.body.appendChild(wHud);

  // ---------------- WEAPONS ----------------
  const icon = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d'); draw(g); return c.toDataURL(); };
  const W = {
    mallet: { name: 'CRAB MALLET', n: 6, col: '#d9944f', ico: icon((g) => { g.fillStyle = '#d9944f'; g.fillRect(20, 16, 7, 30); g.fillStyle = '#9aa3c5'; g.fillRect(8, 6, 32, 14); }) },
    oldbay: { name: 'OLD BAY GRENADE', n: 3, col: '#ffd23c', ico: icon((g) => { g.fillStyle = '#ffd23c'; g.fillRect(12, 10, 24, 32); g.fillStyle = '#2f5bd3'; g.fillRect(12, 18, 24, 10); g.fillStyle = '#c42b48'; g.fillRect(14, 6, 20, 6); }) },
    brick: { name: 'STOOP BRICK', n: 4, col: '#b5492f', ico: icon((g) => { g.fillStyle = '#b5492f'; g.fillRect(6, 16, 36, 18); g.fillStyle = '#7a2a1a'; g.fillRect(6, 24, 36, 2); g.fillRect(22, 16, 2, 8); }) },
    cans: { name: 'NATTY BOH CAN LAUNCHER', n: 20, col: '#e8e8f0', ico: icon((g) => { g.fillStyle = '#5f6688'; g.fillRect(4, 20, 30, 10); g.fillStyle = '#e8e8f0'; g.fillRect(32, 14, 12, 20); g.fillStyle = '#c42b48'; g.fillRect(32, 20, 12, 6); }) },
  };
  const KINDS = Object.keys(W);
  const wMesh = (k) => { const g = new THREE.Group(), m = (geo, col, y = 0) => { const q = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.25 })); q.position.y = y; g.add(q); return q; };
    if (k === 'mallet') { m(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), '#d9944f'); m(new THREE.BoxGeometry(0.42, 0.22, 0.22), '#9aa3c5', 0.36); }
    else if (k === 'oldbay') { m(new THREE.CylinderGeometry(0.14, 0.14, 0.34, 10), '#ffd23c'); m(new THREE.CylinderGeometry(0.145, 0.145, 0.1, 10), '#2f5bd3', 0.02); m(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 10), '#c42b48', 0.2); }
    else if (k === 'brick') m(new THREE.BoxGeometry(0.42, 0.14, 0.2), '#b5492f');
    else { m(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8), '#5f6688').rotation.z = Math.PI / 2; m(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 10), '#e8e8f0', 0.12); }
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 18), new THREE.MeshBasicMaterial({ color: W[k].col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = -0.38; g.add(halo); return g; };
  for (const k of KINDS) X.PK_KIND[k] = { mesh: () => wMesh(k), take: (f) => { give(f, k); return true; } };
  X.PK_KIND.weaponRandom = () => KINDS[(Math.random() * KINDS.length) | 0];
  function give(f, k) { f.wpn = { k, n: W[k].n }; X.pop(X.word(W[k].name.split(' ').slice(-1)[0] + '!', W[k].col), f, 0.9, 0.8); sfx('ko'); hudW(); log('wpn:' + k + ':' + (f === hero ? 'p1' : 'p2')); }
  function hudW() { const rows = [[hero, 'P1'], [partner, 'P2']].filter(([f]) => f.wpn && (f === hero || COOP.on)).map(([f, t]) => `<div><img src="${W[f.wpn.k].ico}" width="22" height="22" style="vertical-align:middle"> ${COOP.on ? t + ' ' : ''}${W[f.wpn.k].name} <b>x${f.wpn.n}</b></div>`);
    wHud.innerHTML = rows.join(''); wHud.style.display = rows.length ? 'block' : 'none'; }
  const aimAt = (f, maxD = 11, cone = 0.9) => { let best = null, bs = 1e9; const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
    for (const e of enemies) { if (!e.alive || e.state === 'dying' || e.fin) continue; const dx = e.pos.x - f.pos.x, dz = e.pos.z - f.pos.z, d = Math.hypot(dx, dz); if (d > maxD) continue;
      const a = Math.acos(clamp((dx * fx + dz * fz) / (d || 1), -1, 1)); if (a > cone) continue; const s = d + a * 4; if (s < bs) { bs = s; best = e; } } return best; };
  const SHOTS = [];
  function fire(f) {
    const w = f.wpn; if (!w) return false; const t = aimAt(f); if (t) f.yaw = Math.atan2(t.pos.x - f.pos.x, t.pos.z - f.pos.z);
    const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw); ST.fired[w.k] = (ST.fired[w.k] || 0) + 1;
    if (w.k === 'mallet') { spawnSlash(_v.set(f.pos.x, f.pos.y + 0.8, f.pos.z), f.yaw, 'spin', 0); sfx('heavy'); S.shake = Math.max(S.shake, 0.6);
      for (const e of enemies) { if (!e.alive) continue; const dx = e.pos.x - f.pos.x, dz = e.pos.z - f.pos.z, d = Math.hypot(dx, dz); if (d > 3.4 || Math.abs(angTo(f.yaw, Math.atan2(dx, dz))) > 1.7) continue;
        if (hitEnemy(e, 4, true, Math.atan2(dx, dz), f)) e.kb.multiplyScalar(1.7); } }
    else { const sp = w.k === 'oldbay' ? 0 : w.k === 'brick' ? 18 : 24, m = wMesh(w.k); m.children[m.children.length - 1].visible = false; m.scale.setScalar(w.k === 'cans' ? 0.7 : 1); scene.add(m);
      const tx = t ? t.pos.x : f.pos.x + fx * 7, tz = t ? t.pos.z : f.pos.z + fz * 7;
      SHOTS.push({ k: w.k, m, x: f.pos.x + fx * 0.6, y: f.pos.y + 1.3, z: f.pos.z + fz * 0.6, vx: fx * sp, vz: fz * sp, t: 0, by: f, x0: f.pos.x, z0: f.pos.z, tx, tz, T: 0.7 }); sfx('swing'); }
    if (f === hero && hero.state === 'move') startAttack(w.k === 'mallet' ? 3 : 1);
    if (--w.n <= 0) { f.wpn = null; X.pop(X.word('EMPTY!', '#9aa3c5'), f, 0.7, 0.6); } hudW(); return true;
  }
  function tickShots(dt) {
    for (const s of SHOTS) { s.t += dt;
      if (s.k === 'oldbay') { const u = Math.min(1, s.t / s.T), gy = groundY(s.tx, s.tz); s.m.position.set(lerp(s.x0, s.tx, u), lerp(s.y, gy + 0.2, u) + Math.sin(u * Math.PI) * 2.2, lerp(s.z0, s.tz, u)); s.m.rotation.x += dt * 10;
        if (u >= 1) { s.dead = true; for (let k = 0; k < 9; k++) spawnSprite(FXT.puff, _v.set(s.tx + rnd(-1.6, 1.6), gy + rnd(0.3, 1.4), s.tz + rnd(-1.6, 1.6)), rnd(0.9, 1.5), 1.6, { kind: 'grow', depth: true, vel: new THREE.Vector3(rnd(-0.4, 0.4), 0.4, rnd(-0.4, 0.4)) });
          X.pop(X.word('ACHOO!', '#ff9f1c', '#c42b48'), { pos: { x: s.tx, y: gy, z: s.tz } }, 1.3, 1.0, 1.6); sfx('heavy');
          for (const e of enemies) { if (!e.alive || e.state === 'dying' || Math.hypot(e.pos.x - s.tx, e.pos.z - s.tz) > 3.4) continue; hitEnemy(e, 1, false, Math.atan2(e.pos.x - s.tx, e.pos.z - s.tz), s.by); if (e.alive && e.state !== 'down') { e.hp = Math.max(1, e.hp); e.dizzied = true; e.set('dizzy'); } } }
        continue; }
      s.x += s.vx * dt; s.z += s.vz * dt; s.m.position.set(s.x, s.y, s.z); s.m.rotation.x += dt * 18;
      for (const e of enemies) { if (!e.alive || e.state === 'dying' || e.state === 'down' || Math.hypot(e.pos.x - s.x, e.pos.z - s.z) > 0.85) continue;
        if (hitEnemy(e, s.k === 'brick' ? 5 : 1, true, Math.atan2(s.vx, s.vz), s.by)) { s.dead = true; if (s.k === 'cans') X.pop(X.word('SLIP!', '#e8e8f0'), e, 0.7, 0.5, 2.2); break; } }
      if (s.t > 0.75 || collAt(s.x, s.z).some((c) => c.r === undefined && s.x > c.x0 && s.x < c.x1 && s.z > c.z0 && s.z < c.z1)) s.dead = true; }
    for (let i = SHOTS.length - 1; i >= 0; i--) if (SHOTS[i].dead) { scene.remove(SHOTS[i].m); SHOTS.splice(i, 1); }
  }

  // ---------------- TOAD POWERS ----------------
  let POW = {}; try { POW = JSON.parse(localStorage.getItem('tcb_powers') || '{}') || {}; } catch (e) {}
  if (Q.has('powers')) for (const k of ['dash', 'tongue', 'pound']) POW[k] = true;
  const has = (k) => !!POW[k];
  const PNAME = { dash: 'DASH  (SHIFT / RT)', tongue: 'TOAD TONGUE  (G / LT)', pound: 'GROUND POUND  (JUMP-ATTACK FROM UP HIGH)' };
  const orbMat = new THREE.MeshLambertMaterial({ color: '#7dffc0', emissive: '#1fd37a', emissiveIntensity: 0.9 });
  for (const k of ['dash', 'tongue', 'pound']) X.PK_KIND['pw_' + k] = { mesh: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), orbMat)); const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 20), orbMat); r.rotation.x = Math.PI / 2; g.add(r); return g; },
    take: (f) => { unlock(k); return true; } };
  function unlock(k) { if (POW[k]) return; POW[k] = true; try { localStorage.setItem('tcb_powers', JSON.stringify(POW)); } catch (e) {} banner('TOAD POWER: ' + PNAME[k], 3); sfx('ko'); log('power:' + k); }
  // hidden spots: dash on top of Federal Hill, tongue in the Washington Monument park, pound on the far end of the rooftop route (placed below)
  const POW_SPOTS = { dash: { x: -3, z: 56 }, tongue: { x: -20, z: -84 } };
  for (const k in POW_SPOTS) if (!POW[k]) { const p = X.drop('pw_' + k, POW_SPOTS[k].x, POW_SPOTS[k].z, { life: 1e9 }); if (p) p.power = k; }
  function dash(f) { if (!has('dash') || (f.dashCd || 0) > 0) return; const d = worldDir(f); let dx = d[0], dz = d[1]; const l = Math.hypot(dx, dz); if (l < 0.1) { dx = Math.sin(f.yaw); dz = Math.cos(f.yaw); } else { dx /= l; dz /= l; }
    f.dashT = 0.2; f.dashV = [dx * 17, dz * 17]; f.dashCd = 0.7; f.inv = Math.max(f.inv, 0.3); f.yaw = Math.atan2(dx, dz); ST.dashes++; sfx('jump'); for (let k = 0; k < 3; k++) dust(f.pos.x, f.pos.y, f.pos.z, 1); }
  // tongue line
  const tongueM = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1, 6), new THREE.MeshBasicMaterial({ color: '#ff6f9f' })); tongueM.visible = false; scene.add(tongueM); let tongueT = 0;
  function drawTongue(f, x, y, z) { const a = new THREE.Vector3(f.pos.x, f.pos.y + f.y + 1.45, f.pos.z), b = new THREE.Vector3(x, y, z), m = a.clone().add(b).multiplyScalar(0.5); tongueM.position.copy(m); tongueM.scale.set(1, a.distanceTo(b), 1); tongueM.lookAt(b); tongueM.rotateX(Math.PI / 2); tongueM.visible = true; tongueT = 0.22; }
  function tongue(f) { if (!has('tongue') || f.zip) return;
    const hk = ROUTE.hooks.filter((h) => Math.hypot(h.x - f.pos.x, h.z - f.pos.z) < 15 && Math.hypot(h.x - f.pos.x, h.z - f.pos.z) > 2.5 && h.y > f.pos.y - 3).sort((a, b) => Math.hypot(a.x - f.pos.x, a.z - f.pos.z) - Math.hypot(b.x - f.pos.x, b.z - f.pos.z))[0];
    if (hk) { drawTongue(f, hk.x, hk.y + 0.5, hk.z); zipTo(f, hk.x, hk.y, hk.z, 0.55); ST.zips++; sfx('jump'); log('zip'); return; }
    const e = aimAt(f, 9.5, 1.0); if (!e) return; drawTongue(f, e.pos.x, e.pos.y + 1.2, e.pos.z); ST.yanks++; sfx('swing');
    const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw); e.pos.x = f.pos.x + fx * 1.4; e.pos.z = f.pos.z + fz * 1.4; hitEnemy(e, 1, false, f.yaw, f); if (e.alive && e.state !== 'dizzy') { e.set('hurt'); e.kb.set(0, 0); } log('yank'); }
  function zipTo(f, x, y, z, T) { f.zip = { x0: f.pos.x, y0: f.pos.y + f.y, z0: f.pos.z, x, y, z, t: 0, T }; f.vel.set(0, 0); f.inv = Math.max(f.inv, T + 0.2); }
  function zipStep(f, dt) { const Z = f.zip; Z.t += dt; const u = Math.min(1, Z.t / Z.T), e = u * u * (3 - 2 * u);
    f.pos.x = lerp(Z.x0, Z.x, e); f.pos.z = lerp(Z.z0, Z.z, e); f.pos.y = lerp(Z.y0, Z.y, e) + Math.sin(u * Math.PI) * 1.2; f.y = 0; f.yaw = Math.atan2(Z.x - Z.x0, Z.z - Z.z0) || f.yaw;
    applyPose(f.J, HERO_POSES.jump(4 - u * 8), 18, dt, false); f.sync(dt);
    if (u >= 1) { f.zip = null; f.pos.y = Z.y; const P = platAt(Z.x, Z.z, Z.y + 0.3); f.rt = !!P; if (!P) f.pos.y = groundY(Z.x, Z.z); f.set('move'); } }

  // ---------------- ROOFTOP ROUTE (Fells Point) ----------------
  const FB = BLDS.filter((b) => b.x0 >= 136 && b.z1 < -40 && b.x1 < 200);
  const bAt = (x, z) => FB.find((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  const PLATS = FB.map((b) => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: b.h, y1: b.h, roof: true }));
  const hooks = [], tokens = [];
  function plank(ax, az, bx, bz, w = 1.7) { const A = bAt(ax, az), B = bAt(bx, bz); if (!A || !B) return false; const ya = A.h, yb = B.h, alongX = Math.abs(bx - ax) > Math.abs(bz - az);
    const lo = alongX ? Math.min(ax, bx) : Math.min(az, bz), hi = alongX ? Math.max(ax, bx) : Math.max(az, bz), yl = (alongX ? ax < bx : az < bz) ? ya : yb, yh = yl === ya ? yb : ya, mid = (lo + hi) / 2, G = 2.2;
    const seg = (s0, s1) => { const yy0 = lerp(yl, yh, (s0 - lo) / (hi - lo)), yy1 = lerp(yl, yh, (s1 - lo) / (hi - lo)); const P = alongX ? { x0: s0, x1: s1, z0: az - w / 2, z1: az + w / 2 } : { x0: ax - w / 2, x1: ax + w / 2, z0: s0, z1: s1 }; Object.assign(P, { y0: yy0, y1: yy1, ax: alongX ? 'x' : 'z', a0: s0, a1: s1 }); PLATS.push(P); return P; };
    seg(lo, mid - G / 2); seg(mid + G / 2, hi); // the jump gap over the street
    { const hx = alongX ? (bx > ax ? hi - 1.2 : lo + 1.2) : ax, hz = alongX ? az : (bz > az ? hi - 1.2 : lo + 1.2), q = platAt(hx, hz, 1e9); hooks.push({ x: hx, z: hz, y: q ? q.y : yb }); }
    for (let k = 0; k < 2; k++) { const s = lerp(lo, hi, k ? 0.3 : 0.7); tokens.push({ x: alongX ? s : ax, z: alongX ? az : s, y: lerp(yl, yh, (s - lo) / (hi - lo)) + 0.9 }); } return true; }
  function platY(P, x, z) { if (!P.ax) return P.y0; const u = clamp(((P.ax === 'x' ? x : z) - P.a0) / (P.a1 - P.a0), 0, 1); return lerp(P.y0, P.y1, u); }
  function platAt(x, z, maxY) { let best = null, by = -1e9; if (x < 130 || x > 205 || z > -38 || z < -112) return null;
    for (const P of PLATS) { if (x < P.x0 || x > P.x1 || z < P.z0 || z > P.z1) continue; const y = platY(P, x, z); if (y <= maxY && y > by) { by = y; best = P; } } return best ? { P: best, y: by } : null; }
  const tallAt = (x, z) => { let t = null; if (x < 130 || x > 205 || z > -38 || z < -112) return null; for (const P of PLATS) if (P.roof && x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1) t = P; return t; };
  // links: block (138..162,-104..-80) <-> (172..196,-104..-80) over the x street, then down to (172..196,-70..-46) over the z street
  const bA = FB.filter((b) => b.x1 < 166 && b.z1 < -76), bB = FB.filter((b) => b.x0 > 168 && b.z1 < -76), bC = FB.filter((b) => b.x0 > 168 && b.z0 > -74);
  const xA = bA.length ? Math.max(...bA.map((b) => b.x1)) : 159, xB = bB.length ? Math.min(...bB.map((b) => b.x0)) : 175, zB = bB.length ? Math.max(...bB.map((b) => b.z1)) : -83, zC = bC.length ? Math.min(...bC.map((b) => b.z0)) : -67;
  const okAB = plank(xA - 0.4, -92, xB + 0.4, -92), okBC = plank(184, zB - 0.4, 184, zC + 0.4);
  // street ladder (fire escape) up onto the Fells square end of the route
  const lb = bC.length ? bC.reduce((a, b) => (Math.abs((a.x0 + a.x1) / 2 - 178) < Math.abs((b.x0 + b.x1) / 2 - 178) ? a : b)) : null;
  const LAD = lb ? { x: clamp(178, lb.x0 + 1, lb.x1 - 1), z: lb.z1 + 0.9, top: { x: clamp(178, lb.x0 + 1, lb.x1 - 1), z: lb.z1 - 1.2, y: lb.h } } : null;
  if (LAD) hooks.push({ x: LAD.top.x, z: LAD.top.z, y: LAD.top.y });
  for (const b of FB) tokens.push({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, y: b.h + 0.9 });
  while (tokens.length > 12) tokens.splice((Math.random() * tokens.length) | 0, 1);
  // meshes: planks, hooks, ladder, tokens
  { const mat = toonMat(), g = new THREE.Group(); g.userData.mat = mat; scene.add(g);
    for (const P of PLATS) if (P.ax) { const L = P.a1 - P.a0, dy = P.y1 - P.y0, len = Math.hypot(L, dy), w = P.ax === 'x' ? P.z1 - P.z0 : P.x1 - P.x0, m = part(g, G.box(P.ax === 'x' ? len : w, 0.12, P.ax === 'x' ? w : len), '#a8763e', (P.x0 + P.x1) / 2, (P.y0 + P.y1) / 2 - 0.06, (P.z0 + P.z1) / 2);
      if (P.ax === 'x') m.rotation.z = Math.atan2(dy, L); else m.rotation.x = -Math.atan2(dy, L); }
    for (const h of hooks) { part(g, G.cyl(0.05, 0.05, 1.1, 6), '#5f6688', h.x, h.y + 0.55, h.z, { outline: false }); part(g, G.tor(0.18, 0.05), '#3fd13a', h.x, h.y + 1.2, h.z); }
    if (LAD) { for (const s of [-0.35, 0.35]) part(g, G.box(0.06, LAD.top.y, 0.06), '#2c2c3c', LAD.x + s, LAD.top.y / 2, LAD.z - 0.4, { outline: false }); for (let y = 0.6; y < LAD.top.y; y += 0.6) part(g, G.box(0.7, 0.04, 0.04), '#2c2c3c', LAD.x, y, LAD.z - 0.4, { outline: false }); } }
  let GOT = {}; try { GOT = JSON.parse(localStorage.getItem('tcb_roof_tokens') || '{}') || {}; } catch (e) {}
  const tokMat = new THREE.MeshLambertMaterial({ color: '#ffd23c', emissive: '#a86b00', emissiveIntensity: 0.6 }), tokGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 14);
  tokens.forEach((t, i) => { t.id = i; t.got = !!GOT[i]; t.m = new THREE.Mesh(tokGeo, tokMat); t.m.rotation.x = Math.PI / 2; t.m.position.set(t.x, t.y, t.z); t.m.visible = !t.got; scene.add(t.m); });
  // the pound power sits on the far roof of the route
  if (!POW.pound && bA.length) { const b = bA[0], p = X.drop('pw_pound', (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, { life: 1e9, y: b.h }); if (p) { p.roofY = b.h; p.power = 'pound'; } }
  const ROUTE = { PLATS, hooks, tokens, LAD, okAB, okBC, platAt };
  if (LAD) ACTIONS.push({ kind: 'climb', label: 'CLIMB UP', x: LAD.x, z: LAD.z, r: 1.5, y: 2.2, ok: () => !hero.rt && !hero.zip && !hero.bike && !hero.roof, go: () => { zipTo(hero, LAD.top.x, LAD.top.y, LAD.top.z, 1.0); log('climb:p1'); } });
  // collide on the route: roofs / planks hold you up, higher roofs are walls (jump at them to mantle up), off the edge = drop to the street
  const _collide = collide;
  collide = function (f) {
    if (f.post || f.state === 'drown' || f.roof) return _collide(f);
    const A = f.pos.y + f.y, air = f.y > 0.01 || f.vy > 0, hit = platAt(f.pos.x, f.pos.z, A + 0.2);
    if (!f.rt && !(air && hit && A >= hit.y - 0.25 && hit.y > groundY(f.pos.x, f.pos.z) + 1)) { const prv = f.rtPrev; const r = _collide(f); f.rtPrev = { x: f.pos.x, z: f.pos.z }; return r; }
    const tall = tallAt(f.pos.x, f.pos.z);
    if (tall && tall.y0 > A + 0.35) { // a taller roof: wall. A jump at it mantles up
      if (air && tall.y0 - A < 4.2 && !f.zip) { zipTo(f, f.pos.x, tall.y0, f.pos.z, 0.35); return; }
      if (f.rtPrev) { f.pos.x = f.rtPrev.x; f.pos.z = f.rtPrev.z; } return; }
    if (!hit) { // off the edge: fall to the street
      const gy = groundY(f.pos.x, f.pos.z); f.y = Math.max(0.01, A - gy); f.pos.y = gy; f.rt = false; if (f.state === 'move' || f.state === 'idle') { f.set('air'); f.vy = 0; } f.rtPrev = { x: f.pos.x, z: f.pos.z }; log('drop'); return; }
    if (!f.rt) { f.rt = true; f.y = Math.max(0, A - hit.y); f.pos.y = hit.y; log('land:roof'); }
    else if (hit.y < f.pos.y - 0.02) { const d = f.pos.y - hit.y; f.pos.y = hit.y; if (d > 0.4) { f.y += d; if (f.state === 'move' || f.state === 'idle') { f.set('air'); f.vy = 0; } } }
    else f.pos.y = hit.y;
    f.airTop = Math.max(f.airTop || 0, f.pos.y + f.y); f.rtPrev = { x: f.pos.x, z: f.pos.z };
  };
  function tickTokens() { for (const t of tokens) { if (t.got) continue; t.m.rotation.z += 0.05; for (const f of X.players()) if (Math.hypot(f.pos.x - t.x, f.pos.z - t.z) < 1.0 && Math.abs(f.pos.y + f.y + 0.9 - t.y) < 1.6) { t.got = true; t.m.visible = false; GOT[t.id] = 1; ST.tokens++; X.cred(2);
    try { localStorage.setItem('tcb_roof_tokens', JSON.stringify(GOT)); } catch (e) {} sfx('ko'); const n = tokens.filter((q) => q.got).length; X.pop(X.word('CRAB TOKEN ' + n + '/' + tokens.length, '#ffd23c', null, 768, 70), f, 1.3, 0.9); log('token'); break; } } }
  // power / weapon pickups placed up on a roof sit at roof height
  const _tp = X.PK_KIND.pw_pound.take; X.PK_KIND.pw_pound.take = (f, p) => (f.rt || f.pos.y > 6 ? _tp(f, p) : false);

  // ground pound: jump-attack from a roof / high drop
  function poundCheck(f, before) { if (before === 'airatk' && f.state !== 'airatk') { const drop = (f.airTop || 0) - (f.pos.y + f.y); f.airTop = 0;
      if (has('pound') && drop > 1.6) { ST.pounds++; S.shake = Math.max(S.shake, 1.1); S.hitstop = Math.max(S.hitstop, 0.12); sfx('heavy'); X.pop(X.word('GROUND POUND!', '#7dffc0', '#14101f', 768, 76), f, 1.6, 0.9, 1.8);
        for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; spawnSprite(FXT.puff, _v.set(f.pos.x + Math.sin(a) * 2.2, f.pos.y + 0.3, f.pos.z + Math.cos(a) * 2.2), 1.1, 0.5, { kind: 'grow', depth: true, vel: new THREE.Vector3(Math.sin(a) * 4, 0.6, Math.cos(a) * 4) }); }
        for (const e of enemies) { if (!e.alive) continue; const dx = e.pos.x - f.pos.x, dz = e.pos.z - f.pos.z; if (Math.hypot(dx, dz) < 5.2) hitEnemy(e, 5, true, Math.atan2(dx, dz), f); } log('pound'); } }
    if (f.state === 'air' || f.state === 'airatk') f.airTop = Math.max(f.airTop || 0, f.pos.y + f.y); else if (!f.rt) f.airTop = 0; }

  // ---------------- DIRT BIKES ----------------
  const BIKES = [];
  function mkBike(col) { const g = new THREE.Group(), pivot = grp(g, 0, 0, -0.62), body = grp(pivot, 0, 0, 0.62), mat = toonMat(); body.userData.mat = mat;
    for (const z of [-0.62, 0.62]) part(body, G.tor(0.32, 0.09), '#14101f', 0, 0.36, z, { rot: [0, Math.PI / 2, 0] });
    part(body, G.box(0.14, 0.14, 1.1), col, 0, 0.62, 0); part(body, G.box(0.3, 0.22, 0.42), col, 0, 0.8, 0.18); part(body, G.box(0.26, 0.08, 0.6), '#2c2c3c', 0, 0.86, -0.24);
    part(body, G.cyl(0.03, 0.03, 0.62, 6), '#9aa3c5', 0, 1.0, 0.48, { rot: [0, 0, Math.PI / 2], outline: false }); part(body, G.cyl(0.035, 0.035, 0.6, 6), '#9aa3c5', 0, 0.68, 0.56, { rot: [0.35, 0, 0], outline: false });
    part(body, G.box(0.24, 0.05, 0.3), col, 0, 0.66, 0.64, { outline: false });
    scene.add(g); return { g, pivot, body }; }
  const SPOTS = [[-36, -37.5, 0.3, '#ff3d6e'], [-6, 43.5, 1.6, '#3fd13a'], [96, 37.5, -1.4, '#ffd23c'], [150, -43.5, 2.8, '#2f5bd3']];
  for (const [x, z, yaw, col] of SPOTS) { const m = mkBike(col); BIKES.push(Object.assign(m, { x, z, y: groundY(x, z), yaw, sp: 0, pitch: 0, pv: 0, rider: null, crew: null, home: [x, z, yaw] })); }
  // the roaming crew: two riders cruising Pratt St, popping wheelies
  const CREW = [];
  for (let i = 0; i < 2; i++) { const m = mkBike(i ? '#ff9f1c' : '#7b4dff'); const b = Object.assign(m, { x: 0 + i * 4, z: -39.6 - i * 1.6, y: 0, yaw: Math.PI / 2, sp: 9, pitch: 0, pv: 0, rider: null, crew: null, home: null });
    const J = buildThug(THUG_LOOKS[i ? 8 : 5]); scene.add(J.root); b.crew = { J, dir: 1, wt: rnd(2, 5) }; BIKES.push(b); CREW.push(b); }
  const CREW_X = [-25, 118];
  function seatPose(f, b) { const p = HERO_POSES.idle(S.time); p.lgL = [-1.25, 0, 0.18]; p.lgR = [-1.25, 0, -0.18]; p.knL = [1.4, 0, 0]; p.knR = [1.4, 0, 0]; p.shL = [-1.1, 0, 0.2]; p.shR = [-1.1, 0, -0.2]; p.elL = [-0.4, 0, 0]; p.elR = [-0.4, 0, 0]; p.torso = [0.35 - b.pitch * 0.6, 0, 0]; return p; }
  function placeBike(b) { b.g.position.set(b.x, b.y, b.z); b.g.rotation.y = b.yaw; b.pivot.rotation.x = -b.pitch; }
  function mount(f, b) { if (b.rider || b.crew) return; b.rider = f; f.bike = b; f.set('ride'); f.vel.set(0, 0); b.sp = 0; b.pitch = 0; b.pv = 0; b.score = 0; b.wt = 0; ST.mounts++; sfx('jump'); log('mount:' + (f === hero ? 'p1' : 'p2')); }
  function dismount(f, wipe) { const b = f.bike; if (!b) return; b.rider = null; f.bike = null; f.y = 0; f.root.rotation.x = 0; const sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw); f.pos.x = b.x + sx * 1.0; f.pos.z = b.z + sz * 1.0; collide(f);
    if (wipe) { ST.wipeouts++; f.set('down'); f.vy = 4; f.y = 0.01; f.kb.set(Math.sin(b.yaw) * b.sp * 0.4, Math.cos(b.yaw) * b.sp * 0.4); X.pop(X.word('WIPEOUT!', '#ff3d6e'), f, 1.0, 0.8); sfx('heavy'); b.sp = 0; log('wipeout'); }
    else f.set('move'); b.pitch = 0; b.pv = 0; b.sp = 0; b.y = groundY(b.x, b.z); placeBike(b); bankWheelie(f, b, true); }
  function bankWheelie(f, b, lost) { if (!b.score) return; const pts = Math.floor(b.score); b.score = 0; b.wt = 0; if (lost || pts < 1) return; X.cred(Math.max(1, Math.floor(pts / 10))); ST.wheelies++; ST.best = Math.max(ST.best, pts);
    X.pop(X.word('WHEELIE +' + pts, '#7dffc0', null, 768, 76), f, 1.4, 1.0, 2.6); sfx('ko'); log('wheelie:' + pts); }
  function rideStep(f, dt) {
    const b = f.bike, I = inp(f), d = worldDir(f), l = Math.min(1, Math.hypot(d[0], d[1]));
    if (I.act) { dismount(f, false); return; }
    if (f.state !== 'ride') { dismount(f, false); return; } // knocked off by a hit
    if (l > 0.1) { const ty = Math.atan2(d[0], d[1]); b.yaw += angTo(b.yaw, ty) * (1 - Math.exp(-dt * (2.2 + 2.5 / (1 + b.sp * 0.15)))); b.sp = Math.min(15, b.sp + 14 * l * dt); } else b.sp = Math.max(0, b.sp - 9 * dt);
    // wheelie: hold A / Space. Holding lifts the front, letting go drops it; over 1.25 rad = wipe out
    const hold = I.jumpH && b.sp > 4; if (hold) b.pv += (3.1 - 2.0 * b.pitch) * dt; else b.pv -= 5 * dt; b.pv += rnd(-0.6, 0.6) * dt; b.pv *= Math.exp(-dt * 1.6); b.pitch += b.pv * dt;
    if (b.pitch <= 0) { b.pitch = 0; b.pv = Math.max(0, b.pv); if (b.score) bankWheelie(f, b, false); }
    const green = b.pitch > 0.45 && b.pitch < 1.0; if (b.pitch > 0.12) { if (green) b.wt += dt; b.mult = 1 + Math.min(4, Math.floor(b.wt * 2) / 2); b.score = (b.score || 0) + dt * (green ? 10 : 3) * b.mult; }
    if (b.pitch > 1.25) { b.score = 0; dismount(f, true); return; }
    const vx = Math.sin(b.yaw) * b.sp, vz = Math.cos(b.yaw) * b.sp, ox = f.pos.x, oz = f.pos.z; f.pos.x += vx * dt; f.pos.z += vz * dt; f.y = 0; _collide(f);
    const moved = Math.hypot(f.pos.x - ox, f.pos.z - oz); if (b.sp > 3 && moved < b.sp * dt * 0.4) { b.sp *= 0.4; S.shake = Math.max(S.shake, 0.3); }
    f.vel.set(vx, vz); f.yaw = b.yaw; b.x = f.pos.x; b.z = f.pos.z; b.y = f.pos.y; placeBike(b);
    // ride into thugs
    if (b.sp > 5) for (const e of enemies) { if (!e.alive || e.state === 'down' || e.state === 'dying' || (e.bkT || 0) > S.time) continue; if (Math.hypot(e.pos.x - f.pos.x, e.pos.z - f.pos.z) < 1.25) { e.bkT = S.time + 0.5; if (hitEnemy(e, 3, true, b.yaw, f)) { ST.bikeKOs++; b.sp *= 0.8; } } }
    // rider sits on the seat (lifts with the wheelie)
    const lift = Math.sin(b.pitch) * 0.62; f.y = 0.42 + lift * 0.9; applyPose(f.J, seatPose(f, b), 16, dt, false); f.sync(dt); f.root.position.x -= Math.sin(b.yaw) * lift * 0.25; f.root.position.z -= Math.cos(b.yaw) * lift * 0.25; f.root.rotation.x = -b.pitch * 0.8;
  }
  function crewStep(b, dt) { const c = b.crew; if (!c) return; c.wt -= dt; if (c.wt < 0) { c.whee = !c.whee; c.wt = c.whee ? rnd(1, 2.2) : rnd(2.5, 6); }
    b.pitch = damp(b.pitch, c.whee ? 0.7 : 0, 3, dt); b.yaw = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; b.x += c.dir * b.sp * dt; if (b.x > CREW_X[1]) c.dir = -1; if (b.x < CREW_X[0]) c.dir = 1; b.y = groundY(b.x, b.z); placeBike(b);
    const lift = Math.sin(b.pitch) * 0.62; c.J.root.position.set(b.x - Math.sin(b.yaw) * lift * 0.25, b.y + 0.42 + lift * 0.9, b.z); c.J.root.rotation.set(-b.pitch * 0.8, b.yaw, 0); applyPose(c.J, THUG_POSES.getup(0.45, c.J), 12, dt, false);
    for (const f of [hero, partner]) { if (f.hp <= 0) continue; const d = Math.hypot(f.pos.x - b.x, f.pos.z - b.z); if (d > 1.6) continue;
      if (f.state === 'atk' || f.state === 'airatk' || (f.bike && f.bike.sp > 5) || f.dashT > 0) { knockRider(b, f); return; }
      if (d < 1.0 && !f.bike) hurtTurtle(f, 6, b.x, b.z, true); } }
  function knockRider(b, by) { const c = b.crew; b.crew = null; scene.remove(c.J.root); b.pitch = 0; b.sp = 0; placeBike(b); log('crew:knocked');
    const e = X.free((q) => q.arch !== 'mook'); if (e) { X.wake(e, b.x + 1, b.z, { state: 'down', leash: 18, aggro: 99 }); e.vy = 4; e.y = 0.3; e.kb.set(Math.sin(b.yaw) * 4, Math.cos(b.yaw) * 4); }
    X.pop(X.word('OFF THE BIKE!', '#ffd23c', '#ff3d6e', 768, 70), { pos: { x: b.x, y: b.y, z: b.z } }, 1.3, 0.9, 2.2); sfx('heavy'); }
  BIKES.forEach(placeBike);
  for (const b of BIKES) ACTIONS.push({ kind: 'dirtbike', label: 'RIDE', get x() { return b.x; }, get z() { return b.z; }, r: 1.7, y: 1.8, ok: () => !b.rider && !b.crew && !hero.bike && !hero.rt && !hero.roof && !hero.zip, go: () => mount(hero, b) });
  if (typeof ICONS !== 'undefined') { ICONS.dirtbike = ICONS.bike || ICONS.skate || ICONS.car || ''; ICONS.climb = ICONS.ladder || ICONS.vault || ICONS.door || ''; }
  function hudBike() { const rs = [hero, partner].filter((f) => f.bike); if (!rs.length) { bikeHud.style.display = 'none'; return; }
    bikeHud.style.display = 'block'; bikeHud.innerHTML = rs.map((f) => { const b = f.bike, m = clamp(b.pitch / 1.25, 0, 1) * 100; return `<div>${COOP.on ? (f === hero ? 'P1 ' : 'P2 ') : ''}${b.pitch > 0.12 ? 'WHEELIE x' + (b.mult || 1).toFixed(1) + ' +' + Math.floor(b.score || 0) : 'HOLD A / SPACE TO WHEELIE'}</div><div class="bar"><i style="left:${m.toFixed(0)}%"></i></div>`; }).join(''); }

  // ---------------- per-step hooks ----------------
  function pre(f, dt, I) { // before the normal update; returns true when gear owns this fighter's step
    f.dashCd = Math.max(0, (f.dashCd || 0) - dt); f.inv = Math.max(0, f.inv - (f.zip || f.bike ? dt : 0));
    if (f.zip) { zipStep(f, dt); return true; }
    if (f.bike) { rideStep(f, dt); return true; }
    if (I.dash && (f.state === 'move' || f.state === 'atk' || f.state === 'air')) dash(f);
    if (I.tongue && (f.state === 'move' || f.state === 'air')) tongue(f);
    return false; }
  function post(f, dt, before) { if (f.dashT > 0) { f.dashT -= dt; f.pos.x += f.dashV[0] * dt; f.pos.z += f.dashV[1] * dt; collide(f); f.sync(0); if (Math.random() < 0.5) dust(f.pos.x, f.pos.y, f.pos.z, 1); } poundCheck(f, before); }
  const _uh = updateHero;
  updateHero = function (dt) { const I = inp(hero);
    if (!hero.bike && !hero.zip && hero.wpn && (hero.state === 'move' || hero.state === 'idle') && pressed('j', 'x', 'enter')) { for (const k of ['j', 'x', 'enter']) PRESS.delete(k); fire(hero); }
    if (pre(hero, dt, I)) return; const before = hero.state; _uh(dt); post(hero, dt, before); };
  const _u2 = COOP.updateP2;
  COOP.updateP2 = function (dt) { const P = partner, I = inp(P), I2 = COOP.IN2;
    if (!P.bike && !P.zip && I.act && P.state === 'move') { const b = BIKES.find((q) => !q.rider && !q.crew && Math.hypot(q.x - P.pos.x, q.z - P.pos.z) < 1.8); if (b) { mount(P, b); I2.act = false; return; }
      if (LAD && Math.hypot(LAD.x - P.pos.x, LAD.z - P.pos.z) < 1.6 && !P.rt) { zipTo(P, LAD.top.x + 0.8, LAD.top.y, LAD.top.z, 1.0); I2.act = false; log('climb:p2'); return; } }
    if (!P.bike && !P.zip && P.wpn && P.state === 'move' && I2.atk) { I2.atk = false; fire(P); }
    if (pre(P, dt, I)) return; const before = P.state; _u2(dt); post(P, dt, before); };
  // co-op off while P2 rides: AI Mavis can't ride, so she hops off
  const _up = updatePartner; updatePartner = function (dt) { if (partner.bike) dismount(partner, false); if (partner.zip) { zipStep(partner, dt); return; } return _up(dt); };

  // ---------------- per-frame ----------------
  let wCd = 20;
  function tick(rdt) { const dt = Math.min(rdt, 0.05); tickShots(dt); tickTokens(); hudBike();
    if (tongueT > 0) { tongueT -= dt; if (tongueT <= 0) tongueM.visible = false; }
    if (MODE.duel || RB.mode) return;
    for (const b of CREW) crewStep(b, dt);
    if (!CREW.some((b) => b.crew) && Math.random() < dt / 90) { const b = CREW.find((q) => !q.rider && Math.min(...[hero, partner].map((f) => Math.hypot(f.pos.x - q.x, f.pos.z - q.z))) > 50); if (b) { const J = buildThug(THUG_LOOKS[5]); scene.add(J.root); b.crew = { J, dir: 1, wt: 3 }; b.x = CREW_X[0]; b.z = -39.6; b.sp = 9; } }
    // weapons lying in alleys round the city (a few at a time)
    wCd -= dt; if (wCd <= 0 && !BOT && !SIM) { wCd = rnd(30, 50); if (X.PICK.filter((p) => W[p.kind]).length < 3) { const s = X.STOOPS[(Math.random() * X.STOOPS.length) | 0]; const d = Math.hypot(s.x - hero.pos.x, s.z - hero.pos.z); if (d > 20 && d < 60) X.drop(KINDS[(Math.random() * KINDS.length) | 0], s.x, s.z, { life: 120 }); } } }
  MODE.ticks.push(tick);
  const api = { give: (f, k) => give(f === 'p2' ? partner : f === 'p1' ? hero : f, k), fire: (f) => fire(f === 'p2' ? partner : hero), powers: () => Object.assign({}, POW), unlock, route: ROUTE, bikes: BIKES, mount: (f, i) => mount(f === 'p2' ? partner : hero, BIKES[i]), dismount: (f) => dismount(f === 'p2' ? partner : hero, false),
    tokens: () => tokens.filter((t) => t.got).length, ST, zipTo: (f, x, y, z) => zipTo(f === 'p2' ? partner : hero, x, y, z, 0.6), W: Object.keys(W), shots: () => SHOTS.length };
  window.__gear = api; return api;
})();
