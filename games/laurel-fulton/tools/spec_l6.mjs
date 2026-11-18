// spec_l6.mjs — task L6, ONE SERVER, FRIENDS ONLY, EVERYONE IS CPU UNTIL CHOSEN.
//   node tools/spec_l6.mjs        (from games/laurel-fulton/; needs `npm install` in server/)   exit 0 = green
// A — the world itself (src/lf_world.js), fast-forwarded: 12 game-minutes with nobody connected
//   1 every crew member is in the world as a CPU; they LIVE: leave home, drive somewhere real, hang out, come home
//   2 CPU driving = the stick autopilot on Palm City physics: no teleports, on the streets; the burning Mustang never moves
//   3 TAKEOVER mid-drive: you get the car exactly as it is (same spot, same speed) — no jump; the CPU lets go of it
//   4 HAND BACK mid-drive: the CPU carries on from exactly there, no jump, and drives the character home
// B — the real server over real sockets (server/server.js)
//   5 friends only: no key / a wrong key is refused before a single byte of the world is sent
//   6 pick: free -> yours; already picked -> TAKEN; two friends drive two crew members and SEE each other (crossed paths)
//   7 a friend drops mid-drive -> that crew member is CPU again within a snapshot and keeps moving
//   8 persistent: the world keeps running with nobody connected
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f)));
const G = J('data/graph.json'), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json'), BUMPS = J('data/bumps.json').bumps;
const { GraphWorld } = await import('../src/world_graph.js');
let CW = null; try { CW = await import('../src/lf_world.js'); } catch (e) { check(false, 'src/lf_world.js loads', String(e).slice(0, 160)); }
if (CW) {
  const W = new GraphWorld(G), WD = new CW.CrewWorld(W, ROSTER, FLEET, { bumps: BUMPS }), DT = 1 / 30;
  const crewIds = ROSTER.people.filter(p => p.active && p.car && p.car.sprite && FLEET[p.car.sprite]).map(p => p.id);
  check(WD.crew.size === crewIds.length && WD.who().every(c => c.human === null), '1 every crew member is in the world, all CPU', `${WD.crew.size} crew: ${crewIds.join(' ')}`);
  const last = new Map(), st = { teleports: 0, drive: 0, off: 0 }; const fire = [...WD.crew.values()].find(B => B.still);
  const fire0 = fire && { x: fire.car.x, y: fire.car.y };
  const watch = () => {
    for (const B of WD.crew.values()) {
      const c = B.car, p = last.get(B.id);
      if (p && !B.human && Math.hypot(c.x - p.x, c.y - p.y) > Math.abs(c.v) * DT + 8) st.teleports++;
      last.set(B.id, { x: c.x, y: c.y });
      if (B.state === 'drive' && !B.human && Math.abs(c.v) > 40) { st.drive++; const r = W.roadInfo(c.x, c.y, c.layer); if (!(r.e && r.d < r.hw + 15)) st.off++; }
    }
  };
  const run = (secs, until) => { for (let t = 0; t < secs; t += DT) { WD.step(DT); watch(); if (until && until()) return true; } return false; };
  run(12 * 60);
  const movers = [...WD.crew.values()].filter(B => !B.still), tripped = movers.filter(B => B.trips >= 2);
  check(tripped.length >= movers.length - 1, '1 the crew LIVE: out to somewhere real and back home again, with nobody connected', `${tripped.length}/${movers.length} made 2+ trips in 12 game-min (${movers.map(B => B.id + ':' + B.trips).join(' ')})`);
  check(st.teleports === 0 && st.off / Math.max(1, st.drive) < 0.05, '2 CPU driving: no teleports, on the streets (< 5% of moving steps past a kerb)', `${st.teleports} jumps, ${(100 * st.off / Math.max(1, st.drive)).toFixed(2)}% off over ${st.drive} steps`);
  check(!fire || Math.hypot(fire.car.x - fire0.x, fire.car.y - fire0.y) < 1, '2 the burning Mustang stays parked burning', fire ? fire.id : 'none');
  // 3 takeover mid-drive
  const ok3 = run(240, () => [...WD.crew.values()].some(B => B.state === 'drive' && B.car.v > 120));
  const B = [...WD.crew.values()].find(B => B.state === 'drive' && B.car.v > 120);
  const before = WD.state(B.car), got = WD.takeover(B.id, 'Friend A');
  check(ok3 && got && got.x === before.x && got.y === before.y && got.v === before.v, `3 TAKEOVER ${B ? B.id : '?'} mid-drive: you get the car exactly as it is`, got ? `${Math.round(got.v / 4.47)} mph at ${Math.round(got.x)},${Math.round(got.y)}` : '');
  check(WD.takeover(B.id, 'Friend B') === null, '3 a crew member someone has picked cannot be picked again');
  const mine = { ...got, model: B.car.model, len: B.car.len, wid: B.car.wid, turbo: 0, layer: got.layer };   // the friend's machine drives it now
  let follow = true;
  for (let t = 0; t < 8; t += DT) {
    WD.S.stickDrive(mine, { jx: Math.cos(mine.h + 0.6), jy: Math.sin(mine.h + 0.6), jm: 1, keys: {} }, DT);
    WD.drive(B.id, mine); WD.step(DT);
    if (Math.hypot(B.car.x - mine.x, B.car.y - mine.y) > 0.5) follow = false;
  }
  check(follow, '3 while picked, the car goes exactly where the friend drives it (the CPU has let go)');
  // 4 hand back mid-drive
  mine.v = 200; WD.drive(B.id, mine); const at = { x: B.car.x, y: B.car.y };
  WD.release(B.id); for (const o of WD.crew.values()) last.set(o.id, { x: o.car.x, y: o.car.y }); st.teleports = 0;   // fresh baseline: the takeover steps above were not watched
  const home = run(8 * 60, () => B.state === 'home' && B.car.parked);
  check(st.teleports === 0 && home !== undefined && WD.who().find(c => c.id === B.id).human === null, '4 HAND BACK mid-drive: the CPU carries on from exactly there, no jump');
  check(home && Math.hypot(B.car.x - B.home.x, B.car.y - B.home.y) < 250, `4 ... and drives ${B.name} home`, `parked ${Math.round(Math.hypot(B.car.x - B.home.x, B.car.y - B.home.y) / 10)} m from the driveway spot, from ${Math.round(Math.hypot(at.x - B.home.x, at.y - B.home.y) / 10)} m away`);
}
// B — real sockets
let WS = null; try { WS = createRequire(path.join(ROOT, 'server/package.json'))('ws'); } catch (e) { check(false, 'server deps installed (cd server && npm install)', String(e).slice(0, 100)); }
if (WS) {
  const { start } = await import('../server/server.js');
  const srv = await start({ port: 0, friends: new Map([['k-a', 'Friend A'], ['k-b', 'Friend B']]), log: () => {} });
  const url = (k) => `ws://localhost:${srv.port}/${k ? '?key=' + k : ''}`;
  const open = (k) => new Promise((res) => {
    const ws = new WS(url(k)), box = { ws, msgs: [], code: null };
    ws.on('message', b => box.msgs.push(JSON.parse(b))); ws.on('close', c => { box.code = c; res(box); }); ws.on('open', () => setTimeout(() => res(box), 300));
  });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await wait(20); } return null; };
  const none = await open(null), bad = await open('nope');
  check(none.code === 4003 && bad.code === 4003 && !none.msgs.length && !bad.msgs.length, '5 friends only: no key / a wrong key is refused, nothing about the world is sent', `codes ${none.code} ${bad.code}`);
  const A = await open('k-a'), Bc = await open('k-b');
  const hello = A.msgs.find(m => m.type === 'hello');
  check(hello && hello.crew.every(c => c.human === null), '6 a friend connects: the whole crew is listed, everyone CPU', hello ? `${hello.crew.length} crew` : '');
  const send = (b, m) => b.ws.send(JSON.stringify(m));
  send(A, { type: 'pick', id: 'brad' }); const youA = await until(() => A.msgs.find(m => m.type === 'you'));
  send(Bc, { type: 'pick', id: 'brad' }); const taken = await until(() => Bc.msgs.find(m => m.type === 'taken'));
  send(Bc, { type: 'pick', id: 'jason' }); const youB = await until(() => Bc.msgs.find(m => m.type === 'you'));
  check(youA && taken && youB, '6 pick: free -> yours; already picked -> TAKEN; pick another -> yours', `A=${youA && youA.id} B=${youB && youB.id}`);
  // A drives brad toward jason's car (they cross paths): A sends its car at 15 Hz
  const a = { ...youA.state }, jb = youB.state; let seenByB = false;
  for (let i = 0; i < 30; i++) {
    a.x += (jb.x - a.x) * 0.05; a.y += (jb.y - a.y) * 0.05; a.v = 150; send(A, { type: 'car', ...a }); send(Bc, { type: 'car', ...jb }); await wait(66);
  }
  await wait(200);
  const snapB = [...Bc.msgs].reverse().find(m => m.type === 'snap'), brad = snapB && snapB.cars.find(c => c[0] === 'brad');
  seenByB = brad && Math.hypot(brad[1] - a.x, brad[2] - a.y) < 2 && brad[7] === 'Friend A';
  check(seenByB, "6 two friends, two crew members: B's world shows A's car where A drove it, marked as a person", brad ? `brad @ ${brad[1]},${brad[2]} (sent ${Math.round(a.x)},${Math.round(a.y)})` : '');
  // 7 A drops mid-drive
  A.ws.terminate(); const t0 = Date.now(); Bc.msgs.length = 0;
  const back = await until(() => { const s = Bc.msgs.filter(m => m.type === 'snap').pop(); const c = s && s.cars.find(c => c[0] === 'brad'); return c && !c[7] ? c : null; }), tBack = Date.now() - t0;
  await wait(1500); const later = Bc.msgs.filter(m => m.type === 'snap').pop().cars.find(c => c[0] === 'brad');
  check(back && tBack < 500 && Math.hypot(later[1] - back[1], later[2] - back[2]) > 5, '7 a friend drops mid-drive: Brad is CPU again within a snapshot and keeps driving', back ? `CPU after ${tBack} ms, moved ${Math.round(Math.hypot(later[1] - back[1], later[2] - back[2]) / 10)} m in 1.5 s` : '');
  // 8 persistent
  const t1 = hello.t; Bc.ws.close(); await wait(1000);
  const C2 = await open('k-a'), h2 = C2.msgs.find(m => m.type === 'hello');
  check(h2 && h2.t > t1 + 2 && h2.crew.every(c => c.human === null), '8 persistent: the world kept running with nobody on, and every seat is CPU again', h2 ? `world time ${t1.toFixed(1)} s -> ${h2.t.toFixed(1)} s` : '');
  C2.ws.close(); await srv.close();
}
console.log(fails ? `SPEC L6 FAIL (${fails})` : 'SPEC L6 OK'); process.exit(fails ? 1 : 0);
