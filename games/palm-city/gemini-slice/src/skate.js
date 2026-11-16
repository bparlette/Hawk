// skate.js — the third way to move. Carve physics with momentum, ollies, grinds, hood ollies,
// near-misses, bails, and the WANTED LINE combo. Operates on the Sim (player.mode === 'board').

const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export const TRICK = { ollie: 50, curb: 80, bench: 150, grind: 120, hood: 300, copHood: 900, nearMiss: 150, rim: 160 };
const AIR = 0.6;          // ollie hang time (s)
const COMBO_T = 2.6;      // seconds to land the next trick before the line cashes out

// Grindables + obstacles live in layout.json: rails (segments), rims (circles), benches.
export function initSkate(sim) {
  const L = sim.W.L;
  sim.rails = (L.rails || []).map(r => ({ ...r, len: Math.hypot(r.x1 - r.x0, r.y1 - r.y0) }));
  sim.rims = L.rims || [];
  sim.benches = (L.benches || []).map(([x, y, a]) => ({ x, y, a, w: 34, d: 9 }));
  const [bx, by] = L.spawn.board;
  sim.board = { x: bx, y: by, h: -Math.PI / 2, vx: 0, vy: 0, z: 0, air: 0, grind: null, ridden: false };
  sim.combo = null;           // { pts, mult, t, last }
  sim.score = 0;
  sim.lastTrick = null;       // { name, pts, t } for the HUD
  sim.hotEntry = -99;
}

function trick(sim, name, base) {
  const c = sim.combo || (sim.combo = { pts: 0, mult: 1, t: 0, n: 0 });
  c.mult = Math.min(12, c.mult + (c.n ? 1 : 0));
  c.pts += base;
  c.n++;
  c.t = COMBO_T;
  sim.lastTrick = { name, pts: base, t: 1.2, mult: c.mult };
  sim.ev('trick', name);
}

function cashOut(sim, lost) {
  const c = sim.combo;
  if (!c) return;
  if (!lost) {
    const total = c.pts * c.mult;
    sim.score += total;
    if (c.n > 1) sim.say(`WANTED LINE  ${total.toLocaleString()}`, 1.8);
  } else sim.say('BAILED', 1.4);
  sim.combo = null;
}

export function boardSpeed(b) { return Math.hypot(b.vx, b.vy); }

function surfaceDrag(t) {
  return t === 'grass' ? 2.4 : t === 'sand' ? 3.2 : t === 'water' ? 9 : 0.18;
}

export function nearBoard(sim) {
  const p = sim.player.ped, b = sim.board;
  return !b.ridden && Math.hypot(b.x - p.x, b.y - p.y) < 26;
}

export function mount(sim) {
  const P = sim.player, b = sim.board;
  P.mode = 'board';
  b.ridden = true; b.vx = 0; b.vy = 0; b.z = 0; b.air = 0; b.grind = null;
  b.h = P.ped.h;
  P.ped.x = b.x; P.ped.y = b.y;
  sim.ev('door');
}

export function dismount(sim) {
  const P = sim.player, b = sim.board;
  P.mode = 'foot'; b.ridden = false; b.vx = b.vy = 0; b.grind = null; b.z = 0; b.air = 0;
  P.ped.x = b.x + Math.cos(b.h + Math.PI / 2) * 10; P.ped.y = b.y + Math.sin(b.h + Math.PI / 2) * 10;
  cashOut(sim, false);
}

export function bail(sim, why) {
  const P = sim.player, b = sim.board;
  P.mode = 'foot'; b.ridden = false; b.grind = null; b.z = 0; b.air = 0;
  // board skitters on, rider tumbles
  b.vx *= 0.6; b.vy *= 0.6;
  P.ped.x = b.x; P.ped.y = b.y;
  P.stunT = 1.1;
  cashOut(sim, true);
  sim.ev('bail', why);
}

function distSeg(px, py, r) {
  const vx = r.x1 - r.x0, vy = r.y1 - r.y0;
  let t = ((px - r.x0) * vx + (py - r.y0) * vy) / (r.len * r.len);
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(r.x0 + vx * t - px, r.y0 + vy * t - py), t };
}

