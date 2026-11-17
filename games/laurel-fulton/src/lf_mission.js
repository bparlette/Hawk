// lf_mission.js — task L2, the opening mission: PICK YOUR PLAYER -> RALLY THE CREW -> meet at Atholton HS.
// Everything reads data/roster.json: who can be picked, where they live, their car, who shares a house.
//
//   players(roster)                 -> the PICK YOUR PLAYER list (active people with a car and a house)
//   startRally(sim, roster, id)     -> M: you are moved into your OWN parked car at your house; housemates join
//   stepRally(sim, M, dt)           -> pickups, the arrival beat, the convoy, the finish (call after sim.step)
//
// THE ARRIVAL BEAT (L2 addendum): pull in slow at a crew house -> the camera pushes in -> EVERYONE gets out
// and walks to a huddle on the driveway -> dap up -> everyone back to their own car -> the camera pulls back
// and the new car(s) pull out behind you. Same structure at every house: the game's rhythm.
// THE CONVOY: every follower is a real car on Palm City physics (sim.driveCar), driving YOUR path — a
// breadcrumb trail of where you actually drove — at road spacing. It never takes a shortcut, so it never
// cuts a lawn; if you double back, the trail doubles back and so do they. Newest member slots in right
// behind you (they are in the driveway beside you); the rest shift one place back.

const SP = 78;                    // convoy spacing along your path: a car length (~4.6 m) + a gap
const PULL_IN_R = 190, PULL_IN_V = 45;
const BEAT = [['zoom', 0.55], ['out', 0.95], ['dap', 1.7], ['in', 0.95], ['roll', 0.55]];
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

export function players(roster) { return roster.people.filter(p => p.active && p.car && p.car.sprite && !p.at && p.house); }

