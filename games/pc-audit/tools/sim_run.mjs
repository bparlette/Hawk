// sim_run.mjs — run the real sim + ?demo autopilot headless in Node and print the route.
// Usage: node tools/sim_run.mjs [seconds]
// Checks the demo does what it promises: jack a car, drive, get chased, get busted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';
import { DemoPilot } from '../src/demo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
const events = [];
let t = 0;
const sim = new Sim(world, M, 7, (n) => events.push(`${t.toFixed(1)}s ${n}`));
const pilot = new DemoPilot(sim, world);
const secs = Number(process.argv[2] || 34);
const STEP = 1 / 60;
let lastPrint = -1;
for (let i = 0; i < secs * 60 && !pilot.done; i++) {
  sim.step(STEP, pilot.input(STEP));
  t += STEP;
  if (Math.floor(t) !== lastPrint) {
    lastPrint = Math.floor(t);
    const f = sim.focus();
    const pol = sim.cars.filter(c => c.driver === "police").map(c => `${Math.round(Math.hypot(c.x - f.x, c.y - f.y))}@${Math.round(c.v)}`).join(","); const nb = sim.cars.filter(c => c !== f).map(c => [Math.hypot(c.x - f.x, c.y - f.y), c]).sort((a, b) => a[0] - b[0])[0]; const near = nb ? `near ${Math.round(nb[0])} ${nb[1].driver} v${Math.round(nb[1].v)}` : "";
    console.log(`${String(lastPrint).padStart(2)}s ${sim.player.mode.padEnd(4)} pos ${Math.round(f.x)},${Math.round(f.y)} v ${Math.round(f.v || 0)} stars ${sim.stars} police[${pol}] ${near} ${sim.busted ? 'BUSTED' : ''} ${pilot.phase}`);
  }
}
console.log('events:', events.join(' | '));
const ok = events.some(e => e.endsWith('jack')) && events.some(e => e.endsWith('busted'));
console.log(ok ? 'DEMO OK: jacked and busted' : 'DEMO FAIL');
process.exit(ok ? 0 : 1);
