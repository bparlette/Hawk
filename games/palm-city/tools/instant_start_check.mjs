// instant_start_check.mjs — the INSTANT-START rule (owner, Nov 16): a yellow circle is a
// promise — whatever the game needs is sitting in the circle, one press starts instantly.
//   jobs   : all four job vehicles live at homes on the Garage kerb; a wrecked/stranded one
//            is restocked (repaired) after the player waits 10 s at the kerb — never while
//            the player is away, and never by spawning a duplicate
//   rings  : WRECK IT! / VALET / SPOTLIGHT each keep their own car inside the button radius,
//            restocked by the same guardian pattern at their own sites
//   board  : the skateboard is a singleton — ACTION at the pier marker recalls the very same
//            board object to the rack and mounts it; it is never duplicated
//   water  : a bust sends the ridden craft straight home; a craft stranded >260 from its
//            mooring (even far out in the extended sea) drifts home once the player is away
//   heli   : waiting at the hospital clamps the replacement heli to 3 s (not 60); the help
//            marker and the JUMP follow a field-parked heli
//   siege  : regression — the motel door still enters the siege
// Usage: node tools/instant_start_check.mjs   (exit 0 = all pass)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js'; import { Sim } from '../src/sim.js';
import { jobButton } from '../src/jobs.js';
import { markers } from '../src/activities.js';
import { mountCraft } from '../src/watercraft.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json'))), M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const DT = 1 / 60, inp = (o = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...o });
function fresh() {
  const s = new Sim(world, M, 7, () => {});
  s.spawnTraffic = () => null; s.spawnPed = () => null;
  s.cars = s.cars.filter(c => c.parked); s.peds = [s.player.ped];
  return s;
}
const step = (s, secs, input) => { for (let i = 0; i < secs * 60; i++) s.step(DT, input || inp()); };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ------------------------------------------------------------------ jobs
{ const s = fresh();
  const J = {}; for (const k of ['taxi', 'tow', 'bus', 'getaway']) J[k] = s.cars.find(c => c.job === k);
  check(Object.values(J).every(Boolean), 'jobs: all four job vehicles exist');
  check(Math.abs(J.taxi.home.x - 935) < 1 && Math.abs(J.getaway.home.x - 785) < 1 && Math.abs(J.tow.home.x - 860) < 1 && Math.abs(J.bus.home.x - 1010) < 1,
    'jobs: homes on the Garage kerb (getaway 785, tow 860, taxi 935, bus 1010)');
  check(Object.values(J).every(c => Math.hypot(c.x - c.home.x, c.y - c.home.y) < 1), 'jobs: every job vehicle starts AT its home');
  step(s, 0.25);   // settle: the OPEN ROAD grid car restores itself on the first ticks (its own instant-start)
  const n = s.cars.length, taxi = J.taxi;
  taxi.x += 600; taxi.wreck = true; taxi.dmg = 100;
  s.player.ped.x = 300; s.player.ped.y = 300;                       // the player is nowhere near the kerb
  step(s, 11);
  check(taxi.wreck && Math.hypot(taxi.x - taxi.home.x, taxi.y - taxi.home.y) > 200, 'jobs: no restock while the player is away from the kerb');
  s.player.ped.x = 897; s.player.ped.y = 1456;                      // wait at the kerb
  step(s, 11);
  check(!taxi.wreck && taxi.dmg === 0 && Math.hypot(taxi.x - taxi.home.x, taxi.y - taxi.home.y) < 1, 'jobs: wrecked taxi restocked + repaired after 10 s at the kerb');
  check(s.cars.length === n && s.cars.filter(c => c.job === 'taxi').length === 1, 'jobs: population unchanged — the guardian never spawns', `${s.cars.length}/${n}`);
}
// ------------------------------------------------------------------ rings
for (const kind of ['wreck', 'valet', 'spot']) {
  const s = fresh();
  const ring = s.cars.find(c => c.ring === kind);
  check(!!ring, `ring ${kind}: the ring car exists`);
  if (!ring) continue;
  check(Math.hypot(ring.x - ring.home.x, ring.y - ring.home.y) < 1, `ring ${kind}: starts at its home in the circle`);
  const site = s.eventSites.find(e => e.kind === kind);
  check(Math.hypot(ring.x - site.p[0], ring.y - site.p[1]) < 70, `ring ${kind}: inside the 70-unit button radius`, `d ${Math.hypot(ring.x - site.p[0], ring.y - site.p[1]).toFixed(0)}`);
  const P = s.player;                                               // sit in the ring car: START must arm
  P.mode = 'car'; P.car = ring; ring.driver = 'player'; P.ped.x = ring.x; P.ped.y = ring.y;
  const btn = jobButton(s);
  check(!!btn && /^START /.test(btn.label || ''), `ring ${kind}: the button arms from the ring car`, btn && btn.label);
  P.mode = 'foot'; P.car = null; ring.driver = null;
  step(s, 0.25);   // settle the grid car before counting (see the jobs block)
  const n = s.cars.length;
  ring.x += 800; ring.wreck = true; ring.dmg = 100;
  P.ped.x = site.p[0]; P.ped.y = site.p[1];                         // wait at the ring
  step(s, 11);
  check(!ring.wreck && ring.dmg === 0 && Math.hypot(ring.x - ring.home.x, ring.y - ring.home.y) < 1, `ring ${kind}: restocked + repaired after 10 s at the ring`);
  check(s.cars.length === n && s.cars.filter(c => c.ring === kind).length === 1, `ring ${kind}: population unchanged — no duplicate ring car`, `${s.cars.length}/${n}`);
}
// ------------------------------------------------------------------ board rack
{ const s = fresh();
  const b = s.board;
  check(!!b, 'board: the board exists');
  b.x = 400; b.y = 400;                                             // abandoned across town
  s.cars = s.cars.filter(c => Math.hypot(c.x - 1296, c.y - 1035) > 100);   // a clear promenade for the mount test
  const p = s.player.ped; p.x = 1296; p.y = 1035;
  s.step(DT, inp({ action: true }));
  step(s, 0.5);
  check(s.player.mode === 'board', 'board: one ACTION press at the marker mounts the board', `mode ${s.player.mode}`);
  check(s.board === b, 'board: the SAME board object was recalled — never duplicated');
  check(Math.hypot(b.x - 1296, b.y - 1035) < 60, 'board: it came to the rack at the pier marker', `${b.x.toFixed(0)},${b.y.toFixed(0)}`);
}
// ------------------------------------------------------------------ watercraft
{ const s = fresh();
  const ski = s.water.craft.find(c => c.kind === 'jetski');
  ski.x = 2300; ski.y = 2000; ski.vx = ski.vy = 0;                  // stranded far out in the extended sea
  s.player.ped.x = 300; s.player.ped.y = 300;                       // the player is far away
  step(s, 21);
  check(Math.hypot(ski.x - ski.home.x, ski.y - ski.home.y) < 2, 'water: a craft stranded in the far sea drifts home', `${ski.x.toFixed(0)},${ski.y.toFixed(0)}`);
  check(s.water.craft.length === 2, 'water: still exactly two player craft');
}
{ const s = fresh();
  const boat = s.water.craft.find(c => c.kind === 'boat');
  const p = s.player.ped; p.x = boat.x; p.y = boat.y - 20;
  mountCraft(s, boat);
  boat.x = 1650; boat.y = 1900;                                     // mid-bay when the bust lands
  s.busted = { t: 0 };
  step(s, 5);
  check(s.player.mode === 'foot' && Math.hypot(boat.x - boat.home.x, boat.y - boat.home.y) < 2, 'water: a bust sends the ridden craft straight home', `${boat.x.toFixed(0)},${boat.y.toFixed(0)}`);
}
// ------------------------------------------------------------------ heli
{ const s = fresh();
  const H = s.heli;
  check(!!H, 'heli: the helicopter exists');
  H.state = 'gone'; H.respawnT = 60;
  const p = s.player.ped, pad = s.W.L.hospital.pad; p.x = pad[0]; p.y = pad[1];   // waiting at the hospital
  step(s, 4);
  check(H.state === 'pad', 'heli: waiting at the hospital clamps the replacement to ~3 s', `state ${H.state}`);
}
{ const s = fresh();
  const H = s.heli;
  H.state = 'gone'; H.respawnT = 60;                                // the player is at spawn, far away
  step(s, 4);
  check(H.state === 'gone' && H.respawnT > 50, 'heli: away from the hospital the 60 s replacement stands', `respawnT ${H.respawnT.toFixed(0)}`);
}
{ const s = fresh();
  const H = s.heli;
  H.state = 'parked'; H.x = 600; H.y = 600; H.home = false; H.onRoof = false;   // landed in the field
  const m = markers(s).find(mk => mk.a.id === 'heli');
  const pos = m && m.a.pos();
  check(!!pos && Math.hypot(pos[0] - 600, pos[1] - 600) < 2, 'heli: the help marker rides a field-parked heli', pos && pos.join(','));
  s.step(DT, inp({ jump: 'heli' }));
  check(Math.hypot(s.player.ped.x - 600, s.player.ped.y - 600) < 70, 'heli: JUMP lands the player beside the parked heli, not the pad', `${s.player.ped.x.toFixed(0)},${s.player.ped.y.toFixed(0)}`);
}
// ------------------------------------------------------------------ siege regression
{ const s = fresh();
  const d = s.W.L.motelDoor, p = s.player.ped; p.x = d[0]; p.y = d[1];
  s.step(DT, inp({ action: true }));
  check(s.player.mode === 'siege', 'siege regression: the motel door still enters the siege', `mode ${s.player.mode}`);
}
console.log(fails ? `INSTANT-START FAIL (${fails})` : 'INSTANT-START OK');
process.exit(fails ? 1 : 0);
