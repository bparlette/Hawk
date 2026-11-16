// import_jobs.mjs — copy Gemini's Jobs Board sprites (shots/jobs-sprites/, metrics from its
// SPRITES.md) into assets/jobs/ and write assets/jobs.json for the game.
// Usage: node tools/import_jobs.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'shots', 'jobs-sprites'), OUT = path.join(ROOT, 'assets', 'jobs');
fs.mkdirSync(OUT, { recursive: true });
const e = (f, w, h, ox, oy, extra = {}) => { fs.copyFileSync(path.join(SRC, f + '.webp'), path.join(OUT, f + '.webp')); return { file: 'jobs/' + f + '.webp', w, h, ox, oy, ...extra }; };
const ped = (f) => ({ angles: 16, poses: 3, cols: 12, color: e(f, 39, 39, -19.5, -19.5), shadow: { file: 'jobs/ped_fare_sh.webp', w: 110, h: 110, ox: -20.23, oy: -64.32 } });
e('ped_fare_sh', 110, 110, -20.23, -64.32);
const M = {
  cars: {
    bus: { angles: 32, cols: 8, kind: 'bus', length: 68, width: 21.5, color: e('car_bus', 80, 80, -40, -40), shadow: e('car_bus_sh', 108, 108, -41.2, -57.8), light: e('car_bus_light', 75, 240, -37.5, -175) },
    tow_truck: { angles: 32, cols: 8, kind: 'tow', length: 49, width: 20, color: e('car_tow_truck', 64, 64, -32, -32), shadow: e('car_tow_truck_sh', 96, 96, -36.41, -51.11), light: e('car_tow_truck_light', 70, 220, -35, -160) },
  },
  peds: { fare_vip: ped('ped_fare_vip'), fare_chaos: ped('ped_fare_chaos'), fare_tourist: ped('ped_fare_tourist'), fare_fed: ped('ped_fare_fed') },
  cable: e('prop_tow_cable', 32, 8, 0, -4), hook: e('prop_tow_hook', 16, 16, -8, -8),
  sign: { free: e('prop_taxi_sign_free', 16, 16, -8, -8), fare: e('prop_taxi_sign_fare', 16, 16, -8, -8), low: e('prop_taxi_sign_lowmood', 16, 16, -8, -8), fed: e('prop_taxi_sign_fed', 16, 16, -8, -8) },
};
fs.writeFileSync(path.join(ROOT, 'assets', 'jobs.json'), JSON.stringify(M, null, 1));
console.log('imported', fs.readdirSync(OUT).length, 'sprites -> assets/jobs.json');
