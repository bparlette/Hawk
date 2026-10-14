// ======================= FELLS POINT ROOFTOP RUN: side-scrolling platformer (Brad 2026-10-12 14:06 "top 20 play styles", DESIGN.md "Fells Point Rooftop Run").
// 2.5D locked side camera over Fells Point / Canton rooftops: rowhouse formstone, chimneys, clotheslines, the Domino Sugars sign on the skyline.
// Harold runs, jumps, swings the cane (B) and butt-stomps (stick DOWN in the air). Mavis waits at checkpoints (refills hearts). Foes: rooftop PIGEONS, gutter RATS,
// Bandit LOOKOUTS (throw bricks). Crab tokens everywhere; a green DOWNSPOUT (stand on it, push DOWN) warps ahead with a crab cache. 3 short levels:
// 1 THAMES STREET ROOFS, 2 CANTON CHIMNEYS, 3 THE STEEPLE (flagpole finish on the church steeple). 4 hearts; a fall costs one heart and puts you back at the last
// checkpoint; hearts at 0 = RETRY. Level flagpole = next level; the steeple pole = win (remembered: localStorage tcb_rr_won, DUELS.log 'rooftop:win').
// Runs on the DUELS core (own scene, HUD, RETRY / LEAVE, radio duck). Side quest: no boss clear.
// Controls: stick / A D = run, A (J / panel A) = JUMP, B (K) = CANE swing, stick DOWN in the air = BUTT-STOMP (also kills what it lands on), DOWN on the downspout = warp, E = LEAVE.
// Entry: ACT "ROOFTOP RUN" at the fire-escape ladder in Fells Point (any time). Tests: ?duel=rooftop starts at once; &rrauto=win|lose (or &duelbot=); &rrlevel=0..2.
// RIG HOOK (procedural stand-ins until real rigs drop in): window.buildRooftopFoe(ctx, kind) kind = 'rat'|'pigeon'|'bandit' -> Object3D (front +X, about 0.6 tall).
// <RRSIM> (pure logic, no THREE; node-testable) -----------------------------------------------------------------------------------------------------
const RRSIM = (function () {
  const HW = 0.3, HH = 1.15, G = 30, RUN = 6.4, JV = 12.2, MAXHP = 4, KILLY = -7;
  const LEVELS = [];
  function build(name, len, o) { // o: roofs [x0,x1,h], chim [x,roofH,h,w], line [x0,x1,y], foes, checks [x], pipes, flag x, steps
    const solids = [], tokens = [], foes = [], checks = [], pipes = [];
    for (const [x0, x1, h] of o.roofs) solids.push({ x0, x1, y0: -30, y1: h, k: 'roof' });
    for (const [x, rh, h, w = 1.1] of o.chim || []) solids.push({ x0: x - w / 2, x1: x + w / 2, y0: rh, y1: rh + h, k: 'chim' });
    for (const [x0, x1, y] of o.line || []) solids.push({ x0, x1, y0: y - 0.12, y1: y, k: 'line', ow: true });
    const topAt = (x) => { let t = -99; for (const s of solids) if (s.k === 'roof' && x >= s.x0 && x <= s.x1) t = Math.max(t, s.y1); return t; };
    for (const [x, to] of o.pipes || []) { const t = topAt(x); solids.push({ x0: x - 0.42, x1: x + 0.42, y0: t, y1: t + 0.9, k: 'pipe' }); pipes.push({ x, y: t + 0.9, to, ty: topAt(to) }); }
    for (const [x0, x1, y, n] of o.tokens || []) for (let i = 0; i < n; i++) tokens.push({ x: n > 1 ? x0 + (x1 - x0) * i / (n - 1) : x0, y, got: false });
    for (const f of o.foes || []) { const e = Object.assign({ hp: 1, dir: -1, t: Math.random() * 6, dead: 0, id: foes.length }, f); if (e.k === 'rat') { e.y = topAt(e.x); e.w = 0.5; e.h = 0.5; } else if (e.k === 'pigeon') { e.w = 0.6; e.h = 0.5; e.by = e.y; } else { e.y = topAt(e.x); e.w = 0.6; e.h = 1.0; e.hp = 2; e.cd = 1.2; } foes.push(e); }
    for (const x of o.checks || []) checks.push({ x, y: topAt(x), on: false });
    const fx = o.flag, fy = topAt(fx);
    return { name, len, solids, tokens, foes, checks, pipes, flag: { x: fx, y: fy, h: o.poleH || 5 }, topAt, spawn: { x: o.spawnX == null ? 0 : o.spawnX, y: topAt(o.spawnX == null ? 0 : o.spawnX) }, theme: o.theme };
  }
  const defs = [
    () => build('THAMES STREET ROOFS', 112, { theme: 'day',
      roofs: [[-8, 14, 0], [17.5, 31, 1], [34, 46, 0], [49.5, 54, 1.8], [57.5, 71, 0.8], [74.5, 90, 0], [93.5, 114, 1]],
      chim: [[24, 1, 1.4], [40, 0, 1.3], [64, 0.8, 1.4], [82, 0, 1.6]], line: [[7, 11, 2.3], [60, 66, 3.1], [97, 101, 3.0]],
      pipes: [[36, 59]], checks: [32, 72], foes: [{ k: 'rat', x: 22, x0: 19, x1: 29 }, { k: 'rat', x: 40, x0: 36.5, x1: 45 }, { k: 'pigeon', x: 55.5, y: 3.4, x0: 52, x1: 59 }, { k: 'rat', x: 68, x0: 60, x1: 70 }, { k: 'bandit', x: 85, x0: 85, x1: 85 }, { k: 'rat', x: 100, x0: 96, x1: 111 }],
      tokens: [[1, 12, 1.3, 6], [19, 29, 2.4, 5], [35.5, 44.5, 1.3, 5], [16, 17, 3.0, 2], [31.5, 33.5, 2.6, 2], [47, 49, 2.8, 2], [53, 57, 3.4, 3], [60, 66, 3.9, 4], [72, 74.5, 2.4, 2], [76, 88, 1.3, 5], [91, 93, 2.4, 2], [96, 112, 2.3, 6]], flag: 108, poleH: 5, spawnX: 0 }),
    () => build('CANTON CHIMNEYS', 132, { theme: 'dusk',
      roofs: [[-8, 12, 0.5], [15.5, 27, 1.5], [30.5, 38, 0.5], [41.5, 49, 2.0], [52.5, 65, 1.0], [68.5, 74, 2.4], [77, 91, 1.2], [94.5, 107, 0], [110, 134, 1.2]],
      chim: [[20, 1.5, 1.3], [34, 0.5, 1.5], [45, 2.0, 1.2], [58, 1, 1.6], [62, 1, 1.2], [83, 1.2, 1.6], [99, 0, 1.8], [118, 1.2, 1.3]],
      line: [[22, 26, 3.4], [53, 57, 2.9], [78, 82, 3.1], [111, 115, 3.0]],
      pipes: [[51.5 + 3, 78]], checks: [28, 66, 96], foes: [{ k: 'rat', x: 18, x0: 16, x1: 26 }, { k: 'pigeon', x: 29, y: 3.0, x0: 27, x1: 31 }, { k: 'rat', x: 44, x0: 42, x1: 48 }, { k: 'bandit', x: 56, x0: 56, x1: 56 }, { k: 'pigeon', x: 70, y: 4.6, x0: 66, x1: 76 }, { k: 'rat', x: 88, x0: 78, x1: 90 }, { k: 'bandit', x: 104, x0: 104, x1: 104 }, { k: 'rat', x: 122, x0: 111, x1: 133 }, { k: 'pigeon', x: 124, y: 3.4, x0: 112, x1: 130 }],
      tokens: [[0, 10, 1.9, 5], [16, 26, 3.0, 5], [28, 40, 2.0, 5], [42, 48, 3.4, 4], [53, 64, 2.4, 5], [67, 75, 3.8, 4], [78, 90, 2.6, 5], [95, 106, 1.4, 5], [111, 132, 2.6, 7]], flag: 128, poleH: 5, spawnX: 0 }),
    () => { const roofs = [[-8, 12, 0], [15, 28, 0.8], [31, 40, 0], [43, 55, 1.5], [58, 66, 0.5]], steps = []; let x = 69.5; for (let i = 0; i < 8; i++) { const h = 2.0 + i * 1.5; roofs.push([x, x + 3.2, h]); steps.push({ x: x + 1.6, h }); x += 3.2; }
      return build('THE STEEPLE', 100, { theme: 'night', roofs, chim: [[22, 0.8, 1.4], [47, 1.5, 1.3], [36, 0, 1.4]], line: [[5, 9, 2.4], [44, 50, 3.2]],
        checks: [30, 56, 69.5 + 3.2 * 3 + 1.6], foes: [{ k: 'rat', x: 20, x0: 16, x1: 27 }, { k: 'pigeon', x: 29.5, y: 3, x0: 28, x1: 31 }, { k: 'bandit', x: 52, x0: 52, x1: 52 }, { k: 'rat', x: 60, x0: 58.5, x1: 65 }, { k: 'pigeon', x: 73, y: 5.2, x0: 69, x1: 80 }, { k: 'bandit', x: 85, x0: 85, x1: 85 }, { k: 'pigeon', x: 92, y: 12, x0: 90, x1: 94 }],
        tokens: [[0, 10, 1.4, 5], [16, 27, 2.1, 5], [32, 39, 1.4, 4], [43, 54, 2.8, 5], [59, 65, 1.9, 3], ...steps.map((s, i) => [s.x, s.x, s.h + 1.2, 1])], flag: 69.5 + 3.2 * 8 - 1.2, poleH: 4, spawnX: 0 }); },
  ];
  function make(seed, startLevel) {
    const st = { lv: 0, L: null, x: 0, y: 0, vx: 0, vy: 0, face: 1, ground: false, coy: 0, jbuf: 0, hp: MAXHP, inv: 0, cane: 0, caneCd: 0, pound: false, tokens: 0, score: 0, over: null, t: 0, lvT: 0, hurt: 0, warp: 0, check: -1, ev: [], bricks: [], trans: 0, pipeHold: 0, stomps: 0, falls: 0, flagGot: 0, run: 0, poundT: 0 };
    function load(i) { st.lv = i; st.L = defs[i](); st.check = -1; st.hp = MAXHP; st.bricks = []; respawn(true); st.lvT = 0; st.trans = 0; st.flagGot = 0; st.ev.push({ k: 'level', x: i }); }
    function respawn(first) { const c = st.check >= 0 ? st.L.checks[st.check] : st.L.spawn; st.x = c.x; st.y = c.y + 0.02; st.vx = st.vy = 0; st.ground = true; st.inv = first ? 0.5 : 1.6; st.pound = false; st.cane = 0; st.coy = 0; st.jbuf = 0; for (const f of st.L.foes) if (f.dead) { /* stay dead */ } }
    function solidsNear(x0, x1) { return st.L.solids.filter((s) => s.x1 > x0 && s.x0 < x1); }
    function hurt(why, kx) { if (st.inv > 0 || st.over) return; st.hp--; st.inv = 1.4; st.hurt = 0.35; st.vy = Math.max(st.vy, 6); st.vx = -(kx || st.face) * 4; st.ground = false; st.pound = false; st.ev.push({ k: 'hurt', x: st.x, y: st.y + 0.8, why }); if (st.hp <= 0) { st.over = 'lose'; st.ev.push({ k: 'over', x: 0 }); } }
    function step(dt, I) {
      if (st.over) return; st.t += dt; st.lvT += dt; st.inv = Math.max(0, st.inv - dt); st.hurt = Math.max(0, st.hurt - dt); st.caneCd = Math.max(0, st.caneCd - dt); st.cane = Math.max(0, st.cane - dt);
      if (st.trans > 0) { st.trans -= dt; if (st.trans <= 0) { if (st.lv >= defs.length - 1) { st.over = 'win'; st.ev.push({ k: 'over', x: 1 }); } else load(st.lv + 1); } return; }
      const mx = Math.abs(I.mx) > 0.25 ? Math.sign(I.mx) : 0, down = I.my < -0.5;
      if (I.a) st.jbuf = 0.13; st.jbuf = Math.max(0, st.jbuf - dt); st.coy = st.ground ? 0.1 : Math.max(0, st.coy - dt);
      // horizontal
      if (st.hurt <= 0) { const tv = mx * RUN, ac = st.ground ? 70 : 42; st.vx += clampN(tv - st.vx, -ac * dt, ac * dt); if (mx) st.face = mx; }
      if (st.pound) st.vx *= 0.9;
      // jump / pound / cane
      if (st.jbuf > 0 && st.coy > 0 && st.hurt <= 0) { st.vy = JV; st.ground = false; st.coy = 0; st.jbuf = 0; st.ev.push({ k: 'jump', x: st.x, y: st.y }); }
      if (!st.ground && down && !st.pound && st.vy < 6 && st.hurt <= 0) { st.pound = true; st.vy = -24; st.vx *= 0.3; st.ev.push({ k: 'poundstart', x: st.x, y: st.y }); }
      if (I.b && st.caneCd <= 0 && st.hurt <= 0 && !st.pound) { st.cane = 0.22; st.caneCd = 0.4; st.ev.push({ k: 'cane', x: st.x, y: st.y + 0.7 }); }
      st.vy -= G * dt; if (st.vy < -30) st.vy = -30;
      // move x, resolve
      st.x += st.vx * dt; for (const s of solidsNear(st.x - HW, st.x + HW)) { if (s.ow) continue; if (st.y < s.y1 - 0.06 && st.y + HH > s.y0 + 0.02) { if (st.vx > 0 && st.x + HW > s.x0 && st.x - HW < s.x0) st.x = s.x0 - HW; else if (st.vx < 0 && st.x - HW < s.x1 && st.x + HW > s.x1) st.x = s.x1 + HW; else if (st.x > (s.x0 + s.x1) / 2 && st.x - HW < s.x1) st.x = s.x1 + HW; else if (st.x < (s.x0 + s.x1) / 2 && st.x + HW > s.x0) st.x = s.x0 - HW; st.vx = 0; } }
      if (st.x < st.L.spawn.x - 7) { st.x = st.L.spawn.x - 7; st.vx = 0; }
      // move y, resolve
      const py = st.y; st.y += st.vy * dt; const wasG = st.ground; st.ground = false;
      for (const s of solidsNear(st.x - HW + 0.02, st.x + HW - 0.02)) {
        if (st.vy <= 0 && py >= s.y1 - 0.08 && st.y <= s.y1) { st.y = s.y1; st.ground = true; if (st.vy < -2 || st.pound) { st.ev.push({ k: 'land', x: st.x, y: st.y, p: st.pound }); } if (st.pound) { pounded(); } st.vy = 0; }
        else if (!s.ow && st.vy > 0 && py + HH <= s.y0 + 0.05 && st.y + HH > s.y0) { st.y = s.y0 - HH; st.vy = 0; }
      }
      if (st.ground && st.pound) st.pound = false;
      if (!st.ground && wasG && st.vy <= 0) { /* walked off an edge: coyote time covers it */ }
      // fall
      if (st.y < KILLY) { st.falls++; st.hp--; st.ev.push({ k: 'fall', x: st.x, y: st.y }); if (st.hp <= 0) { st.over = 'lose'; st.ev.push({ k: 'over', x: 0 }); return; } respawn(false); return; }
      // tokens
      for (const k of st.L.tokens) if (!k.got && Math.abs(k.x - st.x) < 0.7 && Math.abs(k.y - (st.y + 0.55)) < 0.9) { k.got = true; st.tokens++; st.score += 10; st.ev.push({ k: 'token', x: k.x, y: k.y }); }
      // checkpoints (Mavis)
      st.L.checks.forEach((c, i) => { if (!c.on && Math.abs(c.x - st.x) < 1.6 && Math.abs(c.y - st.y) < 2.5) { c.on = true; st.check = Math.max(st.check, i); if (st.hp < MAXHP) st.hp = MAXHP; st.ev.push({ k: 'check', x: c.x, y: c.y + 1.2, i }); } });
      // downspout warp
      st.pipeHold = 0; if (st.ground && down) for (const p of st.L.pipes) if (Math.abs(p.x - st.x) < 0.5 && Math.abs(p.y - st.y) < 0.2) { st.warp += dt; st.pipeHold = st.warp; if (st.warp > 0.35) { st.warp = 0; st.x = p.to; st.y = p.ty + 0.05; st.vx = 0; st.vy = 0; st.inv = 1; st.ev.push({ k: 'warp', x: p.to, y: p.ty + 1 }); for (let j = 0; j < 8; j++) st.L.tokens.push({ x: p.to - 2 + j * 0.5, y: p.ty + 1.0 + Math.sin(j / 7 * Math.PI) * 1.4, got: false, bonus: true }); } } else st.warp = 0; else st.warp = 0;
      // foes
      for (const e of st.L.foes) foe(e, dt);
      for (const b of st.bricks) { b.t += dt; b.vy -= 22 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (Math.abs(b.x - st.x) < HW + 0.22 && b.y > st.y - 0.1 && b.y < st.y + HH && st.inv <= 0) { b.t = 9; hurt('brick', Math.sign(b.vx)); } }
      st.bricks = st.bricks.filter((b) => b.t < 3 && b.y > -8);
      // flag
      const F = st.L.flag; if (!st.flagGot && Math.abs(st.x - F.x) < 0.55 && st.y < F.y + F.h) { st.flagGot = 1; const hh = clampN((st.y - F.y) / F.h, 0, 1); st.score += 100 + Math.round(hh * 400); st.trans = 2.1; st.ev.push({ k: 'flag', x: F.x, y: st.y + 1, h: hh }); }
    }
    function pounded() { st.pound = false; st.ev.push({ k: 'shock', x: st.x, y: st.y }); for (const e of st.L.foes) if (!e.dead && Math.abs(e.x - st.x) < 1.8 && Math.abs(e.y - st.y) < 1.0) killOrHit(e, 2, 'pound'); }
    function killOrHit(e, d, how) { e.hp -= d; e.flash = 0.2; if (e.hp <= 0) { e.dead = 1; e.dt = 0; st.score += e.k === 'bandit' ? 60 : 25; st.stomps++; st.ev.push({ k: 'ko', x: e.x, y: e.y + 0.4, kind: e.k, how }); } else st.ev.push({ k: 'hit', x: e.x, y: e.y + 0.6, how }); }
    function foe(e, dt) {
      if (e.dead) { e.dt += dt; return; } e.t += dt; e.flash = Math.max(0, (e.flash || 0) - dt);
      if (e.k === 'rat') { e.x += e.dir * 1.9 * dt; if (e.x < e.x0) { e.x = e.x0; e.dir = 1; } if (e.x > e.x1) { e.x = e.x1; e.dir = -1; } e.y = st.L.topAt(e.x); }
      else if (e.k === 'pigeon') { e.x += e.dir * 2.3 * dt; if (e.x < e.x0) { e.x = e.x0; e.dir = 1; } if (e.x > e.x1) { e.x = e.x1; e.dir = -1; } e.y = e.by + Math.sin(e.t * 3.1) * 0.55; }
      else { e.dir = st.x < e.x ? -1 : 1; e.cd -= dt; if (e.cd <= 0 && Math.abs(st.x - e.x) < 13) { e.cd = 2.3; e.throw = 0.3; st.bricks.push({ x: e.x + e.dir * 0.4, y: e.y + 1.1, vx: e.dir * 6.2, vy: 5.2, t: 0 }); st.ev.push({ k: 'brick', x: e.x, y: e.y + 1.1 }); } e.throw = Math.max(0, (e.throw || 0) - dt); }
      // vs Harold: stomp, cane, touch
      const dx = Math.abs(e.x - st.x), cx = st.cane > 0 ? (e.x - st.x) * st.face : -9;
      if (st.cane > 0 && cx > -0.2 && cx < 1.9 && e.y < st.y + 1.5 && e.y + e.h > st.y - 0.2 && !e.hitC) { e.hitC = 1; killOrHit(e, 1, 'cane'); if (e.dead) return; } if (st.cane <= 0) e.hitC = 0;
      if (dx < HW + e.w / 2 && st.y < e.y + e.h && st.y + HH > e.y) {
        if (st.vy < -1 && st.y > e.y + e.h * 0.4 - 0.15) { killOrHit(e, st.pound ? 2 : 1, st.pound ? 'pound' : 'stomp'); st.vy = 10; st.ground = false; st.coy = 0; st.pound = false; st.ev.push({ k: 'bounce', x: e.x, y: e.y + e.h }); }
        else hurt(e.k, Math.sign(e.x - st.x) || 1);
      }
    }
    // test bot: win = run right, jump edges / walls / foes, cane near foes, stomp over foes; lose = just hold right and never jump
    function bot(B) {
      B.mx = 1; B.my = 0; if (B.mode === 'lose') return;
      const L = st.L, g = (x) => L.solids.some((s) => x >= s.x0 && x <= s.x1 && Math.abs(s.y1 - st.y) < 0.4 || (x >= s.x0 && x <= s.x1 && s.y1 < st.y + 0.4 && s.y1 > st.y - 4 && !s.ow && s.k !== 'chim'));
      if (st.ground || st.coy > 0) {
        let jump = false;
        if (!g(st.x + 0.55) && st.ground) jump = true;
        for (const s of L.solids) { if (s.ow) continue; if (s.x0 > st.x && s.x0 - st.x < 1.9 && s.y1 > st.y + 0.12 && s.y0 < st.y + HH) jump = true; }
        for (const e of L.foes) { if (e.dead) continue; const d = (e.x - st.x); if (e.k === 'bandit' && d > 0.3 && d < 3.0 && e.hp > 0) jump = true; }
        for (const p of L.pipes) { /* downspout shortcut is optional: the bot walks past it */ }
        if (jump) B.a = true;
      } else { for (const e of L.foes) { if (e.dead) continue; if (Math.abs(e.x - st.x) < 0.5 && st.y > e.y + 0.6 && st.vy < 2) B.my = -1; } if (st.y < -2.2 && st.vy < 0) B.a = true; }
      for (const e of L.foes) { if (e.dead || e.k === 'bandit' && st.ground) continue; const d = e.x - st.x; if (d > 0.2 && d < 1.7 && e.y < st.y + 1.5 && e.y + e.h > st.y - 0.2) B.b = true; }
    }
    function clampN(v, a, b) { return v < a ? a : v > b ? b : v; }
    load(startLevel | 0);
    return { st, step, bot, load, hurt };
  }
  return { LEVELS: defs, MAXHP, HW, HH, make, count: () => defs.length };
})();
// </RRSIM> ------------------------------------------------------------------------------------------------------------------------------------------
const ROOFTOP = (function () {
  const S = { scene: null, cam: null, title: 'FELLS POINT ROOFTOP RUN', pips: 1, hint: '<b>stick</b> run · <b>A</b> jump · <b>B</b> cane · <b>DOWN</b> in the air = butt-stomp · DOWN on the green downspout = warp · <b>E</b> leave',
    labels: { a: 'JUMP', b: 'CANE', c: 'LEAVE', l: '', r: '' } };
  const V = new THREE.Vector3(), POPV = new THREE.Vector3();
  let sim = null, Hh = null, Mv = null, lvGroup = null, bg = null, tokM = null, foeM = new Map(), brickM = null, fx = [], camX = 0, camY = 2, port = false, wasOver = false, flagCloth = null, mavisM = [];
  const bc = (v, a, b) => Math.max(a, Math.min(b, v));
  const GEOF = {};
  function foeRig(kind) {
    if (window.buildRooftopFoe) { try { const r = window.buildRooftopFoe({ THREE, toonMat: window.toonMat }, kind); if (r) return r.root || r; } catch (e) { console.error(e); } }
    const g = new THREE.Group(), k = DUELS.kit(), sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h), box = (x, y, z) => new THREE.BoxGeometry(x, y, z), cone = (r, h, n = 6) => new THREE.ConeGeometry(r, h, n);
    if (kind === 'rat') { k.add(sph(0.3), '#7a7280', 0, 0.28, 0, 0, 0, 0, 1.3, 0.8, 0.85); k.add(sph(0.16), '#8a8290', 0.36, 0.3, 0); k.add(sph(0.05, 6, 5), '#ff9ab0', 0.52, 0.3, 0); k.add(sph(0.12, 6, 5), '#a89aa8', 0.34, 0.5, 0.1); k.add(sph(0.12, 6, 5), '#a89aa8', 0.34, 0.5, -0.1); k.add(box(0.6, 0.05, 0.05), '#ff9ab0', -0.55, 0.2, 0, 0, 0, 0.25); k.add(sph(0.04, 5, 4), '#14101f', 0.46, 0.38, 0.1); k.add(sph(0.04, 5, 4), '#14101f', 0.46, 0.38, -0.1); }
    else if (kind === 'pigeon') { k.add(sph(0.28), '#8e94a8', 0, 0.3, 0, 0, 0, 0, 1.2, 0.9, 0.9); k.add(sph(0.16), '#5a7a6a', 0.3, 0.5, 0); k.add(cone(0.05, 0.16, 5), '#ffb23a', 0.5, 0.48, 0, 0, 0, -Math.PI / 2); k.add(sph(0.035, 5, 4), '#ff7a1a', 0.4, 0.55, 0.1); k.add(box(0.4, 0.06, 0.2), '#7a8098', -0.35, 0.34, 0, 0, 0, 0.2); }
    else { k.add(box(0.5, 0.7, 0.4), '#4a4560', 0, 0.45, 0); k.add(sph(0.26), '#8a8296', 0, 1.0, 0); k.add(box(0.1, 0.18, 0.5), '#14101f', 0.2, 1.02, 0); k.add(sph(0.06, 6, 5), '#fff', 0.26, 1.05, 0.1); k.add(sph(0.06, 6, 5), '#fff', 0.26, 1.05, -0.1); k.add(box(0.5, 0.1, 0.4), '#2a2438', 0, 1.28, 0); k.add(box(0.14, 0.14, 0.14), '#b8452e', 0.3, 0.8, 0.28); k.add(box(0.14, 0.5, 0.12), '#4a4560', 0.15, 0.7, 0.28); }
    const m = new THREE.Mesh(k.geo(), new THREE.MeshLambertMaterial({ vertexColors: true })); g.add(m); g.userData.body = m;
    if (kind === 'pigeon') { const wk = DUELS.kit(); wk.add(box(0.5, 0.05, 0.34), '#a8aec2', -0.1, 0, 0.0); const w = new THREE.Mesh(wk.geo(), new THREE.MeshLambertMaterial({ vertexColors: true })); w.position.set(-0.05, 0.42, 0); g.add(w); g.userData.wing = w; }
    return g;
  }
  // ---------- level geometry ----------
  const THEME = { day: { sky: ['#6fb8ee', '#dff1fb'], fog: '#cfe6f4', brick: ['#a4553f', '#b8644a', '#9a4c3a'], stone: '#c9c3b4', roof: '#4a4450', win: '#8ec8e8', far: '#9fb4c8', water: '#3b86b0' },
    dusk: { sky: ['#5a4a9a', '#ffb070'], fog: '#e0a08a', brick: ['#8e4a40', '#a05a46', '#84423a'], stone: '#b0a49a', roof: '#3e3846', win: '#ffd890', far: '#8a6a98', water: '#4a5a8a' },
    night: { sky: ['#0a0a26', '#3a2a66'], fog: '#20184a', brick: ['#5a3a4a', '#684458', '#503444'], stone: '#7a7488', roof: '#2a2634', win: '#ffd070', far: '#2a2450', water: '#141a40' } };
  function skyTex(a, b) { const cv = document.createElement('canvas'); cv.width = 8; cv.height = 128; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 8, 128); return new THREE.CanvasTexture(cv); }
  function signTex(txt, col, bgc) { return canvasTex(512, 128, (g, w, h) => { g.fillStyle = bgc; g.fillRect(0, 0, w, h); g.strokeStyle = col; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = col; g.font = 'italic bold 66px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 4); }, 512); }
  function clearGroup(g) { while (g.children.length) { const c = g.children.pop(); c.traverse && c.traverse((o) => { if (o.geometry && !o.geometry.__shared) o.geometry.dispose(); }); } }
  function buildLevel() {
    const L = sim.st.L, th = THEME[L.theme], rr = (() => { let s = 7 + sim.st.lv * 13; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    clearGroup(lvGroup); clearGroup(bg); foeM.forEach((m) => m.parent && m.parent.remove(m)); foeM.clear(); mavisM.forEach((m) => m.parent && m.parent.remove(m)); mavisM = [];
    S.scene.background = new THREE.Color(th.fog); S.scene.fog.color.set(th.fog); S.sky.material.map = skyTex(th.sky[0], th.sky[1]); S.sky.material.needsUpdate = true;
    const k = DUELS.kit(), box = (x, y, z) => new THREE.BoxGeometry(x, y, z), cyl = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n);
    // rowhouse roofs + facades (z -3..2): brick fronts with window rows, formstone base, cornice, flat tar roof
    for (const s of L.solids) {
      const w = s.x1 - s.x0, cx = (s.x0 + s.x1) / 2;
      if (s.k === 'roof') {
        const top = s.y1, bot = Math.max(-9, top - 14), hh = top - bot, cb = th.brick[Math.floor(rr() * 3)];
        k.add(box(w, hh, 5), cb, cx, bot + hh / 2, -0.5); k.add(box(w + 0.3, 0.32, 5.3), th.stone, cx, top - 0.16, -0.5); k.add(box(w - 0.2, 0.06, 4.7), th.roof, cx, top + 0.02, -0.5);
        k.add(box(w + 0.1, 0.5, 0.18), th.stone, cx, top - 0.65, 2.05); // cornice band on the street face
        for (let wx = s.x0 + 1.3; wx < s.x1 - 0.9; wx += 2.4) for (let wy = top - 2.0; wy > Math.max(bot + 0.8, top - 9); wy -= 2.2) { k.add(box(0.95, 1.3, 0.1), th.win, wx, wy, 2.03); k.add(box(1.12, 0.12, 0.16), th.stone, wx, wy - 0.72, 2.05); k.add(box(1.12, 0.1, 0.14), th.stone, wx, wy + 0.72, 2.05); }
        k.add(box(w, 0.14, 0.14), '#2a2438', cx, top + 0.16, 1.9); // parapet rail
      } else if (s.k === 'chim') { k.add(box(w, s.y1 - s.y0, 1.2), '#8a4638', cx, (s.y0 + s.y1) / 2, 0); k.add(box(w + 0.18, 0.18, 1.38), '#c9c3b4', cx, s.y1 + 0.09, 0); for (let i = 0; i < 3; i++) k.add(box(w + 0.02, 0.05, 1.22), '#5a2a22', cx, s.y0 + 0.4 + i * 0.4, 0); }
      else if (s.k === 'pipe') { k.add(cyl(0.38, 0.38, 0.9, 10), '#3aa05a', cx, (s.y0 + s.y1) / 2, 0); k.add(cyl(0.46, 0.46, 0.18, 10), '#2a7a42', cx, s.y1 - 0.09, 0); }
      else if (s.k === 'line') { k.add(box(w + 0.6, 0.05, 0.05), '#2a2438', cx, s.y1 + 0.02, -0.4); k.add(box(0.1, 3.0, 0.1), '#5a5048', s.x0 - 0.3, s.y1 - 1.4, -0.4); k.add(box(0.1, 3.0, 0.1), '#5a5048', s.x1 + 0.3, s.y1 - 1.4, -0.4);
        for (let lx = s.x0 + 0.5; lx < s.x1 - 0.3; lx += 0.9) k.add(box(0.5, 0.55 + rr() * 0.3, 0.04), ['#fff', '#ffd23c', '#ff6a8a', '#7ad0ff', '#9dff6b'][Math.floor(rr() * 5)], lx, s.y1 - 0.4, -0.38); k.add(box(w, 0.1, 0.9), '#6a5a48', cx, s.y1 - 0.05, 0); }
    }
    // Mavis spots + sign posts + flag pole
    for (const c of L.checks) { k.add(cyl(0.45, 0.5, 0.12, 12), '#ffd23c', c.x, c.y + 0.06, 0.1); }
    const F = L.flag; k.add(cyl(0.07, 0.07, F.h, 6), '#d8d4c8', F.x, F.y + F.h / 2, -0.2); k.add(new THREE.SphereGeometry(0.16, 8, 6), '#ffd23c', F.x, F.y + F.h + 0.12, -0.2); k.add(box(0.7, 0.14, 0.7), '#7a6a58', F.x, F.y + 0.07, -0.2);
    if (L.theme === 'night') { const lastTop = L.solids.filter((s) => s.k === 'roof').pop().y1; k.add(new THREE.ConeGeometry(2.2, 6, 4), '#4a4258', L.flag.x + 1.2, lastTop + 2.6, -1.0, 0, Math.PI / 4, 0); } // steeple spire under the pole
    const fm = k.mesh(toonMat(), lvGroup, 0.004);
    // flag cloth (waves) on the pole
    if (flagCloth) flagCloth.parent && flagCloth.parent.remove(flagCloth); flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7, 6, 1), new THREE.MeshBasicMaterial({ color: '#e0372b', side: THREE.DoubleSide })); flagCloth.position.set(F.x + 0.58, F.y + F.h - 0.5, -0.2); flagCloth.userData.base = F.y + F.h - 0.5; lvGroup.add(flagCloth);
    // far skyline: two layers of rowhouse / tower silhouettes, the Domino Sugars sign, the harbor
    const kb = DUELS.kit(), len = L.len;
    for (let layer = 0; layer < 2; layer++) for (let x = -30; x < len + 70; x += 6 + rr() * 5) { const hh = (layer ? 12 : 7) + rr() * (layer ? 16 : 9), ww = 5 + rr() * 4; kb.add(box(ww, hh, 4), layer ? th.far : (L.theme === 'night' ? '#2a2450' : '#9ab4cc'), x, hh / 2 - 4, layer ? -34 : -18);
      if (L.theme !== 'day') for (let i = 0; i < 4; i++) if (rr() > 0.4) kb.add(box(0.7, 0.9, 0.1), '#ffd070', x + (rr() - 0.5) * ww * 0.7, rr() * hh - 3, (layer ? -34 : -18) + 2.1); }
    kb.add(box(len + 240, 0.2, 60), th.water, len / 2, -9, -22);
    kb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, fog: true }), bg, 0);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: signTex('Domino Sugars', '#ff3b3b', L.theme === 'night' ? '#10101e' : '#f4eee0'), fog: true })); sg.position.set(L.theme === 'dusk' ? 60 : L.theme === 'day' ? 80 : 40, 15, -17.2); bg.add(sg);
    // tokens (instanced)
    if (tokM) tokM.parent && tokM.parent.remove(tokM); tokM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10), new THREE.MeshLambertMaterial({ color: '#ff7a3a', emissive: '#7a2a00' }), 140); tokM.frustumCulled = false; tokM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); lvGroup.add(tokM);
    // Mavis at each checkpoint
    for (const c of L.checks) { const m = buildHero({ wife: true }); m.root.position.set(c.x, c.y, 0.1); m.root.rotation.y = -Math.PI / 2; lvGroup.add(m.root); mavisM.push(m); m.c = c; }
  }
  S.build = function () {
    const sc = (S.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#cfe6f4', 40, 130); S.cam = new THREE.PerspectiveCamera(50, VW() / VH(), 0.3, 220);
    DUELS.sceneLights(sc, '#fff2dc', '#5a6a80', 1.2, '#fff0d0', 1.45, new THREE.Vector3(-0.5, 1, 0.9));
    S.sky = new THREE.Mesh(new THREE.PlaneGeometry(400, 130), new THREE.MeshBasicMaterial({ map: skyTex('#6fb8ee', '#dff1fb'), fog: false })); S.sky.position.set(0, 20, -60); sc.add(S.sky);
    lvGroup = new THREE.Group(); bg = new THREE.Group(); sc.add(lvGroup, bg);
    Hh = buildHero(); sc.add(Hh.root); Mv = null;
    brickM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: '#b8452e' }), 12); brickM.frustumCulled = false; sc.add(brickM);
    S.fxm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }), 80); S.fxm.frustumCulled = false; sc.add(S.fxm);
  };
  function layout() { port = VH() > VW(); S.cam.fov = port ? 62 : 46; S.cam.updateProjectionMatrix(); }
  S.onResize = () => { if (S.cam) layout(); };
  function reset(lv) { sim = RRSIM.make(0, lv); S.sim = sim; S.st = sim.st; wasOver = false; fx = []; camX = sim.st.x + 2; camY = sim.st.y + 2; buildLevel(); }
  S.start = function (opts = {}) { layout(); const lv = Q.get('rrlevel') != null ? bc(parseInt(Q.get('rrlevel'), 10) || 0, 0, RRSIM.count() - 1) : 0; S.lv0 = lv; reset(lv); DUELS.log.push('rooftop:start'); DUELS.banner('ROOFTOP RUN<small>' + sim.st.L.name + ' · TO THE FLAGPOLE</small>', 2.2); DUELS.say('MAVIS', 'Watch the gutter rats, hon. I\'ll be waiting on the chimneys with crab cakes.', 3.2); };
  S.retry = function () { reset(S.lv0 || 0); DUELS.banner('BACK UP THE FIRE ESCAPE<small>' + sim.st.L.name + '</small>', 1.4); };
  S.exit = function () { DUELS.bars(1, 1); DUELS.sub('', ''); };
  const POP = new THREE.Vector3(); const pop = (txt, x, y, cls) => { POP.set(x, y, 0.5); DUELS.pop(txt, POP, cls || ''); };
  function onEvent(e) {
    const st = sim.st;
    if (e.k === 'jump') { puff(e.x, e.y, '#ffffff', 3); DUELS.hitSfx && DUELS.hitSfx('light'); }
    else if (e.k === 'land') { puff(e.x, e.y + 0.05, e.p ? '#ffd23c' : '#ffffff', e.p ? 8 : 3); if (e.p) { DUELS.shake && DUELS.shake(0.4); DUELS.hitSfx && DUELS.hitSfx('heavy'); } }
    else if (e.k === 'token') { DUELS.hitSfx && DUELS.hitSfx('light'); }
    else if (e.k === 'ko') { pop(e.how === 'cane' ? 'WHAP!' : e.how === 'pound' ? 'SQUISH!' : 'STOMP!', e.x, e.y + 0.8, 'word'); puff(e.x, e.y + 0.3, '#ffffff', 6); DUELS.hitSfx && DUELS.hitSfx('heavy'); }
    else if (e.k === 'hit') { pop('OW!', e.x, e.y + 0.4); DUELS.hitSfx && DUELS.hitSfx('light'); }
    else if (e.k === 'hurt') { DUELS.hurt(); DUELS.shake && DUELS.shake(0.3); DUELS.hitSfx && DUELS.hitSfx('heavy'); pop(e.why === 'brick' ? 'BRICK!' : 'OUCH', e.x, e.y + 0.6, 'big'); }
    else if (e.k === 'fall') { DUELS.hurt(); DUELS.banner('FELL OFF THE ROOF<small>' + st.hp + ' HEARTS LEFT</small>', 1.1); DUELS.hitSfx && DUELS.hitSfx('heavy'); }
    else if (e.k === 'check') { DUELS.banner('MAVIS!<small>HEARTS REFILLED</small>', 1.2); DUELS.say('MAVIS', ['Crab cake, hon. Eat up.', 'That\'s my husband. Mind the pigeons.', 'Almost to the steeple! Go on.'][e.i % 3], 2.6); puff(e.x, e.y, '#ff9ac0', 6); }
    else if (e.k === 'warp') { DUELS.banner('DOWNSPOUT!<small>CRAB CACHE</small>', 1.2); puff(e.x, e.y, '#7dff6b', 8); }
    else if (e.k === 'flag') { DUELS.banner((st.lv >= RRSIM.count() - 1 ? 'STEEPLE CLIMBED!' : 'FLAGPOLE!') + '<small>' + (e.h > 0.7 ? 'HIGH GRAB! +BONUS' : 'LEVEL CLEAR') + '</small>', 1.8); puff(e.x, e.y, '#ffd23c', 12); DUELS.hitSfx && DUELS.hitSfx('heavy'); }
    else if (e.k === 'level') { if (e.x > 0) { DUELS.banner(st.L.name + '<small>LEVEL ' + (e.x + 1) + ' OF ' + RRSIM.count() + '</small>', 1.8); DUELS.log.push('rooftop:level:' + e.x); buildLevel(); camX = st.x + 2; camY = st.y + 2; } }
    else if (e.k === 'cane') { DUELS.hitSfx && DUELS.hitSfx('light'); }
    else if (e.k === 'brick') { }
  }
  function puff(x, y, col, n) { for (let i = 0; i < n; i++) fx.push({ x, y, z: 0.6, vx: (Math.random() - 0.5) * 5, vy: Math.random() * 4 + 1, t: 0, life: 0.5 }); }
  let acc = 0;
  S.step = function (dt, I) {
    if (!sim) return; const st = sim.st;
    if (I.c || I.back) { DUELS.exit('leave'); return; }
    acc += dt; let n = 0; const first = { a: I.a, b: I.b };
    while (acc > 1 / 120 && n < 40) { const s = Math.min(1 / 120, acc); acc -= s; n++; sim.step(s, n === 1 ? I : { mx: I.mx, my: I.my, a: false, b: false }); }
    for (const e of st.ev.splice(0)) onEvent(e);
    const ll = st.L; DUELS.bars(st.hp / RRSIM.MAXHP, bc((st.x - ll.spawn.x) / (ll.flag.x - ll.spawn.x), 0, 1));
    DUELS.sub('<b style="color:#ff5a6a">' + '♥'.repeat(Math.max(0, st.hp)) + '<span style="opacity:.35">' + '♥'.repeat(Math.max(0, RRSIM.MAXHP - st.hp)) + '</span></b> <b style="color:#ffd23c">' + st.tokens + '</b>', 'LV ' + (st.lv + 1) + '/' + RRSIM.count());
    if (st.over && !wasOver) { wasOver = true;
      if (st.over === 'win') { DUELS.log.push('rooftop:win'); try { localStorage.setItem('tcb_rr_won', '1'); } catch (e) {} setTimeout(() => { if (DUELS.cur === S) DUELS.over('win', 'STEEPLE CLIMBED!', 'Three rooftops, one flagpole, ' + st.tokens + ' crab tokens and ' + st.score + ' points. Mavis cheers from the street, and the gutter rats are retired.'); }, SIM ? 200 : 900); }
      else { DUELS.log.push('rooftop:lose:l' + (st.lv + 1)); setTimeout(() => { if (DUELS.cur === S) DUELS.over('lose', 'OFF THE ROOFTOPS', 'Out of hearts on ' + st.L.name + '. Watch the gaps, stomp the pigeons, and look for Mavis on the chimneys.'); }, SIM ? 200 : 700); } }
  };
  const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), E3 = new THREE.Euler();
  S.render = function (rdt) {
    if (!sim) return; const st = sim.st, t = st.t, L = st.L, dt = Math.min(0.05, rdt);
    // Harold
    Hh.root.visible = !(st.inv > 0 && Math.floor(st.t * 14) % 2 === 0 && !st.over);
    Hh.root.position.set(st.x, st.y, 0.1); Hh.root.rotation.y = st.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    let p; const sp = Math.abs(st.vx);
    if (st.hurt > 0) p = HERO_POSES.hurt(1 - st.hurt / 0.35); else if (st.cane > 0) p = HERO_POSES.airatk(1 - st.cane / 0.22); else if (st.pound) p = HERO_POSES.jump(-1); else if (!st.ground) p = HERO_POSES.jump(st.vy); else if (sp > 0.6) p = HERO_POSES.run(t, sp); else p = HERO_POSES.idle(t);
    applyPose(Hh, p, 16, rdt, false);
    for (const m of mavisM) { const near = Math.abs(st.x - m.c.x) < 6; const pp = HERO_POSES.idle(t + m.c.x); if (m.c.on && near) { pp.shL = [-2.6 + Math.sin(t * 8) * 0.3, 0, 0.5]; } applyPose(m, pp, 16, rdt, false); m.root.rotation.y = st.x > m.c.x ? Math.PI / 2 : -Math.PI / 2; }
    // tokens
    let ti = 0; for (const k of L.tokens) { if (k.got || ti >= 140) continue; const a = t * 3 + k.x; E3.set(0, a, Math.PI / 2); Q4.setFromEuler(E3); M4.compose(P3.set(k.x, k.y + Math.sin(t * 2 + k.x) * 0.06, 0.1), Q4, S3.set(1, 1, 1)); tokM.setMatrixAt(ti++, M4); }
    tokM.count = ti; tokM.instanceMatrix.needsUpdate = true;
    // foes
    const seen = new Set();
    for (const e of L.foes) { if (e.dead && e.dt > 0.5) continue; seen.add(e.id); let m = foeM.get(e.id); if (!m) { m = foeRig(e.k); lvGroup.add(m); foeM.set(e.id, m); }
      m.visible = true; const sq = e.dead ? Math.max(0.05, 1 - e.dt * 2.5) : 1; m.position.set(e.x, e.y + (e.k === 'rat' ? Math.abs(Math.sin(e.t * 12)) * 0.05 : 0), 0.1); m.scale.set(1, sq, 1); m.rotation.y = e.k === 'bandit' ? (e.dir > 0 ? 0 : Math.PI) : (e.dir > 0 ? 0 : Math.PI);
      if (e.k === 'bandit' && e.throw > 0) m.rotation.z = -0.25; else m.rotation.z = 0; const w = m.userData.wing; if (w) w.rotation.x = Math.sin(e.t * 18) * 0.9; if (e.flash > 0 && m.userData.body) m.userData.body.scale.set(1.12, 0.9, 1); else if (m.userData.body) m.userData.body.scale.set(1, 1, 1); }
    for (const [id, m] of foeM) if (!seen.has(id)) m.visible = false;
    // bricks
    let bi = 0; for (const b of st.bricks) { if (bi >= 12) break; E3.set(0, 0, b.t * 9); Q4.setFromEuler(E3); M4.compose(P3.set(b.x, b.y, 0.1), Q4, S3.set(1, 1, 1)); brickM.setMatrixAt(bi++, M4); } brickM.count = bi; brickM.instanceMatrix.needsUpdate = true;
    // fx
    let fi = 0; for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy -= 9 * dt; if (f.t > f.life) { fx.splice(i, 1); continue; } }
    for (const f of fx) { if (fi >= 80) break; const s = 1 - f.t / f.life; M4.compose(P3.set(f.x, f.y, f.z), Q4.identity(), S3.set(s, s, s)); S.fxm.setMatrixAt(fi++, M4); } S.fxm.count = fi; S.fxm.instanceMatrix.needsUpdate = true;
    // flag cloth wave
    if (flagCloth) { const pa = flagCloth.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x0 = pa.getX(i); pa.setZ(i, Math.sin(t * 5 + x0 * 5) * 0.1 * (x0 + 0.55)); } pa.needsUpdate = true; if (st.flagGot) flagCloth.position.y = bc(flagCloth.position.y - dt * 1.5, L.flag.y + 0.6, 99); }
    // camera: side-on, a little ahead of Harold, follows height smoothly; wider in portrait
    layout(); const dist = port ? 21 : 15.5, lx = st.x + st.face * (port ? 1.6 : 3.2), ly = st.y + (port ? 3.2 : 1.9);
    camX += (lx - camX) * Math.min(1, rdt * 4.5); camY += (ly - camY) * Math.min(1, rdt * 3);
    S.cam.position.set(camX, camY + 1.2, dist); S.cam.lookAt(camX, camY, 0); S.sky.position.x = camX; S.sky.position.y = camY + 18;
  };
  // ---------- test bot ----------
  S.botThink = function (B, dt) { if (!sim || sim.st.over) return; sim.bot(B); };
  DUELS.reg('rooftop', S);
  S.trigger = { x: 120, z: -19.5 };
  function setupTrigger() {
    const T = S.trigger, rt = canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke(); g.lineWidth = 4; g.setLineDash([10, 9]); g.beginPath(); g.arc(64, 64, 38, 0, TAU); g.stroke(); }, 128);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: rt, color: '#9dff6b', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    r.rotation.x = -Math.PI / 2; r.position.set(T.x, groundY(T.x, T.z) + 0.04, T.z); r.renderOrder = 2; scene.add(r);
    MODE.ticks.push((rdt) => { const d = Math.hypot(T.x - hero.pos.x, T.z - hero.pos.z); r.visible = d < 40 && !DUELS.cur; r.rotation.z += rdt * 0.8; });
    ACTIONS.push({ kind: 'boss', label: 'ROOFTOP RUN', x: T.x, z: T.z, r: 1.7, y: 2.2, ok: () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels') || Q.has('rr')), go: () => { DUELS.start('rooftop'); } });
  }
  let n = 0; MODE.ticks.push(() => { n++; if (n === 1) setupTrigger(); if (n === 3 && Q.get('rrauto') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('rrauto'); DUELS.start('rooftop', m === 'win' || m === 'lose' ? { bot: m } : {}); } });
  window.__rooftop = S; S.SIM = RRSIM;
})();
