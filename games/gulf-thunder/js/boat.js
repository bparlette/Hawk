'use strict';
/* GULF THUNDER - boat stages: 1 GULF RUN, 3 MANGROVE CHASE */
(function () {
  const R = GT.R, rnd = GT.rnd, rndi = GT.rndi, clamp = GT.clamp;

  function waterTile(cols, seed, foam) {
    const c = GT.mk(128, 128), g = c.getContext('2d');
    R(g, 0, 0, 128, 128, cols[0]);
    const r = GT.srand(seed);
    for (let i = 0; i < 70; i++) { const x = Math.floor(r() * 128), y = Math.floor(r() * 128), w = 4 + Math.floor(r() * 14); R(g, x, y, w, 1, cols[1]); R(g, x - 128, y, w, 1, cols[1]); }
    for (let i = 0; i < 50; i++) { const x = Math.floor(r() * 128), y = Math.floor(r() * 128), w = 3 + Math.floor(r() * 9); R(g, x, y, w, 1, cols[2]); R(g, x + 1, y + 1, w - 2, 1, cols[3]); R(g, x - 128, y, w, 1, cols[2]); }
    if (foam) for (let i = 0; i < 14; i++) { const x = Math.floor(r() * 126), y = Math.floor(r() * 128); R(g, x, y, 2, 1, foam); }
    return c;
  }
  function island(seed) {
    const r = GT.srand(seed);
    const w = 50 + Math.floor(r() * 30), h = 34 + Math.floor(r() * 20);
    const c = GT.mk(w + 20, h + 20), g = c.getContext('2d');
    const cx = (w + 20) / 2, cy = (h + 20) / 2;
    for (let y = 0; y < h + 20; y++) for (let x = 0; x < w + 20; x++) {
      const d = ((x - cx) / (w / 2 + 8)) ** 2 + ((y - cy) / (h / 2 + 8)) ** 2;
      const n = (Math.sin(x * 0.7 + seed) + Math.cos(y * 0.6 + seed)) * 0.05;
      if (d + n < 0.62) g.fillStyle = (x + y) % 7 === 0 ? '#e8d8a0' : '#f4e4b0';
      else if (d + n < 0.75) g.fillStyle = '#d8c088';
      else if (d + n < 1.0) g.fillStyle = (x * 3 + y) % 5 === 0 ? '#7ae0e0' : '#4cc8d8';
      else continue;
      g.fillRect(x, y, 1, 1);
    }
    const np = 1 + Math.floor(r() * 3);
    for (let i = 0; i < np; i++) {
      const px = cx + (r() - 0.5) * w * 0.5, py = cy + (r() - 0.5) * h * 0.4;
      R(g, px + 3, py + 3, 9, 5, '#c0a870');
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]])
        for (let k = 0; k < 8; k++) R(g, px + dx * k, py + dy * k, 3, 3, k > 5 ? '#2a8a3a' : '#3aa848');
      R(g, px - 1, py - 1, 3, 3, '#6a4a20');
    }
    return GT.outline(c, '#2a7aa0');
  }

  function BoatStage(cfg) {
    const S = GT.S;
    const st = {
      t: 0, dist: 0, scroll: cfg.scroll || 55, script: 0, scriptPaused: false,
      p: { x: 135, y: 400, hp: 100, inv: 2, boostT: 0, boostCd: 0, fireCd: 0, power: 1, msl: 6, mode: 'boat', cloak: false, cloakM: 100, dead: 0, alive: true },
      shots: [], eshots: [], en: [], pick: [], decor: [], fx: new GT.FX(), boss: null, banner: null, bannerT: 0,
      phase: 'play', endT: 0, alarmT: 0
    };
    const p = st.p;
    const water = waterTile(cfg.water, cfg.seed || 7, cfg.foam);
    const islands = cfg.islands ? [island(3), island(11), island(23), island(41)] : [];
    function banner(s, d) { st.banner = s; st.bannerT = d || 2.2; }
    function bankL(wy) { return cfg.bankL ? cfg.bankL(wy, st) : -40; }
    function bankR(wy) { return cfg.bankR ? cfg.bankR(wy, st) : 310; }
    const wyOf = sy => st.dist + (480 - sy);
    st.wyOf = wyOf; st.bankL = bankL; st.bankR = bankR;

    function hurtPlayer(d) {
      if (GT.god || p.inv > 0 || p.dead > 0 || p.boostT > 0) return;
      p.hp -= d; p.inv = 0.9; GT.sfx('hurt'); GT.shake(5); st.fx.spark(p.x, p.y, 8);
      if (p.hp <= 0) {
        p.hp = 0; p.dead = 1.6; st.fx.boom(p.x, p.y, 2.2); st.fx.boom(p.x + 8, p.y - 10, 1.4);
      }
    }
    st.hurtPlayer = hurtPlayer;
    function spawn(type, x, y, o) {
      if (y < 0) y += Math.min(0, GT.view().y0); // spawn above the visible (possibly extended) top edge
      const e = Object.assign({ type, x, y, vx: 0, vy: 0, hp: 1, t: 0, w: 10, h: 10, fireT: rnd(0.8, 2), score: 100, flash: 0 }, o || {});
      switch (type) {
        case 'jet': e.hp = 2; e.w = 8; e.h = 16; e.vy = 110; e.score = 150; e.ph = rnd(0, 6); break;
        case 'gun': e.hp = 14; e.w = 16; e.h = 30; e.vy = 90; e.score = 400; e.stopY = e.stopY || rnd(60, 170); e.spr = cfg.gunSpr || S.gunboat; break;
        case 'mine': e.hp = 2; e.w = 10; e.h = 10; e.score = 60; break;
        case 'barrel': e.hp = 3; e.w = 12; e.h = 12; e.score = 100; break;
        case 'log': e.hp = 6; e.w = 34; e.h = 8; e.score = 80; break;
        case 'patrol': e.hp = 40; e.w = 20; e.h = 34; e.score = 800; e.vx = (Math.random() < 0.5 ? -1 : 1) * 22; e.cone = 0; e.vy = -st.scroll * 0.55; break;
      }
      st.en.push(e); return e;
    }
    st.spawn = spawn;
    function eshot(x, y, tx, ty, sp, kind) {
      const a = Math.atan2(ty - y, tx - x);
      st.eshots.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, k: kind || 'b', t: 0 });
      GT.sfx('eshot');
    }
    st.eshot = eshot;
    function drop(x, y, kind) { st.pick.push({ x, y, k: kind || ['M', 'H', 'P'][rndi(0, 2)], t: 0 }); }
    function killEnemy(e) {
      e.dead = true; GT.addScore(e.score); st.fx.pop(e.x, e.y - 10, String(e.score), '#ffe070');
      const big = e.type === 'gun' || e.type === 'patrol' ? 1.4 : e.type === 'barrel' ? 1.6 : 0.8;
      st.fx.boom(e.x, e.y, big);
      if (e.type === 'barrel') { drop(e.x, e.y); for (const o of st.en) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 40) { o.hp -= 8; if (o.hp <= 0) killEnemy(o); } }
      else if (e.type === 'gun' && Math.random() < 0.35) drop(e.x, e.y);
      else if (e.type === 'patrol') drop(e.x, e.y, 'H');
      if (e.type === 'mine') st.fx.splash(e.x, e.y, 10);
    }
    st.killEnemy = killEnemy;

    function firePlayer() {
      if (p.mode === 'jet') {
        st.shots.push({ x: p.x, y: p.y - 10, vx: 0, vy: -380, d: 1 });
        p.fireCd = 0.09; GT.sfx('shot'); return;
      }
      st.shots.push({ x: p.x - 5, y: p.y - 18, vx: 0, vy: -380, d: 1 }, { x: p.x + 5, y: p.y - 18, vx: 0, vy: -380, d: 1 });
      if (p.power >= 2) st.shots.push({ x: p.x - 9, y: p.y - 10, vx: -80, vy: -360, d: 1 }, { x: p.x + 9, y: p.y - 10, vx: 80, vy: -360, d: 1 });
      if (p.power >= 3) st.shots.push({ x: p.x - 12, y: p.y - 4, vx: -160, vy: -320, d: 1 }, { x: p.x + 12, y: p.y - 4, vx: 160, vy: -320, d: 1 });
      p.fireCd = 0.1; GT.sfx('shot');
    }
    function fireMissiles() {
      if (p.msl <= 0 || p.mode !== 'boat') return;
      p.msl--;
      st.shots.push({ x: p.x - 12, y: p.y, vx: -40, vy: -120, d: 8, m: true, t: 0 }, { x: p.x + 12, y: p.y, vx: 40, vy: -120, d: 8, m: true, t: 0 });
      GT.sfx('missile');
    }

    function update(dt) {
      st.t += dt;
      if (st.bannerT > 0) st.bannerT -= dt;
      const inp = GT.inp;
      // scroll
      const scrollNow = st.phase === 'dock' ? Math.max(0, st.scroll * (1 - st.endT / 2)) : st.scroll;
      st.dist += scrollNow * dt;
      if (!st.scriptPaused && st.phase === 'play') { st.script += dt; cfg.script(st, st.script, dt); }
      // player
      if (p.dead > 0) {
        p.dead -= dt;
        if (p.dead <= 0) {
          if (!GT.loseLife()) return;
          p.hp = 100; p.inv = 2.5; p.x = clamp(135, bankL(wyOf(400)) + 20, bankR(wyOf(400)) - 20); p.y = 410; p.msl = Math.max(p.msl, 4); p.power = Math.max(1, p.power - 1);
        }
      } else if (st.phase !== 'dock') {
        const spd = (p.mode === 'jet' ? 140 : 115) * (p.boostT > 0 ? 2 : 1);
        let ix = inp.x, iy = inp.y;
        if (p.boostT > 0 && Math.abs(ix) < 0.2 && Math.abs(iy) < 0.2) iy = -0.6;
        p.x += ix * spd * dt; p.y += iy * spd * dt;
        p.x = clamp(p.x, 10, 260); p.y = clamp(p.y, 60, 452);
        // banks
        const hw = p.mode === 'jet' ? 4 : 11;
        const bl = bankL(wyOf(p.y)), br = bankR(wyOf(p.y));
        if (p.x - hw < bl) { p.x = bl + hw; hurtPlayer(6); if (Math.random() < 0.3) st.fx.splash(p.x - hw, p.y, 4); }
        if (p.x + hw > br) { p.x = br - hw; hurtPlayer(6); if (Math.random() < 0.3) st.fx.splash(p.x + hw, p.y, 4); }
        if (p.x - hw < bl || p.x + hw > br) p.x = (bl + br) / 2; // channel narrower than boat: centre
        p.fireCd -= dt; p.boostCd -= dt; p.boostT -= dt; p.inv -= dt;
        // cloak (stage 3 patrol section)
        const canCloak = cfg.cloak && cfg.cloak(st);
        if (canCloak && inp.spec && p.cloakM > 0 && p.mode === 'boat') { if (!p.cloak) GT.sfx('cloak'); p.cloak = true; p.cloakM -= dt * 18; }
        else { p.cloak = false; p.cloakM = Math.min(100, p.cloakM + dt * 12); }
        if (inp.fire && p.fireCd <= 0 && !p.cloak) firePlayer();
        if (inp.specP && !canCloak) fireMissiles();
        if (inp.jumpP && p.boostCd <= 0) { p.boostT = 0.5; p.boostCd = 1.4; GT.sfx('boost'); }
        // wake
        if (Math.random() < 0.85) {
          if (p.mode === 'jet') st.fx.wake(p.x, p.y + 9, 60 + st.scroll);
          else { st.fx.wake(p.x - 7, p.y + 20, 60 + st.scroll); st.fx.wake(p.x + 6, p.y + 20, 60 + st.scroll); if (p.boostT > 0) st.fx.wake(p.x, p.y + 22, 90 + st.scroll); }
        }
      }
      // shots
      for (const s of st.shots) {
        if (s.m) {
          s.t += dt;
          let tgt = st.boss && !st.boss.dead && st.boss.hitable !== false ? st.boss : null, bd = 1e9;
          if (!tgt) for (const e of st.en) { if (e.dead || e.type === 'mine' || e.y < -10) continue; const d = Math.hypot(e.x - s.x, e.y - s.y); if (d < bd) { bd = d; tgt = e; } }
          const sp = Math.min(330, 120 + s.t * 500);
          let a = Math.atan2(s.vy, s.vx);
          if (tgt && s.t > 0.12) { const ta = Math.atan2(tgt.y - s.y, tgt.x - s.x); let da = ta - a; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; a += clamp(da, -6 * dt, 6 * dt); }
          s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
          if (Math.random() < 0.7) st.fx.smoke(s.x, s.y, 2, st.scroll * 0.5);
          if (s.t > 3) s.dead = true;
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.y < -30 || s.y > 520 || s.x < -30 || s.x > 300) s.dead = true;
        if (s.dead) continue;
        for (const e of st.en) {
          if (e.dead || e.inv) continue;
          if (Math.abs(s.x - e.x) < e.w / 2 + 2 && Math.abs(s.y - e.y) < e.h / 2 + 3) {
            s.dead = true; e.hp -= s.d; e.flash = 0.06; st.fx.spark(s.x, s.y, 2);
            if (s.m) st.fx.boom(s.x, s.y, 0.6, { quiet: true });
            if (e.hp <= 0) killEnemy(e);
            break;
          }
        }
        const b = st.boss;
        if (!s.dead && b && !b.dead && b.hitable !== false && b.hit(s.x, s.y)) {
          s.dead = true; b.hp -= s.d; b.flash = 0.05; st.fx.spark(s.x, s.y, 3);
          if (s.m) st.fx.boom(s.x, s.y, 0.7, { quiet: true });
          GT.addScore(s.d * 5);
        }
      }
      st.shots = st.shots.filter(s => !s.dead);
      // enemies
      for (const e of st.en) {
        if (e.dead) continue;
        e.t += dt; e.flash -= dt;
        switch (e.type) {
          case 'jet':
            e.y += e.vy * dt; e.x += Math.sin(e.t * 3 + e.ph) * 70 * dt;
            if (Math.random() < 0.5) st.fx.wake(e.x, e.y - 10, -20);
            break;
          case 'gun':
            if (e.y < e.stopY || e.t > 7) e.y += (e.t > 7 ? 70 : e.vy) * dt;
            e.x += Math.sin(e.t * 0.8) * 20 * dt;
            e.fireT -= dt;
            if (e.fireT <= 0 && e.y > 10 && p.dead <= 0 && !p.cloak) { e.fireT = 1.8; for (let k = 0; k < 3; k++) setTimeout(() => { if (!e.dead && GT.scene === st.scene) eshot(e.x, e.y + 4, p.x, p.y, 120); }, k * 140 / GT.speed); }
            if (Math.random() < 0.3) st.fx.wake(e.x, e.y - 16, -10);
            break;
          case 'mine': case 'barrel': case 'log':
            e.y += st.scroll * dt; break;
          case 'patrol': {
            e.y += (st.scroll + e.vy) * dt; e.x += e.vx * dt;
            if (e.x < 30 || e.x > 240) e.vx = -e.vx;
            e.cone = Math.sin(e.t * 1.1 + e.x) * 0.7;
            // searchlight check
            const dx = p.x - e.x, dy = p.y - e.y;
            if (dy > 0 && dy < 150 && p.dead <= 0) {
              const ang = Math.atan2(dx, dy);
              if (Math.abs(ang - e.cone) < 0.26 && !p.cloak) {
                if (st.alarmT <= 0) { GT.sfx('alarm'); banner('SPOTTED!', 1.2); spawn('jet', rnd(40, 230), -20); spawn('jet', rnd(40, 230), -40); }
                st.alarmT = 2.5;
              }
            }
            e.fireT -= dt;
            if (st.alarmT > 0 && e.fireT <= 0 && !p.cloak && e.y > 0) { e.fireT = 0.7; eshot(e.x, e.y + 10, p.x, p.y, 140); }
            break;
          }
        }
        if (e.y > 540 || e.x < -60 || e.x > 330) e.dead = true;
        // collide with player
        if (!e.dead && p.dead <= 0 && Math.abs(e.x - p.x) < e.w / 2 + 8 && Math.abs(e.y - p.y) < e.h / 2 + 14) {
          if (p.boostT > 0 && e.type !== 'patrol') { e.hp = 0; killEnemy(e); }
          else if (e.type === 'mine' || e.type === 'barrel') { killEnemy(e); hurtPlayer(25); }
          else if (e.type === 'jet' || e.type === 'log') { killEnemy(e); hurtPlayer(15); }
          else hurtPlayer(12);
        }
      }
      st.en = st.en.filter(e => !e.dead);
      if (st.alarmT > 0) st.alarmT -= dt;
      // boss
      if (st.boss) {
        const b = st.boss;
        b.update(dt);
        b.flash -= dt;
        if (b.hp <= 0 && !b.dead) {
          b.dead = true; b.deadT = 0; GT.addScore(5000); st.fx.pop(b.x, b.y, '5000', '#ffe070');
          st.eshots.length = 0;
        }
        if (b.dead) {
          b.deadT += dt;
          if (Math.random() < 0.25) st.fx.boom(b.x + rnd(-24, 24), b.y + rnd(-35, 35), rnd(0.8, 1.8));
          if (b.deadT > 2.2 && !b.gone) { b.gone = true; st.fx.boom(b.x, b.y, 3.2); GT.flash(0.15); st.boss = null; st.scriptPaused = false; if (b.onDead) b.onDead(); }
        } else if (p.dead <= 0 && b.hit(p.x, p.y)) hurtPlayer(20);
      }
      // enemy shots
      for (const s of st.eshots) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt;
        if (s.k === 'r' && Math.random() < 0.5) st.fx.smoke(s.x, s.y, 2, 0);
        if (s.y < -40 || s.y > 520 || s.x < -40 || s.x > 310) s.dead = true;
        if (!s.dead && p.dead <= 0 && Math.abs(s.x - p.x) < (p.mode === 'jet' ? 5 : 9) && Math.abs(s.y - p.y) < (p.mode === 'jet' ? 9 : 17)) {
          s.dead = true; if (p.cloak && s.k !== 'r') continue; hurtPlayer(s.k === 'r' ? 18 : 10); if (s.k === 'r') st.fx.boom(s.x, s.y, 0.7);
        }
      }
      st.eshots = st.eshots.filter(s => !s.dead);
      // pickups
      for (const k of st.pick) {
        k.t += dt; k.y += st.scroll * 0.7 * dt;
        if (p.dead <= 0 && Math.abs(k.x - p.x) < 16 && Math.abs(k.y - p.y) < 22) {
          k.dead = true; GT.sfx('pickup');
          if (k.k === 'M') { p.msl = Math.min(20, p.msl + 4); st.fx.pop(k.x, k.y, 'MISSILES', '#ff8080'); }
          if (k.k === 'H') { p.hp = Math.min(100, p.hp + 35); st.fx.pop(k.x, k.y, 'REPAIR', '#80ff90'); }
          if (k.k === 'P') { p.power = Math.min(3, p.power + 1); st.fx.pop(k.x, k.y, 'POWER UP', '#80c0ff'); }
          GT.addScore(200);
        }
        if (k.y > 500) k.dead = true;
      }
      st.pick = st.pick.filter(k => !k.dead);
      // decor
      if (islands.length && Math.random() < dt * 0.35) {
        const im = islands[rndi(0, islands.length - 1)];
        st.decor.push({ im, x: Math.random() < 0.5 ? rnd(-30, 25) : rnd(245, 300), y: -60 });
      }
      for (const d of st.decor) d.y += scrollNow * dt;
      st.decor = st.decor.filter(d => d.y < 560);
      st.fx.update(dt);
      if (cfg.update) cfg.update(st, dt);
      // stage end: docking
      if (st.phase === 'dock') {
        st.endT += dt;
        p.x += (cfg.dockX - p.x) * dt * 2; p.y += (cfg.dockY - p.y) * dt * 1.5;
        if (st.endT > 0.5 && !st.clearSaid) { st.clearSaid = true; banner('STAGE CLEAR!', 4); GT.sfx('clear'); }
        if (st.endT > 4) GT.stageClear();
      }
    }
    st.startDock = function () { st.phase = 'dock'; st.endT = 0; st.eshots.length = 0; for (const e of st.en) if (e.type !== 'patrol') { e.hp = 0; } st.en.forEach(e => { if (e.hp <= 0 && !e.dead) killEnemy(e); }); };

    function draw(g) {
      const v = GT.view();
      // water
      const oy = Math.floor(st.dist) % 128;
      const sway = Math.floor(Math.sin(st.t * 0.7) * 4);
      for (let y = Math.floor((v.y0 - oy) / 128) * 128 + oy - 128; y < v.y1; y += 128)
        for (let x = Math.floor(v.x0 / 128) * 128 - 128 + sway; x < v.x1; x += 128) g.drawImage(water, x, y);
      for (const d of st.decor) g.drawImage(d.im, Math.round(d.x - d.im.width / 2), Math.round(d.y - d.im.height / 2));
      if (cfg.drawUnder) cfg.drawUnder(g, st, v);
      // banks
      if (cfg.bankL) drawBanks(g, v);
      st.fx.p.forEach(q => { }); // (fx drawn below in order)
      // pickups
      for (const k of st.pick) { if (Math.floor(k.t * 8) % 2 || k.t < 2) GT.draw(g, S['p' + k.k], k.x, k.y + 6); }
      // enemies
      for (const e of st.en) drawEnemy(g, e);
      if (st.boss) st.boss.draw(g);
      // player
      if (p.dead <= 0 && (p.inv <= 0 || Math.floor(st.t * 20) % 2)) {
        if (p.mode === 'jet') GT.draw(g, S.jet, p.x, p.y + 10);
        else {
          if (p.cloak) { g.globalAlpha = 0.28 + Math.sin(st.t * 30) * 0.08; }
          GT.draw(g, p.boostT > 0 ? S.thBoost : S.th, p.x, p.y + 22);
          g.globalAlpha = 1;
          if (p.cloak) for (let i = 0; i < 4; i++) R(g, p.x - 12 + rndi(0, 22), p.y - 20 + rndi(0, 40), rndi(2, 6), 1, '#c8f0ff');
        }
      }
      // shots
      for (const s of st.shots) {
        if (s.m) { const a = Math.atan2(s.vy, s.vx); R(g, s.x - 1, s.y - 1, 3, 3, '#fff'); R(g, s.x - Math.cos(a) * 4 - 1, s.y - Math.sin(a) * 4 - 1, 3, 3, '#d8d8e0'); R(g, s.x - Math.cos(a) * 7, s.y - Math.sin(a) * 7, 2, 2, '#ff9a2a'); }
        else { R(g, s.x - 1, s.y - 4, 3, 8, '#ffe070'); R(g, s.x, s.y - 4, 1, 8, '#fff'); }
      }
      for (const s of st.eshots) {
        if (s.k === 'r') { GT.draw(g, S.rocket, s.x, s.y + 5, false); }
        else { GT.circ(g, s.x, s.y, 3, '#ff4030'); R(g, s.x - 1, s.y - 1, 2, 2, '#fff'); }
      }
      st.fx.draw(g);
      if (cfg.drawOver) cfg.drawOver(g, st, v);
      // HUD
      const canCloak = cfg.cloak && cfg.cloak(st);
      GT.hud(g, {
        hp: p.hp, maxhp: 100, lives: GT.state.lives, score: GT.state.score,
        label: p.mode === 'boat' && !canCloak ? 'MSL' : '', val: p.msl,
        meter: canCloak ? p.cloakM / 100 : clamp(1 - p.boostCd / 1.4, 0, 1), meterLabel: canCloak ? 'CLOAK' : 'BOOST', meterCol: canCloak ? '#b080ff' : '#5ac8ff',
        boss: st.boss && !st.boss.dead ? st.boss.hp : 0, bossMax: st.boss ? st.boss.max : 1, bossName: st.boss ? st.boss.name : ''
      });
      if (st.bannerT > 0) GT.banner(g, st.banner, 200, '#ffd848');
      if (st.t < 2.5) { GT.banner(g, cfg.title, 170, '#fff'); GT.text(g, cfg.sub, 135, 200, '#ffd848', 1, 1, '#000'); }
      if (st.t < 4.5 && cfg.hint) GT.text(g, cfg.hint, 135, 222, '#fff', 1, 1, '#000');
    }
    function drawBanks(g, v) {
      for (let y = Math.floor(v.y0 / 2) * 2; y < v.y1; y += 2) {
        const wy = wyOf(y), l = Math.round(bankL(wy)), r = Math.round(bankR(wy));
        const n = Math.sin(wy * 0.31) * 2 + Math.sin(wy * 0.09) * 3;
        const k = Math.floor(wy / 2);
        if (l > v.x0) {
          R(g, v.x0, y, l - v.x0, 2, '#1c4420');
          R(g, l - 10 + n, y, 10 - n, 2, k % 3 ? '#2e6a2a' : '#3a7a30');
          if (k % 5 === 0) R(g, l + 1, y, 3, 2, '#5a3a1a');
          if (k % 7 === 0) R(g, l - 22 + n * 2, y, 6, 2, '#4a8a3a');
          R(g, l, y, 1, 2, '#0e2a12');
        }
        if (r < v.x1) {
          R(g, r, y, v.x1 - r, 2, '#1c4420');
          R(g, r, y, 10 + n, 2, k % 3 ? '#2e6a2a' : '#3a7a30');
          if (k % 5 === 2) R(g, r - 4, y, 3, 2, '#5a3a1a');
          if (k % 7 === 3) R(g, r + 16 - n * 2, y, 6, 2, '#4a8a3a');
          R(g, r - 1, y, 1, 2, '#0e2a12');
        }
      }
      // mangrove canopy clumps overhanging the banks
      const step = 26, w0 = Math.floor(wyOf(v.y1) / step) * step;
      for (let wy = w0; wy < wyOf(v.y0) + step; wy += step) {
        const y = st.dist + 480 - wy, h = (wy * 2654435761) >>> 0;
        const l = bankL(wy), r = bankR(wy);
        const rr = 7 + (h % 6);
        if (l > v.x0) { GT.circ(g, l - 4 + (h % 5), y, rr, '#245a26'); GT.circ(g, l - 6 + (h % 5), y - 2, rr - 3, '#3a7a34'); R(g, l - 3, y - 3, 2, 2, '#5aa048'); for (let k = 0; k < 3; k++) R(g, l - 2 + k * 3, y + rr - 2, 1, 6, '#5a3a1a'); }
        if (r < v.x1) { GT.circ(g, r + 4 - (h % 5), y + 9, rr, '#245a26'); GT.circ(g, r + 6 - (h % 5), y + 7, rr - 3, '#3a7a34'); R(g, r + 2, y + 5, 2, 2, '#5aa048'); for (let k = 0; k < 3; k++) R(g, r - 3 + k * 3, y + 9 + rr - 2, 1, 6, '#5a3a1a'); }
      }
    }
    function drawEnemy(g, e) {
      const fl = e.flash > 0;
      switch (e.type) {
        case 'jet': GT.draw(g, S.ejet, e.x, e.y + 10, false, undefined, undefined, fl); break;
        case 'gun': {
          GT.draw(g, e.spr, e.x, e.y + 18, false, undefined, undefined, fl);
          GT.draw(g, S.turret, e.x, e.y + 2, false, undefined, undefined, fl);
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          for (let i = 3; i < 9; i++) R(g, e.x + Math.cos(a) * i - 1, e.y - 4 + Math.sin(a) * i, 2, 2, '#2a2a30');
          break;
        }
        case 'mine': { GT.draw(g, S.mine, e.x, e.y + 7, false, undefined, undefined, fl); if (Math.floor(e.t * 4) % 2) R(g, e.x - 1, e.y - 1, 2, 2, '#ff2020'); break; }
        case 'barrel': GT.draw(g, S.drum, e.x, e.y + 9, false, undefined, undefined, fl); break;
        case 'log': { R(g, e.x - 17, e.y - 4, 34, 8, '#3a2410'); R(g, e.x - 16, e.y - 3, 32, 6, fl ? '#fff' : '#6a4420'); R(g, e.x - 16, e.y - 3, 32, 1, '#8a6030'); R(g, e.x + 12, e.y - 3, 4, 6, '#a07848'); break; }
        case 'patrol': {
          // searchlight cone
          const len = 150, a = e.cone;
          g.fillStyle = st.alarmT > 0 ? 'rgba(255,80,60,0.22)' : 'rgba(255,250,190,0.2)';
          g.beginPath(); g.moveTo(e.x, e.y + 14);
          g.lineTo(e.x + Math.sin(a - 0.26) * len, e.y + 14 + Math.cos(a - 0.26) * len);
          g.lineTo(e.x + Math.sin(a + 0.26) * len, e.y + 14 + Math.cos(a + 0.26) * len); g.closePath(); g.fill();
          GT.draw(g, S.patrol, e.x, e.y + 20, false, undefined, undefined, fl);
          break;
        }
      }
    }
    // bot: steer in shooter stages
    function bot(b, dt) {
      b.fire = true; b.jump = false; b.spec = false;
      if (p.dead > 0 || st.phase === 'dock') { b.x = 0; b.y = 0; return; }
      let tx = 135, ty = 400;
      const tgt = st.boss && !st.boss.dead && st.boss.hitable !== false ? st.boss : st.en.filter(e => e.type !== 'mine' && e.type !== 'log' && e.y < p.y - 20 && e.y > 0).sort((a, c) => Math.abs(a.x - p.x) - Math.abs(c.x - p.x))[0];
      if (tgt) tx = tgt.x;
      if (st.boss && !st.boss.dead && st.boss.y > p.y) ty = 200; // boss behind: get ahead
      // dodge
      for (const o of st.en.concat(st.eshots)) {
        if (o.type === 'patrol') continue;
        const dy = p.y - o.y;
        if (dy > -10 && dy < 90 && Math.abs(o.x - p.x) < 22) tx = p.x + (o.x > p.x ? -40 : 40);
      }
      const l = bankL(wyOf(p.y - 30)), r = bankR(wyOf(p.y - 30));
      tx = clamp(tx, l + 16, r - 16);
      if (r - l < 40) tx = (l + r) / 2;
      b.x = clamp((tx - p.x) / 12, -1, 1); b.y = clamp((ty - p.y) / 20, -1, 1);
      if (cfg.cloak && cfg.cloak(st)) {
        b.spec = p.cloakM > 5 && st.en.some(e => e.type === 'patrol' && e.y < p.y && p.y - e.y < 190);
        if (b.spec) b.fire = false;
      } else if (Math.floor(st.t * 2) % 4 === 0 && (st.boss || st.en.length > 3)) b.specP = true;
    }
    st.scene = { name: cfg.name, update, draw, bot, prog: () => st.script, st };
    st.scene.enter = () => { GT.music(cfg.music); };
    return st.scene;
  }
  GT.BoatStage = BoatStage;

  /* ------------ boss: smuggler cruiser (stage 1) ------------ */
  function Cruiser(st) {
    const b = { name: 'RED TIDE YACHT', x: 135, y: -80, hp: 220, max: 220, t: 0, flash: 0, ph: 0, fT: 1, sT: 3, jT: 5 };
    b.hit = (x, y) => Math.abs(x - b.x) < 26 && Math.abs(y - b.y) < 46;
    b.update = dt => {
      b.t += dt; if (b.dead) { b.y += 10 * dt; return; }
      if (b.y < 95) { b.y += 50 * dt; return; }
      b.x = 135 + Math.sin(b.t * 0.6) * 70;
      const p = st.p;
      b.fT -= dt; b.sT -= dt; b.jT -= dt;
      if (b.fT <= 0) { b.fT = 0.9; st.eshot(b.x - 12, b.y + 30, p.x, p.y, 130); st.eshot(b.x + 12, b.y + 30, p.x, p.y, 130); }
      if (b.sT <= 0) { b.sT = b.hp < b.max / 2 ? 2.2 : 3.2; for (let i = -3; i <= 3; i++) st.eshot(b.x, b.y + 45, b.x + i * 30, b.y + 200, 110); }
      if (b.jT <= 0) { b.jT = 6; st.spawn('jet', b.x - 30, b.y + 40); st.spawn('jet', b.x + 30, b.y + 40); }
      if (Math.random() < 0.6) st.fx.wake(b.x + GT.rnd(-20, 20), b.y - 50, -st.scroll * 0.3);
    };
    b.draw = g => {
      GT.draw(g, GT.S.cruiser, b.x, b.y + 50, false, undefined, undefined, b.flash > 0);
      for (const dx of [-12, 12]) {
        GT.draw(g, GT.S.turret, b.x + dx, b.y + 31);
        const a = Math.atan2(st.p.y - b.y, st.p.x - b.x - dx);
        for (let i = 3; i < 10; i++) R(g, b.x + dx + Math.cos(a) * i - 1, b.y + 25 + Math.sin(a) * i, 2, 2, '#2a2a30');
      }
    };
    return b;
  }

  /* ------------ STAGE 1: GULF RUN ------------ */
  GT.Stage1 = function () {
    let dockY = -999;
    const cfg = {
      name: 'stage1', title: 'STAGE 1', sub: 'GULF RUN', hint: 'FIRE: CANNON  SPCL: MISSILES  JUMP: BOOST', music: 'boat', scroll: 55,
      water: ['#1a78b8', '#2a90cc', '#4cb0e0', '#a8e4f8'], foam: '#e8fbff', islands: true, seed: 9,
      dockX: 135, dockY: 88,
      script(st, t, dt) {
        const ev = st.ev || (st.ev = {});
        const once = (k, f) => { if (!ev[k]) { ev[k] = 1; f(); } };
        const every = (k, iv, f) => { ev[k] = (ev[k] || 0) + dt; if (ev[k] >= iv) { ev[k] = 0; f(); } };
        if (t > 2 && t < 14) every('j1', 2.4, () => { const x = rnd(50, 220); for (let i = -1; i <= 1; i++) st.spawn('jet', x + i * 22, -20 - Math.abs(i) * 16); });
        if (t > 7 && t < 50) every('m1', 1.6, () => st.spawn('mine', rnd(20, 250), -15));
        once('b1', () => { });
        if (t > 12 && t < 13) once('bar1', () => { st.spawn('barrel', 90, -20); st.spawn('barrel', 180, -40); });
        if (t > 14 && t < 34) every('g1', 4, () => { st.spawn('gun', rnd(40, 110), -30); st.spawn('gun', rnd(160, 230), -50); });
        if (t > 18 && t < 50) every('j2', 3.2, () => st.spawn('jet', rnd(30, 240), -20));
        if (t > 28 && t < 29) once('bar2', () => { st.spawn('barrel', 135, -20); });
        if (t > 36 && t < 52) every('g2', 3.5, () => st.spawn('gun', rnd(40, 230), -30));
        if (t > 44 && t < 45) once('bar3', () => { st.spawn('barrel', 70, -20); st.spawn('barrel', 200, -20); });
        if (t > 56) once('boss', () => {
          st.boss = Cruiser(st); st.scriptPaused = true; GT.music('boss'); st.bossBanner = 1;
          st.boss.onDead = () => { GT.music('boat'); st.afterBoss = true; };
          st.banner = 'WARNING!'; st.bannerT = 2;
        });
      },
      update(st, dt) {
        if (st.afterBoss) {
          st.ab = (st.ab || 0) + dt;
          if (st.ab > 2 && dockY < -500) dockY = -300;
          if (dockY > -500) { dockY += (st.phase === 'dock' ? 0 : st.scroll) * dt; if (dockY > 40 && st.phase !== 'dock') st.startDock(); }
        }
      },
      drawUnder(g, st, v) {
        if (dockY < -500) return;
        // sandy shore + resort silhouette at the top, pier coming down
        const top = Math.round(dockY - 260);
        R(g, v.x0, v.y0, v.x1 - v.x0, top - v.y0 + 60, '#f0dca0');
        for (let x = v.x0; x < v.x1; x += 4) R(g, x, top + 56 + (x % 8 ? 0 : 2), 4, 4, '#4cc8d8');
        R(g, v.x0, top + 52, v.x1 - v.x0, 4, '#e8f8ff');
        // resort roofs (top view)
        for (const [x, w] of [[10, 70], [190, 70]]) { R(g, x, top - 40, w, 50, '#c83a2a'); R(g, x, top - 40, w, 4, '#e85a40'); R(g, x + w / 2 - 1, top - 40, 2, 50, '#902018'); }
        R(g, 95, top - 20, 80, 36, '#c8a060'); for (let i = 0; i < 80; i += 5) R(g, 95 + i, top - 20, 2, 36, '#a07838'); // thatched grill roof
        // pier
        R(g, 112, top + 50, 46, dockY - top - 30, '#8a5a30');
        for (let y = top + 50; y < dockY + 20; y += 5) R(g, 112, y, 46, 1, '#5a3418');
        R(g, 110, top + 50, 2, dockY - top - 30, '#3a2410'); R(g, 158, top + 50, 2, dockY - top - 30, '#3a2410');
        for (let y = top + 60; y < dockY + 20; y += 24) { R(g, 106, y, 5, 5, '#3a2410'); R(g, 159, y, 5, 5, '#3a2410'); }
        R(g, 112, dockY + 18, 46, 3, '#3a2410');
        if (st.phase === 'dock') GT.text(g, 'MAC\'S DOCK', 135, top + 70, '#fff', 1, 1, '#3a2410');
      }
    };
    return BoatStage(cfg);
  };

  /* ------------ boss: swamp gunboat (stage 3) ------------ */
  function SwampBoat(st) {
    const b = { name: 'GATOR GUNBOAT', x: 135, y: 560, hp: 240, max: 240, t: 0, flash: 0, ph: 'chase', fT: 1.5, sT: 2 };
    b.hit = (x, y) => Math.abs(x - b.x) < 20 && Math.abs(y - b.y) < 40;
    b.update = dt => {
      b.t += dt; if (b.dead) { b.y += 20 * dt; return; }
      const p = st.p;
      const cx = (st.bankL(st.wyOf(b.y)) + st.bankR(st.wyOf(b.y))) / 2;
      if (b.ph === 'chase') {
        b.y += (440 - b.y) * dt * 1.2; b.x += (p.x - b.x) * dt * 0.8;
        b.fT -= dt;
        if (b.fT <= 0 && b.t > 1.5) { b.fT = 1.1; st.eshot(b.x, b.y - 42, p.x, p.y, 150, 'r'); }
        if (b.t > 11) { b.ph = 'pass'; GT.music('boss'); st.banner = 'IT\'S PASSING US!'; st.bannerT = 1.5; }
        if (Math.random() < 0.8) st.fx.wake(b.x + GT.rnd(-16, 16), b.y + 42, 80);
      } else if (b.ph === 'pass') {
        b.y -= 220 * dt; b.x += ((p.x < 135 ? 200 : 70) - b.x) * dt * 3;
        if (b.y < 110) { b.ph = 'fight'; }
        if (Math.random() < 0.8) st.fx.wake(b.x + GT.rnd(-16, 16), b.y + 42, 140);
      } else {
        b.x = cx + Math.sin(b.t * 0.9) * 40; b.y = 110 + Math.sin(b.t * 0.5) * 15;
        b.fT -= dt; b.sT -= dt;
        if (b.fT <= 0) { b.fT = 1.3; st.eshot(b.x - 10, b.y + 40, p.x, p.y, 130, 'r'); st.eshot(b.x + 10, b.y + 40, p.x + 30, p.y, 130, 'r'); }
        if (b.sT <= 0) { b.sT = 2.6; for (let i = -2; i <= 2; i++) st.eshot(b.x, b.y + 40, b.x + i * 25, b.y + 200, 120); }
        if (Math.random() < 0.6) st.fx.wake(b.x + GT.rnd(-16, 16), b.y + 42, 60);
      }
    };
    b.draw = g => {
      const flip = b.ph === 'fight';
      if (flip) { // turn around to face the player
        g.save(); g.translate(Math.round(b.x), Math.round(b.y)); g.scale(1, -1);
        GT.draw(g, GT.S.swamp, 0, 43, false, undefined, undefined, b.flash > 0); g.restore();
      } else GT.draw(g, GT.S.swamp, b.x, b.y + 43, false, undefined, undefined, b.flash > 0);
      GT.draw(g, GT.S.turret, b.x, b.y + 6);
    };
    return b;
  }

  /* ------------ STAGE 3: MANGROVE CHASE ------------ */
  GT.Stage3 = function () {
    let rigY = -999;
    // phases by script time: A (0-?) boat + pursuit boss, B jet-ski, C cloak, D rig
    const cfg = {
      name: 'stage3', title: 'STAGE 3', sub: 'MANGROVE CHASE', hint: 'MISSILES HOME IN ON THE PURSUER!', music: 'swamp', scroll: 60,
      water: ['#2a5a50', '#326a5c', '#4a8270', '#86b8a0'], foam: '#c0e0c8', seed: 21,
      dockX: 135, dockY: 300,
      bankL(wy, st) { const w = chanW(st); return 135 - w / 2 + chanOff(wy, st); },
      bankR(wy, st) { const w = chanW(st); return 135 + w / 2 + chanOff(wy, st); },
      cloak(st) { return st.ph === 'C'; },
      script(st, t, dt) {
        const ev = st.ev || (st.ev = {});
        const once = (k, f) => { if (!ev[k]) { ev[k] = 1; f(); } };
        const every = (k, iv, f) => { ev[k] = (ev[k] || 0) + dt; if (ev[k] >= iv) { ev[k] = 0; f(); } };
        const L = st.bankL(st.wyOf(-20)), Rr = st.bankR(st.wyOf(-20));
        if (!st.ph) st.ph = 'A';
        if (st.ph === 'A') {
          if (t > 2) every('j', 2.6, () => st.spawn('jet', rnd(L + 15, Rr - 15), -20));
          if (t > 4) every('m', 2.2, () => st.spawn('mine', rnd(L + 10, Rr - 10), -15));
          if (t > 5 && t < 9) every('g', 3, () => st.spawn('gun', rnd(L + 20, Rr - 20), -30, { spr: GT.S.gunboat2 }));
          if (t > 8) once('boss', () => {
            st.boss = SwampBoat(st); st.scriptPaused = true; st.banner = 'PURSUIT FROM BEHIND!'; st.bannerT = 2.2; GT.sfx('alarm');
            st.boss.onDead = () => { st.ph = 'B'; st.phT = 0; st.banner = 'LAUNCH JET-SKI!'; st.bannerT = 2.5; st.p.mode = 'jet'; st.p.inv = 1.5; st.dropTH = { x: st.p.x, y: st.p.y }; GT.music('swamp'); GT.sfx('boost'); };
          });
        } else if (st.ph === 'B') {
          st.phT += dt;
          if (st.phT > 2) every('log', 1.5, () => st.spawn('log', rnd(L + 18, Rr - 18), -10));
          if (st.phT > 3) every('j', 2.0, () => st.spawn('jet', rnd(L + 6, Rr - 6), -20));
          if (st.phT > 4) every('m', 1.9, () => st.spawn('mine', rnd(L + 8, Rr - 8), -15));
          if (st.phT > 9 && st.phT < 10) once('bar', () => st.spawn('barrel', (L + Rr) / 2, -20));
          if (st.phT > 24) { st.ph = 'C'; st.phT = 0; st.p.mode = 'boat'; st.p.inv = 1.5; st.banner = 'BACK ABOARD! HOLD SPECIAL TO CLOAK'; st.bannerT = 3; GT.sfx('pickup'); }
        } else if (st.ph === 'C') {
          st.phT += dt;
          if (st.phT > 2) every('pt', 3.8, () => { if ((ev.np || 0) < 6) { ev.np = (ev.np || 0) + 1; st.spawn('patrol', rnd(50, 220), -40); } });
          if (st.phT > 4) every('m', 2.4, () => st.spawn('mine', rnd(30, 240), -15));
          if (st.phT > 28) { st.ph = 'D'; st.phT = 0; rigY = -260; st.banner = 'THE OIL RIG!'; st.bannerT = 2; }
        } else if (st.ph === 'D') {
          st.phT += dt;
        }
      },
      update(st, dt) {
        if (st.dropTH) st.dropTH.y += st.scroll * dt;
        if (rigY > -500 && st.phase !== 'dock') { rigY += st.scroll * dt; if (rigY > 150) { st.startDock(); } }
      },
      drawUnder(g, st, v) {
        if (st.dropTH && st.dropTH.y < 520) GT.draw(g, GT.S.th, st.dropTH.x, st.dropTH.y + 22);
        if (rigY > -500) drawRig(g, rigY, st.t, v);
      }
    };
    function chanW(st) {
      if (st.ph === 'B') return 96; if (st.ph === 'C' || st.ph === 'D') return 520;
      return Math.max(140, 250 - st.script * 8);
    }
    function chanOff(wy, st) {
      const a = st.ph === 'B' ? 52 : st.ph === 'A' ? 26 : 0;
      return Math.sin(wy * 0.006) * a + Math.sin(wy * 0.017) * a * 0.3;
    }
    return BoatStage(cfg);
  };
  function drawRig(g, y, t, v) {
    y = Math.round(y);
    // legs into water
    for (const x of [60, 100, 170, 210]) { R(g, x, y - 20, 8, 70, '#5a5048'); R(g, x, y - 20, 2, 70, '#8a8078'); R(g, x - 4, y + 46, 16, 4, '#9fd8f0'); }
    for (let i = 0; i < 4; i++) R(g, 60, y + i * 16, 158, 2, '#4a4038');
    // deck
    R(g, 40, y - 120, 190, 100, '#6a6058'); R(g, 40, y - 120, 190, 3, '#9a9088'); R(g, 40, y - 24, 190, 4, '#3a3430');
    for (let x = 44; x < 228; x += 12) R(g, x, y - 110, 6, 80, '#5a5048');
    R(g, 50, y - 100, 50, 40, '#c8a040'); R(g, 50, y - 100, 50, 4, '#e8c060'); GT.text(g, 'RT-7', 75, y - 80, '#3a2a10', 1, 1);
    // helipad
    GT.circ(g, 170, y - 70, 26, '#3a3a40'); GT.circ(g, 170, y - 70, 22, '#4a4a50'); GT.text(g, 'H', 170, y - 80, '#ffd848', 2, 1);
    // derrick
    for (let i = 0; i < 8; i++) { R(g, 110 + i * 2, y - 120 - i * 12, 2, 12, '#b04030'); R(g, 140 - i * 2, y - 120 - i * 12, 2, 12, '#b04030'); R(g, 112 + i * 2, y - 122 - i * 12, 28 - i * 4, 1, '#d06050'); }
    // flare stack
    R(g, 218, y - 170, 4, 60, '#7a7068');
    const f = Math.floor(t * 10) % 3;
    GT.circ(g, 220, y - 176, 6 + f, '#ff9a2a'); GT.circ(g, 220, y - 178, 3 + f, '#ffe070');
    for (let i = 0; i < 3; i++) GT.circ(g, 220 + Math.sin(t * 2 + i) * 6, y - 192 - i * 9, 4 + i, '#3a3434');
  }
})();
