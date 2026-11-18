// lf_convoy.js — CONVOY BEHAVIOUR (owner, Nov 18): when the crew follows you they are NOT a parade. They constantly try to RACE and
// PASS you, yell "Cole Trickle", yell "rubbin is racing" when they bump you, throw ones (dollar bills) out the window at the cars,
// and throw pens + pennies at each other while driving.
//
//   raceTune(S, M, f, dt, k)   called from lf_mission.follow() for every follower, every step -> null (drive the slot as usual) or
//                              { ax, ay, want } = steer at (ax, ay), hold `want` u/s. Runs on the SAME physics (driveCar) and the
//                              same road-snapping, so a racer never leaves the street. Used by the solo rally AND the one world.
//   stepConvoy(S, M, dt)       called from lf_mission.stepRally (client side): bump detection -> "rubbin is racing", the rolling
//                              "Cole Trickle", ones / pens / pennies, and the Barks (lf_barks.js) step. M.barks holds it all.
//
// A follower's RACE is a small state machine: idle -> pull (surge up alongside, a lane off yours) -> pass (nose ahead of you) ->
// gloat (holds the lead ~2 s, bills out the window) -> drop (lifts, falls back to its slot) -> idle. Two racers at most; slow
// parades (< 11 mph), the arrival beat and the run-in to the finish are NOT raced (everyone still ends up parked at the school).
import { Barks } from './lf_barks.js';

const SP = 78;                                            // the follow spacing (lf_mission.js)
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
export const RACE = { vmax: 540, minV: 110, maxRacers: 1, pullT: 14, passT: 6, gloatT: 2.0, dropT: 6, passAhead: 48, lead: 60, finishQuiet: 1200 };

const lcg = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
function raceOf(M) { return M.race || (M.race = { on: true, rnd: lcg(M.seed || 1118), passes: 0, bumps: 0, racers: 0, events: [], pause: 0 }); }

