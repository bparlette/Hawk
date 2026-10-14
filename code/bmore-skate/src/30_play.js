
// ======================= TOAD CITY SKATE: the skater sim (ride, ollie, flip, grab, grind, manual, spin, bail) + trick scoring =======================
// Arcade skate physics on the city's own ground (groundY / isWater / onPier / COLL from 03_city) plus the skate props (SKD).
const SKI = { sx: 0, sy: 0, held: { ollie: 0, flip: 0, grab: 0, grind: 0, special: 0 }, pressed: new Set(), buf: {} }; // filled by the HUD / keyboard / bot
const SKP = (function () {
  const G = 16, STEP_CITY = 0.24, STEP_BOX = 0.1, R = 0.3, CRUISE = 8.4, TOP = 12.8, OLLIE_V = 5.3, BODY = 0.85;
  const S = {
    x: 0, y: CURB, z: 0, vx: 0, vz: 0, vy: 0, h: 0, v: 0, yawOff: 0, spinV: 0, spinAcc: 0, mode: 'ground', fakie: false, t: 0,
    airT: 0, flip: null, grab: null, bal: 0, balV: 0, balK: 1.6, gr: null, bailT: 0, bailWhy: '', manual: null, slope: 0, surf: 'walk',
    combo: { pts: 0, mult: 0, list: [], counts: {}, live: 0, stoopLast: -1, grindAir: false }, score: 0, bestCombo: 0, bestTrick: '', bestTrickPts: 0,
    special: 0, specialOn: false, launch: null, overWater: false, lastSafe: { x: 0, z: 0, h: 0 }, safeT: 0, pushT: 0, landT: 0, lean: 0,
    letters: new Set(), tape: false, gapsDone: new Set(), events: [], stats: { tricks: 0, bails: 0, grindT: 0, manualT: 0, airT: 0, combos: 0, maxAir: 0 },
    board: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0 }, frozen: false, buf: {}, travel: 0, getup: 0,
  };
  const ev = (type, a) => { S.events.push(Object.assign({ type, t: S.t }, a || {})); };
  // ---------------- the world queries ----------------
  function surfAt(x, z) { if (isWater(x, z)) return 'water'; const p = onPier(x, z); if (p) return p.t === 'plank' ? 'plank' : 'pave'; if (isRoad(x, z)) return 'street'; if (isProm(x, z)) return 'brick'; return 'walk'; }
  function wedgeH(w, x, z) { const t = w.dir === '+x' ? (x - w.x0) / (w.x1 - w.x0) : w.dir === '-x' ? (w.x1 - x) / (w.x1 - w.x0) : w.dir === '+z' ? (z - w.z0) / (w.z1 - w.z0) : (w.z1 - z) / (w.z1 - w.z0); return w.base + w.h * clamp(t, 0, 1); }
  function floorAt(x, z, y) {
    let f, kind = surfAt(x, z), water = kind === 'water';
    f = water ? WY - 3 : groundY(x, z);
    for (const b of SKD.boxes) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y >= b.top - STEP_BOX - 0.03 && b.top > f) { f = b.top; kind = b.kind; water = false; }
    for (const w of SKD.wedges) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) { const hh = wedgeH(w, x, z); if (y >= hh - 0.32 && hh > f) { f = hh; kind = 'ramp'; water = false; } }
    return { f, kind, water };
  }
  // solid test for the skate props (a box face / a kicker's high side or cheeks) at height y
  function propBlock(x, z, y, out) {
    for (const b of SKD.boxes) if (x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R && y < b.top - STEP_BOX) { pushBox(b, x, z, out); if (out.hit) return true; }
    for (const w of SKD.wedges) if (x > w.x0 - R * 0.5 && x < w.x1 + R * 0.5 && z > w.z0 - R * 0.5 && z < w.z1 + R * 0.5) { const hh = wedgeH(w, clamp(x, w.x0, w.x1), clamp(z, w.z0, w.z1)); if (y < hh - 0.32) { pushBox(w, x, z, out, R * 0.5); if (out.hit) return true; } }
    return false;
  }
  function pushBox(b, x, z, out, r = R) { // push a circle (x,z,r) out of box b: out = { x, z, nx, nz, hit }
    const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1); let dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
    if (d > 1e-6) { if (d >= r) { out.hit = false; return; } out.nx = dx / d; out.nz = dz / d; out.x = cx + out.nx * r; out.z = cz + out.nz * r; out.hit = true; return; }
    const pl = [x - b.x0, b.x1 - x, z - b.z0, b.z1 - z], m = Math.min(...pl), i = pl.indexOf(m);
    out.nx = i === 0 ? -1 : i === 1 ? 1 : 0; out.nz = i === 2 ? -1 : i === 3 ? 1 : 0;
    out.x = i === 0 ? b.x0 - r : i === 1 ? b.x1 + r : x; out.z = i === 2 ? b.z0 - r : i === 3 ? b.z1 + r : z; out.hit = true;
  }
  const _o = { x: 0, z: 0, nx: 0, nz: 0, hit: false };
  // move (x,z) -> (nx,nz) at height y, sliding along walls. Returns the strongest wall normal hit (or null)
  function moveXZ(nx, nz, y, grounded) {
    let hitN = null;
    for (let it = 0; it < 3; it++) {
      let any = false;
      for (const c of collAt(nx, nz)) {
        if (c.r !== undefined) { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz), rr = c.r + R; if (d < rr && d > 1e-6) { nx = c.x + dx / d * rr; nz = c.z + dz / d * rr; hitN = { x: dx / d, z: dz / d }; any = true; } }
        else { pushBox(c, nx, nz, _o); if (_o.hit) { nx = _o.x; nz = _o.z; hitN = { x: _o.nx, z: _o.nz }; any = true; } }
      }
      if (propBlock(nx, nz, y, _o)) { nx = _o.x; nz = _o.z; hitN = { x: _o.nx, z: _o.nz }; any = true; }
      if (grounded) { const gy = isWater(nx, nz) ? -99 : groundY(nx, nz); if (gy - y > STEP_CITY) { // a raised edge (a plot / pier lip) too tall to roll onto
        const ax = S.x, az = S.z; const ddx = nx - ax, ddz = nz - az, l = Math.hypot(ddx, ddz) || 1; hitN = { x: -ddx / l, z: -ddz / l }; nx = ax; nz = az; any = true; } }
      const B = SKD.bounds; if (nx < B.x0) { nx = B.x0; hitN = { x: 1, z: 0 }; any = true; } if (nx > B.x1) { nx = B.x1; hitN = { x: -1, z: 0 }; any = true; }
      if (nz < B.z0) { nz = B.z0; hitN = { x: 0, z: 1 }; any = true; } if (nz > B.z1) { nz = B.z1; hitN = { x: 0, z: -1 }; any = true; }
      if (!any) break;
    }
    S.x = nx; S.z = nz; return hitN;
  }
  // ---------------- tricks + combo ----------------
  function addTrick(name, pts, multInc = 1) {
    const c = S.combo, n = c.counts[name] || 0; c.counts[name] = n + 1;
    const p = Math.round(pts * Math.pow(0.5, Math.min(n, 3))); // the same trick again in one combo is worth less (x0.5 each time)
    c.list.push(name); c.pts += p; c.mult += multInc; S.special = Math.min(1, S.special + p * 0.0011 + 0.01 * multInc);
    S.stats.tricks++; ev('trick', { name, pts: p });
    if (p > S.bestTrickPts) { S.bestTrickPts = p; S.bestTrick = name; }
    return p;
  }
  function comboTotal() { return Math.round((S.combo.pts + S.combo.live) * Math.max(1, S.combo.mult)); }
  function bank() {
    const c = S.combo; const total = comboTotal();
    if (c.list.length) { S.score += total; S.stats.combos++; if (total > S.bestCombo) S.bestCombo = total; ev('bank', { total, mult: Math.max(1, c.mult), list: c.list.slice() }); }
    resetCombo();
  }
  function resetCombo() { const c = S.combo; c.pts = 0; c.mult = 0; c.list.length = 0; c.counts = {}; c.live = 0; c.stoopLast = -1; c.grindAir = false; }
  function inCombo() { return S.combo.list.length > 0; }
  // ---------------- state changes ----------------
  function launch(vy, why) {
    S.mode = 'air'; S.vy = vy; S.airT = 0; S.yawOff = 0; S.spinV = 0; S.spinAcc = 0; S.flip = null; S.grab = null;
    const sp = Math.hypot(S.vx, S.vz); S.travel = sp > 0.3 ? Math.atan2(S.vx, S.vz) : S.h;
    S.launch = { x: S.x, z: S.z, why }; S.overWater = false;
  }
  function ollie(fromGrind) {
    let vy = OLLIE_V + (S.specialOn ? 0.4 : 0);
    if (S.mode === 'ground' || S.mode === 'manual') { vy += clamp(S.slope * S.v * 1.1, 0, 3.2); S.vx = Math.sin(S.h) * S.v; S.vz = Math.cos(S.h) * S.v; }
    const wasManual = S.mode === 'manual';
    launch(vy, fromGrind ? 'grind' : 'ollie');
    if (!fromGrind && !wasManual) addTrick('OLLIE', 50, 0);
    ev('pop');
  }
  function bail(why) {
    if (S.mode === 'bail') return;
    const lost = comboTotal(); S.mode = 'bail'; S.bailT = 0; S.bailWhy = why; S.stats.bails++; S.special = 0; S.specialOn = false;
    S.flip = null; S.grab = null; S.gr = null; S.manual = null;
    ev('bail', { why, lost }); resetCombo();
    const sp = Math.hypot(S.vx, S.vz); S.board = { x: S.x, y: S.y + 0.1, z: S.z, vx: S.vx * 1.15 + rnd(-1, 1), vy: 3.2 + rnd(0, 1.5), vz: S.vz * 1.15 + rnd(-1, 1), r: 0, rv: rnd(8, 14) * (Math.random() < 0.5 ? -1 : 1) };
    S.bailV = { x: S.vx * 0.55, z: S.vz * 0.55 }; S.bailSplash = why === 'SPLASH';
    if (!sp) S.bailV = { x: 0, z: 0 };
  }
  function land(fl) {
    const travel = Math.hypot(S.vx, S.vz) > 0.5 ? Math.atan2(S.vx, S.vz) : S.travel;
    const boardYaw = S.travel + S.yawOff, d = Math.abs(wrapA(boardYaw - travel));
    if (S.flip && S.flip.u < 0.82) { S.y = fl.f; bail('FLIP'); return; }
    if (d > 0.78 && d < Math.PI - 0.78) { S.y = fl.f; bail('SPIN'); return; }
    if (d >= Math.PI - 0.78) S.fakie = !S.fakie;
    // spin credit
    const deg = Math.floor((Math.abs(S.spinAcc) + 0.5) / Math.PI) * 180;
    if (deg >= 180) addTrick((S.spinAcc > 0 ? 'FS ' : 'BS ') + deg, 60 * deg / 180 + (deg >= 540 ? 200 : 0));
    // gaps
    for (const g of SKD.gaps) if (S.launch && inR(g.from, S.launch.x, S.launch.z) && inR(g.to, S.x, S.z) && (!g.goal || S.overWater)) { addTrick(g.name, g.pts); S.gapsDone.add(g.name); ev('gap', { name: g.name, pts: g.pts, goal: !!g.goal }); }
    S.y = fl.f; S.vy = 0; S.h = travel; S.v = Math.min(TOP + 1.5, Math.hypot(S.vx, S.vz) * 0.97); S.mode = 'ground'; S.landT = 0.28; S.flip = null; S.grab = null;
    S.stats.maxAir = Math.max(S.stats.maxAir, S.airT);
    ev('land', { hard: S.airT > 0.9 });
    if (S.buf.grind > 0 && inCombo()) startManual(); else bank();
  }
  function startManual() {
    const nose = SKI.sy > 0.35;
    S.mode = 'manual'; S.manual = { nose, t: 0, special: false }; S.bal = rnd(-0.12, 0.12); S.balV = 0; S.balK = 1.5; S.buf.grind = 0;
    if (S.specialOn && SKI.held.special) { S.manual.special = true; S.special -= 0.4; addTrick('CRAB WALK', 1200); ev('special', { name: 'CRAB WALK' }); }
    else addTrick(nose ? 'NOSE MANUAL' : 'MANUAL', 75);
  }
  function nearGrind(air) {
    let best = null, bs = 1e9;
    for (const g of SKD.grinds) {
      const ax = g.a.x, az = g.a.z, bx = g.b.x - ax, bz = g.b.z - az, l2 = bx * bx + bz * bz;
      const t = clamp(((S.x - ax) * bx + (S.z - az) * bz) / l2, 0, 1); if (t <= 0.001 || t >= 0.999) continue;
      const qx = ax + bx * t, qz = az + bz * t, qy = g.a.y + (g.b.y - g.a.y) * t, dh = Math.hypot(S.x - qx, S.z - qz), dy = S.y - qy;
      if (dh > (air ? 0.95 : 1.3) || dy < (air ? -0.6 : -1.35) || dy > 1.15) continue;
      const sc = dh + Math.abs(dy) * 0.4; if (sc < bs) { bs = sc; best = { g, t, qx, qy, qz }; }
    }
    return best;
  }
  function startGrind(n) {
    const g = n.g, ab = new THREE.Vector3().subVectors(g.b, g.a), L = ab.length(), u = ab.clone().divideScalar(L), uh = Math.hypot(u.x, u.z) || 1;
    const vx = S.mode === 'air' ? S.vx : Math.sin(S.h) * S.v, vz = S.mode === 'air' ? S.vz : Math.cos(S.h) * S.v;
    let along = (vx * u.x + vz * u.z) / uh;
    const boardYaw = S.mode === 'air' ? S.travel + S.yawOff : S.h, railYaw = Math.atan2(u.x, u.z);
    let dir = Math.sign(along) || (Math.cos(boardYaw - railYaw) >= 0 ? 1 : -1); if (Math.abs(along) < 1.5) dir = n.t < 0.5 ? 1 : -1;
    const rel = Math.abs(wrapA(boardYaw - railYaw)); const ang = Math.min(rel, Math.PI - rel);
    const sy = SKI.sy; let name, slide = false;
    if (S.specialOn && SKI.held.special) { name = 'FORMSTONE GRIND'; S.special -= 0.4; ev('special', { name }); }
    else if (ang < 0.55) name = sy > 0.4 ? 'NOSEGRIND' : sy < -0.4 ? '5-0 GRIND' : '50-50 GRIND';
    else if (ang > 1.05) { slide = true; name = g.kind === 'rail' ? (sy > 0.4 ? 'NOSESLIDE' : sy < -0.4 ? 'TAILSLIDE' : 'BOARDSLIDE') : (sy > 0.4 ? 'NOSESLIDE' : sy < -0.4 ? 'TAILSLIDE' : 'LIPSLIDE'); }
    else name = sy >= 0 ? 'CROOKED GRIND' : 'SMITH GRIND';
    // stoop to stoop transfer
    if (g.stoop !== undefined && S.combo.stoopLast >= 0 && S.combo.stoopLast !== g.stoop && S.mode === 'air' && S.combo.grindAir) { addTrick('STOOP TO STOOP', 250); ev('gap', { name: 'STOOP TO STOOP', pts: 250 }); }
    if (g.stoop !== undefined) S.combo.stoopLast = g.stoop;
    const yawSnap = slide ? railYaw + (wrapA(boardYaw - railYaw - Math.PI / 2) < Math.PI / 2 && wrapA(boardYaw - railYaw - Math.PI / 2) > -Math.PI / 2 ? Math.PI / 2 : -Math.PI / 2) : railYaw + (Math.cos(boardYaw - railYaw) >= 0 ? 0 : Math.PI);
    S.gr = { g, t: n.t, L, u, uh, dir, v: Math.max(Math.abs(along) * 1.02 + 0.6, 5.2), name, slide, yaw: yawSnap, time: 0, special: name === 'FORMSTONE GRIND' };
    S.mode = 'grind'; S.bal = rnd(-0.14, 0.14) * (g.kind === 'rail' ? 1.2 : 0.8); S.balV = 0; S.balK = 1.55; S.x = n.qx; S.z = n.qz; S.y = n.qy; S.vy = 0;
    S.flip = null; S.grab = null; S.buf.grind = 0;
    addTrick(name, name === 'FORMSTONE GRIND' ? 1500 : g.stoop !== undefined ? 150 : 100);
    ev('grind', { name, kind: g.kind });
  }
  function startFlip(sp) {
    if (S.specialOn && (sp || SKI.held.special)) { S.flip = { kind: 'HON 540 FLIP', u: 0, dur: 0.78, n: 2, ax: 'z', special: true }; S.special -= 0.4; S.spinV = 0; S.autoSpin = Math.PI * 3 / 0.78; addTrick('HON 540 FLIP', 2500); ev('special', { name: 'HON 540 FLIP' }); return; }
    if (S.flip && S.flip.u < 0.5 && !S.flip.dbl && !S.flip.special) { S.flip.dbl = true; S.flip.n = 2; S.flip.dur *= 1.55; S.flip.kind = 'DOUBLE ' + S.flip.kind; addTrick(S.flip.kind, 160); return; }
    if (S.flip && S.flip.u < 0.85) return;
    const sx = SKI.sx, sy = SKI.sy; let kind = 'KICKFLIP', ax = 'z', sg = 1, pts = 100;
    if (sy > 0.45 && Math.abs(sy) > Math.abs(sx)) { kind = 'IMPOSSIBLE'; ax = 'x'; pts = 150; }
    else if (sy < -0.45 && Math.abs(sy) > Math.abs(sx)) { kind = 'POP SHOVE-IT'; ax = 'y'; }
    else if (sx > 0.45) { kind = 'HEELFLIP'; sg = -1; }
    S.flip = { kind, u: 0, dur: 0.42, n: 1, ax, sg }; addTrick(kind, pts); ev('flip', { name: kind });
  }
  function startGrab() {
    if (S.flip && S.flip.u < 0.85) return;
    const sx = SKI.sx, sy = SKI.sy; let kind = 'INDY';
    if (sy > 0.45 && Math.abs(sy) >= Math.abs(sx)) kind = 'NOSEGRAB'; else if (sy < -0.45 && Math.abs(sy) >= Math.abs(sx)) kind = 'TAILGRAB'; else if (sx < -0.45) kind = 'MELON'; else if (sx > 0.45) kind = 'METHOD';
    S.grab = { kind, t: 0 }; addTrick(kind, 100); ev('grab', { name: kind });
  }
  // ---------------- per-mode updates ----------------
  function ground(dt) {
    const man = S.mode === 'manual';
    // steering + speed
    const turn = SKI.sx * (2.55 - S.v * 0.055) * (man ? 0.6 : 1);
    S.h -= turn * dt; S.lean = damp(S.lean, -SKI.sx * clamp(S.v / 8, 0, 1), 8, dt);
    const top = TOP + (S.specialOn ? 1.2 : 0);
    let pushing = false;
    if (!man) {
      if (SKI.sy > 0.35) { if (S.v < top) { S.v += 7.5 * dt; pushing = true; } }
      else if (SKI.sy < -0.45) S.v = Math.max(0, S.v - 11 * dt);
      else if (S.v < CRUISE) { S.v += 5.5 * dt; pushing = true; }
    }
    S.pushT = pushing ? S.pushT + dt * 1.7 : 0;
    S.v -= (0.12 + S.v * 0.012) * dt; if (S.v > top + 0.5) S.v = damp(S.v, top, 1.5, dt);
    // slope along the heading
    const dx = Math.sin(S.h), dz = Math.cos(S.h);
    const fa = floorAt(S.x, S.z, S.y + 0.05).f, fb = floorAt(S.x - dx * 0.4, S.z - dz * 0.4, S.y + 0.05).f;
    S.slope = clamp((fa - fb) / 0.4, -1.2, 1.2); if (Math.abs(fa - fb) > 0.2) S.slope = 0; // a curb / ledge edge behind is not a slope
    S.v -= G * S.slope * 0.75 * dt; if (S.v < 0) { S.v = -S.v * 0.5; S.h += Math.PI; S.fakie = !S.fakie; }
    S.vx = dx * S.v; S.vz = dz * S.v;
    const n = moveXZ(S.x + S.vx * dt, S.z + S.vz * dt, S.y, true);
    if (n) wallHit(n, true);
    const fl = floorAt(S.x, S.z, S.y + 0.02);
    S.surf = fl.kind;
    if (fl.f < S.y - 0.11 || fl.water) { // rolled off an edge (a ledge, the kicker lip, a curb, the seawall)
      const vy = clamp(S.slope * S.v * 1.2, 0, 3.5);
      if (man) { S.manual = null; } // the manual flows into the air, the combo carries on
      launch(vy, 'drop'); if (vy > 1.2) ev('launch'); return;
    }
    S.y = fl.f;
    if (man) {
      S.manual.t += dt; S.stats.manualT += dt;
      S.balK += dt * 0.22; S.balV += (S.bal * S.balK + rnd(-0.9, 0.9)) * dt; S.balV -= SKI.sy * 3.4 * dt * (S.manual.nose ? -1 : 1); S.balV *= Math.exp(-1.1 * dt); S.bal += S.balV * dt;
      S.combo.live += (S.manual.special ? 320 : 70) * dt;
      if (Math.abs(S.bal) > 1) { bail('MANUAL'); return; }
      if (consume('grind')) { S.mode = 'ground'; S.manual = null; bank(); }
      else if (consume('special')) { if (!S.specialOn) ev('nospecial'); else if (!S.manual.special) { S.manual.special = true; S.special -= 0.4; addTrick('CRAB WALK', 1200); ev('special', { name: 'CRAB WALK' }); } }
    } else if (consume('grind')) {
      const n2 = nearGrind(false); if (n2 && n2.qy - S.y < 1.35) { S.y = n2.qy; startGrind(n2); return; } // pop straight onto a ledge / rail beside you
      if (S.v > 1.5) startManual();
    }
    if (consume('ollie')) { ollie(false); return; }
    if (consume('special')) { if (!S.specialOn) ev('nospecial'); else { ollie(false); startFlip(true); return; } } // special on the ground: pop straight into the special flip
    consume('flip'); consume('grab');
    // a safe respawn point (on dry, open ground)
    S.safeT += dt; if (S.safeT > 0.4 && !man && fl.kind !== 'water' && S.v > 1) { S.safeT = 0; if (Math.abs(S.slope) < 0.02 && !nearWaterEdge(S.x, S.z) && !onPier(S.x, S.z) && S.z < -31.5 && (fl.kind === 'street' || fl.kind === 'brick' || fl.kind === 'walk')) S.lastSafe = { x: S.x, z: S.z, h: S.h }; }
  }
  function nearWaterEdge(x, z) { for (const [ox, oz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2]]) if (isWater(x + ox, z + oz)) return true; return false; }
  function wallHit(n, grounded) {
    const vx = grounded ? Math.sin(S.h) * S.v : S.vx, vz = grounded ? Math.cos(S.h) * S.v : S.vz;
    const vn = vx * n.x + vz * n.z; if (vn >= 0) return;
    const sp = Math.hypot(vx, vz), head = -vn / (sp || 1);
    if ((grounded && -vn > 7.2 && head > 0.72) || (!grounded && -vn > 8.5 && head > 0.7)) { bail('WALL'); return; }
    const tx = vx - n.x * vn, tz = vz - n.z * vn, ts = Math.hypot(tx, tz);
    if (grounded) { if (ts > 0.3) S.h = Math.atan2(tx, tz); S.v = ts * 0.92; ev('bump', { s: -vn }); }
    else { S.vx = tx * 0.9; S.vz = tz * 0.9; }
  }
  function air(dt) {
    S.airT += dt; S.stats.airT += dt;
    S.vy -= G * dt;
    const n = moveXZ(S.x + S.vx * dt, S.z + S.vz * dt, S.y, false); if (n) wallHit(n, false);
    if (S.mode !== 'air') return;
    S.y += S.vy * dt;
    if (isWater(S.x, S.z)) S.overWater = true;
    // spin (stick left / right), auto spin for the special
    const target = S.flip && S.flip.special ? S.autoSpin : -SKI.sx * 7.2;
    S.spinV = damp(S.spinV, target, S.flip && S.flip.special ? 30 : 9, dt); S.yawOff += S.spinV * dt; S.spinAcc += S.spinV * dt;
    if (S.flip) { S.flip.u += dt / S.flip.dur; if (S.flip.u >= 1) { if (S.flip.special) S.spinAcc = Math.round(S.spinAcc / Math.PI) * Math.PI, S.yawOff = Math.round(S.yawOff / Math.PI) * Math.PI; S.flip = null; } }
    if (S.grab) { S.grab.t += dt; S.combo.live += 160 * dt; if (!SKI.held.grab) S.grab = null; }
    if (consume('flip')) startFlip();
    if (consume('grab')) startGrab();
    if (consume('special')) { if (S.specialOn) startFlip(true); else ev('nospecial'); }
    consume('ollie');
    // grinds: press (or hold) GRIND near a rail
    if ((S.buf.grind > 0 || SKI.held.grind) && S.vy < 3.2) { const g = nearGrind(true); if (g) { startGrind(g); return; } }
    pickups();
    const fl = floorAt(S.x, S.z, S.y);
    if (fl.water && S.y < WY + 0.15) { bail('SPLASH'); return; }
    if (S.y <= fl.f && S.vy <= 0) land(fl);
    if (S.y < -6) bail('SPLASH');
  }
  function grind(dt) {
    const r = S.gr, g = r.g; r.time += dt; S.stats.grindT += dt;
    const uy = r.u.y * r.dir;
    r.v -= G * uy * 0.85 * dt; r.v -= 0.22 * dt;
    if (r.v < 0.9) { S.vx = r.u.x * r.dir * r.v; S.vz = r.u.z * r.dir * r.v; S.mode = 'air'; launch(0, 'grind'); S.combo.grindAir = true; return; }
    r.t += r.dir * r.v * dt / r.L;
    S.balK += dt * 0.32; S.balV += (S.bal * S.balK + rnd(-1.1, 1.1) * (g.kind === 'rail' ? 1.15 : 0.85)) * dt; S.balV -= SKI.sx * 3.6 * dt; S.balV *= Math.exp(-1.15 * dt); S.bal += S.balV * dt;
    S.combo.live += (r.special ? 420 : g.stoop !== undefined ? 170 : 120) * dt;
    if (Math.abs(S.bal) > 1) { // fall off the rail: the side you lean to
      const side = Math.sign(S.bal), px = -r.u.z / r.uh, pz = r.u.x / r.uh;
      S.x += px * side * 0.5; S.z += pz * side * 0.5; S.vx = r.u.x * r.dir * r.v * 0.5 + px * side * 2; S.vz = r.u.z * r.dir * r.v * 0.5 + pz * side * 2;
      bail(g.water && isWater(S.x + px * side, S.z + pz * side) ? 'SPLASH' : 'GRIND'); if (S.bailWhy === 'SPLASH') S.y -= 0.2; return;
    }
    const tt = clamp(r.t, 0, 1);
    S.x = g.a.x + (g.b.x - g.a.x) * tt; S.z = g.a.z + (g.b.z - g.a.z) * tt; S.y = g.a.y + (g.b.y - g.a.y) * tt;
    S.vx = r.u.x * r.dir * r.v; S.vz = r.u.z * r.dir * r.v; S.surf = g.kind;
    pickups();
    if (r.t < 0 || r.t > 1) {
      const end = r.t > 1 ? g.b : g.a; let nx = null;
      for (const h of SKD.grinds) if (h !== g) { if (h.a.distanceTo(end) < 0.06) nx = [h, 0]; else if (h.b.distanceTo(end) < 0.06) nx = [h, 1]; if (nx) break; }
      if (nx) { const [h, t0] = nx, ab = new THREE.Vector3().subVectors(h.b, h.a), L2 = ab.length(), u2 = ab.clone().divideScalar(L2); Object.assign(r, { g: h, t: t0 === 0 ? 0.0005 : 0.9995, L: L2, u: u2, uh: Math.hypot(u2.x, u2.z) || 1, dir: t0 === 0 ? 1 : -1 }); return; }
      launch(Math.max(0, uy * r.v) + 1.2, 'grind'); S.combo.grindAir = true; S.yawOff = Math.cos(r.yaw - S.travel) >= 0 ? 0 : Math.PI; return; }
    if (consume('ollie')) { const px = -r.u.z / r.uh, pz = r.u.x / r.uh; S.vx += px * -SKI.sx * 1.5; S.vz += pz * -SKI.sx * 1.5; launch(OLLIE_V * 0.95, 'grind'); S.combo.grindAir = true; S.yawOff = Math.cos(r.yaw - S.travel) >= 0 ? 0 : Math.PI; ev('pop'); return; }
    consume('grind'); consume('flip'); consume('grab');
    if (consume('special')) { if (!S.specialOn) ev('nospecial'); else if (!r.special) { r.special = true; r.name = 'FORMSTONE GRIND'; S.special -= 0.4; addTrick('FORMSTONE GRIND', 1500); ev('special', { name: r.name }); } }
  }
  function bailStep(dt) {
    S.bailT += dt;
    const b = S.board; b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.r += b.rv * dt;
    const bf = isWater(b.x, b.z) ? WY - 0.1 : groundY(b.x, b.z); if (b.y < bf + 0.04) { b.y = bf + 0.04; if (b.vy < -2) { b.vy = -b.vy * 0.35; ev('clack'); } else b.vy = 0; b.vx *= 0.8; b.vz *= 0.8; b.rv *= 0.7; }
    if (!S.bailSplash) {
      S.bailV.x = damp(S.bailV.x, 0, 2.6, dt); S.bailV.z = damp(S.bailV.z, 0, 2.6, dt);
      moveXZ(S.x + S.bailV.x * dt, S.z + S.bailV.z * dt, S.y, false);
      const fl = floorAt(S.x, S.z, S.y + 0.2); if (fl.water) { S.bailSplash = true; ev('splash'); } else { S.vy -= G * dt; S.y = Math.max(fl.f, S.y + S.vy * dt); if (S.y <= fl.f) S.vy = 0; }
    } else { S.y = damp(S.y, WY - 0.6, 3, dt); }
    if (S.bailT > (S.bailSplash ? 1.5 : 1.9)) respawn(S.bailSplash || isWater(S.x, S.z));
  }
  function respawn(toSafe) {
    if (toSafe) { // back on the promenade, rolling along it (never facing the water)
      const L = S.lastSafe; S.x = L.x; S.z = Math.min(L.z, -33.4); const e = Math.sin(L.h) >= 0 ? 1 : -1; S.h = e * Math.PI / 2;
      if (S.x > 66) S.h = -Math.PI / 2; if (S.x < -60) S.h = Math.PI / 2; }
    S.y = floorAt(S.x, S.z, 5).f; if (!isFinite(S.y) || S.y < -1) S.y = CURB;
    S.mode = 'ground'; S.v = 0; S.vx = S.vz = S.vy = 0; S.bal = 0; S.getup = 0.6; S.fakie = false; S.yawOff = 0;
    moveXZ(S.x, S.z, S.y, false); ev('respawn', { safe: !!toSafe });
  }
  function pickups() {
    const by = S.y + BODY;
    for (const L of SKD.letters) if (!S.letters.has(L.ch) && (S.x - L.x) ** 2 + (by - L.y) ** 2 + (S.z - L.z) ** 2 < 1.15 * 1.15) { S.letters.add(L.ch); ev('letter', { ch: L.ch, n: S.letters.size }); }
    const T = SKD.tape; if (!S.tape && (S.x - T.x) ** 2 + (by - T.y) ** 2 + (S.z - T.z) ** 2 < 1.2 * 1.2) { S.tape = true; ev('tape'); }
  }
  function consume(k) { if (S.buf[k] > 0) { S.buf[k] = 0; return true; } return false; }
  // ---------------- step ----------------
  function step(dt) {
    S.t += dt;
    for (const k of SKI.pressed) S.buf[k] = 0.16; SKI.pressed.clear();
    for (const k in S.buf) S.buf[k] = Math.max(0, S.buf[k] - dt);
    if (S.frozen) return;
    S.specialOn = S.special >= 0.999;
    if (!inCombo() && S.mode !== 'bail') S.special = Math.max(0, S.special - 0.022 * dt);
    if (S.landT > 0) S.landT -= dt; if (S.getup > 0) S.getup -= dt;
    if (S.mode === 'ground' || S.mode === 'manual') ground(dt);
    else if (S.mode === 'air') air(dt);
    else if (S.mode === 'grind') grind(dt);
    else if (S.mode === 'bail') bailStep(dt);
  }
  function reset() {
    const sp = SKD.spawn;
    Object.assign(S, { x: sp.x, z: sp.z, h: sp.h, v: 0, vx: 0, vz: 0, vy: 0, mode: 'ground', fakie: false, yawOff: 0, spinV: 0, spinAcc: 0, flip: null, grab: null, gr: null, manual: null,
      score: 0, bestCombo: 0, bestTrick: '', bestTrickPts: 0, special: 0, specialOn: false, letters: new Set(), tape: false, gapsDone: new Set(), events: [], t: 0, frozen: false, getup: 0, landT: 0,
      stats: { tricks: 0, bails: 0, grindT: 0, manualT: 0, airT: 0, combos: 0, maxAir: 0 } });
    S.y = floorAt(S.x, S.z, 5).f; S.lastSafe = { x: sp.x, z: sp.z, h: sp.h }; resetCombo(); S.buf = {}; SKI.pressed.clear();
  }
  return { S, step, reset, bank, comboTotal, inCombo, floorAt, surfAt, nearGrind, bail, respawn, BODY };
})();
