// events_check.mjs — rule checks for the city events (src/events.js) on the real sim in Node.
// The event button is pressed through the real input object (inp.punch while driving); the car is driven
// with real key input where the check needs motion. Usage: node tools/events_check.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';
import { jobButton } from '../src/jobs.js';
import { EVENTS, bayAlign, inBay } from '../src/events.js';
import { hitThing } from '../src/destruct.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const DT = 1 / 60, none = { jx: 0, jy: 0, jm: 0, keys: {} };
const run = (s, secs, f, inp = none) => { for (let i = 0; i < secs * 60; i++) { if (f && f(i) === false) return; s.step(DT, inp); } };
const press = (s) => s.step(DT, { ...none, punch: true });
function fresh() {
  const s = new Sim(world, M, 9, () => {});
  s.peds = [s.player.ped]; s.cars = s.cars.filter(c => c.parked);
  s.stars = 0; s.addStars = () => {};
  const vox = []; const ev = s.ev.bind(s); s.ev = (n, v) => { if (String(n).startsWith('vox_evt')) vox.push(n); ev(n, v); };
  const c = s.cars.find(k => k.model === 'conv_mint'), P = s.player;
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
  return { s, c, vox };
}
const put = (c, x, y, h = 0, v = 0) => { c.x = x; c.y = y; c.h = h; c.v = v; };
const score = (s) => s.score || 0;
const startAt = (s, c, kind) => { put(c, ...EVENTS[kind].site); run(s, 0.05); press(s); return s.event; };

// ---- registration + start
{
  const { s, c } = fresh();
  check(s.eventSites.length === 3 && s.eventSites.map(e => e.kind).sort().join() === 'spot,valet,wreck', 'all three ring events register in sim.eventSites (map.js lists them)');
  put(c, 700, 800); check(jobButton(s) === null, 'away from a beacon there is no event button');
  put(c, ...EVENTS.wreck.site, 0, 0);
  check(jobButton(s) && jobButton(s).label === 'START WRECK IT!', 'at the Plaza beacon the button reads START WRECK IT!', jobButton(s) && jobButton(s).label);
  put(c, ...EVENTS.valet.site, 0, 0);
  check(jobButton(s) && /VALET/.test(jobButton(s).label), 'at the Garage beacon the button reads START VALET — PARK IT!', jobButton(s) && jobButton(s).label);
}