export function raceTune(S, M, f, dt, k) {
  const R = raceOf(M); if (!R.on) return null;
  const c = f.car, P = k.P, W = S.W, slot = k.slot;
  const st = f.race || (f.race = { st: 'idle', t: 0, next: 3 + R.rnd() * 5 + slot * 1.5, side: slot % 2 ? -1 : 1, rub: false, passes: 0 });
  const dxp = Math.cos(P.h), dyp = Math.sin(P.h), rx = -dyp, ry = dxp;           // your heading + your right-hand side
  const along = (c.x - P.x) * dxp + (c.y - P.y) * dyp, lat = (c.x - P.x) * rx + (c.y - P.y) * ry;
  const T = M.trail, n = T.x.length;
  const hardQuiet = M.beat || M.complete || Math.abs(P.v) < 35 || n < 8 ||                 // nothing is raced during the beat, at a standstill, or on the run-in to the finish
    (M.stops && M.stops.every(s => s.done) && M.meet && Math.hypot(P.x - M.meet.pos[0], P.y - M.meet.pos[1]) < RACE.finishQuiet);
  const quiet = hardQuiet || Math.abs(P.v) < RACE.minV;                                    // a slow parade doesn't START a race; one already on finishes it
  // L17: racing is for a STRAIGHT you are already on — the stretch you just drove must not be turning (a pass started in a bend shoved the player into the rail)
  const turning0 = (() => { const e = n - 1; let i1 = e, i2 = e; while (i1 > 0 && T.s[e] - T.s[i1] < 130) i1--; i2 = i1; while (i2 > 0 && T.s[e] - T.s[i2] < 300) i2--;
    return Math.abs(wrap(Math.atan2(T.y[e] - T.y[i1], T.x[e] - T.x[i1]) - Math.atan2(T.y[i1] - T.y[i2], T.x[i1] - T.x[i2]))) > 0.4; })();
  // ...and the road AHEAD of you must run straight on under your nose for 40 m (a racer alongside at a bend or a junction gets you pinned on a rail)
  if (R.ck !== M.time) { R.ck = M.time; R.ahead = [60, 140, 240].every(d => { const q = W.roadInfo(P.x + dxp * d, P.y + dyp * d, P.layer || 0); return q.e && q.d < Math.max(16, q.hw * 0.6); }); }
  const turning = turning0 || !R.ahead;
  st.t += dt;
  if (turning && st.st !== 'idle' && st.st !== 'drop') { st.st = 'drop'; st.t = 0; }   // the road bends: lift and fall back to the slot
  if (st.st === 'idle') {
    if (turning) { st.next = Math.max(st.next, 1.5); return null; }
    if (quiet || (M.time - f.joinedAt) < 5) { st.next = Math.max(st.next, 1.5); return null; }
    if ((st.next -= dt) > 0 || slot > 1 || R.racers >= RACE.maxRacers || Math.abs(k.gap) > SP * 1.2 || k.bend > 0.3 || Math.hypot(c.x - P.x, c.y - P.y) > 450) return null;   // only a follower sitting in its slot goes for it
    st.st = 'pull'; st.t = 0; f.race.cool = undefined; st.rub = R.rnd() < 0.6; st.side = R.rnd() < 0.5 ? 1 : -1; R.racers++;
  }
  const leave = () => { st.st = 'idle'; st.t = 0; st.next = 5 + R.rnd() * 6; R.racers = Math.max(0, R.racers - 1); };
  if (hardQuiet) { if (st.st !== 'idle') leave(); return null; }                              // a slow parade / the beat / the run-in: back to the slot at once
  if (Math.hypot(c.x - P.x, c.y - P.y) > 800) { leave(); return null; }                      // fell too far back: just catch up
  const straight = k.bend < 0.45;                                                          // single file through the bends: racing is for the straights
  const look = 30 + Math.abs(c.v) * 0.12;
  let want, ax, ay, off;
  const r0 = W.roadInfo(P.x, P.y, P.layer || 0), hw = r0.e ? r0.hw : 34, lane = clamp(hw - 12, 20, 28);
  if (st.st === 'pull' || st.st === 'pass' || st.st === 'gloat') {
    if (st.st === 'pull' && along > -8) { st.st = 'pass'; st.t = 0; R.events.push({ t: M.time, ev: 'alongside', id: f.person && f.person.id }); }
    if (st.st === 'pass' && along > RACE.passAhead && Math.abs(lat) < 80) { st.st = 'gloat'; st.t = 0; st.passes++; R.passes++; R.events.push({ t: M.time, ev: 'pass', id: f.person && f.person.id }); }
    if ((st.st === 'pull' && st.t > RACE.pullT) || (st.st === 'pass' && st.t > RACE.passT) || (st.st === 'gloat' && st.t > RACE.gloatT)) { st.st = 'drop'; st.t = 0; }
  }
  if (st.st === 'drop') {
    if (along < -(slot + 1) * SP * 0.55 || st.t > RACE.dropT) { leave(); return null; }
    want = Math.abs(P.v) - 75; ax = k.ax; ay = k.ay; off = Math.abs(lat) > 6 ? lat : 0;       // lift: your slot is behind you
    if (off) { ax += rx * -off * 0.5; ay += ry * -off * 0.5; }
    return { ax, ay, want: Math.max(0, want), vmax: 380 };
  }
  // pull / pass / gloat: the aim point. Far behind -> a lane off your breadcrumb trail; alongside/ahead -> a point down YOUR road, a lane over.
  const blend = clamp(st.t / 1.0, 0, 1) * (c.surface && c.surface !== 'road' ? 0.2 : 1);   // wheels off the tarmac: straighten up
  off = st.side * lane * (straight ? 1 : 0.25) * (st.st === 'gloat' ? (st.rub ? 0.5 : 0.85) : 1) * blend * (st.rub && st.st !== 'gloat' ? 0.9 : 1);
  if (along > -70) {
    const ahead = st.st === 'gloat' ? RACE.lead + look : Math.max(look, along + look);
    ax = P.x + dxp * ahead + rx * off; ay = P.y + dyp * ahead + ry * off;
  } else { ax = k.ax + rx * off; ay = k.ay + ry * off; }
  const r = W.roadInfo(ax, ay, c.layer || 0);                                              // snap to the street: never aim across a lawn
  if (r.e && r.d > r.hw - 8) { const q = S.nearPt(ax, ay, r), sc = Math.max(0, r.hw - 10) / r.d; ax = q.x + (ax - q.x) * sc; ay = q.y + (ay - q.y) * sc; }
  want = Math.abs(P.v) + (st.st === 'pull' ? 110 : st.st === 'pass' ? 90 : (RACE.lead - along) * 1.3);
  want = clamp(want, 0, 380);
  const ch = Math.cos(c.h), sh = Math.sin(c.h);                                            // a car dead ahead of the racer (not you, you are what it is racing): stay off it
  for (const o of M.convoy) { if (o === f) continue; const ox = o.car.x - c.x, oy = o.car.y - c.y, fw = ox * ch + oy * sh, lt = -ox * sh + oy * ch; if (fw > 0 && fw < 52 && Math.abs(lt) < 13) want = Math.min(want, Math.max(0, o.car.v * 0.9)); }
  return { ax, ay, want, vmax: RACE.vmax };
}

