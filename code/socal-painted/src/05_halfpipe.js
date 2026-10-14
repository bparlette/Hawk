/* ===== EVENT 1: HALF PIPE SKATEBOARD (Hollywood) =====
   1:15 or three falls. Pump: UP while rolling up a wall, DOWN while rolling down.
   Kick turn (100-300): tap toward the ramp centre while climbing a wall, hold through the top, release just after.
   Aerial turn (400-999): off the lip, tap toward the centre; finish the 180 before you land.
   Hand plant (400-700): press & hold A as you reach the lip, release as the board comes back over.
   No turn = you roll back fakie (backwards), which pumps harder. Too fast = speed wobbles. */
(() => {
  const F = 50, RR = 140, VV = 22, LIPH = RR + VV, SLIP = F + RR * Math.PI / 2 + VV, G = 600;
  const E0 = { s: 0, v: 0, face: 1, air: false, h: 0, vy: 0, maxAir: 0, side: 1, kt: false, ktStart: 0, ktApex: -1, ktEarly: false, at: false, atStart: 0, atProg: 0, atDone: -1,
    hp: false, hpT: 0, hpLate: 0, hpSpeed: 0, fall: 0, fallS: 0, started: false, wob: 0, lastV: 0, x: 0, y: 0, rot: 0, trail: 0, botHold: 0, botMode: 0, airFace: 0, clockStop: false };
  function track(s, out) {
    const a = Math.abs(s), sd = sgn(s);
    if (a <= F) { out.x = s; out.y = 0; out.phi = 0; }
    else if (a <= F + RR * Math.PI / 2) { const p = (a - F) / RR; out.x = sd * (F + RR * Math.sin(p)); out.y = -RR * (1 - Math.cos(p)); out.phi = p; }
    else { const v = Math.min(a - F - RR * Math.PI / 2, VV); out.x = sd * (F + RR); out.y = -(RR + v); out.phi = Math.PI / 2; }
    out.sd = sd; return out;
  }
  const TP = { x: 0, y: 0, phi: 0, sd: 1 };
  const ev = {
    key: 'halfpipe', name: 'Half Pipe', place: 'Hollywood', scene: 'hollywood', time: 75, falls: 3, cpuPar: 11000,
    goal: 'NAIL TRICKS · 3 FALLS', help: 'UP/DOWN pump with the ramp · tap toward centre at the top = turn · A at the lip = hand plant',
    labels: { a: 'HAND\nPLANT', b: 'TURN', c: null },
    view: { w: 420, h: 255 }, viewP: { w: 330, h: 400 }, E: {},
    reset(o) { Object.assign(o, E0); o.s = -SLIP; o.face = 1; o.side = -1; return o; },
    start(e) { e.started = true; e.v = 60; },
    toward(e) { return e.side > 0 ? 'left' : 'right'; },
    update(e, dt) {
      if (!e.started) return;
      if (e.fall > 0) { // tumbling down after a bail
        e.fall -= dt; e.s = damp(e.s, 0, 2.5, dt); e.air = false; e.h = 0;
        if (e.fall <= 0) { e.s = 0; e.v = 260 * (e.fallS > 0 ? -1 : 1); e.face = sgn(e.v); e.kt = e.at = e.hp = false; }
        this.pose(e); return;
      }
      const tw = this.toward(e), turnP = In.p[tw] || In.p.b, turnH = In.held[tw] || In.held.b;
      if (e.hp) { // ---- hand plant on the coping
        e.hpT += dt;
        if (!In.held.a) {
          if (e.hpT >= 0.72) {
            const q = clamp((e.hpT - 0.72) / 0.42, 0, 1);
            e.hp = false; e.v = -e.side * Math.max(230, e.hpSpeed * 0.95); e.face = sgn(e.v); e.s = e.side * (SLIP - 1);
            score(400 + 150 * e.hpLate + 150 * q, 'HAND PLANT', e.x, e.y - 60, q > 0.7 ? 2 : 1); Audio.sfx('land');
          } else { e.hp = false; this.wipe(e, 'LET GO TOO EARLY'); }
        } else if (e.hpT > 1.2) { e.hp = false; this.wipe(e, 'HELD TOO LONG'); }
        this.pose(e); return;
      }
      if (e.air) { // ---- airborne above the lip
        e.vy -= G * dt; e.h += e.vy * dt; e.maxAir = Math.max(e.maxAir, e.h - LIPH);
        if (!e.at && !e.hp && turnP) { e.at = true; e.atStart = T.game; e.atProg = 0; e.atDone = -1; Audio.sfx('whoosh'); }
        if (!e.at && In.p.a && e.vy > 0 && e.h - LIPH < 28) { this.plant(e, 1); return; }
        if (e.at && e.atProg < 1) { e.atProg = Math.min(1, e.atProg + dt / 0.42); if (e.atProg >= 1) e.atDone = T.game; }
        if (e.h <= LIPH && e.vy < 0) { // re-entry
          e.air = false; e.h = LIPH; e.s = e.side * SLIP; e.v = -e.side * Math.abs(e.vy) * 0.96;
          if (e.at) {
            e.at = false;
            if (e.atProg < 1) { this.wipe(e, 'UNDER-ROTATED'); return; }
            const q = 0.5 * clamp(e.maxAir / 150, 0, 1) + 0.5 * clamp(1 - (T.game - e.atDone) / 0.5, 0, 1);
            e.face = sgn(e.v); score(400 + 599 * q, 'AERIAL TURN', e.x, e.y - 80, q > 0.55 ? 2 : 1); Audio.sfx('land');
          } else { Audio.sfx('land', 0.6); pop(e.x, e.y - 50, 'FAKIE', '', C.cream); }
        }
      } else { // ---- rolling on the ramp
        track(e.s, TP); e.side = TP.sd;
        const onWall = Math.abs(e.s) > F + 4, up = e.v * e.side > 0;
        let a = -G * Math.sin(TP.phi) * e.side;
        if (onWall) {
          const fakie = e.face !== sgn(e.v) ? 1.45 : 1;
          if ((up && In.held.up) || (!up && In.held.down)) a += sgn(e.v) * 175 * fakie;
          else if ((up && In.held.down) || (!up && In.held.up)) a -= sgn(e.v) * 60;
        }
        a -= e.v * 0.07 + sgn(e.v) * 5;
        e.lastV = e.v; e.v += a * dt; e.s += e.v * dt;
        const hNow = -track(e.s, TP).y;
        // apex on the wall: an engaged kick turn resolves here
        if (onWall && sgn(e.v) !== sgn(e.lastV) && e.kt && e.ktApex < 0) {
          e.ktApex = T.game;
          if (e.ktApex - e.ktStart > 0.8) { e.kt = false; this.wipe(e, 'TURNED TOO SOON'); return; }
          if (e.ktEarly) { e.kt = false; e.face = sgn(e.v); score(100 + 100 * clamp(1 - (e.ktApex - e.ktStart) / 0.6, 0, 1), 'KICK TURN', e.x, e.y - 50, 0); }
        }
        // kick turn: tap toward the centre while climbing; hold through the top for more points
        if (!e.kt && onWall && up && turnP && hNow > 25) { e.kt = true; e.ktStart = T.game; e.ktApex = -1; e.ktEarly = false; Audio.sfx('whoosh', 0.5); }
        if (e.kt) {
          if (!turnH && e.ktApex < 0) e.ktEarly = true;
          else if (!turnH && e.ktApex > 0) {
            e.kt = false; const q1 = clamp(1 - (e.ktApex - e.ktStart) / 0.6, 0, 1), q2 = clamp((T.game - e.ktApex) / 0.4, 0, 1);
            e.face = sgn(e.v); score(100 + 100 * q1 + 100 * q2, 'KICK TURN', e.x, e.y - 50, (q1 + q2) > 1.5 ? 1 : 0);
          } else if (e.ktApex > 0 && T.game - e.ktApex > 0.42) { e.kt = false; this.wipe(e, 'HELD TOO LONG'); return; }
        }
        // hand plant: press A as you reach the lip
        if (!e.kt && In.p.a && onWall && up && hNow > LIPH - 45) { this.plant(e, clamp(1 - (LIPH - hNow) / 45, 0, 1)); return; }
        // launch
        if (Math.abs(e.s) >= SLIP && up) {
          if (e.kt) { e.kt = false; this.wipe(e, 'OVER THE LIP'); return; }
          e.air = true; e.h = LIPH; e.vy = Math.abs(e.v); e.maxAir = 0; e.at = false; e.s = e.side * SLIP; e.airFace = e.face;
          Audio.sfx('whoosh', 0.7); spawn(e.side * (F + RR), -LIPH, 6, C.greyL, 80, 200, 2);
        }
        // speed wobbles
        if (Math.abs(e.v) > 680) { e.wob += dt; if (e.wob > 0.35) { this.wipe(e, 'SPEED WOBBLES'); return; } } else e.wob = Math.max(0, e.wob - dt);
      }
      Audio.setIntensity(clamp(Math.abs(e.v) / 520, 0, 1));
      Audio.amb('bandpass', clamp(Math.abs(e.air ? 0 : e.v) / 900, 0, 0.3), 700 + Math.abs(e.v));
      this.pose(e);
    },
    plant(e, late) { e.hp = true; e.hpT = 0; e.hpLate = late; e.hpSpeed = e.air ? Math.abs(e.vy) : Math.abs(e.v); e.air = false; e.s = e.side * SLIP; e.h = LIPH; e.v = 0; Audio.sfx('kick'); },
    wipe(e, why) { e.fall = 1.5; e.fallS = e.side; e.kt = e.at = e.hp = false; e.air = false; bail(why, e.x, e.y - 30); },
    pose(e) { // world position & board angle for drawing
      if (e.air) { e.x = e.side * (F + RR + 4); e.y = -e.h; e.rot = -e.side * Math.PI / 2; }
      else { track(e.s, TP); e.x = TP.x; e.y = TP.y; e.rot = -TP.sd * TP.phi; }
    },
    idle(e) { this.pose(e); this.sync(e); },
    timeUp(e) { Game.endTurn('time'); },
    camera(e, c, dt, snap) {
      const tx = e.started ? (V.portrait ? clamp(e.x * 0.85, -120, 120) : clamp(e.x * 0.45, -70, 70)) : -150, ty = clamp((e.started ? e.y : -LIPH) * 0.7 - 70, -230, -110);
      if (snap) { c.x = tx; c.y = ty; } else { c.x = damp(c.x, tx, 3, dt); c.y = damp(c.y, ty, 2.5, dt); }
    },
    tilt: 0.08,
    enter(e) {
      const env = showEnv('halfpipe', g => this.build(g));
      setSky('#2a2f8f', '#c86bb0', '#ffb08a', 40, 160, [-120, 70, -300]);
      e.J = buildDude(Game.look); e.board = buildSkateboard(Game.look);
      e.holder = mountRig(env, e.J, e.board); e.board.position.set(0, 0, 0); e.J.root.position.set(0, 0.17, 0);
      SPZ = 0; this.pose(e); this.sync(e);
    },
    build(g) {
      const X = (F + RR) * U, L = LIPH * U, Rm = RR * U, Fm = F * U, DK = 3.4, Z = 4.2;
      const sh = new THREE.Shape();
      sh.moveTo(-X - DK, L); sh.lineTo(-X, L); sh.lineTo(-X, Rm); sh.absarc(-Fm, Rm, Rm, Math.PI, Math.PI * 1.5, false); sh.lineTo(Fm, 0);
      sh.absarc(Fm, Rm, Rm, -Math.PI / 2, 0, false); sh.lineTo(X, L); sh.lineTo(X + DK, L); sh.lineTo(X + DK, -0.5); sh.lineTo(-X - DK, -0.5); sh.closePath();
      const ex = new THREE.ExtrudeGeometry(sh, { depth: Z * 2, bevelEnabled: false, curveSegments: 28 }); ex.translate(0, 0, -Z);
      const mb = new MB(); mb.add(ex, '#c9bce6');
      for (let i = 1; i < 12; i++) { const a = i / 12 * Math.PI / 2; for (const sd of [-1, 1]) mb.add(place(GG.box(0.04, 0.03, Z * 2), sd * (Fm + Math.sin(a) * (Rm - 0.01)), Rm - Math.cos(a) * (Rm - 0.01), 0, 0, 0, sd * a), '#8f7fc0', false); }
      for (let i = -2; i <= 2; i++) mb.add(place(GG.box(0.03, 0.02, Z * 2), i * 0.6, 0.012, 0), '#8f7fc0', false);
      // painted side panel (front cap) with graffiti
      const tex = texCanvas(1024, 320, (c, w, h) => { c.fillStyle = '#5b3fa0'; c.fillRect(0, 0, w, h); c.fillStyle = '#4a3388'; for (let i = 0; i < 30; i++) c.fillRect(i * 36, 0, 3, h);
        c.save(); c.translate(w / 2, h * 0.62); c.rotate(-0.06); c.font = 'italic 900 120px Impact,Arial Black'; c.textAlign = 'center'; c.lineWidth = 16; c.strokeStyle = INK; c.strokeText('RAD!', 0, 0); c.fillStyle = '#ff5fa2'; c.fillText('RAD!', 0, 0);
        c.font = 'italic 900 40px Impact,Arial Black'; c.lineWidth = 8; c.strokeText('HOLLYWOOD HILLS JAM', 0, 66); c.fillStyle = '#9fe8ff'; c.fillText('HOLLYWOOD HILLS JAM', 0, 66); c.restore();
        c.fillStyle = '#ffd23c'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(rng() * w, rng() * h, 2 + rng() * 4, 0, TAU); c.fill(); } });
      tex.repeat.set(1 / (2 * (X + DK)), 1 / (L + 0.5)); tex.offset.set(0.5, 0.5 / (L + 0.5));
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(sh, 28), toonMat({ map: tex, vertexColors: false })); cap.position.z = Z + 0.01; g.add(cap);
      // coping, decks, rails, braces
      for (const s of [-1, 1]) {
        mb.add(place(GG.cyl(0.1, 0.1, Z * 2, 10), s * X, L, 0, 0, Math.PI / 2), '#d1d8e0');
        mb.add(place(GG.box(DK, 0.12, Z * 2), s * (X + DK / 2), L + 0.06, 0), '#8a5a32');
        mb.add(place(GG.box(0.08, 1.0, 0.08), s * (X + DK - 0.1), L + 0.5, Z - 0.1), '#ffd23c'); mb.add(place(GG.box(0.08, 1.0, 0.08), s * (X + DK - 0.1), L + 0.5, -Z + 0.1), '#ffd23c');
        mb.add(place(GG.box(0.08, 0.08, Z * 2), s * (X + DK - 0.1), L + 1.0, 0), '#ff5fa2');
        mbCrowd(mb, s * (X + DK + 1.5) - 2, s * (X + DK + 1.5) + 2, 0, -3, 22, s > 0 ? 3 : 4);
        mb.add(place(GG.box(5, 0.5, 4), s * (X + DK + 1.5), 0.25, -2), '#57606f'); mb.add(place(GG.box(5, 0.5, 2.6), s * (X + DK + 1.5), 0.75, -2.6), '#8a8fa3');
      }
      // ground, hills, city, palms, SO CAL letters
      mb.add(place(GG.box(220, 1, 60), 0, -1, -10), '#e0a96d', false);
      mb.add(place(GG.box(220, 0.05, 6), 0, -0.48, 7), '#5c5470', false);
      srand(11); for (let i = 0; i < 9; i++) mb.add(place(GG.sph(18 + rng() * 14, 9 + rng() * 9, 10, 14, 8), -90 + i * 24, -2, -70 - rng() * 20), i & 1 ? '#7b3f8c' : '#8f4c9c', false);
      for (let i = 0; i < 16; i++) { const w = 3 + rng() * 4, h = 6 + rng() * 14; mbBuilding(mb, -60 + i * 8 + rng() * 2, 0, -46 - rng() * 8, w, h, 4, ['#ff9f1c', '#2fd3ff', '#ff5fa2', '#fff6dc', '#9dff6b'][i % 5], '#3a2f5a', '#2f5bd3'); }
      for (let i = 0; i < 10; i++) mbPalm(mb, -40 + i * 9 + rng() * 3, 0, -16 - rng() * 10, 1 + rng() * 0.4, rng() - 0.5, false);
      'SO CAL'.split('').forEach((ch, i) => { if (ch !== ' ') signMesh(g, ch, '#fff6dc', '#fff6dc', '#fff6dc', -20 + i * 4.2, 15 + Math.sin(i) * 0.6, -66, 3.6, 0); });
      mb.build(g);
      signMesh(g, 'RADICAL WAX CO.', '#14101f', '#ffd23c', '#ff5fa2', -X - DK / 2, L + 0.72, Z - 0.05, 3.1, 0);
      signMesh(g, 'PACIFIC SYNTH TAPES', '#14101f', '#9fe8ff', '#2fd3ff', X + DK / 2, L + 0.72, Z - 0.05, 3.1, 0);
      signMesh(g, 'MALIBU NEON SODA', '#ffd23c', '#ff3d6e', '#14101f', 0, 9.2, -20, 7, 0, 'OFFICIAL DRINK OF THE JAM');
    },
    sync(e) {
      const h = e.holder, J = e.J; if (!h) return;
      h.position.set(e.x * U, -e.y * U, 0); h.rotation.set(0, 0, -e.rot);
      J.tilt.rotation.set(0, 0, 0); e.board.rotation.set(0, 0, 0); e.board.position.set(0, 0, 0); J.root.position.set(0, 0.17, 0);
      let yaw = e.face * 0.38;
      if (!e.started) { h.position.set(-(F + RR + 55) * U, LIPH * U + 0.06, 0); h.rotation.set(0, 0, 0); poseDude(J, 'stand', T.real); J.root.rotation.y = 0.5; e.board.position.set(0.55, 0, 0.2); e.board.rotation.set(0, 0.3, 1.2); return; }
      if (e.fall > 0) { poseDude(J, 'tumble', T.real); J.tilt.rotation.z = T.real * 7; e.board.position.set(-0.6, 0.3, 0.3); e.board.rotation.set(T.real * 5, 0, T.real * 9); }
      else if (e.hp) { const k = clamp(e.hpT / 0.95, 0, 1), arc = Math.sin(k * Math.PI);
        poseDude(J, 'plant', T.real); J.tilt.rotation.z = Math.PI * (0.2 + 0.8 * arc) * (e.side > 0 ? 1 : -1); J.root.position.set(0, 0.15, 0); J.tilt.position.set(0, 0, 0);
        J.root.position.y = 0.1; e.board.position.set(0, -0.2 + arc * 1.9, 0); e.board.rotation.set(0, 0, arc * Math.PI * (e.side > 0 ? 1 : -1)); }
      else if (e.air) { poseDude(J, e.at ? 'grab' : 'board', T.real, e.at ? 1 : 0.6); if (e.at) yaw = e.airFace * 0.38 + Math.PI * e.atProg; }
      else if (e.kt) { poseDude(J, 'board', T.real, 0.9); yaw = e.face * 0.38 + Math.PI * clamp((T.game - e.ktStart) / 0.3, 0, 1); }
      else poseDude(J, 'board', T.real, (In.held.down || In.held.up) && !R.demo ? 1 : 0.35);
      J.root.rotation.y = yaw; if (!e.hp && e.fall <= 0) e.board.rotation.y = yaw - e.face * 0.38;
      J.flash.value = Math.max(0, T.flash * 0.6);
    },
    hud(g, e, x, y, w) { // speed meter
      const v = Math.abs(e.air ? e.vy : e.v), k = clamp(v / 740, 0, 1);
      g.fillStyle = 'rgba(26,15,36,0.7)'; g.fillRect(x, y, w, 10); g.fillStyle = k > 0.91 ? C.coral : k > 0.65 ? C.yel : C.teal; g.fillRect(x, y, w * k, 10);
      g.fillStyle = C.coral; g.fillRect(x + w * 0.914, y, 2, 10);
      g.fillStyle = C.cream; g.font = 'bold 11px Trebuchet MS,Verdana'; g.textAlign = 'left'; g.fillText('SPEED', x, y - 3);
    },
    bot(e, dt) {
      const B = bot.held; B.up = B.down = B.left = B.right = B.a = B.b = false;
      if (!e.started) { bot.latch.a = true; return; }
      if (e.fall > 0) return;
      const tw = e.side > 0 ? 'left' : 'right';
      if (e.hp) { B.a = e.hpT < 0.98; return; }
      if (e.air) {
        const tLand = (e.vy + Math.sqrt(Math.max(0, e.vy * e.vy + 2 * G * (e.h - LIPH)))) / G;
        if (!e.at && e.vy < 0 && tLand < 0.62 && tLand > 0.46) bot.latch[tw] = true;
        return;
      }
      track(e.s, TP); const h = -TP.y, up = e.v * e.side > 0, onWall = Math.abs(e.s) > F + 4;
      if (onWall) { if (up) B.up = true; else B.down = true; }
      if (Math.abs(e.v) > 530) { B.up = B.down = false; }
      if (onWall && up) {
        const vv = Math.abs(e.v), apexH = h + vv * vv / (2 * G);
        if (apexH < LIPH - 4) { if (!e.kt && apexH - h < 22) { bot.latch[tw] = true; B[tw] = true; } }
        else if (apexH < LIPH + 40 && h > LIPH - 20 && !e.kt && (R.stunts % 2 === 0)) { bot.latch.a = true; B.a = true; }
      }
      if (e.kt) { B[tw] = !(e.ktApex > 0 && T.game - e.ktApex > 0.3); }
    }
  };
  EVENTS.push(ev);
})();
