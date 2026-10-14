/* ===== EVENT 5: BMX BIKE RACING (the desert) =====
   2:00 limit. One serious fall or three easy falls and you're out. Tap → (or B) to pedal, ↑↓ steer round rocks,
   A = jump, ← (or C) = wheelie. In the air: ↑ table top (let go before landing), ↓ 360 turn, ← back flip, → forward flip.
   Land level or crash; land on your head = serious fall. Stop on the finish pad (A) for a bonus; 60 points per second left. */
(() => {
  const LEN = 17400, DX = 5, N = LEN / DX + 200, FIN = 17000, PADL = 160, GR = 700;
  const Hh = new Float32Array(N), OBS = [];
  (function course() { srand(1987 + 5);
    const add = (x0, w, f) => { for (let i = Math.max(0, Math.floor(x0 / DX)); i < Math.min(N, Math.ceil((x0 + w) / DX)); i++) { const t = (i * DX - x0) / w; if (t >= 0 && t <= 1) Hh[i] += f(t); } };
    let x = 500;
    const kinds = ['whoops', 'kicker', 'hill', 'rock', 'table', 'kicker', 'log', 'whoops', 'drop', 'kicker', 'rock', 'log'];
    while (x < FIN - 500) { const k = kinds[Math.floor(rng() * kinds.length)];
      if (k === 'whoops') { add(x, 420, t => 13 * Math.pow(Math.sin(t * Math.PI * 6), 2)); x += 520; }
      else if (k === 'kicker') { const hgt = 34 + rng() * 22; add(x, 110, t => t < 0.85 ? hgt * Math.pow(t / 0.85, 1.6) : hgt * (1 - (t - 0.85) / 0.15 * 0.9)); x += 380; }
      else if (k === 'table') { add(x, 360, t => t < 0.25 ? 40 * t / 0.25 : t < 0.75 ? 40 : 40 * (1 - (t - 0.75) / 0.25)); x += 470; }
      else if (k === 'hill') { add(x, 380, t => 45 * Math.sin(t * Math.PI)); x += 450; }
      else if (k === 'drop') { add(x, 60, t => 30 * t); add(x + 60, 300, t => 30 * (1 - t)); x += 420; }
      else if (k === 'rock') { OBS.push({ x: x + 60, t: 'rock', z: rng() < 0.5 ? -0.55 : 0.55, done: false }); x += 300; }
      else { OBS.push({ x: x + 60, t: 'log', z: 0, done: false }); x += 300; }
    }
    for (let i = 0; i < N; i++) Hh[i] += 6 * Math.sin(i * DX * 0.004) + 4 * Math.sin(i * DX * 0.011);
    for (let i = 1; i < N - 1; i++) Hh[i] = Hh[i] * 0.6 + (Hh[i - 1] + Hh[i + 1]) * 0.2;
  })();
  function hAt(x) { const f = clamp(x / DX, 0, N - 2), i = f | 0, t = f - i; return Hh[i] * (1 - t) + Hh[i + 1] * t; }
  function sAt(x) { return (hAt(x + 4) - hAt(x - 4)) / 8; }
  const E0 = { started: false, x: 40, v: 0, Y: 0, vy: 0, air: false, airT: 0, pitch: 0, rot: 0, lastRotT: 0, table: 0, tableHeld: false, tableRel: 0, spin: -1, spinDone: 0,
    wheelie: 0, z: 0, fall: 0, fin: false, stopped: false, done: false, pedalT: 0, crank: 0, botPlan: 0, clockStop: false };
  const ev = {
    key: 'bmx', name: 'BMX', place: 'Desert Course', time: 120, falls: 3, cpuPar: 9000,
    goal: 'RACE THE COURSE · NAIL STUNTS', help: 'Tap → or B to pedal · ↑↓ steer round rocks · A jump · ← wheelie · in the air: ↑ table top, ↓ 360, ← back flip, → front flip · land level! · A on the finish pad to stop',
    helpT: 'B = pedal · stick ↑↓ steer · A jump · C wheelie · in the air: stick ↑ table, ↓ 360, ← back flip, → front flip · land level! · A on the pad to stop',
    labels: { a: 'JUMP /\nSTOP', b: 'PEDAL', c: 'WHEELIE' },
    view: { w: 360, h: 212 }, viewP: { w: 270, h: 340 }, tilt: 0.1, E: {},
    reset(o) { Object.assign(o, E0); for (const b of OBS) b.done = false; o.Y = hAt(o.x); return o; },
    start(e) { e.started = true; e.v = 90; },
    update(e, dt) {
      if (!e.started || e.done) return;
      if (e.fall > 0) { e.fall -= dt; e.v = damp(e.v, 0, 3, dt); e.x += e.v * dt; e.Y = hAt(e.x); e.air = false; if (e.fall <= 0) { e.v = 60; e.pitch = Math.atan(sAt(e.x)); e.rot = 0; } return; }
      if (In.p.right || In.p.b) { e.v += 30 * (1 - e.v / 340); e.pedalT = 0.25; Audio.sfx('pedal'); }
      if (e.pedalT > 0) e.pedalT -= dt;
      e.crank += e.v * dt * 0.05 + (e.pedalT > 0 ? dt * 10 : 0);
      if (!e.air) {
        // steer between lines
        if (In.held.up) e.z = Math.max(-1, e.z - 2.4 * dt); if (In.held.down) e.z = Math.min(1, e.z + 2.4 * dt);
        const s = sAt(e.x), ga = Math.atan(s);
        e.v += (-GR * Math.sin(ga) * 0.9 - (6 + e.v * 0.045)) * dt; e.v = clamp(e.v, 0, 360);
        const nx = e.x + e.v * dt, vyb = e.v * s, vyNext = e.v * sAt(nx);
        e.x = nx; e.Y = hAt(e.x);
        // wheelie
        if ((In.held.left || In.held.c) && !e.fin) { e.wheelie += dt; if (e.wheelie > 2.6) { this.endWheelie(e); } } else if (e.wheelie > 0) this.endWheelie(e);
        e.pitch = damp(e.pitch, ga + (e.wheelie > 0 ? 0.55 : 0), 14, dt);
        let launch = 0;
        if (vyb - vyNext > 40 * (e.v / 200) && vyb > 70) launch = vyb;
        if (In.p.a && !e.fin) launch = Math.max(launch, 230 + Math.max(0, vyb));
        if (launch > 0) { if (e.wheelie > 0) this.endWheelie(e); e.air = true; e.vy = launch; e.airT = 0; e.rot = 0; e.lastRotT = 0; e.table = 0; e.tableHeld = false; e.tableRel = 0; e.spin = -1; e.spinDone = 0; Audio.sfx('whoosh', 0.6); spawn(e.x, -e.Y, 6, '#c98849', 80, 300, 3); }
        // obstacles on the ground
        for (const o of OBS) { if (o.done || Math.abs(o.x - e.x) > 12) continue;
          if (o.t === 'log' || Math.abs(o.z - e.z) < 0.42) { o.done = true; this.crash(e, o.t === 'log' ? 'HIT THE LOG!' : 'HIT A ROCK!', false); return; } }
      } else {
        e.airT += dt; e.vy -= GR * dt; e.Y += e.vy * dt; e.x += e.v * dt;
        const w = (In.held.left || In.held.c) ? 2 * Math.PI / 0.85 : In.held.right ? -2 * Math.PI / 0.95 : 0;
        if (w) { e.rot += w * dt; e.lastRotT = e.airT; }
        if (In.held.up) { e.table += dt; e.tableHeld = true; } else if (e.tableHeld) { e.tableHeld = false; e.tableRel = e.airT; }
        if (In.p.down && e.spin < 0) { e.spin = 0; Audio.sfx('whoosh', 0.6); }
        if (e.spin >= 0 && e.spin < 1) { e.spin = Math.min(1, e.spin + dt / 0.7); if (e.spin >= 1) e.spinDone = e.airT; }
        for (const o of OBS) if (!o.done && Math.abs(o.x - e.x) < 12 && e.Y - hAt(e.x) > 12) { o.done = true; score(150, 'CLEARED THE ' + o.t.toUpperCase(), e.x, -e.Y - 40, 0); }
        const g = hAt(e.x);
        if (e.Y <= g && e.vy < 0) { e.Y = g; this.land(e); if (e.fall > 0) return; }
      }
      // finish line + pad
      if (!e.fin && e.x >= FIN) { e.fin = true; say('FINISH LINE!', 'press A on the pad to stop', '#9dff6b', 1.4); Audio.sfx('cheer', 1); }
      if (e.fin && !e.air) {
        if (In.p.a && e.x <= FIN + PADL) { e.stopped = true; score(500, 'STOPPED ON THE PAD!', e.x, -e.Y - 50, 1); this.finish(e); return; }
        if (e.x > FIN + PADL + 40) { this.finish(e); return; }
      }
      Audio.amb('bandpass', e.air ? 0 : clamp(e.v / 1100, 0, 0.3), 500 + e.v * 2);
      Audio.setIntensity(clamp(e.v / 300 + (e.air ? 0.3 : 0), 0, 1));
    },
    endWheelie(e) { const t = e.wheelie; e.wheelie = 0; if (t >= 0.6) score(100 + 100 * clamp((t - 0.6) / 1.4, 0, 1), 'WHEELIE', e.x, -e.Y - 50, 0); },
    land(e) {
      e.air = false; const ga = Math.atan(sAt(e.x)), pitchTot = ga * 0 + e.rot, d = wrapA(e.rot - 0) , q2 = Math.abs(wrapA(e.rot));
      const flips = Math.round(Math.abs(e.rot) / TAU), dev = Math.abs(wrapA(e.rot));
      if (dev >= 1.45) { this.crash(e, 'LANDED ON YOUR HEAD!', true); return; }
      if (dev >= 0.55) { this.crash(e, 'BAD LANDING!', false); return; }
      if (e.tableHeld || (e.tableRel > 0 && e.airT - e.tableRel < 0.1)) { this.crash(e, 'STILL IN THE TABLE TOP!', false); return; }
      if (e.spin >= 0 && e.spin < 1) { this.crash(e, 'UNFINISHED 360!', false); return; }
      Audio.sfx('land'); spawn(e.x, -e.Y, 10, '#c98849', 120, 300, 3); shake(3);
      let any = false;
      if (flips > 0) { const q = clamp(1 - (e.airT - e.lastRotT) / 0.6, 0, 1), back = e.rot > 0;
        for (let i = 0; i < flips; i++) score(back ? 1500 + 1500 * q : 3000 + 3000 * q, (flips > 1 ? (i + 1) + 'x ' : '') + (back ? 'BACK FLIP!' : 'FORWARD FLIP!'), e.x, -e.Y - 60 - i * 20, 2); any = true; }
      if (e.spinDone > 0) { score(1000 + 1000 * clamp(1 - (e.airT - e.spinDone) / 0.6, 0, 1), '360 TURN!', e.x, -e.Y - 50, 1); any = true; }
      if (e.table > 0.12) { score(500 + 500 * clamp(e.table / 0.8, 0, 1), 'TABLE TOP!', e.x, -e.Y - 40, 1); any = true; }
      if (e.airT > 0.35) score(200 + 200 * clamp((e.airT - 0.35) / 0.8, 0, 1), any ? 'BIG AIR' : 'JUMP', e.x, -e.Y - 30, 0);
      e.rot = 0; e.pitch = ga;
    },
    crash(e, why, serious) { e.fall = 1.6; e.air = false; e.wheelie = 0; e.Y = hAt(e.x); bail(why, e.x, -e.Y - 20, serious); },
    finish(e) { e.done = true; const left = Math.max(0, Math.round(R.time)); if (left > 0) score(left * 60, 'TIME BONUS ' + left + 's', e.x, -e.Y - 70, 2); later(1.4, () => Game.endTurn('finish')); },
    timeUp() { Game.endTurn('time'); },
    camera(e, c, dt, snap) { const tx = e.x + (V.portrait ? 60 : 110), ty = -(e.air ? (e.Y + hAt(e.x)) / 2 : e.Y) - 45; if (snap) { c.x = tx; c.y = ty; } else { c.x = damp(c.x, tx, 6, dt); c.y = damp(c.y, ty, 3, dt); } },
    enter(e) {
      const env = showEnv('bmx', g => this.build(g));
      setSky('#3a2a7a', '#ff8a6a', '#ffd08a', 45, 200, [-80, 40, -300]);
      e.J = buildDude(Game.look); e.bike = buildBike(Game.look); e.holder = mountRig(env, e.J, e.bike); SPZ = 0;
      if (!env.userData.shadow) env.userData.shadow = blobShadow(env, 0.7);
    },
    build(g) {
      // track ribbon: top surface + front skirt, vertex coloured dirt
      const pos = [], col = [], idx = [], W = 2.3, cD = new THREE.Color('#b8743e'), cL = new THREE.Color('#d39058'), cS = new THREE.Color('#8a5530'), cP = new THREE.Color('#fff6dc');
      const M = Math.floor((LEN + 300) / 10);
      for (let i = 0; i <= M; i++) { const x = i * 10, y = hAt(x) * U, X = x * U; const onPad = x >= FIN && x <= FIN + PADL, c1 = onPad ? ((i & 1) ? cP : new THREE.Color(INK)) : (i & 2 ? cD : cL);
        pos.push(X, y, -W, X, y, W, X, y, W, X, -2.2, W); col.push(c1.r, c1.g, c1.b, c1.r, c1.g, c1.b, cS.r, cS.g, cS.b, cS.r * 0.8, cS.g * 0.8, cS.b * 0.8); }
      for (let i = 0; i < M; i++) { const a = i * 4, b = a + 4; idx.push(a, a + 1, b, a + 1, b + 1, b, a + 2, a + 3, b + 2, a + 3, b + 3, b + 2); }
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
      const tm = new THREE.Mesh(tg, SCENE_MAT); tm.receiveShadow = true; g.add(tm);
      const ink = []; for (let i = 0; i <= M; i++) { const x = i * 10; ink.push(new THREE.Vector3(x * U, hAt(x) * U + 0.01, W + 0.01)); }
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ink), new THREE.LineBasicMaterial({ color: INK })));
      const mb = new MB();
      mb.add(place(GG.box(LEN * U + 300, 1, 120), LEN * U / 2, -2.5, -40), '#e6b27a', false);
      srand(77);
      for (let i = 0; i < 18; i++) { const x = -40 + i * 18 + rng() * 6, w = 10 + rng() * 14, h = 6 + rng() * 9; mb.add(place(GG.cyl(w * 0.42, w * 0.55, h, 7), x, h / 2 - 2, -90 - rng() * 30), i & 1 ? '#b5653f' : '#c97a4a'); mb.add(place(GG.cyl(w * 0.44, w * 0.44, 0.8, 7), x, h - 2, -90 - rng() * 2), '#e08a5a'); }
      for (let x = 0; x < LEN * U; x += 6 + rng() * 6) { const z = -5 - rng() * 14; if (rng() < 0.5) { mb.add(place(GG.cap(0.3, 1.6, 6), x, -1.2, z), '#2fa36b'); mb.add(place(GG.cap(0.18, 0.6, 6), x + 0.4, -0.8, z, 0, 0, -0.9), '#2fa36b'); }
        else { mb.add(place(GG.cyl(0.18, 0.22, 2.4, 6), x, -1, z), '#7a8b3a'); mb.add(place(GG.sph(0.6, 0.5, 0.6, 7, 5), x - 0.4, 0.5, z), '#16634a'); mb.add(place(GG.sph(0.6, 0.5, 0.6, 7, 5), x + 0.5, 0.8, z), '#16634a'); } }
      for (let x = 10; x < LEN * U; x += 23) { mb.add(place(GG.box(1.6, 1, 1), x, hAt(x / U) * U - 1.2, -3.2), '#f2d27a'); for (let k = 0; k < 3; k++) mb.add(place(GG.tor(0.42, 0.18, 6, 12), x + 3, hAt(x / U) * U - 1.6 + k * 0.36, -3.4, 0, Math.PI / 2), INK); }
      for (let x = 30; x < LEN * U; x += 45) mbCrowd(mb, x, x + 7, hAt(x / U) * U - 1.8, -6, 7, x | 0);
      for (const o of OBS) { const x = o.x * U, y = hAt(o.x) * U;
        if (o.t === 'rock') { mb.add(place(new THREE.DodecahedronGeometry(0.45, 0), x, y + 0.25, o.z * W, 0.5, 0.3), '#8a8fa3'); mb.add(place(new THREE.DodecahedronGeometry(0.3, 0), x + 0.4, y + 0.15, o.z * W + 0.3), '#57606f'); }
        else { mb.add(place(GG.cyl(0.24, 0.24, W * 2, 10), x, y + 0.24, 0, 0, Math.PI / 2), '#8a5a32'); } }
      const fx = FIN * U, fy = hAt(FIN) * U; for (const s of [-1, 1]) mb.add(place(GG.box(0.3, 4, 0.3), fx, fy + 2, s * (W + 0.3)), '#ffffff'); mb.add(place(GG.box(0.3, 0.8, W * 2 + 1), fx, fy + 3.8, 0), '#ff5fa2');
      mb.build(g);
      signMesh(g, 'FINISH', '#14101f', '#ffd23c', '#ff5fa2', fx, fy + 3.8, W + 0.8, 3.6, 0);
      for (let i = 0, x = 8; x < LEN * U; x += 30, i++) signMesh(g, i & 1 ? 'GNARLY GEAR BIKES' : 'AERO-DISK 87', '#14101f', i & 1 ? '#9dff6b' : '#ff5fa2', '#ffd23c', x, hAt(x / U) * U + 0.4, -3.6, 3.2, 0);
    },
    sync(e) {
      const env = ENV.bmx, J = e.J; if (!J) return;
      const h = e.holder; h.position.set(e.x * U, e.Y * U, e.z * 1.5); h.rotation.set(0, 0, 0);
      env.userData.shadow.position.set(e.x * U, hAt(e.x) * U + 0.03, e.z * 1.5);
      e.bike.rotation.set(0, 0, 0); e.bike.position.set(0, 0, 0); J.root.position.set(-0.12, 0.08, 0); J.root.rotation.set(0, Math.PI / 2, 0); J.tilt.rotation.set(0, 0, 0);
      const wh = e.bike.userData.wheels; wh[0].rotation.z = wh[1].rotation.z = -e.crank * 3;
      if (e.fall > 0) { const k = 1.6 - e.fall; poseDude(J, 'tumble', T.real); J.root.position.set(-0.5 - k * 0.6, Math.max(0.1, 0.6 - k), 0.3); J.tilt.rotation.x = k * 3; e.bike.rotation.set(0.6, 0, k * 4); return; }
      h.rotation.z = e.air ? e.rot + e.pitch * 0 : e.pitch;
      if (e.air && e.spin >= 0) h.rotation.y = e.spin * TAU;
      if (e.air && e.tableHeld) e.bike.rotation.x = -Math.min(1.1, e.table * 4);
      else if (e.air && e.tableRel > 0) e.bike.rotation.x = -Math.max(0, 1.1 - (e.airT - e.tableRel) * 8);
      poseDude(J, 'pedal', e.crank * 3, 0);
      if (e.air && (e.rot !== 0)) J.torso.rotation.x = 0.4;
      J.flash.value = 0;
    },
    hud(g, e, x, y, w, u) {
      const k = clamp(e.v / 340, 0, 1); g.fillStyle = INK; g.fillRect(x + 3, y + 3, w, 11); g.fillStyle = '#3b3160'; g.fillRect(x, y, w, 11);
      g.fillStyle = k > 0.75 ? '#9dff6b' : '#2fd3ff'; g.fillRect(x, y, w * k, 11); g.lineWidth = 2; g.strokeStyle = INK; g.strokeRect(x, y, w, 11);
      const p = clamp(e.x / FIN, 0, 1); g.fillStyle = '#fff'; g.fillRect(x, y + 19 * u, w, 2); g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(x + w * p, y + 20 * u, 5 * u, 0, TAU); g.fill();
      g.font = '800 ' + Math.round(10 * u) + 'px system-ui,sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('SPEED', x, y - 4); g.textAlign = 'right'; g.fillText('FINISH', x + w, y + 34 * u);
      if (e.air && Math.abs(e.rot) > 0.3) txt(g, Math.round(Math.abs(e.rot) * 180 / Math.PI) + '°', V.W / 2, V.P.y + V.P.h * 0.75, 24 * u, Math.abs(wrapA(e.rot)) < 0.55 ? '#9dff6b' : '#ff3d6e', 'center');
    },
    bot(e, dt) {
      const B = bot.held; B.up = B.down = B.left = B.right = B.a = B.c = false;
      if (!e.started) { bot.latch.a = true; return; }
      if (e.fall > 0 || e.done) return;
      if (e.fin) { if (e.x > FIN + 40 && !e.air) bot.latch.a = true; return; }
      if (!e.air) {
        e.botPlan = 0;
        if (e.v < 270) { e.pedalT2 = (e.pedalT2 || 0) + dt; if (e.pedalT2 > 0.18) { e.pedalT2 = 0; bot.latch.b = true; } }
        for (const o of OBS) { if (o.done || o.x < e.x) continue; const d = o.x - e.x; if (d > 160) break;
          if (o.t === 'log') { if (d < e.v * 0.22 + 10) bot.latch.a = true; }
          else { if (Math.abs(o.z - e.z) < 0.6) { if (o.z > 0) B.up = true; else B.down = true; } }
          break; }
      } else {
        if (!e.botPlan) { const T2 = 2 * Math.max(0, e.vy) / GR + 0.1; e.botPlan = T2 > 1.25 ? 1 : T2 > 0.98 ? 2 : T2 > 0.6 ? 3 : 4; }
        if (e.botPlan === 1 && e.rot < TAU - 0.25) B.left = true;
        if (e.botPlan === 2 && e.spin < 0) bot.latch.down = true;
        if (e.botPlan === 3 && e.airT < 0.25) B.up = true;
      }
    }
  };
  EVENTS.push(ev);
})();