// ---- the client-side layer: bumps, barks, throws --------------------------------------------------------------------------
const LINES = { cole: ['Cole Trickle!', 'Cole Trickle!!', 'Cole Trickle! Cole!'], rub: ['rubbin is racing', "rubbin is racin'", 'rubbin is racing, baby!'] };
const REACH = (a, b) => (a.len + b.len) / 4 + (a.wid + b.wid) / 4;

export function stepConvoy(S, M, dt) {
  const R = raceOf(M), B = M.barks || (M.barks = new Barks()), P = S.player; if (!P) return;
  B.step(dt);
  R.t = (R.t || 0) + dt;
  const cars = M.convoy.map(f => ({ f, c: f.car }));
  const pick = (arr) => arr[Math.floor(R.rnd() * arr.length)];
  // rubbin is racing: a follower makes contact with you (or another follower) -> it yells it, with a cooldown per car
  const touch = (a, b, fa) => {
    const d = Math.hypot(a.x - b.x, a.y - b.y); if (d > REACH(a, b) + 3 || a.layer !== b.layer) return;
    if (B.say(a, pick(LINES.rub), { key: 'rub', cd: 3.5, urgent: true, ttl: 2.1 })) { R.bumps++; R.events.push({ t: M.time, ev: 'bump', id: fa.person && fa.person.id }); }
  };
  for (const { f, c } of cars) {
    if (Math.abs(c.v) < 30 && Math.abs(P.v) < 30) continue;
    touch(c, P, f);
    for (const o of cars) if (o.c !== c) touch(c, o.c, f);
  }
  if (M.beat || M.complete) return;
  // the rolling bark + the throws (only while the convoy is actually rolling and near you)
  for (const { f, c } of cars) {
    const st = f.race || (f.race = { st: 'idle', t: 0, next: 4, side: 1, rub: false, passes: 0 });
    const near = Math.hypot(c.x - P.x, c.y - P.y) < 900, rolling = Math.abs(c.v) > 70;
    if (!near || !rolling) continue;
    f.bark = (f.bark ?? (3 + R.rnd() * 6)) - dt;
    if (f.bark <= 0 && B.say(c, pick(LINES.cole), { key: 'cole', cd: 6 })) f.bark = 7 + R.rnd() * 8;
    else if (f.bark <= 0) f.bark = 1.5;
    if (st.st === 'gloat' && !st.cheered) { st.cheered = true; B.say(c, 'Cole Trickle!', { key: 'cole', cd: 0, urgent: true }); }
    if (st.st !== 'gloat') st.cheered = false;
    // ones out the window at the cars; pens + pennies at each other (convoy cars, you included)
    const others = [P, ...cars.filter(o => o.c !== c).map(o => o.c)].filter(o => Math.hypot(o.x - c.x, o.y - c.y) < 520 && Math.hypot(o.x - c.x, o.y - c.y) > 30);
    if (!others.length) continue;
    f.billT = (f.billT ?? (2 + R.rnd() * 5)) - dt; f.pelt = (f.pelt ?? (1.5 + R.rnd() * 4)) - dt;
    if (f.billT <= 0) { f.billT = 5 + R.rnd() * 7; B.throwAt('bill', c, pick(others)); }
    if (f.pelt <= 0) { f.pelt = 2.5 + R.rnd() * 4.5; B.throwAt(R.rnd() < 0.5 ? 'pen' : 'penny', c, pick(others)); }
  }
}
