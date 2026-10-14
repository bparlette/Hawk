import * as THREE from '../game/three.module.min.js';
import { buildTrack, MAIN_PIECES } from '../game/track.js';
import { RaycastCar } from '../game/carphys.js';
import { Race, Autopilot } from '../game/race.js';
const opt = JSON.parse(process.argv[2] || '{}'), carOpt = JSON.parse(process.argv[3] || '{}');
const tr = buildTrack(MAIN_PIECES());
console.log('tris', tr.grid.n, 'gates', tr.gates.length, 'line', tr.line.length);
const car = new RaycastCar(THREE, carOpt), race = new Race(THREE, tr), ap = new Autopilot(THREE, tr, opt);
const s = race.spawn(); car.reset(s.p, s.q);
const ev = []; let stuck = 0, t = 0, falls = 0, last = -1, maxV = 0;
for (let k = 0; k < 60 * 150; k++) {
  const inp = ap.drive(car); car.step(1 / 60, inp, tr.grid); t += 1 / 60; maxV = Math.max(maxV, car.speed);
  race.update(car.pos, car.speed, t, ev);
  for (const e of ev) console.log(t.toFixed(2), e.type, e.n || '', e.of || '');
  if (car.pos.y < tr.seaY + 1 || !isFinite(car.pos.y)) { falls++; console.log(t.toFixed(2), 'FALL at line', ap.i, tr.line[ap.i].type, car.pos.toArray().map(v=>v.toFixed(1))); const r = race.respawnPose(); car.reset(r.p, r.q, r.f.clone().multiplyScalar(race.lastCpVel)); ap.i = 0; if (falls > 4) break; }
  if (race.done) break;
  if (car.speed < 1 && t > 3) stuck += 1/60; else stuck = 0;
  if (stuck > 2.5) { stuck = 0; falls++; console.log(t.toFixed(2),'STUCK at', ap.i, tr.line[ap.i].type); const r = race.respawnPose(); car.reset(r.p, r.q, r.f.clone().multiplyScalar(race.lastCpVel)); ap.i = 0; if (falls > 4) break; }
  if (opt.log && Math.floor(t * (opt.hz||2)) !== last && t >= (opt.t0||0) && t <= (opt.t1||999)) { last = Math.floor(t * (opt.hz||2)); console.log(t.toFixed(1), 'i', ap.i, tr.line[ap.i].type, 'v', car.speed.toFixed(1), 'g', car.grounded, 'p', car.pos.toArray().map(v=>v.toFixed(1)).join(','), 'slip', car.slip.toFixed(1), 'th', inp.throttle.toFixed(1), 'br', inp.brake.toFixed(1), 'st', inp.steer.toFixed(2), 'xt', ap.dbg); }
}
console.log('RESULT', race.done ? 'FINISH ' + t.toFixed(3) : 'DNF', 'falls', falls, 'maxV', maxV.toFixed(1));
