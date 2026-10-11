// node tools/previews.mjs A|B|all  — writes previews/<id>_day.png, <id>_night.png (1280x720) and <group>_phone_390x844.png
import { open, load, root } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
const which = process.argv[2] || 'all';
const only = process.argv[3]; // optional id filter
// per-asset cameras: a viewer query fragment (yaw/pitch/zoom or an explicit pos/look/fov)
const A = {
  rowhouse: 'yaw=28&pitch=12', rowhouse_4: 'yaw=-28&pitch=12', rowhouse_brick: 'yaw=30&pitch=10', rowhouse_permastone: 'yaw=-30&pitch=10',
  houses: 'pos=-6,5.2,30&look=0,6.2,0&fov=48', corner_bar: 'yaw=48&pitch=11', corner_shop: 'yaw=46&pitch=11',
  block: 'yaw=32&pitch=34', street: 'pos=-30,8.5,-5&look=0,4,-4&fov=50',
};
const B = {
  lamp_acorn: 'yaw=28&pitch=8', lamp_cobra: 'yaw=-35&pitch=8', bench_park: 'yaw=30&pitch=14', bench_bus: 'yaw=-32&pitch=14', trash_can: 'yaw=25&pitch=16',
  trash_can_recycling: ['trash_can', 'yaw=25&pitch=16&recycling=1'], crab_shack: 'yaw=-28&pitch=14', manhole: 'yaw=30&pitch=58&zoom=0.55', ladder_wall: 'yaw=30&pitch=10', ladder_drop: 'yaw=30&pitch=10',
  parked_car_sedan: 'yaw=-35&pitch=14&seed=1', parked_car_hatchback: 'yaw=38&pitch=14&seed=2', parked_car_pickup: 'yaw=-38&pitch=14&seed=3',
  water_taxi: 'yaw=-42&pitch=18', paddle_boat: 'yaw=40&pitch=22', dragon_boat: 'yaw=-52&pitch=26', car_sedan: 'yaw=-38&pitch=14&seed=4', car_hatch: 'yaw=38&pitch=14&seed=6',
  box_truck: 'yaw=-40&pitch=14&seed=2', arabber_cart: 'yaw=-45&pitch=18', skateboard: 'yaw=-35&pitch=16&zoom=0.45',
  props: 'pos=0,4.4,27&look=0,1.8,0&fov=50', vehicles: 'yaw=-62&pitch=30', vehicles_water: ['vehicles', 'group=water&yaw=-58&pitch=34&zoom=0.62'], vehicles_land: ['vehicles', 'group=land&yaw=-60&pitch=26&zoom=0.62'],
};
// phone (iPhone portrait 390x844 @2x): gameplay distance
const PHONE_A = [['rowkit_phone_390x844', 'show=street&pos=-7,4.4,-9.4&look=-1.5,4.8,0&fov=64'], ['rowkit_phone_night_390x844', 'show=street&night=1&pos=-7,4.4,-9.4&look=-1.5,4.8,0&fov=64'],
  ['rowkit_phone_corner_390x844', 'show=street&night=1&pos=-6,4.2,-9&look=3,3.2,-3&fov=60']];
const PHONE_B = [['props_phone_390x844', 'show=props&pos=-4,2.8,7&look=-3,1.6,0&fov=62'], ['vehicles_phone_390x844', 'show=vehicles&yaw=-70&pitch=22&fov=50'],
  ['props_phone_night_390x844', 'show=props&night=1&pos=-4,2.8,7&look=-3,1.6,0&fov=62']];
const jobs = [];
const add = (set, task) => { for (const [id, v] of Object.entries(set)) { if (only && id !== only) continue; const [show, cam] = Array.isArray(v) ? v : [id, v]; for (const n of [0, 1]) jobs.push({ q: `show=${show}&${cam}${n ? '&night=1' : ''}&t=${task === 'B' ? 1.3 : 0}`, out: `previews/${id}_${n ? 'night' : 'day'}.png`, w: 1280, h: 720, dpr: 1 }); } };
if (which === 'A' || which === 'all') { add(A, 'A'); if (!only) for (const [n, q] of PHONE_A) jobs.push({ q, out: `previews/${n}.png`, w: 390, h: 844, dpr: 2 }); }
if (which === 'B' || which === 'all') { add(B, 'B'); if (!only) for (const [n, q] of PHONE_B) jobs.push({ q: q + '&t=1.3', out: `previews/${n}.png`, w: 390, h: 844, dpr: 2 }); }
fs.writeFileSync('/tmp/previews_jobs.json', JSON.stringify(jobs));
console.log(jobs.length, 'jobs');
