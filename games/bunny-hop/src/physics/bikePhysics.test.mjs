// Bunny Hop — bike physics spec tests. Run: node --test games/bunny-hop/src/physics/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBike, CONFIG } from './bikePhysics.js';

const DT = 1 / 60;
const DEG = Math.PI / 180;
const IDLE = { pedal: 0, steer: 0, hopHeld: false, hopReleased: false, airPitch: 0 };
const inp = (o = {}) => ({ ...IDLE, ...o });

// heading 0 => forward is +z (x += sin(h)*v, z += cos(h)*v)
const flat = { groundAt: () => ({ height: 0, type: 'ground' }), waterLevel: -10 };

function makeBike(env = flat, spawn = { x: 0, z: 0, heading: 0 }) {
  const bike = createBike(CONFIG);
  bike.reset(spawn, env);
  return bike;
}

function run(bike, env, seconds, input, onStep) {
  const events = [];
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    const ev = bike.step(DT, typeof input === 'function' ? input(i) : input, env);
    events.push(...ev);
    if (onStep) onStep(bike.state, ev, i);
  }
  return events;
}

/** Hold hop for holdSeconds at the given speed on flat ground, release, return apex height. */
function hopApex(holdSeconds, speed = CONFIG.cruiseSpeed) {
  const bike = makeBike();
  bike.state.speed = speed;
  const pedal = speed / CONFIG.topSpeed; // holds speed
  run(bike, flat, holdSeconds, inp({ pedal, hopHeld: true }));
  let apex = 0, hopEvents = 0;
  const evs = run(bike, flat, 2, i => inp({ pedal, hopReleased: i === 0 }), s => { apex = Math.max(apex, s.y); });
  hopEvents = evs.filter(e => e.type === 'hop').length;
  assert.equal(hopEvents, 1, 'exactly one hop event');
  return apex;
}

test('hop height is monotonic in charge time; full charge apex >= 1.25 m', () => {
  const holds = [DT, 0.08, 0.12, 0.16, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.6, 1.0];
  const apexes = holds.map(h => hopApex(h));
  for (let i = 1; i < apexes.length; i++) {
    assert.ok(apexes[i] >= apexes[i - 1] - 1e-9, `apex not monotonic at hold ${holds[i]}: ${apexes[i - 1]} -> ${apexes[i]}`);
  }
  assert.ok(apexes.at(-1) >= 1.25, `full-charge apex ${apexes.at(-1).toFixed(3)} < 1.25`);
  assert.ok(apexes.at(-1) > apexes[0] + 0.8, 'charge must matter a lot');
});

test('tap hop apex is between 0.15 m and 0.5 m', () => {
  const apex = hopApex(DT);
  assert.ok(apex >= 0.15 && apex <= 0.5, `tap apex ${apex.toFixed(3)}`);
});

test('hop pitch: front lifts first, rising through ~40% of airtime then levelling', () => {
  const bike = makeBike();
  bike.state.speed = CONFIG.cruiseSpeed;
  run(bike, flat, 0.5, inp({ hopHeld: true, pedal: CONFIG.cruiseSpeed / CONFIG.topSpeed }));
  const trace = [];
  run(bike, flat, 1.5, i => inp({ hopReleased: i === 0 }), s => { if (!s.grounded) trace.push(s.pitch); });
  const peakIdx = trace.indexOf(Math.max(...trace));
  assert.ok(trace[peakIdx] > 10 * DEG, 'nose comes up noticeably');
  const frac = peakIdx / trace.length;
  assert.ok(frac > 0.3 && frac < 0.5, `pitch peak at ${(frac * 100).toFixed(0)}% of airtime`);
  for (let i = 1; i <= peakIdx; i++) assert.ok(trace[i] >= trace[i - 1] - 1e-9, 'rising phase is monotonic');
  assert.ok(Math.abs(trace.at(-1)) < 3 * DEG, 'levelled by touchdown');
});

/** Ride off a flat ledge (pitch 0) onto a plane sloping down at slopeDeg; return land events. */
function landOnSlope(slopeDeg) {
  const t = Math.tan(slopeDeg * DEG);
  const env = {
    groundAt: (x, z) => (z < 0 ? { height: 3, type: 'ground' } : { height: 2 - z * t, type: 'ground' }),
    waterLevel: -10,
  };
  const bike = makeBike(env, { x: 0, z: -2, heading: 0 });
  bike.state.speed = 4;
  const evs = run(bike, env, 3, inp({ pedal: 4 / CONFIG.topSpeed }));
  return { bike, evs };
}