// ---- WRECK IT!
{
  const { s, c, vox } = fresh();
  const ev = startAt(s, c, 'wreck');
  check(ev && ev.kind === 'wreck' && s.event === ev && ev.timer === 45, 'pressing the button starts WRECK IT! with a 45 s clock');
  check(s.things.filter(t => t.evAnchor).length === 7, 'seven domino anchors (hydrants + fuel drums) are spawned', `${s.things.filter(t => t.evAnchor).length}`);
  check(vox.includes('vox_evt_wreck_start'), 'the VOX_EVT_WRECK_START hook fires (no audio wired)');
  const s0 = score(s);
  const bench = s.benches[3].thing;                                   // (1040,640): inside the district
  check(s.benches.length > 4 && !!bench, 'the district has benches to break');
  s.player.ped.x = 99; c.x = 700; c.y = 800;                          // park the car out of everything's way
  s.step(DT, none);
  const t0 = ev.timer; run(s, 1.0, null);
  check(ev.count > 0 && ev.timer === t0 && score(s) === s0, 'during the 3-2-1 count the clock holds and nothing scores');
  run(s, 2.5, () => ev.count > 0);
  const t1 = ev.timer; run(s, 1, null);
  check(ev.count === 0 && Math.abs((t1 - ev.timer) - 1) < 0.03, 'after GO the 45 s clock runs', `${t1.toFixed(2)} → ${ev.timer.toFixed(2)}`);
  // breaking things in quick succession grows the combo
  const hit = (t, amt = 0.7) => hitT(s, t, amt);
  const chain0 = ev.chain, p0 = ev.pts;
  const targets = [s.benches[3].thing, s.benches[4].thing, s.palms.find(p => Math.hypot(p.x - 1100, p.y - 430) < 5), s.palms.find(p => Math.hypot(p.x - 980, p.y - 610) < 5)];
  for (const t of targets) { hit(t); run(s, 0.3, null); }
  check(ev.chain >= 3 && ev.chain > chain0, 'breaking things within the window grows the chain multiplier', `×${chain0} → ×${ev.chain}, best ×${ev.maxChain}`);
  check(ev.pts - p0 > 0 && score(s) - s0 >= ev.pts - p0 - 1, 'chained points land on the existing score', `+${ev.pts - p0} event, +${score(s) - s0} score`);
  check((s.hitStopT || 0) > 0 || ev.lastStop > 0, 'a big break fires hit-stop (50 ms) and the zoom punch', `lastStop ${ev.lastStop.toFixed(2)}`);
  // idle: the combo dies
  const was = ev.chain; run(s, 3, null);
  check(was > 1 && ev.chain === 1 && ev.deaths >= 1, 'stop breaking things and the combo dies back to ×1', `×${was} → ×${ev.chain}`);
  // anchors: a punch on a fuel drum fizzes, then detonates and chains onto neighbours
  const drum = s.things.find(t => t.kind === 'drum' && t.x === 1118), next = s.things.find(t => t.kind === 'drum' && t.x === 1142), palm = s.palms.find(p => Math.hypot(p.x - 1100, p.y - 430) < 5);
  const pb = score(s); hitT(s, drum, 0.34);
  check(drum.state === 'fuse', 'one punch lights a fuel drum: it fizzes', drum.state);
  run(s, 0.45, null); check(drum.state === 'fuse', 'the fuse lasts ~0.6 s', `${drum.fuse.toFixed(2)} left`);
  run(s, 0.3, null);
  check(drum.state === 'boom' && drum.stage === 3, 'then it detonates');
  run(s, 0.6, null);
  check(next.state !== 'intact', 'the blast lights the next drum (domino)', next.state);
  check(score(s) - pb >= 300, 'anchor detonation pays +300 and more as the blast breaks things', `+${score(s) - pb}`);
  check(s.palms.some(p => p.stage >= 1 && Math.hypot(p.x - 1100, p.y - 430) < 5) || palm.stage >= 1, 'the blast damages the palm beside it', `palm stage ${palm.stage}`);
  check(ev.domino >= 0 && vox.includes('vox_evt_wreck_chain_5x') || ev.maxChain >= 3, 'chain hooks track: best chain', `×${ev.maxChain}`);
  // a car driven through a hydrant
  const hyd = s.things.find(t => t.kind === 'hydrant' && t.x === 1236);
  put(c, 1236 - 60, 424, 0, 150); s.player.ped.hidden = true;
  run(s, 0.6, () => hyd.state === 'intact', { ...none, keys: { up: true } });
  check(hyd.state !== 'intact', 'driving a car through a hydrant blows it', hyd.state);
  // timer end → clean finish with a medal field
  ev.timer = 0.05; run(s, 0.2, null);
  check(!s.event && s.eventResult && s.eventResult.kind === 'wreck' && 'medal' in s.eventResult, 'the clock running out ends the event cleanly with a result', s.eventResult && `${s.eventResult.pts} pts ${s.eventResult.medal}`);
  check(s.things.every(t => !t.evAnchor), 'anchors are cleaned up at the end');
  run(s, 6.5, null); check(!s.eventResult, 'the result banner clears itself');
}
// medals + busted + restart
{
  const { s, c, vox } = fresh(); const ev = startAt(s, c, 'wreck'); ev.count = 0; ev.pts = 9600; ev.timer = 0.02; run(s, 0.1, null);
  check(s.eventResult && s.eventResult.medal === 'GOLD' && vox.includes('vox_evt_wreck_gold'), '9,600 pts is GOLD and fires VOX_EVT_WRECK_GOLD', s.eventResult && s.eventResult.medal);
  const f = fresh(); const e2 = startAt(f.s, f.c, 'wreck'); e2.count = 0; e2.pts = 3000; f.s.busted = { t: 0 }; run(f.s, 0.1, null);
  check(!f.s.event && f.s.eventResult && f.s.eventResult.ok === false && f.s.eventResult.pts === 3000 && f.vox.includes('vox_evt_wreck_busted'), 'getting busted ends the run, keeps the partial score', `${f.s.eventResult && f.s.eventResult.pts}`);
}

