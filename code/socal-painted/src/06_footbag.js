/* ===== EVENT 2: FOOT BAG (San Francisco) =====
   1:15. A = kick: the kick you get depends on where the bag is (foot: inside / outside / back; knee; head;
   jumping = Jester). Any kick 10 + chain bonus. Stunts: Half Axle 250 / Full Axle 500 (spin between kicks),
   Horseshoe 500 (back kicks L+R), Jester 2000, Double Arch 2500 (outside L-R-L), Doda 5000 (outside + head + outside).
   Dropping the bag costs 3 seconds. Kick it off screen and it gets thrown back: catch it = 1500. Bonk the seagull = 500. */
(() => {
  const GB = 440, KN = ['INSIDE', 'OUTSIDE', 'BACK', 'KNEE', 'HEAD', 'JUMPING'];
  const E0 = { started: false, px: 0, pvx: 0, ph: 0, pvy: 0, face: 1, yaw: Math.PI / 2, spinT: 0, spins: 0, kickT: 0, kickType: 0, whiff: 0,
    bx: 0, by: -20, bvx: 0, bvy: 0, bag: 'hand', bagT: 0, off: false, chain: 0, hist: [], seen: {}, gull: { on: false, x: 0, y: 0, vx: 0, hit: false, t: 9 }, kicks: 0, clockStop: false };
  const ev = {
    key: 'footbag', name: 'Foot Bag', place: 'San Francisco', time: 75, falls: 99, cpuPar: 5000, counterLabel: 'DROPS COST 3s',
    goal: 'KEEP IT UP · LAND STUNTS', help: 'A = kick when the bag drops to you (foot / knee / head) · ←→ move · ↑ or B jump · ↓ or C spin around · spin or jump between kicks for big stunts',
    labels: { a: 'KICK', b: 'JUMP', c: 'SPIN' },
    view: { w: 300, h: 168 }, viewP: { w: 235, h: 300 }, tilt: 0.1, E: {},
    reset(o) { Object.assign(o, E0); o.hist = []; o.seen = {}; o.gull = { on: false, x: 0, y: 0, vx: 0, hit: false, t: 8 }; return o; },
    start(e) { e.started = true; this.serve(e); },
    serve(e) { e.bag = 'air'; e.bx = e.px + e.face * 6; e.by = -20; e.bvx = (rng() - 0.5) * 30; e.bvy = -300; e.off = false; Audio.sfx('kick'); },
    update(e, dt) {
      if (!e.started) return;
      // --- player
      const ax = In.ax;
      e.pvx = damp(e.pvx, ax * 150, ax ? 9 : 12, dt); e.px = clamp(e.px + e.pvx * dt, -165, 165);
      if ((In.p.up || In.p.b) && e.ph <= 0) { e.pvy = 270; Audio.sfx('whoosh', 0.5); }
      if (e.ph > 0 || e.pvy > 0) { e.ph += e.pvy * dt; e.pvy -= 900 * dt; if (e.ph <= 0) { e.ph = 0; e.pvy = 0; } }
      if ((In.p.down || In.p.c) && e.spinT <= 0) { e.spinT = 0.28; e.face = -e.face; Audio.sfx('whoosh', 0.4); }
      if (e.spinT > 0) { e.spinT -= dt; if (e.spinT <= 0) e.spins++; }
      if (Math.abs(e.pvx) > 20 && e.spinT <= 0 && e.kickT <= 0) e.face = sgn(e.pvx);
      e.yaw = damp(e.yaw, e.face * Math.PI / 2, 22, dt);
      if (e.kickT > 0) e.kickT -= dt; if (e.whiff > 0) e.whiff -= dt;
      // --- kick
      if (In.p.a && e.kickT <= 0 && e.whiff <= 0) this.kick(e);
      // --- bag
      if (e.bag === 'air') {
        e.bvy += GB * dt; e.bx += e.bvx * dt; e.by += e.bvy * dt;
        if (Math.abs(e.bx) > 215) { e.bag = 'gone'; e.bagT = 1.2; e.chain = 0; say('OFF SCREEN!', 'here it comes back...', '#2fd3ff', 1.1); Audio.sfx('groan'); }
        else if (e.by >= -3) { e.by = -3; e.bag = 'ground'; e.bagT = 1.0; e.chain = 0; R.time = Math.max(0, R.time - 3); Audio.sfx('buzz'); shake(5);
          pop(e.bx, -30, 'DROPPED', '−3 SECONDS', '#ff3d6e'); spawn(e.bx, -4, 10, '#9dff6b', 90, 300, 3, 1); }
        // seagull bonk
        const gl = e.gull;
        if (gl.on && !gl.hit && Math.abs(gl.x - e.bx) < 16 && Math.abs(gl.y - e.by) < 14) {
          gl.hit = true; Audio.sfx('squawk'); e.bvy = Math.abs(e.bvy) * 0.3; spawn(gl.x, gl.y, 18, '#ffffff', 160, 200, 3, 1);
          score(500, 'SEAGULL BONK!', gl.x, gl.y, 2);
        }
      } else if (e.bag === 'ground') { e.bagT -= dt; if (e.bagT <= 0) this.serve(e); }
      else if (e.bag === 'gone') { e.bagT -= dt; if (e.bagT <= 0) { // thrown back in from off screen
        const sd = sgn(e.bx); e.bx = sd * 225; e.by = -110; e.bvx = (e.px - e.bx) / 1.45; e.bvy = -180; e.bag = 'air'; e.off = true; Audio.sfx('throw'); } }
      // --- seagull
      const gl = e.gull;
      if (!gl.on) { gl.t -= dt; if (gl.t <= 0) { gl.on = true; gl.hit = false; const sd = rng() < 0.5 ? -1 : 1; gl.x = sd * 260; gl.y = -(80 + rng() * 40); gl.vx = -sd * (70 + rng() * 30); Audio.sfx('squawk'); } }
      else { gl.x += gl.vx * dt; if (gl.hit) { gl.y += 60 * dt; gl.x += gl.vx * dt; } else gl.y += Math.sin(T.game * 4) * 10 * dt; if (Math.abs(gl.x) > 280) { gl.on = false; gl.t = 8 + rng() * 6; } }
      Audio.setIntensity(clamp(e.chain / 12, 0, 1));
    },
    kick(e) {
      if (e.bag !== 'air') { e.kickT = 0.25; e.kickType = 0; return; }
      const hb = -e.by - e.ph, dxf = (e.bx - e.px) * e.face, adx = Math.abs(e.bx - e.px), desc = e.bvy > -40;
      let type = -1, q = 0;
      if (desc) {
        if (e.ph > 6 && hb < 34 && adx < 28) { type = 5; q = 1 - Math.abs(hb - 16) / 18; }
        else if (hb >= 44 && hb <= 68 && adx < 17) { type = 4; q = 1 - Math.abs(hb - 54) / 14; }
        else if (hb >= 24 && hb < 40 && adx < 19) { type = 3; q = 1 - Math.abs(hb - 31) / 10; }
        else if (hb >= -5 && hb < 24) {
          if (Math.abs(dxf) <= 11) { type = 0; q = 1 - Math.abs(hb - 9) / 14; }
          else if (dxf > 11 && dxf <= 32) { type = 1; q = 1 - Math.abs(hb - 9) / 14; }
          else if (dxf < -11 && dxf >= -32) { type = 2; q = 1 - Math.abs(hb - 10) / 14; }
        }
      }
      e.kickType = type < 0 ? (hb > 40 ? 4 : 0) : type; e.kickT = 0.26;
      if (type < 0) { e.whiff = 0.22; Audio.sfx('whoosh', 0.3); return; }
      q = clamp(q, 0, 1);
      e.bvy = -(275 + 70 * q); e.bvx = (rng() - 0.5) * (50 + (1 - q) * 110) + (type === 1 ? -e.face * 25 : type === 2 ? e.face * 30 : 0);
      e.by = Math.min(e.by, -4);
      e.kicks++; e.chain++;
      const side = e.bx < e.px ? 'L' : 'R';
      const h = e.hist; h.push({ t: type, s: side, sp: e.spins }); if (h.length > 4) h.shift(); e.spins = 0;
      Audio.sfx('pop', q); spawn(e.bx, e.by, 6 + q * 6, q > 0.75 ? '#ffd23c' : '#fff6dc', 80 + q * 80, 200, 2);
      hitstop(0.03 + q * 0.03);
      let pts = 10 + Math.min(e.chain, 25) * 4, name = KN[type] + ' KICK', tier = 0;
      // stunts (most valuable first)
      const n = h.length, a = h[n - 3], b = h[n - 2], c = h[n - 1];
      let stunt = null, sp = 0;
      if (a && a.t === 1 && b.t === 4 && c.t === 1 && a.s !== c.s) { stunt = 'DODA'; sp = 5000; }
      else if (a && a.t === 1 && b.t === 1 && c.t === 1 && a.s !== b.s && b.s !== c.s) { stunt = 'DOUBLE ARCH'; sp = 2500; }
      else if (type === 5) { stunt = 'JESTER'; sp = 2000; }
      else if (b && b.t === 2 && c.t === 2 && b.s !== c.s) { stunt = 'HORSESHOE'; sp = 500; }
      else if (c.sp >= 2) { stunt = 'FULL AXLE'; sp = 500; }
      else if (c.sp === 1) { stunt = 'HALF AXLE'; sp = 250; }
      if (e.off) { e.off = false; score(1500, 'OFF SCREEN CATCH!', e.bx, e.by - 20, 2); }
      if (stunt) { pts += sp; name = stunt; tier = sp >= 2000 ? 2 : 1; if (!e.seen[stunt]) { e.seen[stunt] = 1; pts += 250; name += ' · NEW!'; } }
      if (q > 0.85 && !stunt) name = 'PERFECT ' + name;
      score(pts, name, e.bx, e.by - 16, tier);
    },
    timeUp() { Game.endTurn('time'); },
    camera(e, c, dt, snap) { const tx = clamp(e.px * 0.35, -40, 40), ty = -75; if (snap) { c.x = tx; c.y = ty; } else { c.x = damp(c.x, tx, 2.5, dt); c.y = damp(c.y, ty, 2, dt); } },
    enter(e) {
      const env = showEnv('footbag', g => this.build(g));
      setSky('#3f6fd8', '#9fd2ff', '#ffd1b0', 35, 170, [-150, 80, -300]);
      e.J = buildDude(Game.look); e.holder = mountRig(env, e.J, null);
      if (!env.userData.bag) { env.userData.bag = buildFootbag(); env.userData.bag.scale.setScalar(1.6); env.add(env.userData.bag); env.userData.gull = this.gullMesh(); env.add(env.userData.gull); env.userData.shadow = blobShadow(env); env.userData.bshadow = blobShadow(env, 0.35); }
      SPZ = 0;
    },
    gullMesh() { const g = new THREE.Group(); g.userData.mat = toonMat();
      part(g, GG.sph(0.22, 0.13, 0.12), '#ffffff', 0, 0, 0); part(g, GG.sph(0.09, 0.09, 0.09), '#ffffff', 0.22, 0.06, 0); part(g, GG.cone(0.035, 0.12, 6), '#ffb43c', 0.33, 0.05, 0, { rot: [0, 0, -Math.PI / 2] });
      part(g, GG.sph(0.02, 0.02, 0.02), INK, 0.27, 0.09, 0.07, { outline: false });
      g.userData.wings = [grp(g, 0, 0.05, 0.05), grp(g, 0, 0.05, -0.05)];
      g.userData.wings.forEach((w, i) => part(w, GG.box(0.18, 0.02, 0.5), '#d1d8e0', 0, 0, (i ? -1 : 1) * 0.25)); return g; },
    build(g) {
      const mb = new MB();
      mb.add(place(GG.box(260, 1, 90), 0, -0.5, -20), '#58c46a', false);
      mb.add(place(GG.cyl(5.5, 5.5, 0.06, 32), 0, 0.02, 0), '#e8d3a8', false);
      mb.add(place(GG.box(260, 0.05, 2.2), 0, 0.03, 5), '#e8d3a8', false);
      mb.add(place(GG.box(400, 0.3, 60), 0, -0.4, -95), '#2a7fc2', false);
      // red suspension bridge (no real logo, just the shape)
      const BX = 10, BZ = -80, R = '#d9452e';
      for (const tx of [-30, 30]) { mb.add(place(GG.box(2, 34, 2.4), BX + tx, 17, BZ), R); for (const y of [12, 22, 31]) mb.add(place(GG.box(2.2, 1.2, 4.5), BX + tx, y, BZ), R); }
      mb.add(place(GG.box(160, 1.3, 3), BX, 7, BZ), R);
      for (let i = 0; i <= 40; i++) { const x = -75 + i * 3.75, t = (x + 30) / 60, y = x > -30 && x < 30 ? 33 - 26 * (1 - Math.pow(2 * t - 1, 2)) : 33 - (Math.abs(x) - 30) * 0.6;
        mb.add(place(GG.box(0.25, Math.max(0.5, y - 7), 0.25), BX + x, 7 + Math.max(0.5, y - 7) / 2, BZ), R, false); }
      // painted victorian row houses
      srand(21); const cols = ['#ff9fb6', '#9fe8ff', '#ffd23c', '#c9a0ff', '#9dff6b', '#fff6dc'];
      for (let i = 0; i < 16; i++) { const x = -64 + i * 8, h = 7 + rng() * 3, c = cols[i % cols.length];
        mbBuilding(mb, x, 0, -34, 7.4, h, 6, c, '#fff6dc', '#2f5bd3'); mb.add(place(GG.cone(5.4, 3, 4), x, h + 1.4, -34, Math.PI / 4), '#5c3828'); }
      for (let i = 0; i < 12; i++) mbTree(mb, -50 + i * 9 + rng() * 3, 0, -18 - rng() * 6, 1 + rng() * 0.5);
      for (const x of [-9, 9]) { mb.add(place(GG.box(2.2, 0.12, 0.6), x, 0.5, -4), '#8a5a32'); mb.add(place(GG.box(2.2, 0.6, 0.12), x, 0.85, -4.3), '#8a5a32'); }
      mbCrowd(mb, -11, -7, 0, -5.5, 8, 31); mbCrowd(mb, 7, 11, 0, -5.5, 8, 32);
      mb.build(g);
      signMesh(g, 'TUBULAR TACOS', '#14101f', '#ffd23c', '#ff3d6e', -6, 3.4, -12, 4.4, 0, 'FOOTBAG OPEN');
      signMesh(g, 'MALIBU NEON SODA', '#ff9f1c', '#fff6dc', '#14101f', 7, 3.4, -12, 4.4, 0);
    },
    sync(e) {
      const env = ENV.footbag, J = e.J; if (!J) return;
      e.holder.position.set(e.px * U, e.ph * U, 0); J.root.rotation.y = e.yaw + (e.spinT > 0 ? 0 : 0);
      if (!e.started) poseDude(J, 'stand', T.real);
      else if (e.kickT > 0) { J.kickType = e.kickType; poseDude(J, 'kick', T.real, 1 - e.kickT / 0.26); }
      else if (e.ph > 0) poseDude(J, 'tuck', T.real);
      else if (Math.abs(e.pvx) > 25) poseDude(J, 'run', T.real, 13);
      else poseDude(J, 'stand', T.real);
      const bag = env.userData.bag;
      bag.visible = e.started && e.bag !== 'gone';
      if (!e.started) bag.position.set((e.px + 8) * U, 0.95, 0.25); else bag.position.set(e.bx * U, -e.by * U, 0.1);
      bag.rotation.set(T.real * 5, T.real * 3, 0);
      const gl = e.gull, gm = env.userData.gull; gm.visible = gl.on; gm.position.set(gl.x * U, -gl.y * U, 0.2); gm.rotation.set(0, gl.vx > 0 ? 0 : Math.PI, gl.hit ? T.real * 12 : 0);
      const fl = Math.sin(T.real * 14) * 0.7; gm.userData.wings[0].rotation.x = -fl; gm.userData.wings[1].rotation.x = fl;
      env.userData.shadow.position.set(e.px * U, 0.04, 0); env.userData.bshadow.position.set(e.bx * U, 0.045, 0.1); env.userData.bshadow.visible = bag.visible;
      J.flash.value = 0;
    },
    hud(g, e, x, y, w, u) {
      if (e.chain >= 2) txt(g, e.chain + ' KICKS', V.W - 14, V.top + 96 * u, 22 * u, '#ffd23c', 'right', -0.06);
      const names = ['HALF AXLE', 'FULL AXLE', 'HORSESHOE', 'JESTER', 'DOUBLE ARCH', 'DODA']; let k = 0; for (const n of names) if (e.seen[n]) k++;
      g.font = '800 ' + Math.round(10 * u) + 'px system-ui,sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('STUNTS FOUND ' + k + '/6', V.W / 2, y + 4);
    },
    bot(e, dt) {
      const B = bot.held; B.left = B.right = B.up = B.down = B.a = B.b = B.c = false;
      if (!e.started) { bot.latch.a = true; return; }
      if (e.bag !== 'air') { if (Math.abs(e.px) > 10) { if (e.px > 0) B.left = true; else B.right = true; } return; }
      const hb = -e.by, tl = (-e.bvy + Math.sqrt(Math.max(0, e.bvy * e.bvy + 2 * GB * Math.max(0, hb - 7)))) / GB;
      const tx = clamp(e.bx + e.bvx * tl, -160, 160) - e.face * 2, d = tx - e.px;
      if (Math.abs(d) > 4) { if (d > 0) B.right = true; else B.left = true; }
      if (e.bvy < -200 && e.spinT <= 0 && e.kicks % 3 === 1 && hb > 60) bot.latch.c = true;
      if (e.bvy > 0 && hb < 18 && hb > 4 && Math.abs(e.bx - e.px) < 10) bot.latch.a = true;
    }
  };
  EVENTS.push(ev);
})();
function blobShadow(parent, r) { const m = new THREE.Mesh(new THREE.CircleGeometry(r || 0.55, 20), new THREE.MeshBasicMaterial({ color: 0x14101f, transparent: true, opacity: 0.28, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; parent.add(m); return m; }