test('landing judge: 15° mismatch clean, 25° wobble, 40° bail', () => {
  const c = landOnSlope(15);
  assert.deepEqual(c.evs.filter(e => e.type === 'land').map(e => e.quality), ['clean']);
  assert.equal(c.bike.state.bailed, false);

  const w = landOnSlope(25);
  assert.deepEqual(w.evs.filter(e => e.type === 'land').map(e => e.quality), ['wobble']);
  assert.equal(w.bike.state.bailed, false);

  const b = landOnSlope(40);
  const lands = b.evs.filter(e => e.type === 'land');
  assert.deepEqual(lands.map(e => e.quality), ['bail']);
  assert.equal(b.evs.filter(e => e.type === 'bail').length, 1);
  assert.equal(b.bike.state.bailed, true);
});

test('landing judge works through airPitch: bad takeoff can be corrected', () => {
  // nose way up from a full hop, held air-pitch up => bail; same hop corrected nose-down => clean
  const go = airPitch => {
    const bike = makeBike();
    bike.state.speed = CONFIG.cruiseSpeed;
    const pedal = CONFIG.cruiseSpeed / CONFIG.topSpeed;
    run(bike, flat, 0.5, inp({ hopHeld: true, pedal }));
    return run(bike, flat, 1.5, i => inp({ hopReleased: i === 0, airPitch: i < 40 ? airPitch : 0 }))
      .filter(e => e.type === 'land').map(e => e.quality);
  };
  assert.deepEqual(go(0), ['clean']);
  assert.deepEqual(go(1), ['bail']);
});

test('lean at cruise with full steer settles in 0.25..0.5 rad with no oscillation after 1 s', () => {
  const bike = makeBike();
  bike.state.speed = CONFIG.cruiseSpeed;
  const pedal = CONFIG.cruiseSpeed / CONFIG.topSpeed;
  const lean = [];
  run(bike, flat, 3, inp({ pedal, steer: 1 }), s => lean.push(s.lean));
  const settled = lean.slice(60);
  for (const l of settled) assert.ok(Math.abs(l) >= 0.25 && Math.abs(l) <= 0.5, `lean ${l}`);
  const span = Math.max(...settled) - Math.min(...settled);
  assert.ok(span < 0.005, `lean still moving after 1 s (span ${span})`);
  // smooth in: monotonic, no overshoot past the settled value
  const final = lean.at(-1);
  for (let i = 1; i < lean.length; i++) assert.ok(Math.abs(lean[i]) >= Math.abs(lean[i - 1]) - 1e-12, 'lean overshoot/jitter');
  assert.ok(Math.max(...lean.map(Math.abs)) <= Math.abs(final) + 1e-9);
  // smooth out: release steer, lean returns to ~0 monotonically
  const out = [];
  run(bike, flat, 1.5, inp({ pedal }), s => out.push(Math.abs(s.lean)));
  for (let i = 1; i < out.length; i++) assert.ok(out[i] <= out[i - 1] + 1e-12, 'lean release jitter');
  assert.ok(out.at(-1) < 0.01);
});

test('standstill: full steer for 1 s changes heading by < 2°', () => {
  const bike = makeBike();
  const h0 = bike.state.heading;
  run(bike, flat, 1, inp({ steer: 1 }));
  assert.ok(Math.abs(bike.state.heading - h0) < 2 * DEG);
  assert.ok(Math.abs(bike.state.lean) < 0.01, 'no lean at standstill');
});

test('steering curve: gentle at crawl, strongest at cruise, calmer at top', () => {
  const rate = v => {
    const bike = makeBike();
    bike.state.speed = v;
    const h0 = bike.state.heading;
    run(bike, flat, 0.5, inp({ pedal: v / CONFIG.topSpeed, steer: 1 }));
    return Math.abs(bike.state.heading - h0) / 0.5;
  };
  const crawl = rate(1), cruise = rate(CONFIG.cruiseSpeed), top = rate(CONFIG.topSpeed);
  assert.ok(cruise > crawl * 1.5, `crawl ${crawl} cruise ${cruise}`);
  assert.ok(cruise > top, `cruise ${cruise} top ${top}`);
});

