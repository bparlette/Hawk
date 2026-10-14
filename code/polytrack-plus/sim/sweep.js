import * as THREE from '../game/three.module.min.js';
import { buildTrack, MAIN_PIECES } from '../game/track.js';
import { RaycastCar } from '../game/carphys.js';
import { Race, Autopilot } from '../game/race.js';
const tr = buildTrack(MAIN_PIECES());
export function run(opt, carOpt = {}, maxT = 90) {
  const car = new RaycastCar(THREE, carOpt), race = new Race(THREE, tr), ap = new Autopilot(THREE, tr, opt);
  const s = race.spawn(); car.reset(s.p, s.q); const ev = []; let t = 0, falls = 0, stuck = 0;
  for (let k = 0; k < 60 * maxT; k++) {
    car.step(1 / 60, ap.drive(car), tr.grid); t += 1 / 60; race.update(car.pos, car.speed, t, ev);
    if (race.done) return { t, falls };
    if (car.speed < 1 && t > 3) stuck += 1 / 60; else stuck = 0;
    if (car.pos.y < tr.seaY + 1 || stuck > 2.5) { falls++; stuck = 0; const r = race.respawnPose(); car.reset(r.p, r.q, r.f.clone().multiplyScalar(race.lastCpVel)); ap.i = 0; }
  }
  return { t: null, falls };
}
const grid = JSON.parse(process.argv[2]);
for (const o of grid) { const r = run(o); console.log(JSON.stringify(o), r.t ? r.t.toFixed(3) : 'DNF', 'falls', r.falls); }
