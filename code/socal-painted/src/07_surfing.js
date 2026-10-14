/* ===== EVENT 3: SURFING (the beach) =====
   1:30 or 4 wipeouts. A = catch a wave. Steer with ←→ (rotate the board) or ↑↓ (nose up / down the face);
   hold A for sharper, slower turns. Turn hard right away or you pearl at the bottom. Stay near the curl, ride the tube,
   carve off the lip, go over the top and spin back in for an aerial; go straight over the top to kick out.
   Five judges score every ride on length, turns and their speed, tube time, riding near the break, airs and 360s. */
(() => {
  const FH = 165, VC = 150, G = 240;
  const E0 = { mode: 'wait', waitT: 0, u: 60, f: FH * 0.88, a: -1.3, v: 160, air: false, ah: 0, avy: 0, airRot: 0, maxAh: 0, curlX: 0,
    rideT: 0, turns: 0, turnVal: 0, tube: 0, near: 0, airs: 0, airVal: 0, spins: 0, rotSum: 0, rotDir: 0, lastCos: 1, inTube: false, wiped: false,
    judges: [0, 0, 0, 0, 0], jT: 0, jTotal: 0, rides: 0, final: false, startGrace: 0, clockStop: false, x: 0 };
  const ev = {
    key: 'surfing', name: 'Surfing', place: 'Malibu Point', time: 90, falls: 4, cpuPar: 1050,
    goal: 'RIDE THE CURL · WOW THE JUDGES', help: 'A = catch a wave · ←→ rotate the board, ↑↓ nose up / down · hold A = sharp turn · ride near the curl and in the tube, carve, spin back in off the lip',
    helpT: 'A = catch wave · stick steers the board (↑ climbs, ↓ drops) · hold A = sharp turn · stay near the curl, ride the tube, spin back in off the lip',
    labels: { a: 'CATCH /\nCARVE', b: null, c: null },
    view: { w: 360, h: 215 }, viewP: { w: 280, h: 285 }, tilt: 0.12, E: {},
    reset(o) { Object.assign(o, E0); o.judges = [0, 0, 0, 0, 0]; o.curlX = 0; return o; },
    start(e) { e.mode = 'wait'; e.waitT = 0; },
    catchWave(e) {
      e.mode = 'ride'; e.u = 70; e.f = FH * 0.92; e.a = -0.95; e.v = 150; e.air = false; e.rideT = 0; e.turns = 0; e.turnVal = 0; e.tube = 0; e.near = 0; e.airs = 0; e.airVal = 0; e.spins = 0;
      e.rotSum = 0; e.rotDir = 0; e.lastCos = Math.cos(e.a); e.lastSin = undefined; e.inTube = false; e.wiped = false; e.startGrace = 0; Audio.sfx('whoosh', 1); E.clockStop = false;
    },
    update(e, dt) {
      e.curlX += VC * dt;
      if (e.mode === 'wait') { e.waitT += dt; E.clockStop = false; if (In.p.a || e.waitT > 3.5) this.catchWave(e); this.amb(0.12); return; }
      if (e.mode === 'judge') { e.jT += dt; E.clockStop = true;
        const k = Math.floor((e.jT - 0.35) / 0.32); if (k >= 0 && k < 5 && e.jT - 0.35 - k * 0.32 < dt * 1.01) Audio.sfx('ding');
        if (e.jT > 2.4 && (In.p.a || e.jT > 3.6)) { if (e.final || R.falls >= R.maxFalls || R.time <= 0) Game.endTurn(R.falls >= R.maxFalls ? 'falls' : 'time'); else { e.mode = 'wait'; e.waitT = 0; } }
        this.amb(0.1); return; }
      // ---- riding
      e.rideT += dt; e.startGrace += dt;
      if (e.rideT > 26 && !e.air) { this.endRide(e, 'WAVE CLOSED OUT'); return; }
      let rate = 3.0, drag = 0.55;
      if (In.held.a) { rate = 5.0; drag = 1.6; }
      let steer = 0;
      if (In.held.left) steer += 1; if (In.held.right) steer -= 1;
      if (In.held.up) steer += Math.cos(e.a) >= 0 ? 1 : -1; if (In.held.down) steer -= Math.cos(e.a) >= 0 ? 1 : -1;
      steer = clamp(steer, -1, 1);
      const da = steer * (e.air ? 5.2 : rate) * dt; e.a = wrapA(e.a + da);
      if (e.air) { e.airRot += Math.abs(da); }
      else { // 360 tracking
        const dir = sgn(da); if (da !== 0) { if (dir !== e.rotDir) { e.rotSum = 0; e.rotDir = dir; } e.rotSum += Math.abs(da); if (e.rotSum >= TAU) { e.rotSum -= TAU; e.spins++; pop(e.u + e.curlX, -e.f - 30, '360!', '', '#9dff6b'); Audio.sfx('trick', 4); hitstop(0.05); } }
      }
      const c = Math.cos(e.a), s = Math.sin(e.a);
      if (!e.air) {
        const push = 230 * clamp(1 - e.u / 520, 0, 1) * (e.f > FH * 0.15 ? 1 : 0.3);
        e.v += (-G * s + push * Math.max(0, c) * 0.7 + 45 - drag * e.v * 0.35) * dt; e.v = clamp(e.v, 60, 430);
        e.u += (e.v * c - VC) * dt; e.f += e.v * s * dt;
        // cutbacks / turns
        if (sgn(c) !== sgn(e.lastCos)) { e.turns++; const val = clamp(e.v / 300, 0.3, 1.6) * (1 + (e.f > FH * 0.72 ? 0.6 : 0) + (e.u < 130 ? 0.5 : 0)); e.turnVal += val;
          pop(e.u + e.curlX, -e.f - 30, e.f > FH * 0.72 ? 'OFF THE LIP!' : 'CUTBACK!', '', val > 1.6 ? '#9dff6b' : '#ffd23c'); Audio.sfx('trick', val > 1.6 ? 5 : 0); spray((e.u + e.curlX), -e.f, 14, '#ffffff', -c * 120, -80, 120, 380, 3); }
        e.lastCos = c;
        if (sgn(s) !== sgn(e.lastSin || 0) && e.lastSin !== undefined) { const top = s < 0; const val = clamp(e.v / 320, 0.3, 1.4) * (top && e.f > FH * 0.7 ? 1.3 : !top && e.f < FH * 0.3 ? 1.1 : 0.6); e.turnVal += val * 0.6; e.turns++;
          if (val > 1.1) pop(e.u + e.curlX, -e.f - 26, top ? 'TOP TURN' : 'BOTTOM TURN', '', '#fff6dc'); }
        e.lastSin = s;
        // tube + near the break
        const tube = e.u > -16 && e.u < 75 && e.f > FH * 0.22 && e.f < FH * 0.82;
        if (tube) { e.tube += dt; if (!e.inTube) { e.inTube = true; say('IN THE TUBE!', 'stay in the green room', '#9dff6b', 1.1); Audio.sfx('cheer', 0.5); } } else e.inTube = false;
        if (e.u < 150) e.near += dt;
        if (e.u < -16) { this.wipe(e, 'CAUGHT INSIDE!'); return; }
        // lip: launch or ride it
        if (e.f >= FH) {
          if (s > 0.15 && e.v * s > 85) { e.air = true; e.ah = 0; e.avy = e.v * s; e.avx = e.v * c; e.airRot = 0; e.maxAh = 0; Audio.sfx('whoosh', 0.8); spray(e.u + e.curlX, -FH, 18, '#ffffff', 0, -160, 140, 500, 3); }
          else { e.f = FH; if (s > 0) e.a = wrapA(e.a - 1.5 * dt * sgn(c || 1)); }
        }
        if (e.f <= 0) { if (s < -0.55 && e.v > 210) { this.wipe(e, 'PEARLED!'); return; } e.f = 0; this.endRide(e, 'LEFT THE WAVE'); return; }
        if (e.startGrace < 1.3 && e.f < FH * 0.12 && s < -0.55) { this.wipe(e, 'PEARLED! TURN SOONER'); return; }
      } else {
        e.u += (e.avx - VC) * dt; e.ah += e.avy * dt; e.avy -= 650 * dt; e.maxAh = Math.max(e.maxAh, e.ah);
        if (e.ah <= 0) {
          e.air = false; e.f = FH - 1;
          if (Math.sin(e.a) < -0.25 && e.airRot > 1.6) { e.airs++; const val = 1 + clamp(e.maxAh / 70, 0, 1) + (e.airRot > 3.6 ? 1 : 0); e.airVal += val;
            hype(val > 2.2 ? 'AERIAL 360!' : 'AERIAL!', e.u + e.curlX, -FH - 40, val > 2.2 ? 2 : 1); e.v = Math.max(e.v, 260); Audio.sfx('land'); spray(e.u + e.curlX, -FH, 20, '#ffffff', 0, -120, 160, 400, 3); }
          else if (e.airRot < 0.9) { this.endRide(e, 'KICK OUT'); return; }
          else { this.wipe(e, 'BAD RE-ENTRY!'); return; }
        }
      }
      this.amb(0.22 + clamp(e.v / 1500, 0, 0.2));
      Audio.setIntensity(clamp(e.v / 420 + (e.inTube ? 0.3 : 0), 0, 1));
      if (Math.random() < 0.5) spray(e.u + e.curlX - c * 30, -e.f + 6, 1, 'rgba(255,255,255,1)', -c * 60, -30, 40, 200, 2.5);
    },
    amb(l) { Audio.amb('lowpass', l, 700); },
    wipe(e, why) {
      e.wiped = true; R.falls++; QLOG.push('surf:' + why); Audio.sfx('splash'); Audio.sfx('bail'); hitstop(0.12); shake(14); flash(0.2);
      spray(e.u + e.curlX, -e.f, 40, '#ffffff', 0, -200, 300, 500, 4);
      const left = R.maxFalls - R.falls; say(why, left > 0 ? left + (left === 1 ? ' WIPEOUT LEFT' : ' WIPEOUTS LEFT') : 'OUT OF WIPEOUTS!', '#ff3d6e', 1.6, true);
      this.judge(e, 0.75);
    },
    endRide(e, why) { QLOG.push('surf-end:' + why + ':' + e.rideT.toFixed(1)); if (why) say(why, '', '#2fd3ff', 1.0); Audio.sfx('land'); this.judge(e, 1); },
    judge(e, mul) {
      const raw = (0.8 + e.rideT * 0.05 + e.turnVal * 0.3 + e.tube * 0.45 + e.near * 0.015 + e.airVal * 0.5 + e.spins * 0.8) * mul;
      QLOG.push('surf-metrics t' + e.rideT.toFixed(0) + ' tv' + e.turnVal.toFixed(1) + ' tube' + e.tube.toFixed(1) + ' near' + e.near.toFixed(0) + ' air' + e.airVal.toFixed(1) + ' sp' + e.spins + ' raw' + raw.toFixed(1));
      const base = clamp(10 * (1 - Math.exp(-raw / 7)), 0.5, 9.9); let tot = 0;
      for (let i = 0; i < 5; i++) { const j = clamp(Math.round((base + (rng() - 0.5) * 0.9) * 10) / 10, 0.1, 10); e.judges[i] = j; tot += j; }
      e.jTotal = Math.round(tot * 10) / 10; e.rides++; e.mode = 'judge'; e.jT = 0; e.air = false;
      R.score += Math.round(tot * 10); R.stunts++;
      if (e.jTotal > R.bestPts / 10 && e.jTotal >= 10) { R.bestPts = Math.round(tot * 10); R.best = 'RIDE ' + e.jTotal.toFixed(1); }
      if (tot > 35) { Audio.sfx('cheer', 1.2); Audio.sfx('big'); } else if (tot > 20) Audio.sfx('cheer', 0.7);
    },
    timeUp(e) { if (e.mode === 'ride') { e.final = true; this.endRide(e, 'TIME!'); } else if (e.mode === 'judge') e.final = true; else Game.endTurn('time'); },
    camera(e, c, dt, snap) {
      const wx = e.curlX + (e.mode === 'ride' ? e.u : 90), tx = wx + (V.portrait ? 30 : 70), ty = -FH * 0.5 - (e.air ? e.ah * 0.5 : 0);
      if (snap) { c.x = tx; c.y = ty; } else { c.x = damp(c.x, tx, 4, dt); c.y = damp(c.y, ty, 3, dt); }
    },
    // wave surface in wave-frame meters (u along shore, v 0..1 up the face)
    faceZ(um, v) { const lean = um >= 0 ? 2.4 * Math.exp(-um / 8) + 0.7 : 2.4; return -1.6 * (1 - v) * (1 - v) + lean * v * v * v; },
    faceH(um) { const FHm = FH * U; return um >= 0 ? FHm : FHm * (1 - 0.62 * clamp(-um / 3, 0, 1)); },
    enter(e) {
      const env = showEnv('surfing', g => this.build(g));
      setSky('#4a2a8a', '#e36aa0', '#ffc07a', 50, 260, [140, 40, -300]);
      e.J = buildDude(Game.look); e.board = buildSurfboard(Game.look);
      e.holder = mountRig(env.userData.waveG, e.J, e.board); e.J.root.position.set(0, 0.1, 0);
      SPZ = 0;
    },
    build(g) {
      const mb = new MB();
      mb.add(place(GG.box(3000, 0.4, 60), 0, -0.25, 30), '#11688a', false);
      for (let i = 0; i < 160; i++) mb.add(place(GG.box(2 + rng() * 5, 0.02, 0.15), -100 + rng() * 2000, -0.04, 1 + rng() * 22), '#5fc8e6', false);
      mb.add(place(GG.box(3000, 0.4, 220), 0, 0.6, -120), '#1d86ad', false);
      srand(41); for (let i = 0; i < 30; i++) mb.add(place(GG.sph(30 + rng() * 25, 10 + rng() * 14, 12, 12, 8), -200 + i * 110, -4, -240 - rng() * 30), i & 1 ? '#7b3f8c' : '#9a4f8f', false);
      mb.build(g);
      // the wave: a moving group whose x follows the curl
      const wg = new THREE.Group(); wg.userData.mat = SCENE_MAT; g.add(wg); g.userData.waveG = wg;
      const NU = 90, NV = 22, u0 = -12, u1 = 48, geo = new THREE.BufferGeometry(), pos = [], col = [], idx = [];
      const cB = new THREE.Color('#2fd3ff'), cM = new THREE.Color('#0a8fb0'), cT = new THREE.Color('#0a5f7a'), cL = new THREE.Color('#7fe3f5'), cF = new THREE.Color('#ffffff'), tmp = new THREE.Color();
      for (let i = 0; i <= NU; i++) { const um = u0 + (u1 - u0) * Math.pow(i / NU, 1.35) * 1 + 0, h = this.faceH(um);
        for (let j = 0; j <= NV; j++) { const v = j / NV; let y = v * h, z = this.faceZ(um, v);
          if (v > 0.86 && um > -1.5) { const k = (v - 0.86) / 0.14, curl = Math.exp(-Math.max(um, 0) / 5); y -= k * k * 1.4 * curl; z += k * 0.9 * curl; }
          pos.push(um, y, z);
          if (v < 0.45) tmp.copy(cB).lerp(cM, v / 0.45); else if (v < 0.85) tmp.copy(cM).lerp(cT, (v - 0.45) / 0.4); else tmp.copy(cT).lerp(cL, (v - 0.85) / 0.15);
          if (Math.sin(um * 1.7 + v * 17 + Math.sin(um * 0.4) * 2) > 0.82 && v > 0.12) tmp.lerp(cL, 0.35); if (um < 0) tmp.lerp(cF, clamp(-um / 2.2, 0, 0.92)); if (v > 0.95 && um < 6) tmp.lerp(cF, 0.8);
          col.push(tmp.r, tmp.g, tmp.b); } }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const wave = new THREE.Mesh(geo, toonMat({ side: THREE.DoubleSide })); wave.receiveShadow = true; wg.add(wave);
      // lip ink line + foam blobs (instanced)
      const foam = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toonMat({ vertexColors: false, color: 0xffffff }), 100); foam.frustumCulled = false; wg.add(foam); g.userData.foam = foam;
      const lip = []; for (let i = 0; i <= 60; i++) { const um = -1 + i * 0.8; lip.push(new THREE.Vector3(um, this.faceH(um) - (um < 6 ? 0.9 * Math.exp(-Math.max(um, 0) / 5) : 0), this.faceZ(um, 1) + (um < 6 ? 0.6 : 0))); }
      const lg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip), 80, 0.07, 5, false); wg.add(new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0xffffff })));
      
      g.userData.blob = new THREE.Matrix4();
    },
    sync(e) {
      const env = ENV.surfing; if (!env || !e.J) return;
      const wg = env.userData.waveG; wg.position.x = e.curlX * U;
      const foam = env.userData.foam, M = env.userData.blob;
      for (let i = 0; i < 70; i++) { const um = -11 + (i % 35) * 0.36 + (i >= 35 ? 0.15 : 0), ph = T.real * 3 + i * 1.7, h = this.faceH(um);
        const v = i >= 35 ? 0.98 : 0.15 + ((i * 37) % 70) / 70 * 0.7, s = (i >= 35 ? 0.35 : 0.55) + 0.18 * Math.sin(ph);
        const y = i >= 35 ? h * (um < 0 ? 1 : 1) + 0.1 * Math.sin(ph) : v * h + 0.2 * Math.sin(ph), z = this.faceZ(Math.min(um, 0), i >= 35 ? 1 : v) + 0.35;
        M.compose(_v.set(um + (i >= 35 ? 0 : 0), y, z), _q.identity(), _s.set(s, s * 0.8, s)); foam.setMatrixAt(i, M); }
      for (let i = 70; i < 100; i++) { const um = -4 + (i - 70) * 1.6 + ((T.real * 2 + i) % 1.6), s2 = 0.35 + 0.12 * Math.sin(T.real * 4 + i); M.compose(_v.set(um, 0.05, this.faceZ(um, 0) + 0.5), _q.identity(), _s.set(s2 * 1.6, s2 * 0.5, s2)); foam.setMatrixAt(i, M); }
      foam.instanceMatrix.needsUpdate = true;
      const J = e.J, h = e.holder;
      h.visible = e.mode !== 'wait' || true;
      let um, v, rot, yo = 0;
      if (e.mode === 'wait') { um = 3.2; v = 0.88 + Math.sin(T.real * 2) * 0.01; rot = -0.1; poseDude(J, 'sit', T.real); }
      else { um = e.u * U; v = clamp(e.f / FH, 0, 1); rot = e.a; if (e.air) yo = e.ah * U;
        if (e.mode === 'judge' && e.wiped) { poseDude(J, 'tumble', T.real); rot = T.real * 3; v = Math.max(0.05, v - e.jT * 0.3); }
        else if (e.mode === 'judge') poseDude(J, 'cheer', T.real); else poseDude(J, 'board', T.real, In.held.a ? 1 : e.inTube ? 0.85 : 0.45); }
      const hh = this.faceH(um);
      h.position.set(um, v * hh + yo, this.faceZ(um, v) + 0.45);
      h.rotation.set(0, 0, rot); J.tilt.rotation.z = -rot * 0.55; J.root.rotation.y = Math.cos(rot) >= 0 ? 0.25 : -0.25;
      e.board.position.set(0, 0, 0); e.board.rotation.set(0, 0, 0);
      J.flash.value = 0;
    },
    hud(g, e, x, y, w, u) {
      if (e.mode === 'wait') { const yy = V.P.y + V.P.h * 0.62; g.globalAlpha = 0.6 + 0.4 * Math.sin(T.real * 6); txt(g, V.touch ? 'TAP A TO CATCH THE WAVE' : 'PRESS A TO CATCH THE WAVE', V.W / 2, yy, 20 * u, '#fff', 'center', -0.04); g.globalAlpha = 1;
        g.font = '800 ' + Math.round(11 * u) + 'px system-ui,sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('RIDE ' + (e.rides + 1) + ' · WIPEOUTS ' + R.falls + '/4', V.W / 2, yy + 24 * u); }
      if (e.mode === 'ride') { // live ride meter
        const k = clamp((e.rideT * 0.075 + e.turnVal * 0.55 + e.tube * 0.85 + e.airVal * 1.3 + e.spins) / 9, 0, 1);
        g.fillStyle = INK; g.fillRect(x + 3, y + 3, w, 11); g.fillStyle = '#3b3160'; g.fillRect(x, y, w, 11); g.fillStyle = k > 0.7 ? '#9dff6b' : '#2fd3ff'; g.fillRect(x, y, w * k, 11); g.lineWidth = 2; g.strokeStyle = INK; g.strokeRect(x, y, w, 11);
        g.font = '800 ' + Math.round(10 * u) + 'px system-ui,sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('RIDE ' + (e.rides + 1) + (e.inTube ? '  · TUBE!' : ''), x, y + 24 * u); }
      if (e.mode === 'judge') { // five judges' cards
        const cw = Math.min(64 * u, (V.W - 40) / 5.6), y0 = V.P.y + V.P.h * 0.58, x0 = V.W / 2 - cw * 2.5 - cw * 0.2;
        txt(g, e.wiped ? 'WIPEOUT — JUDGES' : 'THE JUDGES', V.W / 2, y0 - 26 * u, 20 * u, '#fff', 'center', -0.04);
        for (let i = 0; i < 5; i++) { const t = e.jT - 0.35 - i * 0.32; if (t < 0) continue; const sc = Math.min(1, t * 6), cx = x0 + i * cw * 1.1 + cw / 2;
          g.save(); g.translate(cx, y0 + cw * 0.6); g.scale(sc, sc); g.fillStyle = INK; rr(g, -cw / 2 + 3, -cw * 0.6 + 3, cw, cw * 1.2, 8); g.fill(); g.fillStyle = '#fff6dc'; rr(g, -cw / 2, -cw * 0.6, cw, cw * 1.2, 8); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
          g.font = 'italic ' + Math.round(cw * 0.42) + 'px ' + FONT; g.fillStyle = e.judges[i] >= 7 ? '#c42b48' : INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e.judges[i].toFixed(1), 0, 2); g.restore(); }
        if (e.jT > 2.0) txt(g, 'RIDE TOTAL ' + e.jTotal.toFixed(1) + ' → +' + Math.round(e.jTotal * 10), V.W / 2, y0 + cw * 1.6, 20 * u, '#ffd23c', 'center', -0.04);
      }
    },
    bot(e, dt) {
      const B = bot.held; B.left = B.right = B.up = B.down = B.a = false;
      if (e.mode !== 'ride') { if (e.mode === 'wait' && e.waitT > 0.6) bot.latch.a = true; if (e.mode === 'judge' && e.jT > 2.6) bot.latch.a = true; return; }
      if (e.air) { if (Math.sin(e.a) > -0.45 || e.airRot < 1.8) B.right = true; return; }
      e.botPhase = e.botPhase || 1;
      if (e.rideT < 0.05) e.botPhase = 1; if (e.f > FH * 0.82 && Math.sin(e.a) > 0) e.botPhase = -1; if (e.f < FH * 0.48 && Math.sin(e.a) < 0) e.botPhase = 1;
      let want = e.botPhase > 0 ? 0.8 : -0.6; if (e.u < 30) want *= 0.35; if (e.u > 240) want = e.botPhase > 0 ? 1.15 : -0.35;
      if (e.botPhase > 0 && e.f > FH * 0.6 && e.u < 220 && R.stunts % 3 === 2) want = 1.2;
      const d = wrapA(want - e.a); if (d > 0.08) B.left = true; else if (d < -0.08) B.right = true;
    }
  };
  EVENTS.push(ev);
})();
