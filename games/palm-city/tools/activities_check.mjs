// activities_check.mjs — 7F: one marker language, and a marker for EVERY activity.
// On the real sim: the registry lists the motel siege, the four jobs and the four city events (plus the
// Garage's JOBS signpost); each has a name, a tag, a how-to line and a live street marker inside the
// world; each is also on the map; a job's tag steps aside while you drive that vehicle and comes
// back when you leave it; the event tags hide while an event runs.
// Usage: node tools/activities_check.mjs   (exit 0 = all pass)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js'; import { Sim } from '../src/sim.js';
import { markers, helpRows } from '../src/activities.js'; import { mapPOIs } from '../src/map.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json'))), M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const DT = 1 / 60, inp = (o = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...o });
const s = new Sim(world, M, 7, () => {});
const WANT = ['motel', 'taxi', 'tow', 'bus', 'getaway', 'wreck', 'valet', 'spot', 'openroad', 'chase', 'heli', 'boats'];
const ids = s.activities.map(a => a.id), mk = markers(s).slice();
for (const id of WANT) {
  const a = s.activities.find(q => q.id === id), m = mk.find(q => q.a.id === id);
  check(!!a && !!m && a.name && a.tag && a.how.length > 20 && a.live(), `${id}: registered, with a how-to line and a street marker`, a ? `"${a.tag}" at ${m ? Math.round(m.x) + ',' + Math.round(m.y) : 'nowhere'}` : 'missing');
  if (m) check(m.x > 0 && m.y > 0 && m.x < layout.world.w && m.y < layout.world.h, `${id}: the marker is inside the world`);
}
check(ids.includes('jobs') && mk.some(m => m.a.id === 'jobs'), 'the Garage wears a JOBS signpost');
check(helpRows(s).map(a => a.id).join() === WANT.join(), 'the HELP rows are exactly the startable activities (no signposts)', helpRows(s).map(a => a.id).join());
const pois = mapPOIs(world, s);
for (const id of WANT) check(pois.some(p => p.activity === id), `${id}: also a map POI`);
{ // marker language: a tag short enough to read at driving speed
  check(s.activities.every(a => a.tag.length <= 12 && a.tag === a.tag.toUpperCase()), 'every tag is a short capital word or two', s.activities.map(a => a.tag).join(' · '));
}
{ // a job tag steps aside while you drive that vehicle
  const P = s.player, c = s.cars.find(k => k.job === 'tow');
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
  check(!markers(s).some(m => m.a.id === 'tow') && markers(s).some(m => m.a.id === 'bus'), 'driving the tow truck: its tag is hidden, the others stay');
  s.step(DT, inp({ action: true }));
  check(P.mode === 'foot' && markers(s).some(m => m.a.id === 'tow'), 'get out and the tag is back', P.mode);
}
{ // events hide their tags while one runs
  const t = new Sim(world, M, 7, () => {}); t.event = { kind: 'wreck', car: null, spot: null, name: 'x' };
  check(!markers(t).some(m => m.a.group === 'event'), 'while an event runs, the event tags are hidden');
}
{ // the motel marker sits on the door the ENTER prompt uses
  const m = mk.find(q => q.a.id === 'motel');
  s.player.mode = 'foot'; s.player.ped.hidden = false; s.player.ped.x = m.x + 12; s.player.ped.y = m.y;
  check(s.nearMotelDoor(), 'the motel marker hangs over the spot where ENTER arms');
}
console.log(fails ? `ACTIVITIES FAIL (${fails})` : 'ACTIVITIES OK'); process.exit(fails ? 1 : 0);