test('coast-down: from top speed, 3 s of coast leaves 55%..80% of top speed', () => {
  const bike = makeBike();
  bike.state.speed = CONFIG.topSpeed;
  run(bike, flat, 3, inp());
  const r = bike.state.speed / CONFIG.topSpeed;
  assert.ok(r >= 0.55 && r <= 0.8, `coast ratio ${r.toFixed(3)}`);
});

test('momentum: no instant start, asymptotic top speed, firm brake but not instant', () => {
  const bike = makeBike();
  run(bike, flat, DT, inp({ pedal: 1 }));
  assert.ok(bike.state.speed > 0 && bike.state.speed < 0.3, 'no instant start');
  run(bike, flat, 1, inp({ pedal: 1 }));
  const at1 = bike.state.speed;
  assert.ok(at1 > 3, `strong off the line (${at1})`);
  run(bike, flat, 15, inp({ pedal: 1 }));
  assert.ok(bike.state.speed <= CONFIG.topSpeed + 1e-9 && bike.state.speed > CONFIG.topSpeed * 0.97);
  // brake from top
  run(bike, flat, DT, inp({ pedal: -1 }));
  assert.ok(bike.state.speed > CONFIG.topSpeed * 0.9, 'no instant stop');
  let t = 0;
  run(bike, flat, 4, inp({ pedal: -1 }), s => { if (s.speed > 0) t += DT; });
  assert.ok(t > 0.8 && t < 2.2, `brake-to-stop ${t.toFixed(2)} s`);
});

test('splash: drop from bridge-deck height over water fires exactly one splash with entry speed', () => {
  const env = {
    groundAt: (x, z) => (z < 0 ? { height: 1.5, type: 'deck' } : { height: -1.5, type: 'water' }),
    waterLevel: -0.55,
  };
  const bike = makeBike(env, { x: 0, z: -1, heading: 0 });
  bike.state.speed = 5;
  const evs = run(bike, env, 3, inp({ pedal: 5 / CONFIG.topSpeed }));
  const splashes = evs.filter(e => e.type === 'splash');
  assert.equal(splashes.length, 1);
  const expected = Math.hypot(5, Math.sqrt(2 * CONFIG.gravity * (1.5 + 0.55)));
  assert.ok(Math.abs(splashes[0].speed - expected) < 0.3, `splash speed ${splashes[0].speed} vs ${expected}`);
  assert.equal(evs.filter(e => e.type === 'land').length, 0, 'no landing on the canal bed');
  // simulation stopped: further steps produce nothing and do not move the bike
  const y = bike.state.y;
  assert.deepEqual(run(bike, env, 1, inp({ pedal: 1 })), []);
  assert.equal(bike.state.y, y);
});

// ---- extra feel guarantees from the brief ----

const BIN = { x: 0, z: 5, half: 0.52, top: 1.06 };
const binEnv = {
  groundAt: (x, z) => (Math.abs(x - BIN.x) < BIN.half && Math.abs(z - BIN.z) < BIN.half
    ? { height: BIN.top, type: 'bin' } : { height: 0, type: 'ground' }),
  waterLevel: -10,
};

test('full charge at cruise clears a trash bin and lands clean beyond it', () => {
  const bike = makeBike(binEnv, { x: 0, z: 0, heading: 0 });
  bike.state.speed = CONFIG.cruiseSpeed;
  const pedal = CONFIG.cruiseSpeed / CONFIG.topSpeed;
  // release roughly 1.6 m before the bin face
  const evs = run(bike, binEnv, 3, i => {
    const z = bike.state.z;
    return inp({ pedal, hopHeld: z < 2.9, hopReleased: z >= 2.9 && bike.state.grounded && bike.state.crouch01 > 0 });
  });
  assert.equal(evs.filter(e => e.type === 'bail').length, 0, JSON.stringify(evs));
  const lands = evs.filter(e => e.type === 'land');
  assert.equal(lands[0].surface, 'ground');
  assert.equal(lands[0].quality, 'clean');
  assert.ok(bike.state.z > BIN.z + 1);
  assert.ok(bike.state.speed > CONFIG.cruiseSpeed * 0.9, 'clean landing keeps speed');
});

