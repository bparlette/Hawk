/* ===== EVENT 6: FLYING DISK (Yosemite) =====
   Three throws. The meter: tap ← (or A) to swing back, tap → (or A) when the needle is in the left green zone,
   tap ← (or A) again in the right green zone to release. Then run the catcher (←→) to meet the disk:
   hands are only out while running or diving. A = dive, hold ↑ = overhead catch.
   Catches: running right 150, running left 250, diving right 250, diving left 350, overhead 350,
   plus throw points for accuracy and height (the fewer steps the catcher takes, the more). */
(() => {
  const D0 = 760;
  const E0 = { phase: 'ready', n: 0, power: 0, hf: 0, acc: 0, t: 0, T: 2, Dt: 700, peak: 100, dx: 0, dy: -40, cx: D0, cv: 0, dir: -1, dive: 0, diveDir: 1, reach: false, rec: 0,
    throws: 0, startX: D0, landX: D0, resT: 0, resTxt: '', resPts: 0, caught: false, throwAnim: 0, clockStop: false };
  const ev = {
    key: 'disk', name: 'Flying Disk', place: 'Yosemite', time: 0, falls: 99, cpuPar: 1150, counterLabel: '3 THROWS',
    goal: 'THROW IT · CATCH IT', help: 'Meter: ← (or A) swing back · → (or A) in the LEFT green · ← (or A) in the RIGHT green to release · then run the catcher ←→, A = dive, hold ↑ = overhead catch',
    helpT: 'Meter: tap A to swing back, A in the LEFT green, A in the RIGHT green to throw · then run the catcher with the stick, A = dive, stick ↑ = overhead catch',
    labels: { a: 'THROW /\nDIVE', b: null, c: null },
    view: { w: 340, h: 200 }, viewP: { w: 250, h: 330 }, tilt: 0.1, E: {},
    counter(e) { return 'THROW ' + Math.min(3, e.throws + (e.phase === 'done' ? 0 : 1)) + '/3'; },
    reset(o) { Object.assign(o, E0); return o; },
    start(e) { e.phase = 'ready'; },
    height(e, u) { return 45 * (1 - u) + e.peak * 4 * u * (1 - u); },
    update(e, dt) {
      e.t += dt; if (e.throwAnim > 0) e.throwAnim -= dt;
      if (e.phase === 'ready') { if (In.p.left || In.p.a) { e.phase = 'back'; e.n = 0; Audio.sfx('meter', 0); } return; }
      if (e.phase === 'back') { e.n -= 1.35 * dt; if (Math.round(e.n * 10) !== Math.round((e.n + 1.35 * dt) * 10)) Audio.sfx('meter', -e.n);
        if (In.p.right || In.p.a || e.n <= -1) { if (e.n <= -1) { e.n = -1; pop(0, -90, 'OVERSWING', '', '#ff3d6e'); } e.power = Math.abs(e.n); e.phase = 'fwd'; Audio.sfx('tick'); } return; }
      if (e.phase === 'fwd') { e.n += 2.0 * dt; if (Math.round(e.n * 10) !== Math.round((e.n - 2 * dt) * 10)) Audio.sfx('meter', e.n);
        if (In.p.left || In.p.a || e.n >= 1) { e.n = Math.min(1, e.n); this.release(e); } return; }
      if (e.phase === 'flight') {
        e.t2 += dt; const u = e.t2 / e.T; e.dx = e.Dt * u; e.dy = -this.height(e, Math.min(u, 1));
        this.catcher(e, dt);
        if (!e.caught) this.tryCatch(e);
        if (!e.caught && u >= 1) { e.dy = -2; this.result(e, false, 'DROPPED IN THE GRASS', 0); Audio.sfx('groan'); spawn(e.dx, -2, 10, '#58c46a', 90, 300, 3, 1); }
        Audio.setIntensity(0.6); return;
      }
      if (e.phase === 'result') { e.resT -= dt; this.catcher(e, dt, true); if (e.resT <= 0) { if (e.throws >= 3) { e.phase = 'done'; Game.endTurn('finish'); } else { e.phase = 'ready'; e.cx = D0; e.cv = 0; e.dive = 0; e.dir = -1; } } }
    },
    release(e) {
      const nr = e.n, green = nr >= 0.75, yel = nr >= 0.45; e.acc = green ? 1 : yel ? 0.55 : 0.25; e.hf = clamp((nr - 0.25) / 0.75, 0, 1);
      const pw = e.power >= 0.75 ? 0.85 + (e.power - 0.75) * 0.6 : e.power;
      e.Dt = 300 + pw * 560 + (rng() - 0.5) * 120 * (1 - e.acc); e.T = 1.5 + e.hf * 1.0 + pw * 0.5; e.peak = 55 + e.hf * 130;
      e.t2 = 0; e.phase = 'flight'; e.startX = e.cx; e.caught = false; e.throwAnim = 0.4; e.throws++;
      Audio.sfx('throw'); say(green && e.power >= 0.75 ? 'GREAT THROW!' : e.power < 0.45 ? 'WEAK THROW' : 'THROWN!', '', green ? '#9dff6b' : '#ffd23c', 0.9);
      // where the disk comes down to hand height (for the bot + catcher aid)
      let lu = 0.98; for (let u = 0.5; u <= 1; u += 0.01) if (this.height(e, u) < 50) { lu = u; break; } e.landX = e.Dt * lu;
    },
    catcher(e, dt, idle) {
      if (e.dive > 0) { e.dive -= dt; e.cx += e.diveDir * 230 * dt; if (e.dive <= 0) e.rec = 0.45; return; }
      if (e.rec > 0) { e.rec -= dt; e.cv = 0; return; }
      const ax = idle ? 0 : In.ax; e.reach = !idle && In.held.up && Math.abs(e.cv) < 40;
      e.cv = damp(e.cv, ax * 240, ax ? 6 : 10, dt); e.cx += e.cv * dt;
      if (Math.abs(e.cv) > 25) e.dir = sgn(e.cv);
      if (!idle && In.p.a && Math.abs(e.cv) > 20) { e.dive = 0.5; e.diveDir = sgn(e.cv); Audio.sfx('whoosh', 0.7); }
      else if (!idle && In.p.a && Math.abs(e.cv) <= 20) { e.dive = 0.5; e.diveDir = e.dir; Audio.sfx('whoosh', 0.7); }
    },
    tryCatch(e) {
      const h = -e.dy, dx = e.dx - e.cx;
      let type = null, pts = 0;
      if (e.dive > 0) { const f = dx * e.diveDir; if (f > 6 && f < 48 && h < 36) { type = e.diveDir > 0 ? 'DIVING CATCH RIGHT' : 'DIVING CATCH LEFT'; pts = e.diveDir > 0 ? 250 : 350; } }
      else if (e.reach) { if (Math.abs(dx) < 14 && h > 58 && h < 98) { type = 'OVERHEAD CATCH'; pts = 350; } }
      else if (Math.abs(e.cv) > 25) { const f = dx * e.dir; if (f > -4 && f < 24 && h > 30 && h < 64) { type = e.dir > 0 ? 'RUNNING CATCH RIGHT' : 'RUNNING CATCH LEFT'; pts = e.dir > 0 ? 150 : 250; } }
      if (!type) return;
      const steps = Math.abs(e.cx - e.startX) / 26, tp = Math.max(0, Math.round(400 - steps * 25)) + Math.round(e.hf * 100);
      e.caught = true; this.result(e, true, type, pts + tp, pts, tp);
    },
    result(e, ok, txt, pts, cp, tp) {
      e.phase = 'result'; e.resT = 2.2; e.resTxt = txt; e.resPts = pts;
      if (ok) { Audio.sfx('catch'); score(cp, txt, e.cx, -80, cp >= 350 ? 2 : 1); if (tp > 0) later(0.35, () => score(tp, 'THROW POINTS', e.cx, -110, 0)); }
      else { pop(e.dx, -40, 'MISSED!', '', '#ff3d6e'); shake(4); }
    },
    camera(e, c, dt, snap) {
      let tx = 110; if (e.phase === 'flight') tx = Math.max(110, Math.min(e.dx + 60, e.cx - 40)); if (e.phase === 'result') tx = e.cx - 30;
      if (V.portrait && (e.phase === 'flight' || e.phase === 'result')) tx += 30;
      const ty = -70; if (snap) { c.x = tx; c.y = ty; } else { c.x = damp(c.x, tx, 3.2, dt); c.y = ty; }
    },
    enter(e) {
      const env = showEnv('disk', g => this.build(g));
      setSky('#2f6fd8', '#9fd2ff', '#ffe0c0', 50, 260, [100, 70, -300]);
      const lk = Game.look, lc = Object.assign({}, lk, { key: lk.key + 'c' });
      e.J = buildDude(lk); e.J2 = buildDude(lc);
      const h1 = env.userData.h1 || (env.userData.h1 = grp(env)), h2 = env.userData.h2 || (env.userData.h2 = grp(env));
      for (const [h, J] of [[h1, e.J], [h2, e.J2]]) { while (h.children.length) h.remove(h.children[0]); if (J.root.parent) J.root.parent.remove(J.root); h.add(J.root); J.root.position.set(0, 0, 0); J.tilt.rotation.set(0, 0, 0); }
      e.h1 = h1; e.h2 = h2;
      if (!env.userData.disk) { env.userData.disk = buildDisk('#ff5fa2'); env.add(env.userData.disk); env.userData.ds = blobShadow(env, 0.25); env.userData.s1 = blobShadow(env, 0.5); env.userData.s2 = blobShadow(env, 0.5); }
      SPZ = 0;
    },
    build(g) {
      const mb = new MB();
      mb.add(place(GG.box(200, 1, 90), 30, -0.5, -20), '#6cc76a', false);
      for (let x = -10; x < 60; x += 3) mb.add(place(GG.box(0.08, 0.01, 1.2), x, 0.005, 1.5), '#ffffff', false);
      srand(99);
      // granite dome + cliff + waterfall (generic, no real logos)
      mb.add(place(GG.sph(26, 34, 18, 18, 12), -10, -6, -120), '#c7c9d9'); mb.add(place(GG.box(26, 60, 18), 3, 0, -122), '#c7c9d9');
      mb.add(place(GG.box(40, 44, 20), 55, 6, -130), '#b4b6c9'); mb.add(place(GG.box(2.4, 40, 1), 62, 10, -119.4), '#ffffff', false);
      for (let i = 0; i < 9; i++) mb.add(place(GG.sph(20 + rng() * 10, 10 + rng() * 6, 10, 12, 8), -60 + i * 22, -4, -95), '#5a6aa0', false);
      for (let i = 0; i < 70; i++) mbPine(mb, -40 + rng() * 120, 0, -14 - rng() * 40, 1.2 + rng() * 1.2);
      for (let x = -10; x < 50; x += 3.2) { mb.add(place(GG.box(0.18, 1.0, 0.18), x, 0.5, -5), '#8a5a32'); mb.add(place(GG.box(3.2, 0.12, 0.1), x + 1.6, 0.8, -5), '#8a5a32'); }
      mbCrowd(mb, -6, 1, 0, -7, 9, 61); mbCrowd(mb, 20, 27, 0, -7, 9, 62);
      mb.add(place(GG.box(2.4, 0.12, 1.1), 6, 0.9, -8), '#8a5a32'); for (const s of [-1, 1]) mb.add(place(GG.box(2.4, 0.1, 0.4), 6, 0.5, -8 + s * 0.8), '#8a5a32');
      mb.build(g);
      signMesh(g, 'AERO-DISK 87', '#14101f', '#ff5fa2', '#2fd3ff', 9, 3.4, -6, 4.4, 0, 'FLYING DISK FINALS');
      signMesh(g, 'GNARLY GEAR', '#9dff6b', INK, INK, 24, 3.2, -6, 3.6, 0);
    },
    sync(e) {
      const env = ENV.disk; if (!e.J) return;
      const J = e.J, J2 = e.J2;
      e.h1.position.set(0, 0, 0); J.root.rotation.set(0, 0.2, 0);
      if (e.phase === 'back' || e.phase === 'fwd') { poseDude(J, 'throw', T.real, e.phase === 'back' ? 0.5 + e.n * 0.5 : 0.1); }
      else if (e.throwAnim > 0) poseDude(J, 'throw', T.real, 1 - e.throwAnim / 0.4 * 0.2 + 0.2);
      else poseDude(J, e.phase === 'result' && e.caught ? 'cheer' : 'stand', T.real);
      // catcher
      e.h2.position.set(e.cx * U, 0, 0); J2.root.rotation.set(0, e.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0); J2.tilt.rotation.set(0, 0, 0);
      if (e.dive > 0) { poseDude(J2, 'dive', T.real); J2.root.rotation.y = e.diveDir > 0 ? Math.PI / 2 : -Math.PI / 2; e.h2.position.y = Math.sin((0.5 - e.dive) / 0.5 * Math.PI) * 0.35; J2.tilt.rotation.x = 0; }
      else if (e.rec > 0) { poseDude(J2, 'dive', T.real); e.h2.position.y = -0.55; }
      else if (e.reach) poseDude(J2, 'reach', T.real);
      else if (Math.abs(e.cv) > 25) poseDude(J2, 'run', T.real, 15);
      else poseDude(J2, e.phase === 'result' && e.caught ? 'cheer' : 'stand', T.real);
      const d = env.userData.disk;
      if (e.phase === 'flight' || (e.phase === 'result' && !e.caught)) { d.visible = true; d.position.set(e.dx * U, -e.dy * U, 0.15); d.rotation.set(0.25, T.real * 20, 0); }
      else if (e.phase === 'result' && e.caught) { d.visible = true; d.position.set(e.cx * U + e.dir * 0.3, 1.3 + (e.reach ? 0.8 : 0), 0.3); d.rotation.set(1.2, 0, 0); }
      else { d.visible = true; d.position.set(0.35, 1.0, 0.35); d.rotation.set(0.3, 0, 0.2); }
      env.userData.ds.position.set(d.position.x, 0.02, 0.15); env.userData.s1.position.set(0, 0.02, 0); env.userData.s2.position.set(e.cx * U, 0.02, 0);
      J.flash.value = J2.flash.value = 0;
    },
    hud(g, e, x, y, w, u) {
      if (e.phase === 'ready' || e.phase === 'back' || e.phase === 'fwd') { // the three-colour throw meter
        const mw = Math.min(V.W - 40, 420 * u), mx = (V.W - mw) / 2, my = V.portrait ? V.H - V.bot - 54 * u : V.H - V.bot - 60 * u, mh = 22 * u;
        g.fillStyle = INK; g.fillRect(mx + 4, my + 4, mw, mh);
        const zones = [[-1, -0.75, '#23c26b'], [-0.75, -0.45, '#ffd23c'], [-0.45, 0.45, '#ff3d6e'], [0.45, 0.75, '#ffd23c'], [0.75, 1, '#23c26b']];
        for (const z of zones) { g.fillStyle = z[2]; g.fillRect(mx + (z[0] + 1) / 2 * mw, my, (z[1] - z[0]) / 2 * mw, mh); }
        g.lineWidth = 3; g.strokeStyle = INK; g.strokeRect(mx, my, mw, mh);
        const nx = mx + (e.n + 1) / 2 * mw; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(nx, my - 4); g.lineTo(nx - 8 * u, my - 16 * u); g.lineTo(nx + 8 * u, my - 16 * u); g.closePath(); g.fill(); g.stroke(); g.fillRect(nx - 2, my, 4, mh);
        const tip = e.phase === 'ready' ? (V.touch ? 'TAP A TO SWING BACK' : 'PRESS ← OR A TO SWING BACK') : e.phase === 'back' ? 'STOP IN THE LEFT GREEN!' : 'RELEASE IN THE RIGHT GREEN!';
        txt(g, tip, V.W / 2, my - 30 * u, 18 * u, '#fff', 'center', -0.04);
      }
      if (e.phase === 'flight' || e.phase === 'result' || e.phase === 'ready') { // field strip: thrower, catcher, disk
        const fw = w * 1.15, fx = (V.W - fw) / 2, fy = y + 4, sc = fw / 1100;
        g.fillStyle = INK; g.fillRect(fx + 3, fy + 3, fw, 12); g.fillStyle = '#2fa36b'; g.fillRect(fx, fy, fw, 12); g.lineWidth = 2; g.strokeStyle = INK; g.strokeRect(fx, fy, fw, 12);
        g.fillStyle = '#ffd23c'; g.fillRect(fx, fy, 4, 12);
        g.fillStyle = Game.look.shirt; g.beginPath(); g.arc(fx + clamp(e.cx * sc, 0, fw), fy + 6, 6 * u, 0, TAU); g.fill(); g.stroke();
        if (e.phase === 'flight') { g.fillStyle = '#ff5fa2'; g.beginPath(); g.ellipse(fx + clamp(e.dx * sc, 0, fw), fy + 6, 6 * u, 3 * u, 0, 0, TAU); g.fill(); g.stroke(); }
        g.font = '800 ' + Math.round(10 * u) + 'px system-ui,sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('CATCHER RADAR', fx, fy + 26 * u);
      }
    },
    bot(e, dt) {
      const B = bot.held; B.left = B.right = B.up = B.a = false;
      if (e.phase === 'ready') { bot.latch.a = true; return; }
      if (e.phase === 'back') { if (e.n < -0.86) bot.latch.a = true; return; }
      if (e.phase === 'fwd') { if (e.n > 0.84) bot.latch.a = true; return; }
      if (e.phase === 'flight') { const tgt = e.landX - 8, d = tgt - e.cx; const u = e.t2 / e.T;
        if (Math.abs(d) > 6) { if (d > 0) B.right = true; else B.left = true; } else if (u > 0.6) { B.left = true; }
        const h = -e.dy; if (e.dive <= 0 && Math.abs(e.dx - e.cx) < 46 && h < 34 && u > 0.6) bot.latch.a = true; }
    }
  };
  EVENTS.push(ev);
})();