export function stepBoard(sim, dt, inp) {
  const W = sim.W, b = sim.board, P = sim.player, p = P.ped;
  let sp = boardSpeed(b);

  // ------------------------------------------------ grinding: locked to the rail / rim
  if (b.grind) {
    const g = b.grind;
    g.s += g.dir * g.v * dt;
    g.v = Math.max(60, g.v - 25 * dt);
    sim.combo && (sim.combo.t = COMBO_T);
    g.acc += dt;
    if (g.acc > 0.35) { g.acc = 0; if (sim.combo) sim.combo.pts += Math.round(TRICK[g.kind] * 0.25); }
    let x, y, tx, ty;
    if (g.kind === 'grind') {
      const r = g.r, t = g.s / r.len;
      tx = (r.x1 - r.x0) / r.len; ty = (r.y1 - r.y0) / r.len;
      x = r.x0 + (r.x1 - r.x0) * t; y = r.y0 + (r.y1 - r.y0) * t;
      if (t < 0 || t > 1) { b.grind = null; b.air = 0.25; b.z = 0.3; }
    } else {
      const c = g.r, a = g.s / c.r;
      x = c.x + Math.cos(a) * c.r; y = c.y + Math.sin(a) * c.r;
      tx = -Math.sin(a); ty = Math.cos(a);
      if (Math.abs(g.s - g.s0) > c.r * Math.PI * 1.5) { b.grind = null; b.air = 0.25; b.z = 0.3; }
    }
    b.x = x; b.y = y;
    b.vx = tx * g.dir * g.v; b.vy = ty * g.dir * g.v;
    b.h = Math.atan2(b.vy, b.vx);
    if (inp.action) { b.grind = null; b.air = AIR; b.z = 0; trick(sim, 'OLLIE OUT', TRICK.ollie); sim.ev('ollie'); }
    p.x = b.x; p.y = b.y; p.h = b.h;
    return;
  }

  // ------------------------------------------------ carve + push
  let jx = inp.jx, jy = inp.jy, jm = inp.jm;
  const k = inp.keys || {};
  if (k.up || k.down || k.left || k.right) {
    jx = (k.right ? 1 : 0) - (k.left ? 1 : 0); jy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    jm = Math.hypot(jx, jy) ? 1 : 0; if (jm) { const l = Math.hypot(jx, jy); jx /= l; jy /= l; }
  }
  const surf = W.surfaceAt(b.x, b.y);
  if (jm > 0.15) {
    const ta = Math.atan2(jy, jx);
    const turn = (b.air > 0 ? 1.4 : 3.4) * dt;
    const d = wrap(ta - b.h);
    b.h = wrap(b.h + Math.max(-turn, Math.min(turn, d)));
    if (b.air <= 0 && Math.abs(d) < 1.2 && sp < 250) {   // kick-push along the deck
      b.vx += Math.cos(b.h) * 150 * jm * dt; b.vy += Math.sin(b.h) * 150 * jm * dt;
    }
  }
  // momentum: velocity bends toward the deck heading (carve), keeps most of its speed
  sp = boardSpeed(b);
  if (b.air <= 0 && sp > 1) {
    const va = Math.atan2(b.vy, b.vx);
    let rel = wrap(b.h - va);
    if (Math.abs(rel) > Math.PI / 2) rel = wrap(rel - Math.PI);   // riding fakie is fine
    const nv = va + rel * Math.min(1, 6 * dt);
    const keep = 1 - Math.abs(rel) * 0.04 * dt * 6;
    b.vx = Math.cos(nv) * sp * keep; b.vy = Math.sin(nv) * sp * keep;
    const drag = surfaceDrag(surf);
    const f = Math.exp(-drag * dt);
    b.vx *= f; b.vy *= f;
    if (surf === 'water') { bail(sim, 'water'); return; }
  }
  // ollie
  if (inp.action) {
    if (b.air <= 0 && boardSpeed(b) < 22) { dismount(sim); return; }
    if (b.air <= 0) { b.air = AIR; trick(sim, 'OLLIE', TRICK.ollie); sim.ev('ollie'); }
  }
  // airborne arc
  if (b.air > 0) {
    b.air -= dt;
    const t = 1 - b.air / AIR;
    b.z = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
    // hood ollie: crossing a car while in the air
    for (const c of sim.cars) {
      const lx = b.x - c.x, ly = b.y - c.y, ca = Math.cos(c.h), sa = Math.sin(c.h);
      const u = lx * ca + ly * sa, v = -lx * sa + ly * ca;
      if (Math.abs(u) < c.len / 2 && Math.abs(v) < c.wid / 2 && sim.time - (c.hoodT || -9) > 1.2) {
        c.hoodT = sim.time;
        const cop = c.kind === 'police';
        trick(sim, cop ? 'COP HOOD!' : 'HOOD OLLIE', cop ? TRICK.copHood : TRICK.hood);
        b.air = Math.max(b.air, 0.35);      // the hood kicks you higher
        b.vx *= 1.08; b.vy *= 1.08;
        if (cop) b.copHoodT = sim.time;
        sim.ev('hood', cop);
      }
    }
    // obstacles cleared in the air score
    for (const be of sim.benches) {
      if (Math.hypot(be.x - b.x, be.y - b.y) < 16 && sim.time - (be.t || -9) > 1) { be.t = sim.time; trick(sim, 'BENCH OLLIE', TRICK.bench); }
    }
    if (b.air <= 0) {
      b.air = 0; b.z = 0;
      // land on a rail or rim -> grind
      const hx = Math.cos(b.h), hy = Math.sin(b.h);
      for (const r of sim.rails) {
        const q = distSeg(b.x, b.y, r);
        const along = (hx * (r.x1 - r.x0) + hy * (r.y1 - r.y0)) / r.len;
        if (q.d < 9 && Math.abs(along) > 0.7) {
          b.grind = { kind: 'grind', r, s: q.t * r.len, dir: Math.sign(along), v: Math.max(110, boardSpeed(b)), acc: 0 };
          trick(sim, 'RAIL GRIND', TRICK.grind); sim.ev('grind'); break;
        }
      }
      if (!b.grind) for (const c of sim.rims) {
        const d = Math.hypot(b.x - c.x, b.y - c.y);
        if (Math.abs(d - c.r) < 8) {
          const a = Math.atan2(b.y - c.y, b.x - c.x);
          const tan = -Math.sin(a) * hx + Math.cos(a) * hy;
          if (Math.abs(tan) > 0.6) {
            b.grind = { kind: 'rim', r: c, s: a * c.r, s0: a * c.r, dir: Math.sign(tan), v: Math.max(100, boardSpeed(b)), acc: 0 };
            trick(sim, c.name || 'POOL EDGE', TRICK.rim); sim.ev('grind'); break;
          }
        }
      }
      if (!b.grind) sim.ev('land');
      // HOT ENTRY: off a cop hood, landing at the motel door during a real chase
      const door = W.L.motelDoor;
      if (door && b.copHoodT && sim.time - b.copHoodT < 1.2 && sim.stars >= 3 && Math.hypot(b.x - door[0], b.y - door[1]) < 70) {
        sim.hotEntry = sim.time; trick(sim, 'HOT ENTRY', 1500);
      }
    }
  }
  // move + collide
  const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
  const hit = W.hitSolid(nx, ny, 4) || nx < 4 || ny < 4 || nx > W.L.world.w - 4 || ny > W.L.world.h - 4;
  if (hit) {
    if (boardSpeed(b) > 140) { bail(sim, 'wall'); return; }
    b.vx *= -0.3; b.vy *= -0.3;
  } else { b.x = nx; b.y = ny; }
  sp = boardSpeed(b);
  if (b.air <= 0) {
    // curb hop: crossing the kerb line fast without ollie = bail; with air = points (handled by curb trick)
    const rd = W.roadInfo(b.x, b.y).d, prevRd = b.prevRd ?? rd;
    b.prevRd = rd;
    for (const be of sim.benches) if (Math.hypot(be.x - b.x, be.y - b.y) < 11 && sp > 70) { bail(sim, 'bench'); return; }
    for (const c of sim.cars) {
      const lx = b.x - c.x, ly = b.y - c.y, ca = Math.cos(c.h), sa = Math.sin(c.h);
      const u = lx * ca + ly * sa, v = -lx * sa + ly * ca;
      if (Math.abs(u) < c.len / 2 + 3 && Math.abs(v) < c.wid / 2 + 3) {
        if (sp > 60 || Math.abs(c.v) > 60) { bail(sim, 'car'); return; }
      } else if (Math.abs(c.v) > 80 && Math.abs(u) < c.len / 2 + 18 && Math.abs(v) < c.wid / 2 + 16 && sim.time - (c.nearT || -9) > 2) {
        c.nearT = sim.time; trick(sim, 'NEAR MISS', TRICK.nearMiss);
      }
    }
  } else {
    // in the air over the kerb = curb ollie
    const rd = W.roadInfo(b.x, b.y).d, prevRd = b.prevRd ?? rd;
    if ((prevRd < W.halfRoad) !== (rd < W.halfRoad) && sim.time - (b.curbT || -9) > 0.8) { b.curbT = sim.time; trick(sim, 'CURB HOP', TRICK.curb); }
    b.prevRd = rd;
  }
  // cops grab you
  for (const o of sim.peds) if (o.mode === 'cop' && Math.hypot(o.x - b.x, o.y - b.y) < 14 && b.air <= 0) { bail(sim, 'grabbed'); return; }
  p.x = b.x; p.y = b.y; p.h = b.h;
  p.pose = 1;
}

export function stepCombo(sim, dt) {
  if (sim.lastTrick) { sim.lastTrick.t -= dt; if (sim.lastTrick.t <= 0) sim.lastTrick = null; }
  if (sim.combo && !(sim.board.grind)) {
    if (sim.board.air <= 0) sim.combo.t -= dt;
    if (sim.combo.t <= 0) cashOut(sim, false);
  }
}
