// chase_check.mjs — 7H BOARD CHASE, on the real sim.
//   start   : on the board at the pier marker, A starts it; three stars; the first checkpoint is lit
//   order   : checkpoints register only in order (PLAZA, NOVA, VILLAS, SAFEHOUSE); each fills a quarter of the meter
//   bust    : a board held still at arrest range is busted inside ~3 s
//   no bust : a board moving alongside a cop for 10 s is NOT busted and is not pulled off the board
//   win     : the win fires at the safehouse with the meter full; shaking the cops entirely also wins
//   score   : checkpoints + win + time bonus, banked to the score; result card data
// Usage: node tools/chase_check.mjs   (exit 0 = all pass)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js'; import { Sim } from '../src/sim.js';
import { CHASE, chaseArmed } from '../src/chase.js'; import { buttonA } from '../src/controls.js';
import { markers } from '../src/activities.js'; import { mapPOIs } from '../src/map.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json'))), M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const DT = 1 / 60, inp = (o = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...o });
function fresh(start = true) {
  const ev = [], s = new Sim(world, M, 7, (n) => ev.push(n));
  s.spawnTraffic = () => null; s.spawnPed = () => null; s.cars = s.cars.filter(c => c.parked); s.peds = [s.player.ped];
  s.step(DT, inp({ jump: 'chase' }));
  if (start) s.step(DT, inp({ punch: true }));
  return { s, ev };
}
const put = (s, x, y) => { const b = s.board; b.x = x; b.y = y; b.vx = b.vy = 0; s.player.ped.x = x; s.player.ped.y = y; };
const noCops = (s) => { s.cars = s.cars.filter(c => c.driver !== 'police'); s.peds = s.peds.filter(p => p.mode !== 'cop'); };

{ const { s } = fresh(false);
  check(s.player.mode === 'board' && chaseArmed(s) && buttonA(s).label === 'START BOARD CHASE', 'at the pier marker on the board, A reads START BOARD CHASE');
  check(markers(s).some(m => m.a.id === 'chase') && mapPOIs(world, s).some(p => p.activity === 'chase' && p.name === 'BOARD CHASE'), 'the start has a street marker at the pier and a map POI');
  const air0 = s.board.air;
  s.step(DT, inp({ punch: true }));
  check(s.event && s.event.kind === 'chase' && s.stars === 3 && !(s.board.air > air0), 'pressing A starts the event (not an ollie): three stars, cops on the way', `stars ${s.stars}`);
  check(s.event.next === 'PLAZA' && s.event.meter === 0, 'the first checkpoint is PLAZA and the escape meter starts empty');
  put(s, 400, 400); s.step(DT, inp());
  check(!chaseArmed(s), 'away from the marker nothing is armed');
}
{ const { s } = fresh(), R = CHASE.route, score0 = s.score || 0;
  put(s, R[1][1], R[1][2]); noCops(s); s.step(DT, inp());
  check(s.event.idx === 0, 'riding to NOVA first does not count: the chain is in order', `idx ${s.event.idx}`);
  const seen = [];
  for (let i = 0; i < R.length - 1; i++) { put(s, R[i][1], R[i][2]); noCops(s); s.step(DT, inp()); seen.push(`${R[i][0]}→${s.event.next} ${Math.round(s.event.meter * 100)}%`); }
  check(s.event.idx === 3 && s.event.next === 'SAFEHOUSE' && s.event.meter === 0.75, 'PLAZA, NOVA, VILLAS register in order, a quarter of the meter each, the marker re-points', seen.join(' · '));
  check(s.event.spot[0] === R[3][1] && s.event.spot[1] === R[3][2], 'the lit marker is now the safehouse');
  s.event.t = 60; put(s, R[3][1], R[3][2]); noCops(s); s.step(DT, inp());
  const r = s.eventResult, want = 3 * CHASE.perCheckpoint + CHASE.win + (CHASE.par - 60) * CHASE.perSecond;
  check(!s.event && r && r.ok && r.kind === 'chase' && r.cp === 4 && /ESCAPED/.test(r.text), 'the win fires at the safehouse with the meter full', r && r.text);
  check(r.pts === want && s.score - score0 === want && s.stars === 0, 'score = checkpoints + win + time bonus, banked; the heat is off', `${r.pts} pts (3×${CHASE.perCheckpoint} + ${CHASE.win} + ${(CHASE.par - 60)}s×${CHASE.perSecond})`);
  check(s.eventStats.chase === 1, 'the run is counted in the event stats');
}
{ const { s } = fresh();
  noCops(s); s.stars = 0; for (let i = 0; i < 80; i++) s.step(DT, inp());
  check(!s.event && s.eventResult && s.eventResult.ok && /SHOOK/.test(s.eventResult.text), 'shaking the cops entirely before the safehouse is a win too', s.eventResult && s.eventResult.text);
}
{ // pinned: the board is held still with an officer on it
  const { s } = fresh(); noCops(s); s.addStars = () => {};
  put(s, 1000, 800);
  const cop = s.makePed(1008, 800, 'cop', null, 0); cop.mode = 'cop'; s.peds.push(cop);
  let t = null;
  for (let i = 0; i < 360 && t === null; i++) { cop.x = s.player.ped.x + 8; cop.y = s.player.ped.y; s.step(DT, inp()); if (s.busted) t = (i + 1) * DT; }
  check(t !== null && t <= 3, 'a pinned board (held still at arrest range) is busted inside ~3 s', t === null ? 'never' : `${t.toFixed(2)} s`);
  for (let i = 0; i < 5; i++) s.step(DT, inp());
  check(!s.event && s.eventResult && !s.eventResult.ok && /BUSTED/.test(s.eventResult.text), '…and the bust ends the chase', s.eventResult && s.eventResult.text);
}
{ // moving: 10 s alongside a cop, lapping the plaza block on the board
  const { s } = fresh(); s.addStars = () => {}; s.event.timer = 999;
  put(s, 780, 900); s.board.h = Math.PI / 2;
  const cop = s.makePed(790, 900, 'cop', null, 0); cop.mode = 'cop'; s.peds.push(cop);
  let max = 0, minSp = 1e9, bailed = false;
  for (let i = 0; i < 600; i++) {
    noCops(s); s.peds.push(cop);
    const b = s.board;
    if (b.y > 1300) put(s, 780, 900);                                    // back to the top of the street; the cop stays glued
    b.vx = 0; b.vy = 170; b.h = Math.PI / 2;
    cop.x = b.x + 10; cop.y = b.y; cop.mode = 'cop';
    s.step(DT, inp({ jx: 0, jy: 1, jm: 1 }));
    max = Math.max(max, s.bustT); minSp = Math.min(minSp, Math.hypot(b.vx, b.vy)); bailed ||= s.player.mode !== 'board';
    if (s.busted) break;
  }
  check(!s.busted && max === 0, 'a moving board alongside a cop for 10 s is NOT busted; the meter never fills', `max bust meter ${max.toFixed(2)} s`);
  check(!bailed && !!s.event, '…and the rider is never pulled off the board while moving', `slowest ${minSp.toFixed(0)} u/s`);
}
console.log(fails ? `CHASE FAIL (${fails})` : 'CHASE OK'); process.exit(fails ? 1 : 0);
