// spec_l6md.mjs — task M-D, the L6 LEFTOVERS: the arrival beat online, shared on-foot walkers, Brad by the fire online.
//   node tools/spec_l6md.mjs        (from games/laurel-fulton/; needs `npm install` in server/)   exit 0 = green
// 0 — the beat stepper itself (lf_mission.stepBeat, shared by solo, the world, and every client):
//     phases zoom -> out -> dap -> in -> roll over 4.7 s; the camera pushes to 2.6x; figures reach the huddle at dap.
// A — the beat in THE ONE WORLD (src/lf_world.js): pulling in slow at a crew house starts the beat; the house's
//     crew enlist only when it ENDS (it was instant); rallyState().beat carries {huddle, cast, seconds in} meanwhile.
// B — over real sockets (server/server.js):
//     5 Brad is INSIDE by the fire in the snapshots a friend receives (the L7 remainder, seen from online)
//     6 a friend ON FOOT is in the snap's w list where they walk; back in their car, they are gone from it
//     7 a friend who drops while on foot leaves no walker behind
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f)));
const G = J('data/graph.json'), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json'), BUMPS = J('data/bumps.json').bumps;
const { GraphWorld } = await import('../src/world_graph.js');
const { CrewWorld } = await import('../src/lf_world.js');
const { makeBeat, stepBeat, BEAT_PHASES } = await import('../src/lf_mission.js');
const DT = 1 / 30;

// 0 — the stepper
{
  const M = { beat: null, camZoom: 1 };
  const fig = { who: { id: 'brad', name: 'Brad' }, k: 0, cx: 0, cy: 0, hx: 22, hy: 0, x: 0, y: 0, vis: false, dap: 0 };
  M.beat = makeBeat([fig], 0, 0, null);
  let t = 0, doneAt = -1, zoomAtDap = 0, figAtDap = -1, phases = [];
  while (t < 8) { const was = M.beat && M.beat.phase; if (stepBeat(M, DT)) { doneAt = t; break; } if (M.beat.phase !== was) phases.push(M.beat.phase); if (M.beat.phase === 'dap') { zoomAtDap = M.camZoom; figAtDap = fig.x; } t += DT; }
  const total = BEAT_PHASES.reduce((a, p) => a + p[1], 0);
  check(Math.abs(doneAt - total) < 0.1 && phases.join(',') === 'out,dap,in,roll', '0 the beat runs its five phases in order and ends on time', `${doneAt.toFixed(2)}s of ${total.toFixed(2)}s: zoom ${phases.join(' -> ')}`);
  check(zoomAtDap === 2.6 && Math.abs(figAtDap - 22) < 0.01, '0 at dap the camera is fully pushed in and the walker is AT the huddle', `camZoom ${zoomAtDap}, fig x ${figAtDap}`);
}

// A — the beat in the world
{
  const KITS = {}; for (const id of J('data/interiors/index.json')) KITS[id] = J('data/interiors/' + id + '.json');
  const W = new GraphWorld(G), WD = new CrewWorld(W, ROSTER, FLEET, { bumps: BUMPS, kits: KITS });
  WD.startRally('brad');
  const R = WD.rally, M = R.M, st = M.stops[0], lead = WD.crew.get('brad').car, convoy0 = M.convoy.length;
  lead.x = st.kx; lead.y = st.ky; lead.v = 0;                                   // the leader pulls in slow at the first house
  let beatAt = -1;
  for (let t = 0; t < 2 && beatAt < 0; t += DT) { WD.step(DT); if (M.beat) beatAt = WD.S.time; }
  check(!!M.beat && !st.done && M.convoy.length === convoy0, 'A pulling in starts the ARRIVAL BEAT — nobody climbs in yet', M.beat ? `huddle at ${Math.round(M.beat.cx)},${Math.round(M.beat.cy)}` : 'no beat');
  const rs = WD.rallyState();
  check(rs && rs.beat && rs.beat.who[0] === 'brad' && st.people.every(p => rs.beat.who.includes(p.id)) && Math.abs(rs.beat.x - M.beat.cx) <= 1 && Math.abs(rs.beat.y - M.beat.cy) <= 1,
    'A rallyState carries the beat: huddle + the whole cast (leader, convoy, the house)', rs && rs.beat ? `who=${rs.beat.who.join('+')} t=${rs.beat.t}` : 'none');
  for (let t = 0; t < 2; t += DT) WD.step(DT);
  check(!!M.beat && !st.done && M.convoy.length === convoy0 && Math.abs(lead.v) < 30, 'A mid-beat: still nobody in, the leader held slow', `phase ${M.beat && M.beat.phase}, leader v ${Math.round(lead.v)}`);
  let endAt = -1;
  for (let t = 0; t < 6 && endAt < 0; t += DT) { WD.step(DT); if (!M.beat && st.done) endAt = WD.S.time; }
  check(endAt > 0 && M.convoy.length === convoy0 + st.people.length && WD.rallyState().beat === null && / IN$/.test(WD.rallyState().msg || R.msg),
    'A when the beat ENDS the house climbs in (and the message lands, as solo)', `${st.people.map(p => p.id).join('+')} in after ${endAt > 0 ? (endAt - beatAt).toFixed(1) : '?'}s, msg "${R.msg}"`);
  check(endAt > 0 && Math.abs(endAt - beatAt - 4.7) < 0.35, 'A the world beat lasts the solo beat\'s 4.7 s', `${endAt > 0 ? (endAt - beatAt).toFixed(2) : '?'}s`);
}

