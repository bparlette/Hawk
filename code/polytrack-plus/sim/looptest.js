import * as THREE from '../game/three.module.min.js';
import { buildTrack, chain } from '../game/track.js';
import { RaycastCar } from '../game/carphys.js';
import { Race } from '../game/race.js';
const steerK = +(process.argv[2] || 0);
const tr = buildTrack(chain(['start','straight','straight','straight','straight','loop','straight','straight','finish']).pieces);
const car = new RaycastCar(THREE, {}), race = new Race(THREE, tr); const s = race.spawn(); car.reset(s.p, s.q);
for (let k = 0; k < 60 * 6; k++) {
  car.step(1/60, { throttle: 1, brake: 0, steer: 0 }, tr.grid);
  if (k % 6 === 0 && car.pos.z > 40) console.log((k/60).toFixed(2), 'p', car.pos.toArray().map(v=>v.toFixed(1)).join(','), 'v', car.speed.toFixed(1), 'g', car.grounded, 'slip', car.slip.toFixed(1), 'comp', car.wheels.map(w=>w.comp.toFixed(2)).join('/'), 'imp', car.impact.toFixed(1));
}
