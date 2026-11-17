// common.mjs — shared harness for the gameplay probes: builds the REAL world + sim of any build folder,
// exactly the way that build's main.js does (layout + shell + the shell's sprite buildings, lamps, parked cars).
//   BUILD=<folder under games/> node tools/probes/<probe>.mjs     (default BUILD = this folder)
// A build without its own shell.json uses ../palm-city's (as pc-audit does).
import fs from 'node:fs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const GAMES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const BUILD = process.env.BUILD || path.basename(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const A = path.join(GAMES, BUILD) + '/';
const SH = fs.existsSync(A + 'shell.json') ? A : path.join(GAMES, 'palm-city') + '/';
export const { World } = await import(A + 'src/world.js');
export const { Sim } = await import(A + 'src/sim.js');
export const act = await import(A + 'src/activities.js');
export const SRC = A + 'src/';
export const layout = JSON.parse(fs.readFileSync(A + 'layout.json'));
export const M = JSON.parse(fs.readFileSync(A + 'assets/manifest.json'));
const sj = JSON.parse(fs.readFileSync(SH + 'shell.json')), sl = JSON.parse(fs.readFileSync(SH + 'shell_layout.json'));
export const shell = { ...sj, buildings: sl.buildings || [], palms: sl.palms || [], extraRoads: sl.roads || [], parked: sl.parked || [] };
for (const b of shell.buildings) if (b.tpl) { layout.buildings.push({ id: b.id, style: b.style, x: b.x, y: b.y, w: b.w, d: b.d, h: b.h }); M.buildings[b.id] = M.buildings[b.tpl]; }
shell.buildings = shell.buildings.filter(b => !b.tpl);
if (sl.lamps) layout.lamps.push(...sl.lamps);
export const world = new World(layout, shell);
export const STEP = 1 / 60;
export const idle = (x = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...x });
export const stick = (a, m = 1, x = {}) => idle({ jx: Math.cos(a), jy: Math.sin(a), jm: m, ...x });
export const run = (s, n, inp) => { for (let i = 0; i < n; i++) s.step(STEP, typeof inp === 'function' ? inp(i) : inp); };
export const fresh = (seed = 7) => { const ev = []; const s = new Sim(world, M, seed, (n) => ev.push(n)); return { s, ev }; };
export const out = [];
export const check = (name, ok, extra = '') => { const l = `${ok ? 'OK  ' : 'BUG '} ${name} ${extra}`; console.log(l); out.push(l); };