test('full charge at low speed can land ON a bin top, then roll off it keeping momentum', () => {
  const bike = makeBike(binEnv, { x: 0, z: 0, heading: 0 });
  bike.state.speed = 2;
  const pedal = 2 / CONFIG.topSpeed;
  const evs = run(bike, binEnv, 4.5, () => {
    const z = bike.state.z;
    return inp({ pedal: bike.state.grounded ? pedal : 0, hopHeld: z < 3.9, hopReleased: z >= 3.9 && bike.state.grounded && bike.state.crouch01 > 0 });
  });
  const lands = evs.filter(e => e.type === 'land');
  assert.ok(lands.length >= 1);
  assert.equal(lands[0].surface, 'bin');
  assert.notEqual(lands[0].quality, 'bail');
  // after rolling off the bin it falls to the ground carrying horizontal speed
  assert.equal(lands.at(-1).surface, 'ground');
  assert.ok(bike.state.z > BIN.z + BIN.half);
});

test('edges are honest: riding off a ledge keeps horizontal speed; coyote window is ~80 ms only', () => {
  const env = { groundAt: (x, z) => ({ height: z < 0 ? 1.5 : 0, type: 'deck' }), waterLevel: -10 };
  const bike = makeBike(env, { x: 0, z: -1, heading: 0 });
  bike.state.speed = 6;
  let airSpeeds = [];
  run(bike, env, 0.6, inp(), s => { if (!s.grounded) airSpeeds.push(s.speed); });
  assert.ok(airSpeeds.length > 5);
  assert.ok(Math.abs(airSpeeds[0] - airSpeeds.at(-1)) < 1e-9, 'horizontal momentum preserved in fall');

  const late = delay => {
    const b = makeBike(env, { x: 0, z: -0.5, heading: 0 });
    b.state.speed = 6;
    let air = 0, popped = false;
    for (let i = 0; i < 120 && !popped; i++) {
      const s = b.state;
      if (!s.grounded) air += DT;
      const release = !s.grounded && air >= delay;
      const ev = b.step(DT, inp({ hopHeld: !release, hopReleased: release }), env);
      if (ev.some(e => e.type === 'hop')) popped = true;
      if (release) break;
    }
    return popped;
  };
  assert.equal(late(0.05), true, 'hop within coyote window');
  assert.equal(late(0.15), false, 'no hop well after leaving the edge');
});

test('wall: riding into a bin side at speed bails; slow bump just stops', () => {
  const fast = makeBike(binEnv, { x: 0, z: 0, heading: 0 });
  fast.state.speed = CONFIG.topSpeed;
  const evs = run(fast, binEnv, 1, inp({ pedal: 1 }));
  assert.ok(evs.some(e => e.type === 'bail'));
  assert.equal(fast.state.bailed, true);

  const slow = makeBike(binEnv, { x: 0, z: 3.5, heading: 0 });
  slow.state.speed = 1.5;
  const evs2 = run(slow, binEnv, 2, inp({ pedal: 0.15 }));
  assert.ok(!evs2.some(e => e.type === 'bail'));
  assert.ok(slow.state.z < BIN.z - BIN.half);
  assert.ok(slow.state.y < 0.01);
});

test('reset clears bail and places the bike on the ground', () => {
  const env = { groundAt: () => ({ height: 0.7, type: 'deck' }), waterLevel: -10 };
  const bike = makeBike(env);
  bike.state.bailed = true;
  bike.reset({ x: 3, z: 4, heading: 1 }, env);
  const s = bike.state;
  assert.deepEqual([s.x, s.y, s.z, s.heading, s.speed, s.bailed, s.grounded], [3, 0.7, 4, 1, 0, false, true]);
});

test('frame-rate independence: 30 fps and 144 fps hops agree', () => {
  const apexAt = fps => {
    const dt = 1 / fps;
    const bike = makeBike();
    bike.state.speed = CONFIG.cruiseSpeed;
    const pedal = CONFIG.cruiseSpeed / CONFIG.topSpeed;
    for (let t = 0; t < 0.5; t += dt) bike.step(dt, inp({ pedal, hopHeld: true }), flat);
    let apex = 0;
    for (let i = 0; i < fps * 2; i++) { bike.step(dt, inp({ pedal, hopReleased: i === 0 }), flat); apex = Math.max(apex, bike.state.y); }
    return apex;
  };
  assert.ok(Math.abs(apexAt(30) - apexAt(144)) < 0.03);
});
