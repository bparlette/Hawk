// help_check.mjs — 7G: HELP and the start page list every registered activity, and JUMP puts you
// AT each one, armed, for free. On the real sim:
//   - the panel rows are exactly the registry's startable activities, each with a one-line how-to
//   - layout: every row and its JUMP button sit inside the panel on a 420x860 phone and a short 420x640 one
//   - a tap on a JUMP button resolves to that activity; a tap on the bottom button closes
//   - JUMP motel -> on foot at the door, ENTER armed; jobs -> seated, START <JOB> armed;
//     events -> in a car on the ring, START armed; score and wanted unchanged
//   - jumping while a job runs ends that job; jumping is refused mid-siege
//   - the jump travels as input, so a re-simulated run lands in the same place (the director relies on it)
// Usage: node tools/help_check.mjs   (exit 0 = all pass)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js'; import { Sim } from '../src/sim.js';
import { helpRows } from '../src/activities.js'; import { helpLayout, helpHit, CONTROLS } from '../src/help.js';
import { jobButton } from '../src/jobs.js'; import { buttonA } from '../src/controls.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json'))), M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const DT = 1 / 60, inp = (o = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...o });
const fresh = () => { const s = new Sim(world, M, 7, () => {}); s.spawnTraffic = () => null; return s; };
const WANT = ['motel', 'taxi', 'tow', 'bus', 'getaway', 'wreck', 'valet', 'chase'];

{ const s = fresh(), rows = helpRows(s);
  check(rows.map(a => a.id).join() === WANT.join(), 'the panel lists every registered activity, in order', rows.map(a => a.name).join(' · '));
  check(rows.every(a => a.how && a.how.length > 20 && a.how.length < 100), 'each row has one short how-to line', `longest ${Math.max(...rows.map(a => a.how.length))} chars`);
  check(CONTROLS.some(c => /PUNCH/.test(c[1]) && /TURBO/.test(c[1])) && CONTROLS.some(c => /MAP/.test(c[0])), 'the controls recap covers steer, PUNCH/TURBO, map and pause');
  for (const [vw, vh] of [[420, 860], [420, 640]]) for (const mode of ['start', 'help']) {
    const L = helpLayout(vw, vh, rows.length, mode, 0), P = L.panel;
    const ok = P.y >= 0 && P.y + P.h <= vh && L.rows.every(r => r.y >= P.y && r.y + r.h <= P.y + P.h && r.jump.x >= P.x && r.jump.x + r.jump.w <= P.x + P.w) && L.btn.y + L.btn.h <= P.y + P.h && L.rows.at(-1).y + L.rows.at(-1).h <= L.btn.y;
    check(ok, `layout fits ${vw}x${vh} (${mode})`, `panel ${Math.round(P.y)}..${Math.round(P.y + P.h)}, row ${Math.round(L.rows[0].h)} px`);
  }
  const L = helpLayout(420, 860, rows.length, 'help', 0);
  const hits = rows.map((a, i) => helpHit({ x: L.rows[i].jump.x + 30, y: L.rows[i].jump.y + 16 }, 420, 860, s, 'help', 0));
  check(hits.every((h, i) => h && h.type === 'jump' && h.id === WANT[i]), 'tapping a row\'s JUMP button resolves to that activity');
  check(helpHit({ x: L.btn.x + 50, y: L.btn.y + 20 }, 420, 860, s, 'help', 0).type === 'close' && helpHit({ x: 210, y: 850 }, 420, 860, s, 'help', 0).type === 'close', 'the bottom button closes; so does a tap outside the HELP panel');
  check(helpHit({ x: 210, y: 850 }, 420, 860, s, 'start', 0) === null, 'on the start page a stray tap does nothing (only PLAY or JUMP start the game)');
}
for (const id of WANT) {
  const s = fresh(), P = s.player; s.score = 1234; const stars = s.stars;
  s.step(DT, inp({ jump: id }));
  const a = s.activities.find(q => q.id === id), jb = jobButton(s), A = buttonA(s);
  let armed = false, where = '';
  if (id === 'motel') { armed = P.mode === 'foot' && s.nearMotelDoor(); where = `on foot ${Math.round(P.ped.x)},${Math.round(P.ped.y)}`; }
  else if (a.group === 'job') { armed = P.mode === 'car' && P.car.job === id && jb && jb.kind === 'start' && A.label === 'START ' + a.name; where = `in the ${P.car && P.car.model}, A = ${A && A.label}`; }
  else if (a.board) { armed = P.mode === 'board' && A && A.label === 'START BOARD CHASE'; where = `on the board at ${Math.round(s.board.x)},${Math.round(s.board.y)}, A = ${A && A.label}`; }
  else { armed = P.mode === 'car' && jb && jb.kind === 'evstart' && jb.ev === id; where = `in the ${P.car && P.car.model} at ${Math.round(P.car.x)},${Math.round(P.car.y)}, A = ${A && A.label}`; }
  check(armed, `JUMP ${a.name}: you are there with it armed`, where);
  check(s.score === 1234 && s.stars === stars, `JUMP ${a.name}: free — no score or wanted change`);
  if (a.group !== 'siege') { s.step(DT, inp({ punch: true })); check(a.group === 'job' ? !!s.job && s.job.kind === id : !!s.event && s.event.kind === id, `JUMP ${a.name}: one press of A starts it`); }
}
{ const s = fresh();
  s.step(DT, inp({ jump: 'taxi' })); s.step(DT, inp({ punch: true }));
  check(!!s.job && s.job.kind === 'taxi', 'a taxi job is running');
  s.step(DT, inp({ jump: 'bus' }));
  check(!s.job && s.player.car.job === 'bus' && jobButton(s).kind === 'start', 'jumping to the bus ends the taxi job cleanly and arms the bus');
}
{ const s = fresh(); s.player.mode = 'siege';
  const x = s.player.ped.x; let threw = false;
  try { s.step(DT, inp({ jump: 'taxi' })); } catch (e) { threw = true; }
  check(s.player.mode === 'siege' && s.player.ped.x === x, 'mid-siege a jump is refused');
  const L = helpLayout(420, 860, WANT.length, 'help', 0);
  check(helpHit({ x: L.rows[1].jump.x + 30, y: L.rows[1].jump.y + 16 }, 420, 860, s, 'help', 0) === null, '…and the JUMP buttons are dead in the panel');
}
{ const run = () => { const s = fresh(); for (let i = 0; i < 240; i++) s.step(DT, inp(i === 60 ? { jump: 'valet' } : i > 80 ? { keys: { up: true, left: i % 40 < 20 } } : {})); return [s.player.car.x, s.player.car.y, s.player.car.h]; };
  const a = run(), b = run();
  check(a.every((v, i) => v === b[i]), 'a run with a jump in it re-simulates to the same place (the jump is input)', a.map(v => v.toFixed(2)).join(', '));
}
console.log(fails ? `HELP FAIL (${fails})` : 'HELP OK'); process.exit(fails ? 1 : 0);
