/* ===== EVENT 4: ROLLER SKATING (the boardwalk) =====
   Three falls and you're out. Alternate ↑ and ↓ to stride (or tap C). Hold A to squat, release to jump.
   Spin = B (or roll the stick round). Duck flying beach balls (avoid 10-30), jump cracks, shoes, sand, grass,
   puddles and missing sidewalk (20-60), spin while jumping for 40-120. Points scale with your speed. */
(() => {
  const LEN = 17000, GZ = 900;
  const COURSE = (() => { srand(1987); const types = ['crack', 'grass', 'shoe', 'sand', 'ball', 'puddle', 'gap', 'crack', 'shoe', 'ball'], out = []; let x = 620;
    while (x < LEN - 300) { const t = types[Math.floor(rng() * types.length)], w = t === 'gap' ? 60 + rng() * 25 : t === 'sand' || t === 'grass' ? 55 + rng() * 25 : t === 'puddle' ? 45 : t === 'shoe' ? 18 : t === 'ball' ? 14 : 26;
      out.push({ t, x, w, done: false, hit: false, bx: 0, by: 0, act: false }); x += 290 + rng() * 260; } return out; })();
  const E0 = { started: false, x: 0, v: 0, z: 0, vz: 0, squat: false, sqT: 0, spinT: 0, spinAir: false, last: '', fall: 0, slow: 0, t: 0, quad: -1, quadN: 0, quadDir: 0, finished: false, clockStop: false, stride: 0, botLast: 0 };
  const ev = {
    key: 'skating', name: 'Roller Skating', place: 'Venice Boardwalk', time: 120, falls: 3, cpuPar: 2500,
    goal: 'SKATE THE BOARDWALK · DON\'T FALL', help: 'Alternate ↑ ↓ to skate (or tap C) · hold A to squat, let go to jump · B = 360 spin · duck the beach balls, jump everything else',
    helpT: 'Tap C (or flick the stick ↑↓) to skate · hold A = squat, let go = jump · B = 360 spin · duck beach balls, jump the rest',
    labels: { a: 'SQUAT\nJUMP', b: 'SPIN', c: 'SKATE' },
    view: { w: 330, h: 172 }, viewP: { w: 240, h: 300 }, tilt: 0.12, E: {},
    reset(o) { Object.assign(o, E0); for (const c of COURSE) { c.done = false; c.hit = false; c.act = false; } return o; },
    start(e) { e.started = true; e.v = 60; },
    pts(v, a, b) { return Math.round(a + (b - a) * clamp((v - 110) / 220, 0, 1)); },
    update(e, dt) {
      if (!e.started || e.finished) return;
      e.t += dt;
      if (e.fall > 0) { e.fall -= dt; e.v = damp(e.v, 0, 3, dt); e.x += e.v * dt; e.z = 0; if (e.fall <= 0) { e.v = 70; } this.amb(e); return; }
      // stride: alternate up/down (or C)
      let st = '';
      if (In.p.up) st = 'u'; else if (In.p.down) st = 'd'; else if (In.p.c) st = e.last === 'u' ? 'd' : 'u';
      if (st && e.z <= 0 && !e.squat) { if (st !== e.last) { e.v += 48 * (1 - e.v / 370); e.stride = 0.3; Audio.sfx('stride'); } else e.v -= 8; e.last = st; }
      if (e.stride > 0) e.stride -= dt;
      e.v -= (7 + e.v * 0.055) * dt; if (e.slow > 0) { e.slow -= dt; e.v -= e.v * 1.6 * dt; }
      e.v = clamp(e.v, 0, 370);
      // spin: B or a full roll of the stick
      const qx = In.ax, qy = In.ay;
      if (Math.abs(qx) + Math.abs(qy) > 0.5) { const q = Math.round((Math.atan2(qy, qx) + Math.PI) / (Math.PI / 2)) % 4; if (q !== e.quad) { const d = ((q - e.quad + 4) % 4); if (e.quad >= 0 && (d === 1 || d === 3)) { const dir = d === 1 ? 1 : -1; if (dir === e.quadDir) e.quadN++; else { e.quadDir = dir; e.quadN = 1; } } e.quad = q; } }
      const rollSpin = e.quadN >= 3; if (rollSpin) e.quadN = 0;
      if ((In.p.b || rollSpin) && e.spinT <= 0) { e.spinT = 0.42; e.spinAir = e.z > 0; Audio.sfx('whoosh', 0.6); }
      if (e.spinT > 0) e.spinT -= dt;
      // squat / jump
      if (In.held.a && e.z <= 0) { if (!e.squat) { e.squat = true; e.sqT = 0; } e.sqT += dt; }
      if (e.squat && (!In.held.a || In.r.a)) { e.squat = false; if (e.z <= 0) { e.vz = 230 + 120 * clamp(e.sqT / 0.3, 0, 1); e.z = 0.1; Audio.sfx('whoosh', 0.5); } }
      if (e.z > 0) { e.z += e.vz * dt; e.vz -= GZ * dt; if (e.z <= 0) { e.z = 0; e.vz = 0; Audio.sfx('land', 0.6); spawn(e.x, 0, 5, '#fff6dc', 60, 200, 2); } }
      e.x += e.v * dt;
      // obstacles
      for (const o of COURSE) {
        if (o.done) continue;
        if (o.t === 'ball') { // thrown from up the boardwalk at head height
          if (!o.act && o.x - e.x < 420) { o.act = true; o.bx = o.x; }
          if (o.act) { o.bx -= 170 * dt; o.by = -46 - Math.abs(Math.sin(T.game * 7)) * 6;
            if (Math.abs(o.bx - e.x) < 12) { o.done = true;
              if (e.squat && e.z <= 0) score(this.pts(e.v + 60, 10, 30), 'DUCKED!', e.x, -50, 0);
              else { o.hit = true; this.wipe(e, 'BEANED BY A BEACH BALL!'); return; } } }
          continue;
        }
        const x0 = o.x - o.w / 2, x1 = o.x + o.w / 2, clr = o.t === 'shoe' ? 14 : 6;
        if (e.x >= x0 && e.x <= x1) {
          if (e.z < clr) {
            if (o.t === 'grass' || o.t === 'sand') { if (!o.hit) { o.hit = true; e.slow = 0.5; pop(e.x, -40, o.t === 'sand' ? 'SAND!' : 'GRASS!', 'slowed down', '#ff9f1c'); Audio.sfx('groan'); } }
            else if (o.t === 'puddle') { if (!o.hit) { o.hit = true; if (e.v > 200) { this.wipe(e, 'SLIPPED IN A PUDDLE!'); return; } e.slow = 0.3; pop(e.x, -40, 'SPLASH!', 'slow enough', '#2fd3ff'); spawn(e.x, -2, 10, '#9fe8ff', 120, 400, 2); } }
            else { o.done = true; o.hit = true; this.wipe(e, o.t === 'gap' ? 'FELL IN THE GAP!' : o.t === 'shoe' ? 'TRIPPED ON A SHOE!' : 'CAUGHT A CRACK!'); return; }
          }
        } else if (e.x > x1 && !o.done) {
          o.done = true;
          if (!o.hit) { const spin = e.spinT > 0 && e.z > 0 || (e.spinAir && e.spinT > -0.2);
            if (spin) score(this.pts(e.v, 40, 120), 'SPINNING JUMP!', e.x, -60, 1); else score(this.pts(e.v, 20, 60), 'JUMPED THE ' + o.t.toUpperCase() + '!', e.x, -55, 0); }
        }
      }
      if (e.x >= LEN && !e.finished) { e.finished = true; const tb = Math.max(0, Math.round((105 - e.t) * 5)); score(200 + tb, 'FINISH!' + (tb ? ' TIME BONUS' : ''), e.x, -70, 2); later(1.6, () => Game.endTurn('finish')); }
      this.amb(e);
      Audio.setIntensity(clamp(e.v / 330, 0, 1));
    },
    amb(e) { Audio.amb('bandpass', e.z > 0 ? 0 : clamp(e.v / 1200, 0, 0.25), 900 + e.v * 3); },
    wipe(e, why) { e.fall = 1.4; e.squat = false; e.z = 0; bail(why, e.x, -30); },
    timeUp() { Game.endTurn('time'); },
    counter(e) { return Math.round(clamp(e.x / LEN, 0, 1) * 100) + '%'; },
    camera(e, c, dt, snap) { const tx = e.x + (V.portrait ? 50 : 100), ty = -62; if (snap) { c.x = tx; c.y = ty; } else { c.x = damp(c.x, tx, 6, dt); c.y = ty; } },
    enter(e) {
      const env = showEnv('skating', g => this.build(g));
      setSky('#3a2a8a', '#ff7aa8', '#ffcf8a', 40, 190, [60, 50, -300]);
      e.J = buildDude(Game.look, true); e.holder = mountRig(env, e.J, null); SPZ = 0;
      if (!env.userData.shadow) env.userData.shadow = blobShadow(env, 0.5);
    },
    build(g) {
      const mb = new MB(); const L = LEN * U, gaps = COURSE.filter(o => o.t === 'gap');
      mb.add(place(GG.box(L + 200, 1, 80), L / 2, -1.6, -30), '#f2c27a', false);
      mb.add(place(GG.box(L + 400, 0.4, 260), L / 2, -1.2, -170), '#2a9fc2', false);
      // boardwalk slabs with real holes where the gaps are
      let x0 = -40;
      for (const gp of gaps.concat([{ x: LEN + 1500, w: 0 }])) { const a = x0, b = (gp.x - gp.w / 2) * U; if (b > a) { mb.add(place(GG.box(b - a, 0.5, 4.2), (a + b) / 2, -0.25, 0), '#d8d4e6'); mb.add(place(GG.box(b - a, 0.08, 0.3), (a + b) / 2, 0.02, 2.05), '#ff5fa2', false); }
        x0 = (gp.x + gp.w / 2) * U; }
      for (let x = -40; x < L + 40; x += 2.4) mb.add(place(GG.box(0.05, 0.02, 4.1), x, 0.006, 0), '#b0aac6', false);
      // repeated backdrop: shops, palms, crowd, sponsor signs
      srand(7); const cols = ['#9fe8ff', '#ff9fb6', '#fff6dc', '#ffd23c', '#c9a0ff', '#9dff6b'];
      for (let x = -30; x < L + 60; x += 13) { const c = cols[Math.floor(rng() * cols.length)], h = 4 + rng() * 2.5;
        mb.add(place(GG.box(10, h, 5), x, h / 2 - 0.5, -8), c); mb.add(place(GG.box(10.6, 0.3, 5.6), x, h - 0.35, -8), '#3a2f5a');
        for (let s = 0; s < 5; s++) mb.add(place(GG.box(2, 0.12, 1.8), x - 4 + s * 2, 2.6, -5.0, 0, -0.45), s & 1 ? '#ffffff' : '#ff5fa2');
        mb.add(place(GG.box(3, 2.2, 0.1), x - 1.5, 0.6, -5.45), '#2f5bd3', false); }
      for (let x = 0; x < L + 60; x += 17) mbPalm(mb, x + rng() * 4, -0.5, -4 - rng() * 1.5, 0.95, rng() - 0.5, false);
      for (let x = 10; x < L; x += 37) mbCrowd(mb, x, x + 6, -0.5, -5.8, 5, 50 + x);
      mb.build(g);
      const sp = [['MALIBU NEON SODA', '#ff9f1c', '#fff6dc', '#14101f'], ['SUNSET ROLLER CO.', '#14101f', '#ff5e57', '#9fe8ff'], ['TUBULAR TACOS', '#ffd23c', '#ff3d6e', '#14101f'], ['PIER PRESSURE', '#14101f', '#2fd3ff', '#ff5fa2']];
      for (let i = 0, x = 6; x < L; x += 26, i++) { const s = sp[i % 4]; signMesh(g, s[0], s[1], s[2], s[3], x, 4.6, -5.3, 4.4, 0); }
      // pier + ferris wheel far out on the water (rotating)
      const fw = new THREE.Group(); fw.userData.mat = SCENE_MAT; const fm = new MB();
      fm.add(GG.tor(9, 0.25, 6, 40), '#ffd23c'); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; fm.add(place(GG.box(18, 0.12, 0.12), 0, 0, 0, 0, 0, a), i & 1 ? '#ff5fa2' : '#2fd3ff', false); fm.add(place(GG.box(1.2, 1.2, 1.2), Math.cos(a) * 9, Math.sin(a) * 9, 0), i & 1 ? '#ff5fa2' : '#2fd3ff'); }
      fm.build(fw); fw.position.set(60, 13, -70); g.add(fw); g.userData.wheel = fw;
      const pm = new MB(); pm.add(place(GG.box(160, 1.2, 8), 40, 3, -70), '#5c3828'); for (let x = -40; x < 120; x += 6) pm.add(place(GG.box(0.6, 5, 0.6), x, 0, -67), '#3a2a2a', false);
      pm.add(place(GG.box(1.2, 12, 1.2), 54, 8, -70, 0, 0, 0.5), '#8a8fa3'); pm.add(place(GG.box(1.2, 12, 1.2), 66, 8, -70, 0, 0, -0.5), '#8a8fa3'); pm.build(g);
      // obstacles
      const om = new MB(); const balls = [];
      for (const o of COURSE) { const x = o.x * U, w = o.w * U;
        if (o.t === 'crack') for (let i = 0; i < 4; i++) om.add(place(GG.box(w * 0.4, 0.03, 0.12), x - w * 0.35 + i * w * 0.23, 0.015, -0.6 + i * 0.4, (i & 1 ? 0.6 : -0.5)), '#2f3640', false);
        else if (o.t === 'grass') for (let i = 0; i < 9; i++) om.add(place(GG.cone(0.18, 0.45, 5), x - w / 2 + (i + 0.5) * w / 9, 0.2, -1.2 + (i % 3) * 1.1), i & 1 ? '#2fa36b' : '#58c46a');
        else if (o.t === 'sand') om.add(place(GG.sph(w / 2, 0.08, 1.8, 14, 6), x, 0.02, 0), '#eab56f');
        else if (o.t === 'puddle') om.add(place(GG.sph(w / 2, 0.04, 1.6, 16, 6), x, 0.02, 0), '#3ab4e6', false);
        else if (o.t === 'shoe') { om.add(place(GG.sph(0.2, 0.12, 0.11), x, 0.1, 0.2, 0.4), '#ffffff'); om.add(place(GG.box(0.42, 0.04, 0.22), x, 0.03, 0.2, 0.4), INK, false); om.add(place(GG.box(0.12, 0.05, 0.12), x - 0.02, 0.18, 0.18, 0.4), '#ff3d6e', false); }
        else if (o.t === 'gap') { om.add(place(GG.box(w, 0.6, 4.2), x, -1.2, 0), '#2a1a3a', false); signMesh(g, 'GAP!', '#ffd23c', INK, INK, x - w / 2 - 0.6, 0.9, -2.2, 1.0, 0); }
        else if (o.t === 'ball') { const b = new THREE.Group(); b.userData.mat = SCENE_MAT; part(b, GG.sph(0.36, 0.36, 0.36, 14, 10), '#ffffff', 0, 0, 0);
          for (let k = 0; k < 3; k++) part(b, GG.sph(0.365, 0.365, 0.12, 14, 10), ['#ff3d6e', '#ffd23c', '#2fd3ff'][k], 0, 0, 0, { rot: [0, k * Math.PI / 3, 0], outline: false }); b.visible = false; g.add(b); balls.push({ o, m: b }); }
      }
      om.build(g); g.userData.balls = balls;
      const fin = new MB(); for (const s of [-1, 1]) fin.add(place(GG.box(0.3, 4, 0.3), L, 2, s * 2.3), '#ffffff'); fin.add(place(GG.box(0.2, 0.9, 4.9), L, 3.8, 0), '#ff5fa2'); fin.build(g);
      signMesh(g, 'FINISH', '#14101f', '#ffd23c', '#ff5fa2', L, 3.8, 2.47, 4.4, 0);
    },
    sync(e) {
      const env = ENV.skating, J = e.J; if (!J) return;
      env.userData.wheel.rotation.z = T.real * 0.25;
      for (const b of env.userData.balls) { const o = b.o; b.m.visible = o.act && !o.done && Math.abs(o.bx - e.x) < 600 || (o.hit && o.act && Math.abs(o.bx - e.x) < 300);
        if (b.m.visible) { b.m.position.set(o.bx * U, -o.by * U, 0); b.m.rotation.z = T.real * 8; } }
      e.holder.position.set(e.x * U, e.z * U, 0); J.root.rotation.set(0, Math.PI / 2, 0); J.tilt.rotation.set(0, 0, 0);
      env.userData.shadow.position.set(e.x * U, 0.03, 0);
      if (!e.started) poseDude(J, 'stand', T.real);
      else if (e.fall > 0) { poseDude(J, 'tumble', T.real); J.tilt.rotation.x = Math.min(1.5, (1.4 - e.fall) * 4); }
      else if (e.squat) poseDude(J, 'squat', T.real);
      else if (e.z > 0) poseDude(J, 'tuck', T.real);
      else poseDude(J, e.v > 40 || e.stride > 0 ? 'stride' : 'stand', T.real * (0.4 + e.v / 300));
      if (e.spinT > 0) J.root.rotation.y = Math.PI / 2 + (1 - e.spinT / 0.42) * TAU;
      J.flash.value = 0;
    },
    hud(g, e, x, y, w, u) {
      const k = clamp(e.v / 370, 0, 1); g.fillStyle = INK; g.fillRect(x + 3, y + 3, w, 11); g.fillStyle = '#3b3160'; g.fillRect(x, y, w, 11);
      g.fillStyle = k > 0.75 ? '#9dff6b' : '#2fd3ff'; g.fillRect(x, y, w * k, 11); g.lineWidth = 2; g.strokeStyle = INK; g.strokeRect(x, y, w, 11);
      const p = clamp(e.x / LEN, 0, 1); g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(x + w * p, y + 20 * u, 5 * u, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.fillRect(x, y + 19 * u, w, 2);
      g.font = '800 ' + Math.round(10 * u) + 'px system-ui,sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('SPEED', x, y - 4); g.textAlign = 'right'; g.fillText('FINISH', x + w, y + 34 * u);
    },
    bot(e, dt) {
      const B = bot.held; B.up = B.down = B.a = B.b = B.c = false;
      if (!e.started) { bot.latch.a = true; return; }
      if (e.fall > 0) return;
      e.botLast += dt; if (e.botLast > 0.32 && e.v < 300 && !e.squat && e.z <= 0) { e.botLast = 0; bot.latch.c = true; }
      let next = null; for (const o of COURSE) if (!o.done && o.x + o.w / 2 > e.x) { next = o; break; }
      if (!next) return;
      if (next.t === 'ball') { if (next.act && next.bx - e.x < 70) B.a = true; return; }
      if (next.t === 'grass' || next.t === 'sand' || next.t === 'puddle' || true) {
        const d = next.x - next.w / 2 - e.x, air = 2 * (230 + 120) / GZ, lead = e.v * air * 0.5 - next.w / 2;
        if (e.z <= 0 && d < lead + 40 && d > lead - 10) B.a = true;
        if (e.z > 20 && e.spinT <= 0 && e.v > 220 && (next.x | 0) % 3 === 0) bot.latch.b = true;
      }
    }
  };
  EVENTS.push(ev);
})();