export function startRally(S, roster, id) {
  const me = roster.people.find(p => p.id === id); if (!me) throw new Error('no such player: ' + id);
  const mine = S.cars.find(c => c.owner === id);
  S.cars = S.cars.filter(c => c !== S.player);           // the default spawn car goes; you get into YOUR car
  S.player = mine; mine.player = true; mine.parked = false;
  const M = { time: 0, me, stops: [], convoy: [], beat: null, camZoom: 1, complete: false, lastPickupT: -1, trail: { x: [], y: [], s: [] }, msg: `RALLY THE CREW`, msgT: 3 };
  const key = (p) => p.house[0] + ',' + p.house[1];
  const groups = new Map();
  for (const p of players(roster)) { if (p.id === id) continue; const k = key(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  for (const [k, ppl] of groups) {
    const cars = ppl.map(p => S.cars.find(c => c.owner === p.id));
    if (k === key(me)) { M.time = 0; for (let i = 0; i < ppl.length; i++) join(S, M, ppl[i], cars[i]); continue; }   // housemates ride from the start
    const x = cars.reduce((a, c) => a + c.x, 0) / cars.length, y = cars.reduce((a, c) => a + c.y, 0) / cars.length;
    const r = S.W.roadInfo(x, y, 0), kerb = r.e ? S.nearPt(x, y, r) : { x, y };    // where you pull up: the kerb in front of the driveway
    M.stops.push({ x, y, kx: kerb.x, ky: kerb.y, people: ppl, cars, done: false });
  }
  M.meet = roster.meetup;
  pushTrail(M, S.player.x, S.player.y, true);
  return M;
}

function pushTrail(M, x, y, force) {
  const T = M.trail, n = T.x.length;
  if (!force && n && Math.hypot(x - T.x[n - 1], y - T.y[n - 1]) < 10) return;
  T.s.push(n ? T.s[n - 1] + Math.hypot(x - T.x[n - 1], y - T.y[n - 1]) : 0); T.x.push(x); T.y.push(y);
}

function join(S, M, person, car) {
  car.parked = false; car.follower = true;
  const f = { car, person, joinedAt: M.time, ti: -1 };
  M.convoy.unshift(f);                                    // the newest member slots in right behind you
  car.driveFn = (c, dt) => follow(S, M, f, dt);
}

// where a follower is on your path: the nearest trail point near its last one (a local search)
function locate(M, f) {
  const T = M.trail, n = T.x.length, c = f.car;
  const lo = f.ti < 0 ? Math.max(0, n - 400) : Math.max(0, f.ti - 6), hi = f.ti < 0 ? n : Math.min(n, f.ti + 40);
  let best = 1e18, bi = f.ti < 0 ? n - 1 : f.ti;
  for (let i = lo; i < hi; i++) { const d = (T.x[i] - c.x) ** 2 + (T.y[i] - c.y) ** 2; if (d < best) { best = d; bi = i; } }
  return bi;
}

function follow(S, M, f, dt) {
  const c = f.car, T = M.trail, n = T.x.length;
  if (M.beat || M.complete || n < 2) { S.driveCar(c, c.v > 5 ? -1 : 0, 0, dt, 380); return; }
  f.ti = locate(M, f);
  const slot = M.convoy.indexOf(f), headS = T.s[n - 1], P = S.player;
  const myS = T.s[f.ti], gap = headS - (slot + 1) * SP - myS;
  // steer at a point ON your path, further ahead the faster we go (a driver looks down the road)
  const look = 30 + Math.abs(c.v) * 0.12;
  let ai = f.ti; while (ai + 1 < n && T.s[ai] < myS + look) ai++;
  const ta = Math.atan2(T.y[ai] - c.y, T.x[ai] - c.x), diff = wrap(ta - c.h);
  // the bend ahead (path heading change over the next ~70 units) caps the speed, like a driver lifting
  let bi = ai; while (bi + 1 < n && T.s[bi] < T.s[ai] + 70) bi++;
  const h1 = Math.atan2(T.y[ai] - T.y[f.ti], T.x[ai] - T.x[f.ti]), h2 = Math.atan2(T.y[bi] - T.y[ai], T.x[bi] - T.x[ai]);
  const bend = Math.abs(wrap(h2 - h1)), vCorner = 380 - 250 * Math.min(1, bend / 1.1);
  // match the car you follow, plus a correction toward your slot; never into the car ahead
  const ahead = slot === 0 ? P : M.convoy[slot - 1].car, dAhead = Math.hypot(ahead.x - c.x, ahead.y - c.y);
  let want = clamp(Math.abs(P.v) + gap * 1.3, 0, Math.min(380, vCorner)) * (1 - Math.min(0.6, Math.abs(diff) / 2.5));
  if (dAhead < 42) want = 0;
  let throttle = c.v < want - 8 ? 1 : c.v > want + 12 ? -1 : 0, steer = clamp(diff * 2.6, -1, 1);
  if (Math.abs(diff) > 2.0 && c.v < 70 && gap > -SP) {   // the path is behind (nose-in in a driveway): back out — Palm City's own stick rule
    throttle = -0.7; steer = clamp(-wrap(ta + Math.PI - c.h) * 2.2, -1, 1);
  }
  S.driveCar(c, throttle, steer, dt, 380);
}

// convoy order = actual progress along your path (a stalled car can never deadlock the cars behind it)
function reorder(M) {
  if (M.convoy.length < 2 || !M.trail.s.length) return;
  for (const f of M.convoy) if (f.ti < 0) f.ti = locate(M, f);
  M.convoy.sort((a, b) => M.trail.s[b.ti] - M.trail.s[a.ti]);
}

export function stepRally(S, M, dt) {
  M.time += dt; if (M.msgT > 0) M.msgT -= dt;
  const P = S.player;
  if (!M.beat) { pushTrail(M, P.x, P.y); if ((M._ro = (M._ro || 0) + dt) > 0.5) { M._ro = 0; reorder(M); } }
  // the arrival beat
  if (M.beat) {
    const B = M.beat; B.t += dt; P.v *= Math.pow(0.02, dt);
    while (B.t > BEAT[B.i][1]) { B.t -= BEAT[B.i][1]; B.i++; if (B.i >= BEAT.length) break; }
    if (B.i >= BEAT.length) {
      const st = B.stop; st.done = true; M.lastPickupT = M.time;
      for (let i = 0; i < st.people.length; i++) join(S, M, st.people[i], st.cars[i]);
      M.msg = st.people.map(p => p.name.split(' ')[0]).join(' + ') + (st.people.length > 1 ? ' ARE' : ' IS') + ' IN'; M.msgT = 2.2;
      M.beat = null; M.camZoom = 1;
      if (M.stops.every(s => s.done)) { M.msg = 'EVERYONE\'S IN — MEET AT ATHOLTON HIGH'; M.msgT = 3.5; }
      return;
    }
    B.phase = BEAT[B.i][0];
    const u = B.t / BEAT[B.i][1], ease = u * u * (3 - 2 * u);
    M.camZoom = B.phase === 'zoom' ? 1 + 1.6 * ease : B.phase === 'roll' ? 2.6 - 1.6 * ease : 2.6;   // rescaled for the 0.62 base zoom (Nov 17) — same push-in framing as before
    for (const fg of B.figs) {                             // walkers: out to the huddle, then back to their own car
      const k = B.phase === 'out' ? ease : B.phase === 'dap' ? 1 : B.phase === 'in' ? 1 - ease : 0;
      fg.x = fg.cx + (fg.hx - fg.cx) * k; fg.y = fg.cy + (fg.hy - fg.cy) * k; fg.vis = B.phase !== 'zoom' && B.phase !== 'roll';
      fg.dap = B.phase === 'dap' ? Math.sin(B.t * 9 + fg.k) : 0;
    }
    return;
  }
  if (!M.complete) for (const st of M.stops) {
    if (st.done || Math.min(Math.hypot(P.x - st.x, P.y - st.y), Math.hypot(P.x - st.kx, P.y - st.ky)) > PULL_IN_R || Math.abs(P.v) > PULL_IN_V) continue;
    // everyone in the convoy + the people at this house walk to a huddle between the cars and the house
    const hx = (P.x + st.x) / 2, hy = (P.y + st.y) / 2, all = [{ c: P, who: M.me }, ...M.convoy.map(f => ({ c: f.car, who: f.person })), ...st.cars.map((c, i) => ({ c, who: st.people[i] }))];
    const figs = all.map((a, k) => { const ang = k / all.length * Math.PI * 2; return { who: a.who, k, cx: a.c.x, cy: a.c.y, hx: hx + Math.cos(ang) * 22, hy: hy + Math.sin(ang) * 22, x: a.c.x, y: a.c.y, vis: false, dap: 0 }; });
    M.beat = { stop: st, t: 0, i: 0, phase: 'zoom', figs, cx: hx, cy: hy };
    return;
  }
  // the finish: all collected, the whole convoy at the Atholton lot
  if (!M.complete && M.stops.every(s => s.done)) {
    const [mx, my] = M.meet.pos;
    if (Math.hypot(P.x - mx, P.y - my) < 450 && Math.abs(P.v) < 30 && M.convoy.every(f => Math.hypot(f.car.x - mx, f.car.y - my) < 900)) {
      M.complete = true; M.msg = 'THE CREW IS ASSEMBLED'; M.msgT = 99;
      for (const f of M.convoy) { f.car.v = 0; f.car.parked = true; }
      P.v = 0;
    }
  }
}
