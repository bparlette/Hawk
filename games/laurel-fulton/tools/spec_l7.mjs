// spec_l7.mjs — task L7, BRAD'S HOUSE: SPLIT-FOYER CUTAWAY INTERIOR.  node tools/spec_l7.mjs   (from games/laurel-fulton/)
// Stick + ACTION only (Palm City's input object shape) through Interior.step — the call main.js makes each frame. Proves:
//  1 the kit is a TRUE split foyer: the door opens onto a mid landing; a half-flight UP to the main level, a half-flight
//    DOWN to a half-sunk lower level (each ~half a storey); upstairs living room with Teter's recliner + a cooler;
//    downstairs living room with weights, a fireplace and 6 beers on the mantle; 2 golden retrievers
//  2 up the half-flight -> Teter greets you; she never leaves her chair
//  3 drink a beer upstairs (grab from the cooler, DRINK: a 2.4 s moment, count +1)
//  4 down to the lower level -> take a beer FROM THE MANTLE (6 -> 5 visible cans) -> drink it there
//  5 the dogs roam BOTH levels and trail you; PAT works
//  6 out the front door -> 'exit'; the factory can state the same interior (interior_build.py reproduces brad.json)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const K = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/interiors/brad.json')));
let IN = null; try { IN = await import('../src/lf_interior.js'); } catch (e) { check(false, 'src/lf_interior.js loads', String(e).slice(0, 160)); }
const F = Object.fromEntries(K.floors.map(f => [f.id, f])), P = (k) => K.props.filter(p => p.kind === k);
const up = F.main.z - F.landing.z, dn = F.landing.z - F.lower.z;
check(K.door.floor === 'landing' && up > 1 && up < 1.6 && dn > 1 && dn < 1.6 && F.lower.z < K.grade && K.links.length === 2, '1 a TRUE split foyer: door -> mid landing, half-flight UP, half-flight DOWN to a half-sunk lower level', `up ${up.toFixed(2)} m, down ${dn.toFixed(2)} m, lower floor ${F.lower.z} m below grade`);
check(P('recliner')[0]?.floor === 'main' && K.teter?.name === 'Teter' && P('cooler')[0]?.floor === 'main', '1 upstairs living room: Teter\'s recliner + a cooler of beer');
check(P('computer')[0]?.floor === 'lower' && P('computer')[0].screen === 'eDonkey', '1 Brad\'s basement COMPUTER is in the kit, its screen says eDonkey (the cutaway draws it: l7b shots)');
check(P('weights')[0]?.floor === 'lower' && P('fireplace')[0]?.floor === 'lower' && P('fireplace')[0].mantle === 6 && K.dogs === 2, '1 downstairs: weights, a fireplace with 6 beers on the mantle; two golden retrievers');
if (IN) {
  const I = new IN.Interior(K, { who: { id: 'brad', name: 'Brad' } }), DT = 1 / 60, h = I.hero;
  const stick = (jx, jy = 0) => ({ jx, jy, jm: Math.hypot(jx, jy) ? 1 : 0, keys: {} });
  const run = (inp, secs, until) => { for (let t = 0; t < secs; t += DT) { const r = I.step(DT, typeof inp === 'function' ? inp() : inp); if (r) return r; if (until && until()) return true; } return false; };
  const act = () => I.step(DT, { jx: 0, jy: 0, jm: 0, keys: {}, action: true });
  const goTo = (x) => run(() => stick(Math.sign(x - h.x)), 8, () => Math.abs(h.x - x) < 0.3 && !h.link);
  const teter0 = { ...I.teter };
  run(stick(1, -0.3), 6, () => h.floor === 'main');
  check(h.floor === 'main' && Math.abs(h.z - F.main.z) < 1e-6 && I.events.some(e => e.kind === 'teter_greet'), '2 up the half-flight to the main level -> Teter greets you', `"${I.teter.said}"`);
  goTo(P('cooler')[0].x); const pr1 = I.prompt(); act();
  const c1 = I.prompt(); act(); const drinking = h.drinkT > 2; run(stick(0), 3);
  check(pr1 === 'GRAB BEER' && c1 === 'DRINK' && drinking && h.drank === 1 && I.events.some(e => e.kind === 'drink' && e.room === 'upstairs living room'), '3 a beer in the UPSTAIRS living room: grab from the cooler, DRINK (a 2.4 s moment)', `drank ${h.drank}`);
  run(stick(-1), 8, () => h.floor === 'landing'); run(stick(1, 0.8), 6, () => h.floor === 'lower');
  check(h.floor === 'lower', '4 back down to the landing, then the half-flight DOWN (stick down-right)');
  goTo(P('fireplace')[0].x); const pr2 = I.prompt(); act(); const m = I.mantle; act(); run(stick(0), 3);
  check(pr2 === 'GRAB BEER' && m === 5 && h.drank === 2 && I.events.some(e => e.kind === 'drink' && e.room === 'downstairs living room'), '4 take a beer FROM THE MANTLE (6 -> 5) and drink it by the fire', `mantle ${I.mantle}, drank ${h.drank}`);
  // dogs: 3 minutes of you moving about both levels
  let same = 0, n = 0;
  for (let k = 0; k < 6; k++) {
    goTo(k % 2 ? 4.2 : 11.2); run(stick(0), 6, () => { const dd = I.dogs.filter(d => d.floor === h.floor); n++; if (dd.some(d => Math.abs(d.x - h.x) < 3)) same++; return false; });
    if (k === 2) { run(stick(-1), 8, () => h.floor === 'landing'); run(stick(1, -0.3), 6, () => h.floor === 'main'); }
  }
  check(I.dogs.every(d => d.rooms.has('main') && d.rooms.has('lower')), '5 both retrievers roam BOTH levels (taking the stairs)', I.dogs.map(d => [...d.rooms].join('+')).join(' / '));
  check(same / n > 0.5, '5 ... and trail you: a dog within 3 m of you most of the time you stand still', `${(100 * same / n).toFixed(0)}% of idle time`);
  const dog = I.dogs.find(d => d.floor === h.floor && !d.link); if (dog) { h.x = dog.x; }
  const pp = I.prompt(); act();
  check(pp === 'PAT' && I.events.some(e => e.kind === 'pat'), '5 PAT a dog');
  check(I.teter.x === teter0.x && I.teter.floor === teter0.floor, '2 Teter never left her chair');
  run(stick(-1), 10, () => h.floor === 'landing'); goTo(K.door.x); const pe = I.prompt(); const out = act();
  check(pe === 'EXIT' && out === 'exit', '6 out the front door');
}
const tmp = fs.mkdtempSync('/tmp/l7-'); fs.mkdirSync(path.join(tmp, 'data'));
execFileSync('python3', [path.join(ROOT, 'tools/interior_build.py'), 'brad', 'split-foyer', 'up', 'couch,cooler,tv,fridge,rug,picture,lamp,plant', 'down', 'weights,fireplace,couch,rug,picture,lamp,computer', 'mantle-beers', '6', 'dogs', '2', 'mom', 'Teter'], { env: { ...process.env, LF_ROOT: tmp } });
check(fs.readFileSync(path.join(tmp, 'data/interiors/brad.json'), 'utf8') === fs.readFileSync(path.join(ROOT, 'data/interiors/brad.json'), 'utf8'), '6 the factory statement (interior brad split-foyer ...) reproduces this interior byte-for-byte');
console.log(fails ? `SPEC L7 FAIL (${fails})` : 'SPEC L7 OK'); process.exit(fails ? 1 : 0);
