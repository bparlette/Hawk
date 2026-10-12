'use strict';
/* GULF THUNDER - belt-scroller stages: 2 PARADISE BEACH, 5 STUNT BACKLOT */
(function () {
  const R = GT.R, rnd = GT.rnd, rndi = GT.rndi, clamp = GT.clamp, sgn = GT.sgn;
  const BG_Y0 = -200, BG_H = 900, BG_PAD = 60;

  function Brawl(cfg) {
    const S = GT.S;
    const st = {
      t: 0, camX: 0, lockX: null, wave: 0, en: [], props: [], items: [], shots: [], fx: new GT.FX(),
      phase: 'play', endT: 0, goT: 0, boss: null, banner: null, bannerT: 0
    };
    const Y0 = cfg.yMin, Y1 = cfg.yMax;
    const P = st.P = { x: 60, y: (Y0 + Y1) / 2, z: 0, vz: 0, face: 1, s: 'idle', t: 0, combo: 0, comboT: 0, hp: 100, inv: 2, meter: 100, grab: null, grabT: 0, knees: 0, pushT: 0, shootCd: 0, hitSet: null, deadT: 0 };
    // pre-rendered backdrop layers
    const far = GT.mk(270 + (cfg.worldW - 270) * cfg.farPar + BG_PAD * 2, BG_H);
    cfg.paintFar(far.getContext('2d'), far.width);
    const mid = GT.mk(cfg.worldW + BG_PAD * 2, BG_H);
    cfg.paintMid(mid.getContext('2d'), cfg.worldW);
    cfg.props.forEach(p => st.props.push(Object.assign({ hp: p.k === 'drum' ? 1 : 3, broken: false, flash: 0 }, p)));
    function banner(s, d) { st.banner = s; st.bannerT = d || 2; }
    st.banner_ = banner;

    /* ---- enemies ---- */
    const KINDS = {
      thug: { hp: 32, spd: 48, dmg: 8, range: 22 },
      brute: { hp: 60, spd: 38, dmg: 13, range: 24 },
      bottle: { hp: 26, spd: 46, dmg: 10, range: 22, ranged: 'bottle' },
      soldier: { hp: 36, spd: 50, dmg: 9, range: 22 },
      rifle: { hp: 30, spd: 44, dmg: 9, range: 22, ranged: 'rifle' },
      bouncer: { hp: 260, spd: 44, dmg: 13, range: 28, boss: true },
    };
    function spawnEnemy(kind, look, side, y) {
      const K = KINDS[kind];
      const x = side < 0 ? st.camX - 20 : st.camX + 290;
      const e = { kind, look, x, y: y || rnd(Y0 + 6, Y1 - 6), z: 0, vz: 0, vx: 0, face: -side, s: 'walk', t: 0, hp: K.hp, max: K.hp, K, cd: rnd(0.5, 1.5), flash: 0, slot: rnd(-1, 1), rT: rnd(1.5, 3) };
      st.en.push(e);
      if (K.boss) { st.boss = e; e.name = cfg.bossName; }
      return e;
    }
    st.spawnEnemy = spawnEnemy;
    const attackers = () => st.en.filter(e => e.s === 'wind' || e.s === 'atk').length;

    function hurtEnemy(e, dmg, kd, dir, fromX) {
      if (e.s === 'down' || e.s === 'dead' || e.s === 'rise' || e.dead) return false;
      e.hp -= dmg; e.flash = 0.08; GT.addScore(dmg * 10);
      P.meter = Math.min(100, P.meter + 3);
      st.fx.hit(e.x + (fromX !== undefined ? sgn(fromX - e.x) * 6 : 0), e.y - 22 - e.z);
      GT.sfx(kd ? 'hit' : 'punch');
      if (e === P.grab && !kd) { if (e.hp <= 0) { releaseGrab(); } else return true; }
      if (e.hp <= 0 || kd) {
        e.s = 'fly'; e.t = 0; e.vz = 150; e.vx = (dir || -e.face) * (e.K.boss ? 50 : 90); e.face = -(dir || -e.face);
        if (e.hp <= 0) { e.vz = 170; GT.addScore(e.K.boss ? 8000 : 500); }
        if (e === P.grab) releaseGrab();
      } else { e.s = 'hurt'; e.t = 0; }
      if (e.K.boss && e.hp > 0 && e.s === 'hurt' && Math.random() < 0.35) { e.s = 'wind'; e.t = 0.1; } // super armor-ish
      return true;
    }
    function releaseGrab() { if (P.grab) { const e = P.grab; if (e.s === 'grabbed') { e.s = 'hurt'; e.t = 0; } } P.grab = null; if (P.s === 'grab' || P.s === 'knee') P.s = 'idle'; }
    function hurtPlayer(dmg, kd, fromX) {
      if (P.inv > 0 || P.s === 'dead' || P.s === 'down' || P.s === 'slam' || P.s === 'lift' || P.s === 'rise') return;
      if (GT.god) { st.fx.hit(P.x, P.y - 24); return; }
      P.hp -= dmg; GT.sfx('hurt'); GT.shake(4); st.fx.hit(P.x, P.y - 24 - P.z);
      releaseGrab();
      if (P.hp <= 0) { P.hp = 0; P.s = 'dead'; P.t = 0; P.vz = 140; P.z = Math.max(P.z, 1); P.vx = sgn(P.x - (fromX || P.x - P.face)) * 70; return; }
      if (kd) { P.s = 'down'; P.t = 0; P.vz = 130; P.z = Math.max(P.z, 1); P.vx = sgn(P.x - (fromX || P.x - P.face)) * 80; }
      else { P.s = 'hurt'; P.t = 0; }
    }
    st.hurtPlayer = hurtPlayer;
    function breakProp(pr) {
      pr.hp--; pr.flash = 0.08;
      if (pr.hp > 0) { GT.sfx('punch'); st.fx.spark(pr.x, pr.y - 12, 4); return; }
      pr.broken = true; GT.addScore(200);
      if (pr.k === 'drum') explodeDrum(pr);
      else {
        GT.sfx('break');
        for (let i = 0; i < 10; i++) st.fx.p.push({ k: 'deb', x: pr.x, y: pr.y - 10, vx: rnd(-90, 90), vy: rnd(-140, -40), g: 300, t: 0, life: 0.6, c: ['#8a5a30', '#5a3418', '#c89048'][i % 3] });
        if (pr.drop !== false && Math.random() < 0.7) st.items.push({ x: pr.x, y: pr.y + 2, k: 'food', t: 0 });
      }
    }
    function explodeDrum(pr) {
      pr.broken = true;
      st.fx.boom(pr.x, pr.y - 14, 1.8);
      for (const e of st.en) if (!e.dead && Math.abs(e.x - pr.x) < 46 && Math.abs(e.y - pr.y) < 22) hurtEnemy(e, 30, true, sgn(e.x - pr.x) || 1, pr.x);
      if (Math.abs(P.x - pr.x) < 30 && Math.abs(P.y - pr.y) < 16) hurtPlayer(14, true, pr.x);
      for (const o of st.props) if (!o.broken && o !== pr && o.k === 'drum' && Math.abs(o.x - pr.x) < 40 && Math.abs(o.y - pr.y) < 20) setTimeout(() => { if (!o.broken) explodeDrum(o); }, 120 / GT.speed);
      if (cfg.onDrum) cfg.onDrum(st, pr);
    }
    st.explodeDrum = explodeDrum;

    /* ---- player attacks ---- */
    function meleeHit(range, dmg, kd, zMax) {
      let hit = false;
      for (const e of st.en) {
        if (e.dead || e.s === 'down' || e.s === 'fly' || e.s === 'dead' || e.s === 'thrown' || e.s === 'rise') continue;
        if (P.hitSet && P.hitSet.has(e)) continue;
        const dx = (e.x - P.x) * P.face;
        if (dx > -4 && dx < range + (e.K.boss ? 6 : 0) && Math.abs(e.y - P.y) < 10 && Math.abs(e.z - P.z) < (zMax || 22)) {
          if (P.hitSet) P.hitSet.add(e);
          hurtEnemy(e, dmg, kd, P.face, P.x); hit = true;
        }
      }
      for (const pr of st.props) {
        if (pr.broken) continue;
        const dx = (pr.x - P.x) * P.face;
        if (dx > -4 && dx < range + 4 && Math.abs(pr.y - P.y) < 10) { if (!P.hitSet || !P.hitSet.has(pr)) { if (P.hitSet) P.hitSet.add(pr); breakProp(pr); hit = true; } }
      }
      if (cfg.meleeExtra && cfg.meleeExtra(st, range, dmg)) hit = true;
      if (hit) GT.shake(1.5); else GT.sfx('whiff');
      return hit;
    }
    function nearestMelee() { return st.en.some(e => !e.dead && e.s !== 'down' && e.s !== 'dead' && Math.abs(e.x - P.x) < 30 && Math.abs(e.y - P.y) < 10); }

    function updatePlayer(dt) {
      const inp = GT.inp;
      P.t += dt; P.inv -= dt; P.comboT -= dt; P.shootCd -= dt; P.meter = Math.min(100, P.meter + dt * 2);
      // gravity
      if (P.z > 0 || P.vz > 0) { P.vz -= 620 * dt; P.z += P.vz * dt; if (P.z <= 0) { P.z = 0; P.vz = 0; land(); } }
      const canAct = P.s === 'idle' || P.s === 'walk';
      switch (P.s) {
        case 'idle': case 'walk': {
          const mx = inp.x, my = inp.y;
          if (Math.abs(mx) > 0.15 || Math.abs(my) > 0.15) {
            P.s = 'walk'; P.x += mx * 72 * dt; P.y += my * 46 * dt;
            if (Math.abs(mx) > 0.15) P.face = sgn(mx);
          } else P.s = 'idle';
          // grab check
          const g = st.en.find(e => !e.dead && !e.noGrab && (e.s === 'walk' || e.s === 'hurt' || e.s === 'idle' || (e.s === 'wind' && !e.K.boss)) && Math.abs(e.y - P.y) < 7 && (e.x - P.x) * P.face > 0 && Math.abs(e.x - P.x) < 17 && (!e.K.boss || e.s === 'hurt'));
          if (g && Math.abs(mx) > 0.3 && sgn(mx) === P.face) { P.pushT += dt; if (P.pushT > 0.18) { P.grab = g; g.s = 'grabbed'; g.t = 0; P.s = 'grab'; P.t = 0; P.knees = 0; P.pushT = 0; g.face = -P.face; } }
          else P.pushT = 0;
          if (P.s !== 'grab') {
            if (inp.fireP) {
              if (cfg.gun && !nearestMelee()) { if (P.shootCd <= 0) shoot(); }
              else { P.combo = P.comboT > 0 ? (P.combo + 1) % 3 : 0; P.s = 'atk'; P.t = 0; P.hitSet = new Set(); P.comboT = 0.55; }
            } else if (inp.fire && cfg.gun && !nearestMelee() && P.shootCd <= 0) shoot();
            else if (inp.jumpP) { P.s = 'jump'; P.vz = 230; P.z = 0.1; P.t = 0; P.jvx = mx * 80; P.kick = false; GT.sfx('jump'); }
            else if (inp.specP && P.meter >= 30) { P.meter -= 30; P.s = 'slam'; P.vz = 260; P.z = 0.1; P.t = 0; P.inv = 1; GT.sfx('jump'); }
          }
          break;
        }
        case 'atk': {
          const dur = [0.2, 0.2, 0.32][P.combo];
          if (P.t > 0.05 && P.t - dt <= 0.05) meleeHit(26, [7, 7, 15][P.combo], P.combo === 2);
          if (P.t > dur) P.s = 'idle';
          break;
        }
        case 'shoot': if (P.t > 0.18) P.s = 'idle'; break;
        case 'jump': {
          P.x += P.jvx * dt;
          if (inp.fireP && !P.kick) { P.kick = true; P.hitSet = new Set(); }
          if (P.kick) meleeHit(26, 14, true, 40);
          break;
        }
        case 'slam': P.x += P.face * 30 * dt; break;
        case 'grab': {
          const e = P.grab;
          if (!e || e.dead) { releaseGrab(); break; }
          e.x = P.x + P.face * 15; e.y = P.y; e.z = 0;
          P.grabT += dt;
          if (inp.specP && P.meter >= 30) { P.meter -= 30; P.s = 'lift'; P.t = 0; P.inv = 1.2; break; }
          if (inp.fireP) { P.s = 'knee'; P.t = 0; P.knees++; hurtEnemy(e, 6, false, P.face, P.x); break; }
          if (inp.jumpP || (Math.abs(inp.x) > 0.5 && sgn(inp.x) === -P.face) || P.t > 2.2) throwGrab();
          break;
        }
        case 'knee': {
          const e = P.grab; if (e && !e.dead) { e.x = P.x + P.face * 15; e.y = P.y; }
          if (P.t > 0.2) { if (!P.grab) P.s = 'idle'; else if (P.knees >= 3) throwGrab(); else { P.s = 'grab'; } }
          break;
        }
        case 'throw': if (P.t > 0.3) P.s = 'idle'; break;
        case 'lift': {
          const e = P.grab;
          if (e) { e.x = P.x; e.y = P.y + 1; e.z = 30; e.s = 'grabbed'; }
          if (P.t > 0.4) {
            P.s = 'slamdown'; P.t = 0;
            if (e) { e.x = P.x + P.face * 18; e.z = 0; P.grab = null; e.s = 'idle'; hurtEnemy(e, 40, true, P.face, P.x); e.vz = 60; }
            GT.sfx('slam'); GT.shake(9); st.fx.boom(P.x + P.face * 18, P.y - 4, 0.6, { quiet: true });
            for (const o of st.en) if (o !== e && !o.dead && Math.abs(o.x - P.x) < 48 && Math.abs(o.y - P.y) < 16) hurtEnemy(o, 10, true, sgn(o.x - P.x) || 1, P.x);
          }
          break;
        }
        case 'slamdown': if (P.t > 0.35) P.s = 'idle'; break;
        case 'hurt': if (P.t > 0.3) P.s = 'idle'; break;
        case 'down': P.x += (P.vx || 0) * dt * (P.z > 0 ? 1 : 0); if (P.t > 1.0) { P.s = 'idle'; P.inv = 1.2; } break;
        case 'dead': P.x += (P.vx || 0) * dt * (P.z > 0 ? 1 : 0);
          if (P.t > 1.6) {
            if (!GT.loseLife()) return;
            P.hp = 100; P.s = 'jump'; P.z = 60; P.vz = 0; P.jvx = 0; P.inv = 3; P.meter = 100;
            for (const e of st.en) if (!e.K.boss) hurtEnemy(e, 0, true, sgn(e.x - P.x) || 1, P.x);
          }
          break;
      }
      // bounds
      const lo = st.camX + 10, hi = (st.lockX !== null ? st.lockX : cfg.worldW) + 260 - (st.lockX !== null ? 0 : 0);
      P.x = clamp(P.x, lo, Math.min(cfg.worldW - 10, st.camX + 260));
      P.y = clamp(P.y, Y0, Y1);
      void canAct; void hi;
    }
    function land() {
      if (P.s === 'jump') { P.s = 'idle'; GT.sfx('land'); }
      else if (P.s === 'slam') {
        P.s = 'slamdown'; P.t = 0; GT.sfx('slam'); GT.shake(8);
        st.fx.boom(P.x, P.y - 2, 0.7, { quiet: true });
        for (const e of st.en) if (!e.dead && Math.abs(e.x - P.x) < 50 && Math.abs(e.y - P.y) < 20) hurtEnemy(e, 22, true, sgn(e.x - P.x) || 1, P.x);
        for (const pr of st.props) if (!pr.broken && Math.abs(pr.x - P.x) < 46 && Math.abs(pr.y - P.y) < 20) breakProp(pr);
        if (cfg.meleeExtra) cfg.meleeExtra(st, 50, 22, true);
      } else if (P.s === 'down' || P.s === 'dead') { GT.sfx('land'); GT.shake(2); }
    }
    function throwGrab() {
      const e = P.grab; P.grab = null;
      P.s = 'throw'; P.t = 0;
      if (!e) return;
      e.s = 'thrown'; e.t = 0; e.vx = P.face * 230; e.vz = 120; e.z = 14; e.x = P.x + P.face * 10; e.face = -P.face; e.hitSet = new Set();
      GT.sfx('whiff');
    }
    function shoot() {
      P.s = 'shoot'; P.t = 0; P.shootCd = 0.22;
      st.shots.push({ x: P.x + P.face * 16, y: P.y, z: 23, vx: P.face * 330, own: 'p', t: 0 });
      GT.sfx('pistol'); st.fx.spark(P.x + P.face * 18, P.y - 23, 2, '#ffe070');
    }

    /* ---- enemy AI ---- */
    function updateEnemy(e, dt) {
      e.t += dt; e.flash -= dt; e.cd -= dt;
      if (e.z > 0 || e.vz > 0) {
        e.vz -= 620 * dt; e.z += e.vz * dt;
        if (e.z <= 0) {
          e.z = 0; e.vz = 0;
          if (e.s === 'fly' || e.s === 'thrown') {
            if (e.s === 'thrown') { e.hp -= 14; st.fx.hit(e.x, e.y - 6); }
            e.s = e.hp <= 0 ? 'dead' : 'down'; e.t = 0; GT.sfx('land'); GT.shake(2); st.fx.smoke(e.x, e.y, 4, -10);
          }
        }
      }
      const K = e.K;
      switch (e.s) {
        case 'fly': e.x += e.vx * dt; break;
        case 'thrown': {
          e.x += e.vx * dt;
          for (const o of st.en) if (o !== e && !o.dead && !e.hitSet.has(o) && Math.abs(o.x - e.x) < 16 && Math.abs(o.y - e.y) < 10) { e.hitSet.add(o); hurtEnemy(o, 14, true, sgn(e.vx), e.x); }
          for (const pr of st.props) if (!pr.broken && Math.abs(pr.x - e.x) < 12 && Math.abs(pr.y - e.y) < 10) breakProp(pr);
          if (cfg.thrownExtra) cfg.thrownExtra(st, e);
          break;
        }
        case 'down': if (e.t > (K.boss ? 0.8 : 1.1)) { e.s = 'rise'; e.t = 0; } break;
        case 'rise': if (e.t > 0.3) { e.s = 'walk'; e.t = 0; e.cd = rnd(0.3, 0.9); } break;
        case 'dead': if (e.t > 1.0) e.dead = true; break;
        case 'grabbed': break;
        case 'hurt': if (e.t > 0.32) { e.s = 'walk'; e.t = 0; } break;
        case 'wind': {
          if (e.t > (K.boss ? 0.5 : 0.38)) {
            e.s = 'atk'; e.t = 0;
            if (e.charge) { e.vx = e.face * 210; }
          }
          break;
        }
        case 'atk': {
          if (e.charge) {
            e.x += e.vx * dt;
            if (Math.abs(P.x - e.x) < 20 && Math.abs(P.y - e.y) < 10 && P.z < 20) hurtPlayer(18, true, e.x);
            if (e.t > 1.0 || e.x < st.camX - 10 || e.x > st.camX + 280) { e.charge = false; e.s = 'walk'; e.t = 0; e.cd = 1.2; e.x = clamp(e.x, st.camX + 6, st.camX + 264); }
            if (Math.random() < 0.5) st.fx.smoke(e.x - e.face * 8, e.y, 2, -6);
          } else {
            if (e.t > 0.05 && !e.didHit) {
              e.didHit = true;
              const dx = (P.x - e.x) * e.face;
              if (dx > -4 && dx < K.range + 4 && Math.abs(P.y - e.y) < 10 && P.z < 18) hurtPlayer(K.dmg, K.boss && Math.random() < 0.4, e.x);
              else GT.sfx('whiff');
            }
            if (e.t > 0.3) { e.s = 'walk'; e.t = 0; e.didHit = false; e.cd = K.boss ? rnd(0.5, 1.2) : rnd(0.9, 1.8); }
          }
          break;
        }
        case 'throwing': {
          if (e.t > 0.35 && !e.didHit) {
            e.didHit = true;
            if (K.ranged === 'bottle') st.shots.push({ x: e.x + e.face * 8, y: e.y, z: 26, own: 'e', k: 'bottle', tx: P.x, ty: P.y, t: 0, T: 0.8, sx: e.x + e.face * 8, sy: e.y });
            else { st.shots.push({ x: e.x + e.face * 16, y: e.y, z: 23, vx: e.face * 170, own: 'e', k: 'bullet', t: 0 }); GT.sfx('pistol'); }
          }
          if (e.t > 0.6) { e.s = 'walk'; e.t = 0; e.didHit = false; e.cd = rnd(1.8, 2.8); }
          break;
        }
        case 'walk': case 'idle': {
          if (P.s === 'dead') { e.s = 'idle'; break; }
          const side = e.x < P.x ? -1 : 1;
          let tx, ty = P.y + e.slot * 3;
          if (K.ranged) {
            tx = P.x + side * 95; ty = K.ranged === 'rifle' ? P.y : P.y + e.slot * 20;
          } else tx = P.x + side * (K.range - 2);
          if (attackers() >= 2 && !K.boss && !K.ranged) tx = P.x + side * 52;
          tx = clamp(tx, st.camX + 12, st.camX + 258);
          const dx = tx - e.x, dy = ty - e.y;
          const close = Math.abs(dx) < 4 && Math.abs(dy) < 4;
          if (!close) { e.x += clamp(dx, -1, 1) * K.spd * dt * (Math.abs(dx) > 3 ? 1 : 0); e.y += clamp(dy, -1, 1) * K.spd * 0.7 * dt * (Math.abs(dy) > 2 ? 1 : 0); e.s = 'walk'; }
          else e.s = 'idle';
          e.face = P.x > e.x ? 1 : -1;
          if (e.cd <= 0) {
            if (K.ranged) {
              if (Math.abs(P.x - e.x) > 50 && (K.ranged === 'bottle' || Math.abs(P.y - e.y) < 6)) { e.s = 'throwing'; e.t = 0; e.didHit = false; }
              else if (Math.abs(P.x - e.x) < K.range + 4 && Math.abs(P.y - e.y) < 8) { e.s = 'wind'; e.t = 0; }
            } else if (Math.abs(P.x - e.x) < K.range + 6 && Math.abs(P.y - e.y) < 8 && (attackers() < 2 || K.boss)) { e.s = 'wind'; e.t = 0; e.didHit = false; }
            else if (K.boss && e.cd < -1.5 && Math.abs(P.y - e.y) < 8 && Math.abs(P.x - e.x) > 60) { e.s = 'wind'; e.t = 0; e.charge = true; e.didHit = false; }
          }
          break;
        }
      }
      e.y = clamp(e.y, Y0, Y1);
      // watchdog: never let an enemy linger off-screen (it would stall the wave)
      if (e.x < st.camX - 24 || e.x > st.camX + 294) { e.off = (e.off || 0) + dt; if (e.off > 4 && (e.s === 'walk' || e.s === 'idle' || e.s === 'down')) { e.x = e.x < st.camX ? st.camX + 4 : st.camX + 266; e.off = 0; } } else e.off = 0;
      if (e.s === 'grabbed' && P.grab !== e) { e.s = 'hurt'; e.t = 0; e.z = 0; }
      if (e.s !== 'thrown' && e.s !== 'fly' && e.s !== 'atk') e.x = clamp(e.x, st.camX - 30, st.camX + 300);
    }

    /* ---- shots ---- */
    function updateShots(dt) {
      for (const s of st.shots) {
        s.t += dt;
        if (s.k === 'bottle') {
          const f = s.t / s.T; s.x = GT.lerp(s.sx, s.tx, f); s.y = GT.lerp(s.sy, s.ty, f); s.z = 26 + Math.sin(f * Math.PI) * 40 - f * 26;
          if (f >= 1) { s.dead = true; GT.sfx('break'); st.fx.spark(s.x, s.y, 6, '#80e080'); if (Math.abs(P.x - s.x) < 12 && Math.abs(P.y - s.y) < 9) hurtPlayer(10, false, s.x); }
          continue;
        }
        s.x += s.vx * dt;
        if (s.x < st.camX - 20 || s.x > st.camX + 290) s.dead = true;
        if (s.own === 'p') {
          for (const e of st.en) if (!e.dead && e.s !== 'down' && e.s !== 'dead' && e.s !== 'fly' && Math.abs(e.x - s.x) < 9 && Math.abs(e.y - s.y) < 8) { s.dead = true; hurtEnemy(e, 6, false, sgn(s.vx), s.x); break; }
          if (!s.dead) for (const pr of st.props) if (!pr.broken && Math.abs(pr.x - s.x) < 8 && Math.abs(pr.y - s.y) < 9) { s.dead = true; breakProp(pr); break; }
          if (!s.dead && cfg.shotExtra && cfg.shotExtra(st, s)) s.dead = true;
        } else {
          if (Math.abs(P.x - s.x) < 8 && Math.abs(P.y - s.y) < 7 && P.z < 18 && P.s !== 'down') { s.dead = true; hurtPlayer(s.dmg || 8, false, s.x); }
        }
      }
      st.shots = st.shots.filter(s => !s.dead);
    }

    /* ---- waves & camera ---- */
    function updateWaves(dt) {
      const W = cfg.waves[st.wave];
      if (st.lockX === null && W && st.camX >= W.at - 0.5) {
        st.camX = W.at; st.lockX = W.at; st.waveSpawned = 0; st.waveT = 0;
        if (W.boss) { banner(W.bossTitle || 'BOSS!', 2); GT.music('boss'); }
      }
      if (st.lockX !== null && W) {
        st.waveT += dt;
        while (st.waveSpawned < W.en.length && st.waveT >= (W.en[st.waveSpawned][3] || st.waveSpawned * 0.6)) {
          const d = W.en[st.waveSpawned]; spawnEnemy(d[0], d[1], d[2]); st.waveSpawned++;
        }
        if (W.extra) W.extra(st, dt);
        const alive = st.en.filter(e => !e.dead).length;
        if (st.waveSpawned >= W.en.length && alive === 0 && !(W.until && !W.until(st))) {
          st.lockX = null; st.wave++;
          if (W.boss || st.wave >= cfg.waves.length) { finish(); }
          else { st.goT = 2.5; GT.sfx('select'); }
        }
      }
      // camera
      if (st.phase === 'play') {
        const target = clamp(P.x - 110, 0, cfg.worldW - 270);
        const maxX = st.lockX !== null ? st.lockX : cfg.worldW - 270;
        const nextW = cfg.waves[st.wave];
        let cap = maxX; if (st.lockX === null && nextW) cap = Math.min(cap, nextW.at);
        if (target > st.camX) st.camX = Math.min(cap, st.camX + Math.min(target - st.camX, 120 * dt));
      }
    }
    function finish() {
      if (st.phase !== 'play') return;
      st.phase = 'end'; st.endT = 0;
      if (cfg.onFinish) cfg.onFinish(st);
    }
    st.finish = finish;

    function update(dt) {
      st.t += dt; if (st.bannerT > 0) st.bannerT -= dt; st.goT -= dt;
      if (st.phase === 'play' || st.phase === 'end') updatePlayer(dt);
      if (GT.scene !== st.scene) return;
      for (const e of st.en) if (!e.dead) updateEnemy(e, dt);
      st.en = st.en.filter(e => !e.dead);
      if (st.boss && st.boss.dead) st.boss = null;
      updateShots(dt);
      // items
      for (const it of st.items) {
        it.t += dt;
        if (Math.abs(it.x - P.x) < 14 && Math.abs(it.y - P.y) < 9 && P.s !== 'dead') { it.dead = true; P.hp = Math.min(100, P.hp + 40); GT.sfx('pickup'); st.fx.pop(it.x, it.y - 24, '+HEALTH', '#80ff90'); GT.addScore(300); }
      }
      st.items = st.items.filter(i => !i.dead);
      for (const pr of st.props) pr.flash -= dt;
      if (st.phase === 'play') updateWaves(dt);
      if (cfg.update) cfg.update(st, dt);
      st.fx.update(dt);
      if (st.phase === 'end') {
        st.endT += dt;
        if (st.endT > (cfg.endDelay || 0.8) && !st.clearSaid) { st.clearSaid = true; banner(cfg.clearText || 'STAGE CLEAR!', 5); GT.sfx('clear'); GT.music(null); }
        if (st.endT > (cfg.endDelay || 0.8) + 3.2) GT.stageClear();
      }
    }

    /* ---- drawing ---- */
    function pose(e) {
      switch (e.s) {
        case 'walk': return 'walk' + (Math.floor(st.t * 8 + e.x * 0.01) % 4);
        case 'idle': return 'guard';
        case 'wind': return e.charge ? 'down' : 'wind';
        case 'atk': return e.charge ? 'down' : 'jab';
        case 'throwing': return e.K.ranged === 'rifle' ? 'gun' : (e.t < 0.35 ? 'wind' : 'throw');
        case 'hurt': case 'grabbed': return 'hurt';
        case 'fly': case 'thrown': return 'hurt';
        case 'down': case 'dead': return 'lie';
        case 'rise': return 'down';
      }
      return 'idle';
    }
    function ppose() {
      switch (P.s) {
        case 'walk': return cfg.gun && P.shootCd > 0 ? 'gunW' + (Math.floor(st.t * 8) % 2) : 'walk' + (Math.floor(st.t * 8) % 4);
        case 'idle': return cfg.gun && P.shootCd > -0.4 ? 'gun' : 'guard';
        case 'atk': return ['jab', 'cross', 'upper'][P.combo];
        case 'shoot': return 'gun';
        case 'jump': return P.kick ? 'jkick' : 'jump';
        case 'slam': return 'slam';
        case 'grab': return 'grab';
        case 'knee': return 'knee';
        case 'throw': return 'throw';
        case 'lift': return 'lift';
        case 'slamdown': return 'down';
        case 'hurt': return 'hurt';
        case 'down': case 'dead': return P.z > 0 ? 'hurt' : 'lie';
      }
      return 'idle';
    }
    function drawChar(g, look, ps, x, y, z, face, flash, blink) {
      const sx = Math.round(x - st.camX);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(sx - 9, Math.round(y) - 2, 18, 3); g.fillRect(sx - 7, Math.round(y) - 3, 14, 5);
      if (blink) return;
      const c = GT.man(look, ps);
      GT.draw(g, c, sx, Math.round(y - z), face < 0, 24, GT.manAY(c), flash);
    }
    function draw(g) {
      const v = GT.view();
      g.drawImage(far, Math.round(-BG_PAD - st.camX * cfg.farPar), BG_Y0);
      if (cfg.birds) for (let i = 0; i < 5; i++) { // gulls drifting across the sky
        const bx = ((i * 97 + st.t * (12 + i * 3)) % 340) - 35, by = 40 + i * 23 + Math.sin(st.t + i) * 6, f = Math.floor(st.t * 6 + i) % 2;
        R(g, bx, by, 3, 1, cfg.birds); R(g, bx + 4, by, 3, 1, cfg.birds); R(g, bx + 3, by + 1, 1, 1, cfg.birds); if (f) { R(g, bx - 1, by - 1, 1, 1, cfg.birds); R(g, bx + 7, by - 1, 1, 1, cfg.birds); }
      }
      if (cfg.drawSky) cfg.drawSky(g, st, v);
      g.drawImage(mid, Math.round(-BG_PAD - st.camX), BG_Y0);
      // fill any area beyond prerender
      if (v.y1 > BG_Y0 + BG_H) R(g, v.x0, BG_Y0 + BG_H, v.x1 - v.x0, v.y1 - BG_Y0 - BG_H, cfg.groundCol);
      if (cfg.drawBack) cfg.drawBack(g, st, v);
      // sortable list
      const list = [];
      for (const pr of st.props) if (!pr.broken) list.push({ y: pr.y, d: () => { const im = S[pr.k]; GT.draw(g, im, pr.x - st.camX, pr.y, false, undefined, undefined, pr.flash > 0); } });
      for (const it of st.items) list.push({ y: it.y - 1, d: () => GT.draw(g, S.food, it.x - st.camX, it.y + Math.round(Math.sin(it.t * 6)), false) });
      for (const e of st.en) list.push({ y: e.y + (e.s === 'grabbed' && P.s === 'lift' ? 1 : 0), d: () => drawChar(g, e.look, pose(e), e.x, e.y, e.z, e.face, e.flash > 0, e.s === 'dead' && Math.floor(e.t * 12) % 2) });
      list.push({ y: P.y, d: () => drawChar(g, 'storm', ppose(), P.x, P.y, P.z, P.face, false, P.inv > 0 && P.s !== 'down' && P.s !== 'dead' && Math.floor(st.t * 16) % 2 === 0) });
      if (cfg.sortables) cfg.sortables(st, list, g);
      list.sort((a, b) => a.y - b.y);
      for (const o of list) o.d();
      for (const s of st.shots) {
        const sx = Math.round(s.x - st.camX), sy = Math.round(s.y - s.z);
        if (s.k === 'bottle') { R(g, sx - 1, sy - 3, 3, 6, '#3aa860'); R(g, sx, sy - 5, 1, 2, '#c0e0c0'); R(g, sx - 3, Math.round(s.y) - 1, 6, 2, 'rgba(0,0,0,.25)'); }
        else { R(g, sx - 3, sy - 1, 6, 2, s.own === 'p' ? '#ffe070' : '#ff6040'); R(g, sx - 1, sy - 1, 2, 2, '#fff'); }
      }
      g.save(); g.translate(-st.camX, 0); st.fx.draw(g); g.restore();
      if (cfg.drawFront) cfg.drawFront(g, st, v);
      GT.hud(g, { hp: P.hp, maxhp: 100, lives: GT.state.lives, score: GT.state.score, meter: P.meter / 100, meterLabel: 'SPECIAL', meterCol: P.meter >= 30 ? '#ffd848' : '#8a7a40',
        boss: st.boss ? Math.max(0, st.boss.hp) : (cfg.bossHP ? cfg.bossHP(st) : 0), bossMax: st.boss ? st.boss.max : (cfg.bossMax || 1), bossName: st.boss ? st.boss.name : cfg.bossName });
      if (st.goT > 0 && Math.floor(st.t * 3) % 2 === 0) { GT.textO(g, 'GO', 236, 210, '#ffd848', 2, 1); GT.textO(g, '>', 256, 210, '#ffd848', 2, 1); }
      if (st.bannerT > 0) GT.banner(g, st.banner, 190, '#ffd848');
      if (st.t < 2.5) { GT.banner(g, cfg.title, 160, '#fff'); GT.text(g, cfg.sub, 135, 190, '#ffd848', 1, 1, '#000'); }
      if (st.t < 5 && cfg.hint) R(g, 0, 207, 270, cfg.hint.length * 11 + 6, 'rgba(0,0,0,0.55)');
      if (st.t < 5 && cfg.hint) cfg.hint.forEach((h, i) => GT.text(g, h, 135, 212 + i * 11, '#fff', 1, 1, '#000'));
    }

    /* ---- bot ---- */
    function bot(b, dt) {
      b.x = 0; b.y = 0; b.fire = false;
      st.botT = (st.botT || 0) + dt;
      // anti-stuck: if nothing scored for a while, wander for a second
      if (GT.state.score !== st.botScore) { st.botScore = GT.state.score; st.botIdle = 0; } else st.botIdle = (st.botIdle || 0) + dt;
      if (st.botIdle > 8 && st.phase === 'play' && st.lockX !== null) { if (st.botIdle > 9.2) st.botIdle = 0; b.x = Math.sin(st.t * 1.3) > 0 ? 1 : -1; b.y = Math.cos(st.t * 2) > 0 ? 1 : -1; if (st.botIdle > 8.6) b.jumpP = true; return; }
      if (P.s === 'grab') { if (st.botT > 0.14) { st.botT = 0; b.fireP = true; } return; }
      if (cfg.botExtra && cfg.botExtra(st, b, P)) return;
      const tgts = st.en.filter(e => !e.dead && e.s !== 'down' && e.s !== 'dead' && e.s !== 'fly' && e.s !== 'thrown' && e.x > st.camX - 4 && e.x < st.camX + 274);
      if (!tgts.length) {
        if (st.phase === 'play') { b.x = 1; b.y = clamp(((Y0 + Y1) / 2 - P.y) / 10, -1, 1); }
        return;
      }
      tgts.sort((a, c) => Math.abs(a.x - P.x) + Math.abs(a.y - P.y) - Math.abs(c.x - P.x) - Math.abs(c.y - P.y));
      const e = tgts[0];
      const side = P.x < e.x ? -1 : 1;
      const tx = e.x + side * 18, ty = e.y;
      const dx = tx - P.x, dy = ty - P.y;
      if (cfg.gun && Math.abs(dy) < 4 && Math.abs(e.x - P.x) > 34) {
        b.x = sgn(e.x - P.x) * (P.face === sgn(e.x - P.x) ? 0 : 1);
        if (st.botT > 0.24) { st.botT = 0; b.fireP = true; }
        b.y = clamp(dy / 6, -1, 1);
        return;
      }
      if (Math.abs(dx) > 5) b.x = clamp(dx / 10, -1, 1);
      if (Math.abs(dy) > 2) b.y = clamp(dy / 6, -1, 1);
      if (Math.abs(dy) < 6 && Math.abs(e.x - P.x) < 28) {
        b.x = 0;
        if (P.face !== sgn(e.x - P.x)) b.x = sgn(e.x - P.x) * 0.3;
        if (st.botT > 0.13) { st.botT = 0; b.fireP = true; }
        if (P.meter > 60 && tgts.length >= 3 && Math.random() < 0.02) b.specP = true;
      }
    }
    st.scene = { name: cfg.name, update, draw, bot, prog: () => st.camX + st.wave * 10000, st };
    st.scene.enter = () => GT.music(cfg.music);
    return st.scene;
  }
  GT.Brawl = Brawl;

  /* =================== STAGE 2 painters =================== */
  function paintBeachFar(g, w) {
    // sky
    GT.grad(g, 0, 0, w, 380, ['#2c6cc8', '#3a80d8', '#4c94e0', '#68ace8', '#88c4ee', '#a8d8f2']);
    const r = GT.srand(5);
    for (let i = 0; i < 9; i++) { // clouds
      const cx = r() * w, cy = 120 + r() * 160, cw = 30 + r() * 40;
      for (let k = 0; k < 5; k++) GT.circ(g, cx + (k - 2) * cw / 5, cy - (k % 2) * 4, cw / 5 + 3, '#ffffff');
      R(g, cx - cw / 2, cy + 2, cw, 4, '#e0eef8');
    }
    // sea
    const hz = 380;
    GT.grad(g, 0, hz, w, 160, ['#1a6ab0', '#1f7cc0', '#2a90cc', '#38a4d8']);
    for (let i = 0; i < 260; i++) R(g, r() * w, hz + 4 + r() * 150, 3 + r() * 8, 1, r() < 0.5 ? '#80c8f0' : '#e8f8ff');
    // distant key with a lighthouse (seen from the dock)
    for (let i = 0; i < 120; i++) { const hh = Math.round(9 * Math.sin(Math.PI * i / 120)); R(g, 360 + i, hz - hh, 1, hh, '#4a7a6a'); }
    R(g, 400, hz - 34, 6, 26, '#f4f4f4'); R(g, 400, hz - 28, 6, 4, '#d03028'); R(g, 400, hz - 18, 6, 4, '#d03028'); R(g, 399, hz - 38, 8, 4, '#303030'); R(g, 401, hz - 37, 4, 2, '#ffe890');
    for (const px of [380, 430, 455]) { R(g, px, hz - 22, 2, 14, '#3a5a3a'); R(g, px - 5, hz - 24, 12, 3, '#2e6a3a'); }
    // sailboat
    R(g, 200, hz + 8, 16, 3, '#fff'); for (let i = 0; i < 14; i++) R(g, 208 - i / 2, hz - 6 + i - 8, i / 2 + 1, 1, '#f8f8f8');
    R(g, w * 0.6, hz + 14, 12, 3, '#fff'); for (let i = 0; i < 10; i++) R(g, w * 0.6 + 6, hz + 1 + i, i / 2 + 1, 1, '#f04040');
    R(g, 0, hz + 160, w, 400, '#38a4d8');
  }
  function clap(g, x, y, w, h, col, line) { R(g, x, y, w, h, col); for (let yy = y + 2; yy < y + h; yy += 3) R(g, x, yy, w, 1, line); }
  function roofGable(g, cx, base, half, hgt, col, dark) {
    for (let i = 0; i < hgt; i++) { const ww = Math.round(half * (i + 1) / hgt); R(g, cx - ww, base - hgt + i, ww * 2, 1, (i % 3 === 0) ? dark : col); }
  }
  function palm(g, x, y, h, lean) {
    for (let i = 0; i < h; i++) { const xx = Math.round(x + Math.sin(i / h * 1.4) * lean); R(g, xx, y - i, 4, 1, i % 4 === 0 ? '#6a4420' : '#8a6030'); }
    const tx = Math.round(x + Math.sin(1.4) * lean) + 2, ty = y - h;
    for (const [dx, dy] of [[-1, 0.1], [1, 0.1], [-0.8, 0.5], [0.8, 0.5], [-0.3, -0.4], [0.4, -0.3], [0, 0.6]]) {
      for (let k = 0; k < 16; k++) { const xx = tx + dx * k, yy = ty + dy * k + k * k * 0.035; R(g, xx, yy, 3, 2, k > 11 ? '#1e7a2e' : '#2e9a3e'); R(g, xx, yy + 2, 2, 1, '#14561e'); }
    }
    GT.circ(g, tx, ty + 2, 2, '#6a4a20');
  }
  GT.palm = palm;
  // Pink Mediterranean-revival beach hotel ("pink palace"): flamingo stucco, white trim, bell towers, arched windows
  const PK = '#f2869c', PKD = '#d0627e', PKL = '#ffb4c4', WT = '#fbf6f0', WTS = '#dcd2d0', GL = '#3a5a80', GLL = '#6a8ab0';
  function archWin(g, x, y, w, h, frame, glass) { // x,y = top-left of the arch box
    const r = Math.floor(w / 2);
    GT.circ(g, x + r, y + r, r, frame); R(g, x, y + r, w, h - r, frame);
    GT.circ(g, x + r, y + r, r - 2, glass); R(g, x + 2, y + r, w - 4, h - r - 2, glass);
    R(g, x + 2, y + r, 2, h - r - 2, GLL); R(g, x - 1, y + h - 2, w + 2, 2, WTS);
  }
  function stucco(g, x, y, w, h, seed) {
    R(g, x, y, w, h, PK); const r = GT.srand(seed);
    for (let i = 0; i < w * h / 40; i++) R(g, x + r() * w, y + r() * h, 2, 1, r() < 0.5 ? PKD : PKL);
  }
  function cornice(g, x, y, w) { R(g, x - 2, y, w + 4, 4, WT); R(g, x - 2, y + 4, w + 4, 1, WTS); for (let xx = x; xx < x + w; xx += 6) R(g, xx, y + 5, 3, 2, WT); }
  function balustrade(g, x, y, w) { R(g, x, y - 8, w, 2, WT); for (let xx = x + 1; xx < x + w - 1; xx += 4) R(g, xx, y - 6, 2, 6, WT); R(g, x, y, w, 2, WTS); }
  function bellTower(g, cx, top, bot, w, seed) {
    stucco(g, cx - w / 2, top, w, bot - top, seed);
    R(g, cx - w / 2, top, 2, bot - top, PKD);
    for (let y = top + 34; y < bot - 20; y += 30) archWin(g, cx - 6, y, 12, 20, WT, GL);
    // open belfry with arches + bell
    cornice(g, cx - w / 2, top - 4, w);
    stucco(g, cx - w / 2 + 3, top - 30, w - 6, 26, seed + 1);
    archWin(g, cx - 9, top - 27, 18, 22, WT, '#2a1a28'); R(g, cx - 3, top - 18, 6, 6, '#d8b040'); R(g, cx - 1, top - 20, 2, 2, '#d8b040');
    cornice(g, cx - w / 2 + 3, top - 34, w - 6);
    balustrade(g, cx - w / 2 + 2, top - 34, w - 4);
    // cupola dome with lantern + finial
    GT.circ(g, cx, top - 40, Math.floor(w / 2) - 5, WT); R(g, cx - w / 2 + 5, top - 40, w - 10, 6, WT);
    GT.circ(g, cx, top - 42, Math.floor(w / 2) - 8, PKL); R(g, cx - 4, top - 42 - (w / 2 - 8), 3, 4, '#ffffff');
    R(g, cx - 3, top - 40 - w / 2 - 6, 6, 8, WT); GT.circ(g, cx, top - 40 - w / 2 - 8, 3, PK); R(g, cx, top - 40 - w / 2 - 16, 1, 6, '#c8a040'); R(g, cx - 2, top - 40 - w / 2 - 13, 5, 1, '#c8a040');
  }
  function resort(g, x0, base) {
    const w = 420;
    // main block, 3 floors over an arcaded loggia
    stucco(g, x0, base - 156, w, 156, 11);
    for (let f = 0; f < 2; f++) {
      const fy = base - 150 + f * 48;
      for (let x = x0 + 12; x < x0 + w - 14; x += 24) archWin(g, x, fy + 10, 12, 26, WT, GL);
      cornice(g, x0, fy + 44, w);
    }
    // ground-floor loggia of big arches with white columns
    R(g, x0, base - 52, w, 52, PKD);
    for (let x = x0 + 4; x < x0 + w - 24; x += 30) { archWin(g, x, base - 46, 24, 46, WT, '#5a2a3a'); R(g, x + 4, base - 30, 16, 30, '#7a3a4a'); }
    for (let x = x0; x <= x0 + w; x += 30) R(g, x, base - 50, 4, 50, WT);
    // roofline: white parapet + balustrade (no red roofs)
    cornice(g, x0, base - 160, w); balustrade(g, x0, base - 160, w);
    // stepped center pavilion with the tallest tower
    stucco(g, x0 + 160, base - 190, 100, 34, 21); cornice(g, x0 + 160, base - 194, 100); balustrade(g, x0 + 160, base - 194, 100);
    archWin(g, x0 + 176, base - 186, 14, 28, WT, GL); archWin(g, x0 + 230, base - 186, 14, 28, WT, GL);
    bellTower(g, x0 + 210, base - 250, base - 160, 44, 31);
    // twin bell towers
    bellTower(g, x0 + 70, base - 214, base - 156, 36, 41);
    bellTower(g, x0 + 350, base - 214, base - 156, 36, 51);
    // rounded corner pavilion at the beach end
    stucco(g, x0 + w - 12, base - 176, 46, 176, 61); R(g, x0 + w + 30, base - 176, 4, 176, PKD);
    for (let f = 0; f < 3; f++) archWin(g, x0 + w + 4, base - 166 + f * 48, 14, 28, WT, GL);
    cornice(g, x0 + w - 12, base - 180, 46); balustrade(g, x0 + w - 12, base - 180, 46);
    GT.circ(g, x0 + w + 11, base - 190, 14, WT); GT.circ(g, x0 + w + 11, base - 192, 11, PKL); R(g, x0 + w + 10, base - 212, 2, 10, '#c8a040');
    // sign + awnings
    R(g, x0 + 150, base - 70, 120, 15, WT); R(g, x0 + 152, base - 68, 116, 11, PK);
    GT.text(g, 'SUNSET KEY RESORT', x0 + 210, base - 66, '#ffffff', 1, 1);
    // palms in front of the loggia
    for (const px of [x0 + 20, x0 + 130, x0 + 290, x0 + 400]) palm(g, px, base, 70 + (px % 20), 6);
  }
  GT.pinkPalaceSmall = function (g, x, y) { // tiny far-away version (title / ending horizon)
    R(g, x, y - 16, 56, 16, '#e87a94'); R(g, x, y - 17, 56, 1, '#fbe0e6');
    for (let xx = x + 3; xx < x + 54; xx += 5) R(g, xx, y - 12, 2, 4, (xx % 3) ? '#ffe890' : '#7a3050');
    for (const [tx, h] of [[x + 8, 26], [x + 26, 32], [x + 46, 26]]) { R(g, tx - 3, y - h, 7, h - 16, '#e87a94'); R(g, tx - 4, y - h - 3, 9, 3, '#fbe0e6'); R(g, tx - 2, y - h - 5, 5, 2, '#fbe0e6'); R(g, tx, y - h - 8, 1, 3, '#e8c060'); }
  };
  function grill(g, x0, base) {
    // thatched beach bar & grill
    const w = 230;
    for (const x of [x0 + 6, x0 + 70, x0 + 150, x0 + w - 12]) { R(g, x, base - 80, 6, 80, '#b08840'); for (let y = base - 80; y < base; y += 8) R(g, x, y, 6, 1, '#7a5a20'); }
    R(g, x0 + 10, base - 34, w - 20, 34, '#7a4a20'); R(g, x0 + 10, base - 34, w - 20, 4, '#a06a30'); for (let x = x0 + 14; x < x0 + w - 14; x += 10) R(g, x, base - 30, 1, 30, '#5a3418');
    for (let x = x0 + 22; x < x0 + w - 20; x += 22) { R(g, x, base - 16, 8, 3, '#d03028'); R(g, x + 3, base - 13, 2, 13, '#888'); }
    // bottles shelf
    for (let x = x0 + 30; x < x0 + w - 30; x += 7) { R(g, x, base - 58, 3, 8, ['#3aa860', '#c8a040', '#a03028', '#4080c0'][(x / 7) % 4 | 0]); }
    R(g, x0 + 24, base - 50, w - 48, 2, '#5a3418');
    // thatch roof
    for (let i = 0; i < 46; i++) {
      const ww = w / 2 + 20 - (45 - i) * 1.4;
      R(g, x0 + w / 2 - ww, base - 126 + i, ww * 2, 1, i % 5 === 0 ? '#b08838' : (i % 2 ? '#d8b060' : '#e0c070'));
    }
    for (let x = x0 - 18; x < x0 + w + 18; x += 4) R(g, x, base - 80 + (x % 3), 2, 6 + (x % 5), '#c09848');
    // sign
    R(g, x0 + w / 2 - 50, base - 100, 100, 20, '#5a3418'); R(g, x0 + w / 2 - 48, base - 98, 96, 16, '#8a5a30');
    GT.textO(g, "MAC'S GRILL", x0 + w / 2, base - 94, '#ffd848', 1, 1, '#3a1a08');
    // grill
    R(g, x0 + w - 60, base - 46, 40, 12, '#303030'); R(g, x0 + w - 60, base - 48, 40, 2, '#888');
    for (let x = x0 + w - 58; x < x0 + w - 22; x += 6) R(g, x, base - 52, 4, 3, '#a0602a');
  }
  function sideBoat(g, x, y) { // Thunderhead side view, moored
    R(g, x, y, 120, 14, '#16161e'); for (let i = 0; i < 14; i++) R(g, x + 120 + i, y + i * 0.6, 1, 14 - i, '#16161e');
    R(g, x, y + 5, 132, 2, '#e02828'); R(g, x, y, 130, 1, '#c8d0e0');
    R(g, x + 30, y - 12, 50, 12, '#24242e'); R(g, x + 50, y - 10, 34, 8, '#50b8e8'); R(g, x + 30, y - 12, 50, 1, '#c8d0e0');
    R(g, x + 10, y - 8, 14, 6, '#8890a0'); R(g, x + 22, y - 7, 3, 4, '#e02828');
    GT.text(g, 'THUNDERHEAD', x + 34, y + 8, '#c8d0e0');
  }
  GT.sideBoat = sideBoat;
  function paintBeachMid(g, W) {
    g.translate(BG_PAD, -BG_Y0);
    const base = 318;
    // sand / ground
    GT.grad(g, -BG_PAD, base - 4, W + BG_PAD * 2, 380, ['#ecd49a', '#f0d8a0', '#f2dca8', '#ecd29a']);
    const r = GT.srand(77);
    for (let i = 0; i < W * 1.4; i++) R(g, -BG_PAD + r() * (W + BG_PAD * 2), base + r() * 380, 2, 1, r() < 0.5 ? '#dcc088' : '#fff0c8');
    // boardwalk
    R(g, -BG_PAD, base, 1060 + BG_PAD, 20, '#b88850'); for (let x = -BG_PAD; x < 1060; x += 9) R(g, x, base, 1, 20, '#8a5a30'); R(g, -BG_PAD, base + 20, 1060 + BG_PAD, 3, '#6a4020');
    // palms behind
    for (const x of [-20, 40, 480, 540, 900, 1240, 1290]) palm(g, x, base, 110 + (x % 30), 10 * ((x / 10) % 2 ? 1 : -1));
    resort(g, 40, base);
    // cabanas, lifeguard tower and umbrellas between the hotel and the grill
    for (const cx of [600, 700, 800]) {
      stucco(g, cx, base - 70, 70, 70, cx);
      archWin(g, cx + 24, base - 46, 22, 46, WT, '#5a2a3a'); archWin(g, cx + 6, base - 60, 12, 20, WT, GL); archWin(g, cx + 52, base - 60, 12, 20, WT, GL);
      cornice(g, cx, base - 74, 70); balustrade(g, cx, base - 74, 70); GT.circ(g, cx + 35, base - 84, 9, WT); GT.circ(g, cx + 35, base - 86, 7, PKL);
    }
    g.translate(30, 0); // lifeguard tower (shifted clear of the hotel's corner pavilion)
    for (const lx of [500, 548]) R(g, lx, base - 90, 4, 90, '#e8e0d0');
    for (let yy = base - 80; yy < base; yy += 18) R(g, 500, yy, 52, 2, '#c8c0b0');
    R(g, 492, base - 120, 68, 30, '#e8402e'); R(g, 492, base - 120, 68, 3, '#ff7050'); R(g, 498, base - 112, 56, 14, '#f6f2e8');
    GT.text(g, 'LIFEGUARD', 526, base - 108, '#c02020', 1, 1);
    for (let i = 0; i < 14; i++) R(g, 526 - (8 + i * 3), base - 134 + i, 16 + i * 6, 1, i % 2 ? '#f6f2e8' : '#e8402e');
    g.translate(-30, 0);
    grill(g, 940, base);
    // dock section: water fills, then pier
    R(g, 1300, base - 40, W - 1300 + BG_PAD, 420, '#2a90cc');
    for (let i = 0; i < 200; i++) R(g, 1300 + r() * (W - 1300), base - 40 + r() * 420, 3 + r() * 6, 1, r() < 0.5 ? '#80c8f0' : '#e8f8ff');
    for (let x = 1290; x < 1310; x++) R(g, x, base - 40, 1, 420, (x % 3) ? '#e8f8ff' : '#f0d8a0');
    // pier planks covering walk band
    R(g, 1300, base + 12, W - 1300 + BG_PAD, 140, '#9a6a38');
    for (let y = base + 12; y < base + 152; y += 7) R(g, 1300, y, W - 1300 + BG_PAD, 1, '#6a4420');
    for (let x = 1300; x < W + BG_PAD; x += 46) { R(g, x, base + 2, 6, 14, '#5a3418'); R(g, x, base + 150, 6, 30, '#5a3418'); }
    R(g, 1300, base + 150, W - 1300 + BG_PAD, 4, '#4a2a10');
    sideBoat(g, 1450, base - 14);
    R(g, 1300, base + 8, W - 1300 + BG_PAD, 4, '#c8a070');
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  GT.Stage2 = function () {
    const cfg = {
      name: 'stage2', title: 'STAGE 2', sub: 'PARADISE BEACH', hint: ['FIRE: PUNCH COMBO   JUMP+FIRE: KICK', 'WALK INTO A THUG TO GRAB HIM', 'GRAB+JUMP: THROW   SPCL: BODY SLAM'], music: 'beach', worldW: 1720, yMin: 344, yMax: 448, farPar: 0.25,
      groundCol: '#ecd29a', bossName: 'BIG RICO THE BOUNCER', birds: '#f8f8f8',
      paintFar: paintBeachFar, paintMid: paintBeachMid,
      props: [{ k: 'tiki', x: 190, y: 352 }, { k: 'barrel', x: 260, y: 430 }, { k: 'torch', x: 470, y: 348 }, { k: 'tiki', x: 640, y: 420 }, { k: 'barrel', x: 820, y: 360 },
        { k: 'torch', x: 960, y: 350 }, { k: 'tiki', x: 1090, y: 432 }, { k: 'barrel', x: 1200, y: 356 }, { k: 'barrel', x: 1380, y: 430 }],
      waves: [
        { at: 0, en: [['thug', 'thugA', 1, 0.8], ['thug', 'thugB', 1, 2.2]] },
        { at: 260, en: [['thug', 'thugC', 1], ['thug', 'thugA', -1, 0.8], ['bottle', 'thugB', 1, 1.6]] },
        { at: 560, en: [['brute', 'brute', 1], ['thug', 'thugC', -1, 0.6], ['thug', 'thugA', 1, 2.5], ['bottle', 'thugB', 1, 3.5]] },
        { at: 900, en: [['thug', 'thugA', 1], ['bottle', 'thugC', 1, 0.5], ['thug', 'thugB', -1, 1.2], ['brute', 'brute', 1, 3], ['thug', 'thugC', -1, 4]] },
        { at: 1450, boss: true, bossTitle: 'BOUNCER ON THE DOCK!', en: [['bouncer', 'bouncer', 1, 0.5], ['thug', 'thugA', -1, 6], ['thug', 'thugB', 1, 12]] }
      ],
      drawFront(g, st, v) { },
    };
    return Brawl(cfg);
  };

  /* =================== STAGE 5: STUNT BACKLOT =================== */
  function paintDesertFar(g, w) {
    GT.grad(g, 0, 0, w, 400, ['#3a7ac8', '#4a8ad0', '#609cd8', '#80b4e0', '#a8cce4', '#d8dcc8', '#f0e0b0']);
    const hz = 400;
    // mesas
    g.fillStyle = '#c89868';
    const r = GT.srand(12);
    let x = 0;
    while (x < w) {
      const mw = 50 + r() * 90, mh = 22 + r() * 46;
      for (let i = 0; i < mh; i++) {
        const t = i / mh, ww = Math.round(mw * (0.55 + 0.45 * Math.pow(t, 1.6)));
        R(g, x + (mw - ww) / 2, hz - mh + i, ww, 1, i < 3 ? '#e8b888' : (Math.floor(i / 7) % 2 ? '#c08a5a' : '#b47e50'));
        R(g, x + (mw - ww) / 2, hz - mh + i, 2, 1, '#d8a070');
      }
      x += mw + r() * 70;
    }
    GT.grad(g, 0, hz, w, 300, ['#e8c890', '#e0bc80', '#d8b478']);
  }
  function adobe(g, x, base, w, h, opts) {
    R(g, x, base - h, w, h, '#d8a868'); R(g, x, base - h, w, 3, '#e8c088'); R(g, x, base - h, 3, h, '#b88848');
    const r = GT.srand(x | 0);
    for (let i = 0; i < w * h / 90; i++) R(g, x + 3 + r() * (w - 10), base - h + 5 + r() * (h - 8), 6 + r() * 6, 2, '#c89858');
    for (let y = base - h + 20; y < base - 30; y += 44) for (let xx = x + 12; xx < x + w - 20; xx += 34) {
      R(g, xx, y, 16, 22, '#4a2e1c'); GT.circ(g, xx + 8, y, 8, '#4a2e1c'); R(g, xx - 1, y + 22, 18, 3, '#b88848');
    }
    if (opts && opts.balcony) { const by = base - h + 60; R(g, x + 10, by, w - 20, 4, '#7a4a28'); for (let xx = x + 12; xx < x + w - 10; xx += 5) R(g, xx, by - 12, 2, 12, '#8a5a30'); R(g, x + 10, by - 14, w - 20, 3, '#8a5a30'); }
    if (opts && opts.awning) { const ay = base - 62; for (let i = 0; i < 14; i++) R(g, x + 6 - i, ay + i, w - 12 + i * 2, 1, i % 2 ? '#e8dcc0' : (opts.stripe || '#c84830')); R(g, x + 4, ay + 14, 2, 48, '#6a4020'); R(g, x + w - 6, ay + 14, 2, 48, '#6a4020'); }
    // door
    R(g, x + w / 2 - 12, base - 40, 24, 40, '#3a2414'); GT.circ(g, x + w / 2, base - 40, 12, '#3a2414');
    // roof stuff
    if (opts && opts.barrels) { R(g, x + 10, base - h - 14, 12, 14, '#6a6a70'); R(g, x + 26, base - h - 12, 12, 12, '#8a8a90'); }
  }
  function truck(g, x, base) {
    // army truck side view (facing left)
    const c = '#5a6038', d = '#40462a', l = '#78804c';
    R(g, x, base - 54, 110, 36, d); R(g, x + 2, base - 52, 106, 32, c); // cargo canvas
    for (let i = 0; i < 6; i++) R(g, x + 6 + i * 18, base - 52, 2, 32, d);
    R(g, x - 52, base - 46, 52, 28, c); R(g, x - 52, base - 46, 52, 3, l); R(g, x - 44, base - 42, 20, 12, '#90b0c0'); R(g, x - 44, base - 42, 6, 4, '#d0e8f0');
    R(g, x - 62, base - 34, 12, 16, d); for (let y = base - 32; y < base - 20; y += 3) R(g, x - 61, y, 10, 1, '#2a2e1a');
    R(g, x - 64, base - 22, 178, 6, '#2a2e1a');
    GT.text(g, '5-US', x + 40, base - 40, '#e8e0c0');
    for (const wx of [x - 38, x + 30, x + 80]) { GT.circ(g, wx, base - 10, 11, '#1a1a1a'); GT.circ(g, wx, base - 10, 5, '#6a6a60'); GT.circ(g, wx, base - 10, 2, '#2a2a2a'); }
    R(g, x - 66, base - 30, 4, 4, '#f0e070');
  }
  function falseFront(g, x, base, w, h, label, col) {
    R(g, x, base - h, w, h, col); R(g, x, base - h, w, 4, '#5a3418'); for (let xx = x; xx < x + w; xx += 6) R(g, xx, base - h + 4, 1, h - 4, '#00000022');
    R(g, x + 10, base - h + 10, w - 20, 18, '#f0e0b0'); GT.text(g, label, x + w / 2, base - h + 16, '#6a2010', 1, 1);
    R(g, x + 8, base - 60, w - 16, 3, '#5a3418'); for (let xx = x + 10; xx < x + w - 8; xx += 30) R(g, xx, base - 60, 3, 60, '#5a3418');
    R(g, x + w / 2 - 14, base - 44, 28, 44, '#2a1a0a'); R(g, x + w / 2 - 1, base - 44, 2, 44, '#6a4020');
    // braces behind (it's a movie set!)
    for (let i = 0; i < 14; i++) R(g, x + w + i * 2, base - h + 20 + i * 6, 2, 6, '#8a6030');
  }
  function spotlight(g, x, base) {
    R(g, x, base - 40, 2, 40, '#333'); R(g, x - 8, base - 2, 18, 2, '#333'); R(g, x - 6, base - 50, 14, 12, '#2a2a2a'); R(g, x + 6, base - 48, 3, 8, '#fff8c0');
  }
  function drumStack(g, x, base) {
    const D = GT.S.drum;
    for (let row = 0; row < 4; row++) for (let i = 0; i < 6 - row; i++) g.drawImage(D, x + i * 15 + row * 7, base - 18 - row * 17);
  }
  function paintDesertMid(g, W) {
    g.translate(BG_PAD, -BG_Y0);
    const base = 330;
    GT.grad(g, -BG_PAD, base - 6, W + BG_PAD * 2, 380, ['#dcb880', '#d8b47a', '#d2ad72', '#ccA66c'.toLowerCase()]);
    const r = GT.srand(31);
    for (let i = 0; i < W * 1.5; i++) R(g, -BG_PAD + r() * (W + BG_PAD * 2), base + r() * 380, 2, 1, r() < 0.5 ? '#c49a62' : '#ecd0a0');
    for (let x = -BG_PAD; x < W + BG_PAD; x += 3) { R(g, x, base + 40 + Math.sin(x * 0.05) * 2, 3, 2, '#c09060'); R(g, x, base + 96 + Math.sin(x * 0.04) * 2, 3, 2, '#c09060'); }
    adobe(g, -40, base, 150, 170, { balcony: true, barrels: true });
    adobe(g, 120, base, 120, 120, { awning: true });
    falseFront(g, 260, base, 120, 150, 'SALOON', '#a86a3a');
    adobe(g, 420, base, 120, 190, { balcony: true, awning: true, stripe: '#3a7ab0' });
    truck(g, 640, base - 4);
    spotlight(g, 760, base - 2);
    falseFront(g, 800, base, 130, 140, 'BANK', '#8a8a7a');
    adobe(g, 960, base, 160, 160, { awning: true, balcony: true, barrels: true });
    R(g, 1140, base - 120, 160, 120, '#9a9488'); R(g, 1140, base - 120, 160, 4, '#c8c0b0'); for (let x = 1144; x < 1296; x += 8) R(g, x, base - 116, 1, 116, '#7a7468'); // hangar wall
    GT.text(g, 'STAGE 9 - NO ENTRY', 1220, base - 100, '#c02020', 1, 1);
    R(g, 1180, base - 80, 80, 80, '#3a3a3a');
    spotlight(g, 1320, base - 2);
    adobe(g, 1340, base, 120, 150, { balcony: true });
    drumStack(g, W - 110, base + 2);
    R(g, W - 120, base - 8, 120, 4, '#00000033');
    // studio sign
    R(g, 180, base - 230, 140, 26, '#2a2a3a'); R(g, 182, base - 228, 136, 22, '#3a3a50'); GT.textO(g, 'STUDIO 9 BACKLOT', 250, base - 221, '#ffd848', 1, 1);
    R(g, 200, base - 204, 3, 74, '#555'); R(g, 296, base - 204, 3, 74, '#555');
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // propeller plane boss (side view, faces left)
  let planeSpr = null;
  function planeSprite() {
    if (planeSpr) return planeSpr;
    planeSpr = GT.spr(120, 56, g => {
      const c = '#a8aab0', d = '#7a7c84', l = '#d8dae0';
      // fuselage
      for (let x = 10; x < 112; x++) { const t = (x - 10) / 102; const h = Math.round(22 - Math.max(0, t - 0.55) * 30); R(g, x, 26 - h / 2, 1, h, c); R(g, x, 26 - h / 2, 1, 2, l); R(g, x, 26 + h / 2 - 3, 1, 3, d); }
      // tail fin
      for (let i = 0; i < 20; i++) R(g, 100 + i * 0.5, 6 + i, 12 - i * 0.3, 1, c);
      R(g, 104, 6, 10, 2, '#c02020');
      // cockpit
      R(g, 28, 12, 22, 9, '#405060'); R(g, 30, 13, 8, 4, '#a0d0f0'); R(g, 40, 13, 8, 4, '#a0d0f0');
      // wing (seen edge-on, slightly below)
      R(g, 30, 30, 50, 5, d); R(g, 30, 30, 50, 1, l); R(g, 6, 30, 22, 4, d);
      // engine cowling nose
      R(g, 4, 18, 10, 16, '#5a5c64'); R(g, 0, 22, 5, 8, '#3a3a40');
      // gear
      R(g, 26, 36, 3, 10, '#333'); GT.circ(g, 27, 48, 5, '#1a1a1a'); GT.circ(g, 27, 48, 2, '#666');
      R(g, 96, 34, 2, 8, '#333'); GT.circ(g, 97, 44, 3, '#1a1a1a');
      // markings
      R(g, 60, 20, 30, 3, '#c02020'); GT.text(g, 'K-1', 62, 24, '#202020');
      for (let x = 14; x < 100; x += 12) R(g, x, 24, 1, 1, '#5a5c64');
    });
    return planeSpr;
  }

  GT.Stage5 = function () {
    const PL = { active: false, x: 0, y: 0, dir: -1, hp: 320, max: 320, t: 0, state: 'wait', waitT: 2, flash: 0, fireT: 1.5, dead: false, finale: 0 };
    let drumTimer = 0;
    const cfg = {
      name: 'stage5', title: 'STAGE 5', sub: 'STUNT BACKLOT', hint: ['FIRE: SHOOT, OR PUNCH UP CLOSE', 'BLOW THE FUEL DRUMS!'], music: 'backlot', worldW: 1560, yMin: 352, yMax: 450, farPar: 0.2, gun: true,
      groundCol: '#cca66c', bossName: 'VICTOR KADE', birds: '#3a2a2a', endDelay: 3.5, clearText: 'MISSION COMPLETE!',
      paintFar: paintDesertFar, paintMid: paintDesertMid,
      props: [{ k: 'crate', x: 220, y: 360 }, { k: 'barrel', x: 380, y: 440 }, { k: 'drum', x: 520, y: 368 }, { k: 'crate', x: 700, y: 444 },
        { k: 'drum', x: 860, y: 362 }, { k: 'drum', x: 875, y: 372 }, { k: 'barrel', x: 1040, y: 440 }, { k: 'crate', x: 1150, y: 364 }],
      waves: [
        { at: 0, en: [['soldier', 'soldier', 1, 0.8], ['soldier', 'soldier', 1, 2]] },
        { at: 300, en: [['soldier', 'soldier', 1], ['rifle', 'soldier', 1, 1], ['soldier', 'soldier2', -1, 2]] },
        { at: 600, en: [['brute', 'soldier2', 1], ['rifle', 'soldier', 1, 0.8], ['soldier', 'soldier', -1, 1.6], ['soldier', 'soldier', 1, 3]] },
        { at: 940, en: [['rifle', 'soldier', 1], ['soldier', 'soldier2', -1, 0.6], ['soldier', 'soldier', 1, 1.5], ['rifle', 'soldier', -1, 2.5], ['brute', 'soldier2', 1, 4]] },
        {
          at: 1290, boss: true, bossTitle: 'KADE TAKES OFF!', en: [['soldier', 'soldier', -1, 8], ['rifle', 'soldier', 1, 16], ['soldier', 'soldier', 1, 26]],
          extra(st, dt) { if (!PL.active) { PL.active = true; PL.state = 'wait'; PL.waitT = 2.5; PL.x = st.camX + 360; PL.dir = -1; } },
          until(st) { return PL.dead; }
        }
      ],
      bossHP: () => PL.active && !PL.dead ? PL.hp : 0, bossMax: 320,
      onDrum(st, pr) {
        if (PL.active && !PL.dead && Math.abs(PL.x - pr.x) < 70 && Math.abs(PL.y - pr.y) < 26) damagePlane(st, 70, pr.x);
      },
      meleeExtra(st, range, dmg, aoe) {
        const P = st.P;
        if (!PL.active || PL.dead || PL.state !== 'taxi') return false;
        const dx = PL.x - P.x;
        if (Math.abs(P.y - PL.y) < 14 && (aoe ? Math.abs(dx) < 60 : (dx * P.face > -50 && dx * P.face < 60 + range))) { damagePlane(st, Math.round(dmg / 2)); return true; }
        return false;
      },
      shotExtra(st, s) {
        if (!PL.active || PL.dead || PL.state !== 'taxi') return false;
        if (Math.abs(s.x - PL.x) < 52 && Math.abs(s.y - PL.y) < 16) { damagePlane(st, 3, s.x); st.fx.spark(s.x, s.y - 24, 3); return true; }
        return false;
      },
      thrownExtra(st, e) {
        if (PL.active && !PL.dead && PL.state === 'taxi' && Math.abs(e.x - PL.x) < 50 && Math.abs(e.y - PL.y) < 14 && !e.hitPlane) { e.hitPlane = true; damagePlane(st, 20); }
      },
      update(st, dt) {
        if (!PL.active) return;
        PL.t += dt; PL.flash -= dt;
        window.__plTaxi = PL.state === 'taxi' && Math.abs(PL.x - (st.camX + 135)) < 50;
        const P = st.P;
        if (PL.dead) {
          // finale: burning plane rolls into the fuel-drum stack
          PL.finale += dt;
          if (PL.state !== 'crash') { PL.state = 'crash'; PL.dir = 1; }
          PL.x += 90 * dt; PL.y += (380 - PL.y) * dt;
          if (Math.random() < 0.5) st.fx.smoke(PL.x + GT.rnd(-30, 30), PL.y - 40, 5, -30);
          if (Math.random() < 0.15) st.fx.boom(PL.x + GT.rnd(-40, 40), PL.y - 30, 0.8);
          if (PL.x > st.camX + 230 && !PL.blown) {
            PL.blown = true; GT.flash(0.4); GT.shake(14);
            for (let i = 0; i < 9; i++) setTimeout(() => { st.fx.boom(st.camX + 200 + GT.rnd(-50, 60), 330 + GT.rnd(-60, 20), GT.rnd(1.8, 3.4)); GT.flash(0.1); }, i * 160 / GT.speed);
            setTimeout(() => { PL.gone = true; st.finish(); }, 900 / GT.speed);
          }
          return;
        }
        if (PL.state === 'wait') {
          PL.waitT -= dt;
          if (PL.waitT <= 0) { PL.state = 'warn'; PL.waitT = 1.1; PL.y = GT.clamp(P.y, 356, 446); PL.x = PL.dir < 0 ? st.camX + 340 : st.camX - 70; GT.sfx('alarm'); }
        } else if (PL.state === 'warn') {
          PL.waitT -= dt; if (PL.waitT <= 0) PL.state = 'taxi';
        } else if (PL.state === 'taxi') {
          PL.x += PL.dir * (PL.hp < PL.max / 2 ? 150 : 115) * dt;
          if (Math.random() < 0.7) st.fx.smoke(PL.x - PL.dir * 50, PL.y - 2, 3, -8);
          // propeller hurts
          if (Math.abs(P.y - PL.y) < 12 && Math.abs(P.x - (PL.x + PL.dir * 52)) < 16 && P.z < 30) st.hurtPlayer(20, true, PL.x);
          else if (Math.abs(P.y - PL.y) < 10 && Math.abs(P.x - PL.x) < 48 && P.z < 20) st.hurtPlayer(10, true, PL.x);
          // smash drums in path
          for (const pr of st.props) if (!pr.broken && pr.k === 'drum' && Math.abs(pr.y - PL.y) < 14 && Math.abs(pr.x - (PL.x + PL.dir * 50)) < 12) st.explodeDrum(pr);
          // enemies in path get bowled over
          for (const e of st.en) if (!e.dead && e.s !== 'down' && Math.abs(e.y - PL.y) < 10 && Math.abs(e.x - PL.x) < 50) { e.hp -= 15; e.s = 'fly'; e.vz = 160; e.vx = PL.dir * 120; e.t = 0; }
          PL.fireT -= dt;
          if (PL.fireT <= 0) { PL.fireT = 1.3; st.shots.push({ x: PL.x - 6 * PL.dir, y: PL.y, z: 36, vx: (P.x > PL.x ? 1 : -1) * 160, own: 'e', k: 'bullet', t: 0, dmg: 8 }); GT.sfx('pistol'); }
          if ((PL.dir < 0 && PL.x < st.camX - 80) || (PL.dir > 0 && PL.x > st.camX + 350)) { PL.state = 'wait'; PL.waitT = 1.6; PL.dir = -PL.dir; }
        }
        // keep fuel drums coming (rolled off the truck by the crew)
        drumTimer -= dt;
        const n = st.props.filter(p => !p.broken && p.k === 'drum').length;
        if (drumTimer <= 0 && n < 3) { drumTimer = 2.5; st.props.push({ k: 'drum', x: st.camX + GT.rnd(40, 230), y: GT.rnd(358, 444), hp: 1, broken: false, flash: 0 }); st.fx.smoke(st.props[st.props.length - 1].x, st.props[st.props.length - 1].y, 5, -10); }
      },
      sortables(st, list, g) {
        if (!PL.active || PL.gone) return;
        list.push({
          y: PL.y + 2, d: () => {
            const sx = Math.round(PL.x - st.camX), flip = PL.dir > 0;
            if (PL.state === 'warn') {
              const ex = PL.dir < 0 ? 254 : 16;
              if (Math.floor(PL.t * 8) % 2) { GT.textO(g, '!', ex, PL.y - 30, '#ff3030', 3, 1); }
              R(g, 0, PL.y - 1, 270, 1, 'rgba(255,60,40,0.5)');
              return;
            }
            if (PL.state === 'wait') return;
            g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(sx - 50, Math.round(PL.y) - 3, 100, 5);
            const sp = planeSprite();
            GT.draw(g, sp, sx, Math.round(PL.y) + 5, flip, 60, 56, PL.flash > 0);
            // pilot
            const px = sx + (flip ? 1 : -1) * 22;
            R(g, px - 3, Math.round(PL.y) - 44, 7, 6, '#f0c098'); R(g, px - 3, Math.round(PL.y) - 46, 7, 3, '#d8d8e0');
            // propeller
            const nx = sx + (flip ? 61 : -61), ny = Math.round(PL.y) - 30;
            const f = Math.floor(PL.t * 30) % 3;
            if (f === 0) R(g, nx - 1, ny - 14, 3, 28, '#c8c8d0'); else if (f === 1) { R(g, nx - 1, ny - 6, 3, 12, '#c8c8d0'); R(g, nx - 1, ny - 14, 3, 4, '#ffffff66'); } else R(g, nx - 1, ny - 14, 2, 28, '#ffffff55');
            if (PL.dead) for (let i = 0; i < 3; i++) GT.circ(g, sx + GT.rnd(-30, 30), Math.round(PL.y) - 34 + GT.rnd(-6, 6), GT.rnd(3, 6), Math.random() < 0.5 ? '#ff9a2a' : '#ffe070');
          }
        });
      },
      botExtra(st, b, P) {
        if (!PL.active || PL.dead) return false;
        const live = st.en.filter(e => !e.dead && e.s !== 'down' && e.s !== 'dead');
        if (live.length) return false;
        // stand on a lane away from the plane, shoot it when it taxis
        if (PL.state === 'taxi' || PL.state === 'warn') {
          // stand just outside the plane's lane: shots (|dy|<16) still hit it, the propeller (|dy|<12) misses
          const wantY = PL.y + (PL.y < 400 ? 13 : -13);
          const dy = wantY - P.y;
          b.y = Math.abs(dy) > 1 ? GT.clamp(dy / 4, -1, 1) : 0;
          const d = Math.sign(PL.x - P.x) || 1;
          if (P.face !== d) b.x = d * 0.3;
          st.botT2 = (st.botT2 || 0) + 1 / 60;
          if (st.botT2 > 0.24) { st.botT2 = 0; b.fireP = true; }
          return true;
        }
        b.x = GT.clamp((st.camX + 135 - P.x) / 20, -1, 1); b.y = GT.clamp((PL.y - P.y) / 10, -1, 1) * 0;
        return true;
      }
    };
    function damagePlane(st, d, x) {
      if (PL.dead) return;
      PL.hp -= d; PL.flash = 0.08; GT.addScore(d * 20);
      if (d >= 40) { st.fx.pop(PL.x, PL.y - 60, 'DIRECT HIT!', '#ffe070'); GT.shake(8); }
      if (PL.hp <= 0) { PL.hp = 0; PL.dead = true; GT.addScore(20000); st.banner_('KADE IS GOING DOWN!', 2.5); GT.sfx('bigboom'); st.shots.length = 0; for (const e of st.en) { e.hp = 0; e.s = 'fly'; e.vz = 150; e.vx = 80; } }
    }
    return Brawl(cfg);
  };
})();
