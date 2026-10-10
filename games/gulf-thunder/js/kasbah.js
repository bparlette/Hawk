'use strict';
/* GULF THUNDER - stage 4: KASBAH ROOFTOPS (vertical climb & shootout) */
(function () {
  const R = GT.R, rnd = GT.rnd, clamp = GT.clamp, sgn = GT.sgn;
  const WH = 1560; // world height
  const PADX = 40;

  function buildLevel() {
    const r = GT.srand(4242);
    const plats = [{ x: -40, y: WH - 40, w: 350, kind: 'ground', solid: true }];
    const en = [], lan = [], crates = [], covers = [];
    let prev = { x: 20, w: 230 };
    let k = 0, lastY = WH - 86;
    for (let y = WH - 86; y > 200; y -= 44, k++) {
      lastY = y;
      // main platform overlapping previous main
      let w = 70 + Math.floor(r() * 50);
      let x;
      if (k % 2 === 0) x = clamp(prev.x + prev.w - 34 - Math.floor(r() * 10), 8, 262 - w);
      else x = clamp(prev.x - w + 34 + Math.floor(r() * 10), 8, 262 - w);
      if (x + w < prev.x + 26) x = prev.x + 26 - w; if (x > prev.x + prev.w - 26) x = prev.x + prev.w - 26;
      x = clamp(x, 8, 262 - w);
      const kinds = ['roof', 'awning', 'roof', 'stall'];
      const p = { x, y, w, kind: kinds[k % 4], main: true, row: k };
      plats.push(p);
      // side ledge with an enemy every other row
      if (k % 2 === 1 && k > 0) {
        const sx = x > 135 ? 8 : 190, sw = 72;
        const sp = { x: sx, y: y - 6, w: sw, kind: 'roof', row: k };
        if (Math.abs((sx + sw / 2) - (x + w / 2)) > 90) { plats.push(sp); en.push({ x: sx + sw / 2, y: sp.y, plat: sp, kind: k % 4 === 1 ? 'gunman' : 'gunman2' }); lan.push({ x: sx + sw / 2 + rnd(-10, 10), y: sp.y - 56 }); if (k % 3 === 0) covers.push({ x: x + (x > 135 ? 8 : w - 18), y, w: 10 }); }
      }
      if (k % 3 === 2) crates.push({ x: x + w / 2 + (k % 2 ? -18 : 18), y, hp: 2 });
      if (k % 4 === 3) en.push({ x: x + w / 2, y, plat: p, kind: 'gunman' });
      prev = p;
    }
    // top arena
    const topY = lastY - 44;
    const arena = { x: 4, y: topY, w: 262, kind: 'top', solid: false, row: 99 };
    plats.push(arena);
    lan.push({ x: 60, y: topY - 70 }, { x: 135, y: topY - 80 }, { x: 210, y: topY - 70 });
    covers.push({ x: 40, y: topY, w: 12 }, { x: 220, y: topY, w: 12 });
    return { plats, en, lan, crates, covers, arena, topY };
  }

  function paintFar(g, w, h) {
    // dusk sky with stars and the old city skyline (parallax)
    GT.grad(g, 0, 0, w, h, ['#1a1438', '#241a48', '#33205a', '#4a2a66', '#6a3466', '#8e3e5c', '#c05a4a', '#e8843c', '#f0a048']);
    const r = GT.srand(9);
    for (let i = 0; i < 160; i++) R(g, r() * w, r() * h * 0.55, 1, 1, r() < 0.3 ? '#fff' : '#a8a0d0');
    const base = h - 40;
    // gate with horseshoe arch
    R(g, 10, base - 150, 120, 150, '#3a3058'); R(g, 10, base - 150, 120, 4, '#5a4a78');
    for (let x = 10; x < 130; x += 8) R(g, x, base - 156, 5, 6, '#3a3058');
    GT.circ(g, 70, base - 70, 26, '#e8843c'); R(g, 44, base - 70, 53, 70, '#e8843c'); GT.circ(g, 70, base - 70, 20, '#f0a048');
    for (let i = 0; i < 6; i++) R(g, 20, base - 140 + i * 12, 100, 1, '#2e7a8a');
    // domes
    GT.circ(g, 170, base - 120, 34, '#4a3a60'); R(g, 134, base - 120, 72, 120, '#4a3a60'); R(g, 169, base - 162, 2, 10, '#c8a040');
    // minaret
    const mx = 220;
    R(g, mx, base - 330, 44, 330, '#5a4468'); R(g, mx, base - 330, 3, 330, '#6a5478');
    for (let y = base - 320; y < base - 60; y += 40) { R(g, mx + 14, y, 16, 22, '#2a2040'); GT.circ(g, mx + 22, y, 8, '#2a2040'); }
    for (let y = base - 300; y < base; y += 14) for (let x = mx + 4; x < mx + 40; x += 8) R(g, x, y, 4, 1, '#3e8a96');
    R(g, mx - 4, base - 340, 52, 12, '#6a5478'); for (let x = mx - 4; x < mx + 48; x += 8) R(g, x, base - 348, 5, 8, '#6a5478');
    R(g, mx + 8, base - 390, 28, 50, '#5a4468'); GT.circ(g, mx + 22, base - 392, 12, '#6a5478'); R(g, mx + 21, base - 412, 2, 12, '#c8a040'); GT.circ(g, mx + 22, base - 414, 2, '#e8c060');
    R(g, 0, base, w, 40, '#2a2040');
  }
  function paintNear(g, L) {
    g.translate(PADX, 0);
    const r = GT.srand(77);
    // side walls (alley walls framing the climb)
    for (let y = 0; y < WH; y += 2) {
      const lw = 4 + Math.round(Math.sin(y * 0.013) * 3), rw = 4 + Math.round(Math.cos(y * 0.011) * 3);
      R(g, -PADX, y, PADX + lw, 2, '#7a5034'); R(g, 270 - rw, y, PADX + rw, 2, '#6e4830');
    }
    // string lights / flags between walls
    for (let y = WH - 140; y > 220; y -= 132) {
      for (let x = 0; x < 270; x += 2) { const yy = y + Math.round(Math.sin(x / 270 * Math.PI) * 16); R(g, x, yy, 2, 1, '#2a1a10'); if (x % 22 === 0) { R(g, x, yy + 1, 6, 8, ['#c83a3a', '#3a7ab0', '#3aa060', '#e0b040', '#a050a0'][(x / 22) % 5 | 0]); } if (x % 30 === 15) { R(g, x, yy + 1, 2, 2, '#ffe890'); } }
    }
    for (const p of L.plats) {
      if (p.kind === 'ground') {
        R(g, -PADX, p.y, 270 + PADX * 2, 60, '#8a5a38'); R(g, -PADX, p.y, 270 + PADX * 2, 3, '#b07a4a');
        for (let x = -PADX; x < 270 + PADX; x += 14) R(g, x, p.y + 4 + (x % 28 ? 0 : 8), 12, 6, '#7a4e30');
        // market stalls at street level
        for (const [sx, col] of [[10, '#b03a3a'], [100, '#3a6ab0'], [190, '#c08a2a']]) {
          for (let i = 0; i < 10; i++) R(g, sx - i, p.y - 64 + i, 70 + i * 2, 1, i % 2 ? '#e8dcc0' : col);
          R(g, sx, p.y - 54, 2, 54, '#5a3418'); R(g, sx + 68, p.y - 54, 2, 54, '#5a3418');
          R(g, sx + 6, p.y - 44, 56, 30, ['#a02828', '#2a4a8a', '#8a5a1a'][(sx / 90) | 0]); for (let k = 0; k < 6; k++) R(g, sx + 10 + k * 9, p.y - 40, 4, 22, '#e8c060');
          R(g, sx + 4, p.y - 14, 62, 14, '#7a4a28'); for (let k = 0; k < 4; k++) GT.circ(g, sx + 14 + k * 14, p.y - 18, 4, ['#c86a2a', '#a04a20', '#d89040'][k % 3]);
        }
        continue;
      }
      if (p.kind === 'top') {
        R(g, p.x, p.y, p.w, 90, '#a87048'); R(g, p.x, p.y, p.w, 4, '#d0a070'); for (let x = p.x; x < p.x + p.w; x += 10) R(g, x, p.y - 8, 6, 8, '#a87048');
        for (let x = p.x + 20; x < p.x + p.w - 20; x += 46) { R(g, x, p.y + 20, 18, 30, '#3a2418'); GT.circ(g, x + 9, p.y + 20, 9, '#3a2418'); }
        R(g, 100, p.y + 12, 70, 34, '#7a1e1e'); R(g, 102, p.y + 14, 66, 30, '#a83030'); for (let k = 0; k < 5; k++) R(g, 110 + k * 12, p.y + 20, 6, 18, '#e0b040');
        continue;
      }
      // building block under the rooftop
      const h = 40;
      const wall = p.kind === 'stall' ? '#6a4024' : (p.row % 3 === 0 ? '#b07a4c' : p.row % 3 === 1 ? '#a06a40' : '#c08858');
      if (p.kind === 'awning') {
        for (let i = 0; i < 8; i++) R(g, p.x - 2 + i, p.y + i, p.w + 4 - i * 2, 1, i % 2 ? '#e8dcc0' : ['#c83a3a', '#3a7ab0', '#3aa060'][p.row % 3]);
        R(g, p.x + 2, p.y + 8, 2, 30, '#5a3418'); R(g, p.x + p.w - 4, p.y + 8, 2, 30, '#5a3418');
        // hanging rug
        const rx = p.x + p.w / 2 - 12; R(g, rx, p.y + 9, 24, 30, '#8a2020'); R(g, rx + 2, p.y + 11, 20, 26, '#b03a2a'); R(g, rx + 8, p.y + 16, 8, 14, '#e0b040'); R(g, rx + 10, p.y + 19, 4, 8, '#2a4a8a');
      } else if (p.kind === 'stall') {
        R(g, p.x, p.y, p.w, 5, '#8a5a30'); R(g, p.x, p.y, p.w, 1, '#c08a50');
        R(g, p.x + 3, p.y + 5, 3, h, '#5a3418'); R(g, p.x + p.w - 6, p.y + 5, 3, h, '#5a3418');
        for (let x = p.x + 8; x < p.x + p.w - 10; x += 12) { R(g, x, p.y + 6, 9, 14, ['#c83a3a', '#e0b040', '#3a7ab0', '#a050a0'][(x / 12) % 4 | 0]); R(g, x + 2, p.y + 8, 5, 10, '#ffffff33'); }
      } else {
        R(g, p.x, p.y, p.w, h, wall); R(g, p.x, p.y, p.w, 3, '#e0b080'); R(g, p.x, p.y + 3, p.w, 1, '#7a4a2a');
        for (let i = 0; i < p.w * h / 120; i++) R(g, p.x + 2 + r() * (p.w - 8), p.y + 6 + r() * (h - 10), 5, 1, '#00000022');
        for (let x = p.x + 10; x < p.x + p.w - 14; x += 28) { R(g, x, p.y + 14, 9, 14, '#2a1a12'); GT.circ(g, x + 4, p.y + 14, 4, '#2a1a12'); if (r() < 0.4) R(g, x + 2, p.y + 18, 5, 8, '#ffd070'); }
        R(g, p.x, p.y + h - 2, p.w, 2, '#5a3820');
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  GT.Stage4 = function () {
    const S = GT.S;
    const L = buildLevel();
    const far = GT.mk(270 + PADX * 2, 1000); paintFar(far.getContext('2d'), far.width, far.height);
    const near = GT.mk(270 + PADX * 2, WH + 60); paintNear(near.getContext('2d'), L);
    const st = { t: 0, camY: WH - 480, fx: new GT.FX(), shots: [], eshots: [], items: [], booms: [], phase: 'play', endT: 0, banner: null, bannerT: 0, boss: null };
    const P = { x: 40, y: WH - 40, vx: 0, vy: 0, on: L.plats[0], face: 1, crouch: false, hp: 100, inv: 2, cd: 0, dyn: 4, t: 0, dead: 0, drop: 0, lastSafe: null };
    const en = L.en.map(d => ({ x: d.x, y: d.y, plat: d.plat, look: d.kind, hp: d.kind === 'gunman2' ? 10 : 8, face: -1, t: rnd(0, 2), fireT: rnd(1, 2.5), vx: 22 * (Math.random() < 0.5 ? -1 : 1), flash: 0, s: 'walk', aim: d.kind === 'gunman2' }));
    const lan = L.lan.map(l => ({ x: l.x, y: l.y, vy: 0, falling: false, gone: false }));
    const crates = L.crates.map(c => Object.assign({ flash: 0 }, c));
    const covers = L.covers;
    function banner(s, d) { st.banner = s; st.bannerT = d || 2; }

    function platUnder(x, yPrev, yNow) {
      for (const p of L.plats) {
        if (x < p.x - 3 || x > p.x + p.w + 3) continue;
        if (yPrev <= p.y + 0.5 && yNow >= p.y) return p;
      }
      return null;
    }
    function hurtPlayer(d) {
      if (GT.god || P.inv > 0 || P.dead > 0) return;
      P.hp -= d; P.inv = 1; GT.sfx('hurt'); GT.shake(4); st.fx.hit(P.x, P.y - 20);
      if (P.hp <= 0) { P.hp = 0; P.dead = 1.6; P.vy = -200; P.on = null; GT.sfx('die'); }
    }
    function boom(x, y, r, dmg) {
      st.fx.boom(x, y, r / 24);
      for (const e of en) if (!e.dead && Math.hypot(e.x - x, e.y - 14 - y) < r) killE(e, dmg);
      if (st.boss && !st.boss.dead && Math.hypot(st.boss.x - x, st.boss.y - 16 - y) < r + 6) dmgBoss(dmg);
      for (const c of crates) if (!c.gone && Math.hypot(c.x - x, c.y - 8 - y) < r) { c.hp = 0; setTimeout(() => explodeCrate(c), 100 / GT.speed); }
      if (Math.hypot(P.x - x, P.y - 16 - y) < r * 0.75) hurtPlayer(12);
    }
    function explodeCrate(c) { if (c.gone) return; c.gone = true; GT.addScore(300); boom(c.x, c.y - 8, 38, 30); if (Math.random() < 0.6) st.items.push({ x: c.x, y: c.y, k: Math.random() < 0.5 ? 'food' : 'D', t: 0, vy: -120 }); }
    function killE(e, dmg) {
      e.hp -= dmg; e.flash = 0.08;
      if (e.hp <= 0 && !e.dead) {
        e.dead = true; e.deadT = 0; GT.addScore(500); st.fx.pop(e.x, e.y - 40, '500', '#ffe070'); GT.sfx('hit');
        if (Math.random() < 0.35) st.items.push({ x: e.x, y: e.y, k: Math.random() < 0.6 ? 'D' : 'food', t: 0, vy: -100 });
      }
    }
    function dmgBoss(d) { const b = st.boss; if (!b || b.dead) return; b.hp -= d; b.flash = 0.06; GT.addScore(d * 10); if (b.hp <= 0) { b.hp = 0; b.dead = true; b.deadT = 0; GT.addScore(8000); banner('THE BROKER IS DOWN!', 3); st.eshots.length = 0; } }

    function spawnBoss() {
      st.boss = { x: 200, y: L.topY, vy: 0, on: true, hp: 160, max: 160, face: -1, t: 0, fireT: 1.5, jumpT: 3, gT: 4, flash: 0, s: 'walk', name: 'THE GUN BROKER' };
      banner('THE GUN BROKER!', 2); GT.music('boss');
    }

    function update(dt) {
      st.t += dt; if (st.bannerT > 0) st.bannerT -= dt;
      const inp = GT.inp;
      // ---- player ----
      if (P.dead > 0) {
        P.dead -= dt; P.vy += 900 * dt; P.y += P.vy * dt;
        if (P.dead <= 0) {
          if (!GT.loseLife()) return;
          P.hp = 100; P.inv = 2.5; P.vy = 0;
          const s = P.lastSafe || L.plats[0]; P.x = s.x + s.w / 2; P.y = s.y; P.on = s;
        }
      } else if (st.phase === 'play' || st.phase === 'end') {
        P.t += dt; P.inv -= dt; P.cd -= dt; P.drop -= dt;
        const ctrl = st.phase === 'play';
        P.crouch = ctrl && P.on && inp.y > 0.5;
        const mv = ctrl && !P.crouch ? inp.x : 0;
        P.vx = mv * 92;
        if (Math.abs(mv) > 0.2) P.face = sgn(mv);
        if (ctrl && inp.jumpP && P.on) {
          if (inp.y > 0.5 && P.on.kind !== 'ground' && P.on.kind !== 'top') { P.drop = 0.25; P.on = null; P.y += 2; }
          else { P.vy = -318; P.on = null; GT.sfx('jump'); }
        }
        const prevY = P.y;
        P.x = clamp(P.x + P.vx * dt, 8, 262);
        if (!P.on) {
          P.vy = Math.min(420, P.vy + 900 * dt); P.y += P.vy * dt;
          if (P.vy > 0 && P.drop <= 0) { const p = platUnder(P.x, prevY, P.y); if (p) { P.y = p.y; P.vy = 0; P.on = p; GT.sfx('land'); if (p.kind !== 'ground') P.lastSafe = p; } }
          if (P.y > WH - 40) { P.y = WH - 40; P.vy = 0; P.on = L.plats[0]; }
        } else if (P.x < P.on.x - 3 || P.x > P.on.x + P.on.w + 3) { P.on = null; P.vy = 0; }
        // shooting
        if (ctrl && inp.fire && P.cd <= 0) {
          P.cd = 0.2; GT.sfx('pistol');
          const up = inp.y < -0.5;
          if (up) st.shots.push({ x: P.x + P.face * 3, y: P.y - 40, vx: 0, vy: -330, t: 0 });
          else st.shots.push({ x: P.x + P.face * 4, y: P.y - (P.crouch ? 15 : 23), vx: P.face * 330, vy: 0, t: 0 });
        }
        if (ctrl && inp.specP && P.dyn > 0) { P.dyn--; st.booms.push({ x: P.x, y: P.y - 26, vx: P.face * 120, vy: -230, t: 0 }); GT.sfx('jump'); }
      }
      // camera: follow
      const target = clamp(P.y - 300, 0, WH - 480);
      st.camY += (target - st.camY) * Math.min(1, dt * 4);
      // ---- player bullets ----
      for (const s of st.shots) {
        s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.t > 1.2 || s.x < -10 || s.x > 280) { s.dead = true; continue; }
        for (const e of en) if (!e.dead && Math.abs(e.x - s.x) < 9 && s.y > e.y - 32 && s.y < e.y) { s.dead = true; killE(e, 4); st.fx.hit(s.x, s.y); GT.sfx('punch'); break; }
        if (s.dead) continue;
        const b = st.boss;
        if (b && !b.dead && Math.abs(b.x - s.x) < 9 && s.y > b.y - 36 && s.y < b.y) { s.dead = true; dmgBoss(4); st.fx.hit(s.x, s.y); continue; }
        for (const l of lan) if (!l.gone && !l.falling && Math.abs(l.x - s.x) < 6 && Math.abs(l.y + 5 - s.y) < 8) { s.dead = true; l.falling = true; GT.sfx('break'); st.fx.spark(l.x, l.y, 6, '#ffe070'); break; }
        if (s.dead) continue;
        for (const c of crates) if (!c.gone && Math.abs(c.x - s.x) < 9 && s.y > c.y - 16 && s.y < c.y) { s.dead = true; c.hp--; c.flash = 0.08; if (c.hp <= 0) explodeCrate(c); break; }
        if (s.dead) continue;
        for (const cv of covers) if (s.x > cv.x && s.x < cv.x + cv.w && s.y > cv.y - 14 && s.y < cv.y) { s.dead = true; st.fx.spark(s.x, s.y, 2); break; }
      }
      st.shots = st.shots.filter(s => !s.dead);
      // dynamite
      for (const b of st.booms) {
        b.t += dt; b.vy += 600 * dt; const py = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < 6 || b.x > 264) b.vx = -b.vx;
        const p = b.vy > 0 ? platUnder(b.x, py, b.y) : null;
        if (p) { b.y = p.y - 2; b.vy = -b.vy * 0.3; b.vx *= 0.6; }
        if (Math.random() < 0.5) st.fx.spark(b.x, b.y - 3, 1, '#ffd060');
        if (b.t > 1.1) { b.dead = true; boom(b.x, b.y, 40, 30); }
      }
      st.booms = st.booms.filter(b => !b.dead);
      // lanterns
      for (const l of lan) {
        if (!l.falling || l.gone) continue;
        const py = l.y; l.vy += 700 * dt; l.y += l.vy * dt;
        let hit = false;
        for (const e of en) if (!e.dead && Math.abs(e.x - l.x) < 12 && l.y > e.y - 30 && l.y < e.y + 4) hit = true;
        if (st.boss && !st.boss.dead && Math.abs(st.boss.x - l.x) < 14 && l.y > st.boss.y - 34 && l.y < st.boss.y + 2) hit = true;
        if (hit || platUnder(l.x, py + 10, l.y + 10)) {
          l.gone = true;
          st.fx.boom(l.x, l.y, 1.0);
          for (let i = 0; i < 8; i++) st.fx.p.push({ k: 'ball', x: l.x + rnd(-16, 16), y: l.y + rnd(-6, 4), vx: rnd(-10, 10), vy: -10, r: rnd(3, 5), t: 0, life: rnd(0.4, 0.8), d: rnd(0, 0.3) });
          for (const e of en) if (!e.dead && Math.abs(e.x - l.x) < 30 && Math.abs(e.y - l.y) < 40) killE(e, 20);
          if (st.boss && !st.boss.dead && Math.abs(st.boss.x - l.x) < 32 && Math.abs(st.boss.y - l.y) < 44) dmgBoss(25);
        }
        if (l.y > WH) l.gone = true;
      }
      // ---- enemies ----
      for (const e of en) {
        if (e.dead) { e.deadT += dt; continue; }
        e.t += dt; e.flash -= dt;
        const sameLevel = Math.abs(P.y - e.y) < 30;
        const near = Math.abs(P.y - e.y) < 260 && e.y > st.camY - 10 && e.y < st.camY + 490;
        if (sameLevel && near && Math.abs(P.x - e.x) < 220) {
          e.face = P.x > e.x ? 1 : -1; e.s = 'aim';
        } else {
          e.s = 'walk';
          e.x += e.vx * dt;
          if (e.x < e.plat.x + 6 || e.x > e.plat.x + e.plat.w - 6) { e.vx = -e.vx; e.x = clamp(e.x, e.plat.x + 6, e.plat.x + e.plat.w - 6); }
          e.face = sgn(e.vx);
        }
        e.fireT -= dt;
        if (near && e.fireT <= 0 && P.dead <= 0 && st.phase === 'play') {
          if (e.aim && !sameLevel && P.y > e.y - 120) { e.fireT = 2.2; const a = Math.atan2(P.y - 20 - (e.y - 22), P.x - e.x); st.eshots.push({ x: e.x + Math.cos(a) * 10, y: e.y - 22, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, t: 0 }); e.fire = 0.2; GT.sfx('eshot'); }
          else if (sameLevel) { e.fireT = rnd(1.4, 2.2); st.eshots.push({ x: e.x + e.face * 12, y: e.y - 22, vx: e.face * 130, vy: 0, t: 0 }); e.fire = 0.2; GT.sfx('eshot'); }
        }
        e.fire = (e.fire || 0) - dt;
      }
      // ---- boss ----
      const b = st.boss;
      if (b) {
        b.t += dt; b.flash -= dt;
        if (b.dead) {
          b.deadT += dt;
          if (Math.random() < 0.2) st.fx.boom(b.x + rnd(-10, 10), b.y - rnd(0, 30), 0.6);
          if (b.deadT > 1.5 && st.phase === 'play') { st.phase = 'end'; st.endT = 0; }
        } else {
          if (b.on) {
            b.x += b.face * 40 * dt * (b.s === 'walk' ? 1 : 0);
            if (b.x < 30 || b.x > 240) b.face = -b.face;
            b.jumpT -= dt;
            if (b.jumpT <= 0) { b.jumpT = rnd(2.5, 4); b.vy = -260; b.on = false; }
          } else {
            b.vy += 900 * dt; b.y += b.vy * dt; b.x = clamp(b.x + b.face * 50 * dt, 20, 250);
            if (b.y >= L.topY) { b.y = L.topY; b.on = true; b.vy = 0; }
          }
          b.fireT -= dt;
          if (b.fireT <= 0 && P.dead <= 0) {
            b.fireT = b.hp < b.max / 2 ? 1.1 : 1.6; b.s = 'shoot'; b.face = P.x > b.x ? 1 : -1;
            for (let i = 0; i < 3; i++) setTimeout(() => { if (!b.dead && GT.scene === st.scene) { const a = Math.atan2(P.y - 22 - (b.y - 24), P.x - b.x); st.eshots.push({ x: b.x + b.face * 12, y: b.y - 24, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, t: 0 }); GT.sfx('eshot'); } }, i * 130 / GT.speed);
            setTimeout(() => { b.s = 'walk'; }, 500 / GT.speed);
          }
          if (b.hp < b.max / 2) { b.gT -= dt; if (b.gT <= 0) { b.gT = 3.5; st.eshots.push({ x: b.x, y: b.y - 30, vx: (P.x - b.x) * 0.9, vy: -220, t: 0, g: true }); } }
        }
      }
      // ---- enemy shots ----
      for (const s of st.eshots) {
        s.t += dt; if (s.g) s.vy += 500 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.t > 3 || s.x < -10 || s.x > 280) { s.dead = true; continue; }
        if (s.g) { if (s.t > 0.3 && platUnder(s.x, s.y - s.vy * dt, s.y)) { s.dead = true; boom(s.x, s.y, 30, 0); } continue; }
        for (const cv of covers) if (s.x > cv.x && s.x < cv.x + cv.w && s.y > cv.y - 14 && s.y < cv.y) { s.dead = true; st.fx.spark(s.x, s.y, 3); break; }
        if (s.dead) continue;
        const top = P.crouch ? P.y - 14 : P.y - 32;
        if (P.dead <= 0 && Math.abs(s.x - P.x) < 6 && s.y > top && s.y < P.y) { s.dead = true; hurtPlayer(9); }
      }
      st.eshots = st.eshots.filter(s => !s.dead);
      // items
      for (const it of st.items) {
        it.t += dt;
        if (!it.landed) { const py = it.y; it.vy += 600 * dt; it.y += it.vy * dt; const p = it.vy > 0 ? platUnder(it.x, py, it.y) : null; if (p) { it.y = p.y; it.landed = true; } if (it.y > WH - 40) { it.y = WH - 40; it.landed = true; } }
        if (P.dead <= 0 && Math.abs(it.x - P.x) < 12 && Math.abs(it.y - P.y) < 20) {
          it.dead = true; GT.sfx('pickup');
          if (it.k === 'food') { P.hp = Math.min(100, P.hp + 35); st.fx.pop(it.x, it.y - 20, '+HEALTH', '#80ff90'); } else { P.dyn = Math.min(9, P.dyn + 2); st.fx.pop(it.x, it.y - 20, '+DYNAMITE', '#ffb060'); }
        }
      }
      st.items = st.items.filter(i => !i.dead);
      for (const c of crates) c.flash -= dt;
      // reaching the top
      if (!st.boss && st.phase === 'play' && P.on === L.arena) spawnBoss();
      st.fx.update(dt);
      if (st.phase === 'end') {
        st.endT += dt;
        if (st.endT > 0.5 && !st.said) { st.said = true; banner('STAGE CLEAR!', 4); GT.sfx('clear'); GT.music(null); }
        if (st.endT > 3.8) GT.stageClear();
      }
    }

    function drawMan(g, look, pose, x, y, face, flash, blink) {
      if (blink) return;
      const c = GT.man(look, pose);
      GT.draw(g, c, x, y, face < 0, 24, GT.manAY(c), flash);
    }
    function draw(g) {
      const v = GT.view();
      const cy = Math.round(st.camY);
      // sky: fixed gradient with parallax skyline
      const fy = Math.round(-580 + (1 - st.camY / (WH - 480)) * 220);
      g.drawImage(far, -PADX, fy);
      if (fy > v.y0) R(g, v.x0, v.y0, v.x1 - v.x0, fy - v.y0, '#1a1438');
      if (fy + far.height < v.y1) R(g, v.x0, fy + far.height, v.x1 - v.x0, v.y1 - fy - far.height, '#2a2040');
      g.drawImage(near, -PADX, -cy);
      if (WH + 60 - cy < v.y1) R(g, v.x0, WH + 60 - cy, v.x1 - v.x0, v.y1, '#6a4024');
      g.save(); g.translate(0, -cy);
      // lantern strings + lanterns
      for (const l of lan) {
        if (l.gone) continue;
        if (!l.falling) R(g, l.x, l.y - 30, 1, 30, '#2a1a10');
        GT.draw(g, S.lantern, l.x, l.y + 11);
        if (!l.falling && Math.floor(st.t * 3 + l.x) % 3 === 0) R(g, l.x - 1, l.y + 5, 2, 2, '#fff');
        g.fillStyle = 'rgba(255,200,90,0.12)'; g.beginPath(); g.arc(l.x, l.y + 5, 12, 0, 6.283); g.fill();
      }
      for (const cv of covers) { R(g, cv.x, cv.y - 13, cv.w, 13, '#c8a878'); R(g, cv.x, cv.y - 13, cv.w, 2, '#e8c898'); for (let yy = cv.y - 10; yy < cv.y; yy += 4) R(g, cv.x, yy, cv.w, 1, '#a08058'); }
      for (const c of crates) if (!c.gone) GT.draw(g, S.crate, c.x, c.y, false, undefined, undefined, c.flash > 0);
      for (const it of st.items) GT.draw(g, it.k === 'food' ? S.food : S.pD, it.x, it.y + Math.round(Math.sin(it.t * 6)) - 1);
      for (const e of en) {
        if (e.dead) { if (e.deadT < 1) drawMan(g, e.look, 'lie', e.x, e.y + 2, e.face, false, Math.floor(e.deadT * 12) % 2); continue; }
        drawMan(g, e.look, e.s === 'aim' ? 'gun' : 'walk' + (Math.floor(e.t * 6) % 4), e.x, e.y, e.face, e.flash > 0);
        if (e.fire > 0) R(g, e.x + e.face * 15, e.y - 25, 3, 3, '#fff2a0');
      }
      const bs = st.boss;
      if (bs) {
        if (!bs.dead || bs.deadT < 1.2) drawMan(g, 'broker', bs.dead ? 'lie' : (!bs.on ? 'gunJump' : bs.s === 'shoot' ? 'gun' : 'walk' + (Math.floor(bs.t * 6) % 4)), bs.x, bs.y + (bs.dead ? 2 : 0), bs.face, bs.flash > 0);
      }
      // player
      if (P.dead > 0) drawMan(g, 'storm', 'hurt', P.x, P.y, P.face);
      else {
        let pose;
        if (!P.on) pose = 'gunJump'; else if (P.crouch) pose = 'crouchGun'; else if (GT.inp.y < -0.5 && P.cd > 0) pose = 'gunUp'; else if (Math.abs(P.vx) > 5) pose = 'gunW' + (Math.floor(st.t * 8) % 2); else pose = 'gun';
        drawMan(g, 'storm', pose, P.x, P.y, P.face, false, P.inv > 0 && Math.floor(st.t * 16) % 2 === 0);
        if (P.cd > 0.14) R(g, P.x + P.face * 17 - 1, P.y - (P.crouch ? 17 : 25), 4, 4, '#fff2a0');
      }
      for (const s of st.shots) { if (s.vy) R(g, s.x - 1, s.y - 3, 2, 6, '#ffe070'); else R(g, s.x - 3, s.y - 1, 6, 2, '#ffe070'); }
      for (const s of st.eshots) { if (s.g) { R(g, s.x - 2, s.y - 2, 5, 5, '#3a4a2a'); R(g, s.x, s.y - 3, 1, 1, '#ff4030'); } else { R(g, s.x - 2, s.y - 1, 4, 3, '#ff5040'); R(g, s.x - 1, s.y, 2, 1, '#fff'); } }
      for (const d of st.booms) { R(g, d.x - 1, d.y - 4, 3, 7, '#c02020'); R(g, d.x, d.y - 6, 1, 2, '#888'); }
      st.fx.draw(g);
      g.restore();
      // altitude meter
      const prog = 1 - (P.y - L.topY) / (WH - 40 - L.topY);
      R(g, 262, 60, 4, 140, '#00000088'); R(g, 262, 60 + 140 * (1 - clamp(prog, 0, 1)), 4, 3, '#ffd848'); GT.text(g, 'TOP', 264, 50, '#ffd848', 1, 1, '#000');
      GT.hud(g, { hp: P.hp, maxhp: 100, lives: GT.state.lives, score: GT.state.score, label: 'TNT', val: P.dyn,
        boss: bs && !bs.dead ? bs.hp : 0, bossMax: bs ? bs.max : 1, bossName: bs ? bs.name : '' });
      if (st.bannerT > 0) GT.banner(g, st.banner, 190, '#ffd848');
      if (st.t < 2.5) { GT.banner(g, 'STAGE 4', 160, '#fff'); GT.text(g, 'KASBAH ROOFTOPS', 135, 190, '#ffd848', 1, 1, '#000'); }
      if (st.t < 5) ['CLIMB TO THE TOP!  HOLD DOWN: TAKE COVER', 'UP+FIRE: SHOOT UP   SPCL: DYNAMITE', 'SHOOT LANTERNS AND CRATES'].forEach((h, i) => GT.text(g, h, 135, 212 + i * 11, '#fff', 1, 1, '#000'));
    }

    // ---- bot: climb platform to platform, shoot whoever is level ----
    function bot(b, dt) {
      b.x = 0; b.y = 0; b.fire = false;
      if (P.dead > 0 || st.phase !== 'play') return;
      st.bt = (st.bt || 0) + dt;
      const bs = st.boss;
      if (bs && !bs.dead) {
        const d = sgn(bs.x - P.x) || 1;
        if (Math.abs(bs.x - P.x) < 40) b.x = -d; else if (P.face !== d) b.x = d * 0.4;
        b.fire = true;
        if (P.dyn > 0 && st.bt > 2) { st.bt = 0; b.specP = true; }
        return;
      }
      const lvl = en.filter(e => !e.dead && e.y > P.y - 20 && e.y < P.y + 7 && Math.abs(e.x - P.x) < 200);
      b.fire = true;
      if (lvl.length && P.on) {
        const d = sgn(lvl[0].x - P.x) || 1;
        if (P.face !== d) { b.x = d * 0.4; return; }
        return; // stand and shoot
      }
      if (!P.on) { b.x = st.airDir || 0; return; }
      // choose next platform: lowest one above us that's reachable
      const cands = L.plats.filter(p => p.y < P.y - 8 && p.y > P.y - 56);
      let best = null, bd = 1e9;
      for (const p of cands) {
        const cx = clamp(P.x, p.x + 10, p.x + p.w - 10);
        const d = Math.abs(cx - P.x) + (P.y - p.y) * 0.5 + (p.kind === 'top' ? -500 : 0) + (p.main ? -20 : 0);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) { // nothing reachable: walk toward centre and hope
        b.x = P.x < 135 ? 1 : -1; if (st.bt > 1.5) { st.bt = 0; b.jumpP = true; st.airDir = b.x; }
        return;
      }
      const lo = best.x + 12, hi = best.x + best.w - 12;
      // stand under the overlap with our current platform, then jump
      const olo = Math.max(lo, P.on.x + 4), ohi = Math.min(hi, P.on.x + P.on.w - 4);
      let tx = olo <= ohi ? clamp(P.x, olo, ohi) : (P.x < lo ? lo - 6 : hi + 6);
      tx = clamp(tx, 10, 260);
      const dx = tx - P.x;
      if (Math.abs(dx) > 3) b.x = clamp(dx / 8, -1, 1);
      if (Math.abs(dx) <= 6 || (olo > ohi && Math.abs(dx) < 14)) {
        b.jumpP = true; st.airDir = sgn((lo + hi) / 2 - P.x) * (P.x >= lo && P.x <= hi ? 0.3 : 1);
      }
    }
    st.P = P; st.L = L; st.en = en;
    st.scene = { name: 'stage4', update, draw, bot, prog: () => Math.round(WH - P.y), st, enter() { GT.music('kasbah'); } };
    return st.scene;
  }
})();