// B — real sockets
let WS = null; try { WS = createRequire(path.join(ROOT, 'server/package.json'))('ws'); } catch (e) { check(false, 'server deps installed (cd server && npm install)', String(e).slice(0, 100)); }
if (WS) {
  const { start } = await import('../server/server.js');
  const srv = await start({ port: 0, friends: new Map([['k-a', 'Friend A'], ['k-b', 'Friend B']]), log: () => {} });
  const open = (k) => new Promise((res) => {
    const ws = new WS(`ws://localhost:${srv.port}/?key=${k}`), box = { ws, msgs: [], code: null };
    ws.on('message', b => box.msgs.push(JSON.parse(b))); ws.on('close', c => { box.code = c; res(box); }); ws.on('open', () => setTimeout(() => res(box), 300));
  });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await wait(20); } return null; };
  const send = (b, m) => b.ws.send(JSON.stringify(m));
  const A = await open('k-a'), B = await open('k-b');
  // 5 — Brad by the fire, in a friend's snapshots, before anyone picks anyone
  const snapB0 = await until(() => B.msgs.filter(m => m.type === 'snap').pop());
  const bradRow = snapB0 && snapB0.cars.find(c => c[0] === 'brad');
  check(!!bradRow && Array.isArray(bradRow[8]) && bradRow[8][0] === 'brad' && bradRow[8][1] === 'lower', '5 ONLINE: Brad idles INSIDE by the fire — a connected friend\'s snapshot says so ([8])', bradRow ? JSON.stringify(bradRow[8]) : 'no snap');
  // 6 — walkers shared
  send(A, { type: 'pick', id: 'jason' }); const youA = await until(() => A.msgs.find(m => m.type === 'you'));
  send(B, { type: 'pick', id: 'kosack' }); await until(() => B.msgs.find(m => m.type === 'you'));
  const ja = { ...youA.state };
  for (let i = 0; i < 12; i++) { send(A, { type: 'car', ...ja, f: [1000 + i * 10, 2000, 1.5] }); await wait(66); }
  const wSeen = await until(() => { const s = B.msgs.filter(m => m.type === 'snap').pop(); const w = s && (s.w || []).find(w => w[0] === 'jason'); return w && Math.abs(w[1] - 1110) <= 15 ? w : null; });
  check(!!wSeen, '6 a friend ON FOOT is shared: B\'s snapshot lists Jason walking where A walks him', wSeen ? JSON.stringify(wSeen) : 'not seen');
  for (let i = 0; i < 8; i++) { send(A, { type: 'car', ...ja }); await wait(66); }   // back in the car: no f
  const wGone = await until(() => { const s = B.msgs.filter(m => m.type === 'snap').pop(); return s && !(s.w || []).some(w => w[0] === 'jason') ? true : null; }, 3000);
  check(!!wGone, '6 back in the car, the walker is gone from the snapshot');
  // 7 — drop while on foot
  for (let i = 0; i < 6; i++) { send(A, { type: 'car', ...ja, f: [500, 600, 0] }); await wait(66); }
  await until(() => { const s = B.msgs.filter(m => m.type === 'snap').pop(); return s && (s.w || []).some(w => w[0] === 'jason'); });
  A.ws.terminate();
  const wDrop = await until(() => { const s = B.msgs.filter(m => m.type === 'snap').pop(); return s && !(s.w || []).some(w => w[0] === 'jason') ? true : null; }, 3000);
  check(!!wDrop, '7 a friend who drops while on foot leaves no walker behind');
  B.ws.close(); await srv.close();
}
console.log(fails ? `SPEC L6MD FAIL (${fails})` : 'SPEC L6MD OK'); process.exit(fails ? 1 : 0);