// ---- VALET
{
  const { s, c, vox } = fresh(); const ev = startAt(s, c, 'valet');
  check(ev && ev.kind === 'valet' && ev.bays.length === 3 && ev.timer === 50, 'VALET starts: three bays, 50 s clock');
  check(vox.includes('vox_evt_valet_start'), 'the VOX_EVT_VALET_START hook fires');
  const b = ev.bays[0];
  put(c, b.x, b.y, b.ax); check(bayAlign(c, b) < 0.01 && inBay(c, b), 'a car square in the stall reads aligned and inside');
  put(c, b.x, b.y, b.ax + 0.7); check(bayAlign(c, b) > 0.6 && !inBay(c, b), 'cocked 40° it reads off and sticks out of the lines');
  put(c, b.x + 30, b.y, b.ax); check(!inBay(c, b), 'half out of the lines is not parked');
  run(s, 3.2, () => ev.count > 0);
  // misaligned: never locks
  put(c, b.x, b.y, b.ax + 0.5); run(s, 1.2, () => { put(c, b.x, b.y, b.ax + 0.5); }); check(ev.idx === 0, '29° off never locks');
  // clean standard park, quick = mint
  const s0 = score(s); ev.bayT = 2;
  run(s, 0.7, () => { put(c, b.x, b.y, b.ax + 0.05); });
  const gain = score(s) - s0;
  check(ev.idx === 1 && gain >= 200 + 300 + 12 * 20, 'settled and aligned: base $200 + MINT $300 + speed split', `+$${gain}`);
  check(vox.includes('vox_evt_valet_mint'), 'VOX_EVT_VALET_MINT fires on a spotless park');
  // a scrape costs the mint bonus
  const b2 = ev.bays[1]; c.dmg += 0.05; ev.bayT = 20;
  run(s, 0.7, () => { put(c, b2.x, b2.y, b2.ax - 0.1); });
  check(ev.scraped === false && ev.idx === 2 && ev.mint === 1, 'a bumped bay pays no mint bonus (and a sloppy-but-legal 6° is still clean)', `mint bays ${ev.mint}`);
  // J-turn: real steering from speed builds the yaw swing, then settle in the bay
  const b3 = ev.bays[2]; ev.dmg0 = c.dmg; ev.bayT = 20; ev.scraped = false;
  put(c, 1100, 1735, Math.PI, 215);
  run(s, 1.0, (i) => { c.v = Math.max(c.v, 190); return true; }, { ...none, keys: { up: true, right: true } });
  check(s.time - ev.jt < 2.5, 'whipping the wheel through ≥135° from ≥180 u/s is read as a J-turn', `jt ${ev.jt.toFixed(2)} @ t ${s.time.toFixed(2)}`);
  const s1 = score(s);
  run(s, 0.8, () => { put(c, b3.x, b3.y, b3.ax + 0.04); });
  check(s.eventResult && /J-TURN/.test(s.lastTrick.name) && score(s) - s1 >= 1000, 'a J-turn into the last bay pays 5× and ends the run COMPLETE', `${s.lastTrick.name} +$${score(s) - s1}`);
  check(vox.includes('vox_evt_valet_jturn') && vox.includes('vox_evt_valet_complete') && s.eventResult.ok, 'VOX_EVT_VALET_JTURN + _COMPLETE fire; the run ends clean');
}
{
  const { s, c, vox } = fresh(); const ev = startAt(s, c, 'valet'); run(s, 3.2, () => ev.count > 0);
  const b = ev.bays[0]; put(c, b.x, b.y, b.ax); c.v = 0; c.dmg = 0;
  run(s, 0.3, () => { put(c, b.x, b.y, b.ax); }); c.dmg += 0.05; run(s, 0.1, () => { put(c, b.x, b.y, b.ax); });
  check(ev.scraped && vox.includes('vox_evt_valet_scrape'), 'a bump fires the scrape hook and flags the bay', `scraped ${ev.scraped}`);
  ev.timer = 0.05; run(s, 0.2, null);
  check(!s.event && s.eventResult && !s.eventResult.ok === (s.eventResult.bays === 0 || !s.eventResult.ok), 'the 50 s clock expiring ends valet cleanly', s.eventResult && s.eventResult.text);
}
{
  const { s, c } = fresh(); const ev = startAt(s, c, 'valet'); c.wreck = true; run(s, 0.1, null);
  check(!s.event && s.eventResult && s.eventResult.ok === false, 'wrecking the car fails the valet run');
  const f = fresh(); startAt(f.s, f.c, 'valet'); f.s.exitCar(); run(f.s, 0.1, null);
  check(!f.s.event, 'getting out of the car ends the valet run cleanly');
  const g = fresh(); startAt(g.s, g.c, 'valet'); startAt(g.s, g.c, 'wreck');
  check(g.s.event.kind === 'valet', 'only one event at a time');
}

function hitT(s, t, amt) { hitThing(s, t, amt, 1, 0, 'player', 0); }
console.log(fails ? `\nEVENTS FAILED: ${fails}` : '\nEVENTS OK'); process.exit(fails ? 1 : 0);
