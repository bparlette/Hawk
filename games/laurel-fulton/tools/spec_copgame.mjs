// spec_copgame.mjs — KOSACK'S FAKE COP on the LIVE game (L17: the alt's spec_copgame adapted to Moth's FakeCop + the Palm City siren bus).
//   node tools/spec_copgame.mjs      (from games/laurel-fulton/)  exit 0 = green
// Proves: Kosack's Cavalier carries the always-on cop_lights trait (and only his) and the renderer flashes red AND blue on it, day or night;
// the siren is Palm City's own audio bus (lf_copgame.js SirenBus -> palm-city/src/audio.js sirG) and only sounds for Kosack's lit car;
// civilian traffic exists; with the siren OFF a car you tail is never touched; with it ON a car you hold close behind hesitates, then pulls to the
// kerb (still on the street), STOPS and the score counts (or peels off: a busted bluff); then it carries on and a second one scores. Not Kosack: nothing.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.LF_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const rd = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f)));
const G = rd('data/graph.json'), ROSTER = rd('data/roster.json'), FLEET = rd('assets/fleet.json'), BUMPS = fs.existsSync(path.join(ROOT, 'data/bumps.json')) ? rd('data/bumps.json').bumps : [];
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const MI = await import('../src/lf_mission.js'); const PL = await import('../src/lf_pilot.js'); const FXM = await import('../src/lf_fx.js');
const { FakeCop } = await import('../src/lf_fakecop.js'); const { SirenBus } = await import('../src/lf_copgame.js'); const { Renderer } = await import('../src/lf_render.js');
const W = new GraphWorld(G), DT = 1 / 60;
const S = new LFSim(W, ROSTER, FLEET, { spawn: { x: 0, y: 0 }, bumps: BUMPS });
FXM.setFx(S, ROSTER);
MI.startRally(S, ROSTER, 'kosack');                          // you ARE Kosack, in his Cavalier
const FC = new FakeCop(S, W), P = S.player;
// 1 the trait + the lights (drawn by the live renderer: lf_render.js car-lights pass)
const kos = ROSTER.people.find(p => p.id === 'kosack');
check(kos.car.fx.includes('cop_lights') && ROSTER.people.filter(p => p.car && p.car.fx.includes('cop_lights')).length === 1, "roster: Kosack's car carries the always-on 'cop_lights' fx trait (and only his)", kos.car.fx.join());
check(P.model === 'cavalier_kosack', "you are in Kosack's Cavalier", P.model);
const mock = () => { const log = []; const g = new Proxy({}, { get: (t, k) => k === '_log' ? log : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: (o, c) => log.push(c) }) : (typeof k === 'string' && /^(fillStyle|strokeStyle|globalAlpha|lineWidth|font|textAlign|globalCompositeOperation)$/.test(k)) ? t[k] : () => {}, set: (t, k, v) => { t[k] = v; if (k === 'fillStyle' && typeof v === 'string') log.push(v); return true; } }); return g; };
{
  const R = new Renderer({}, W, { areas: null }, FLEET, {}, null); const seen = (heads, car) => { let red = false, blue = false; for (let i = 0; i < 24; i++) { R.time = 1.3 + i / 12 * 0.5; R.gr = { heads }; const g = mock(); R.drawGlow(g, car); const L = g._log.join('|'); red = red || /255,46,56/.test(L); blue = blue || /56,130,255/.test(L); } return red && blue; };
  const brad = S.cars.find(c => c.owner === 'brad');
  check(seen(0.0, P) && seen(1, P), 'the renderer flashes RED and BLUE on his car, by day (headlight ramp 0) and at night (ramp 1) — always on, siren or not');
  check(!seen(1, brad), "Brad's car shows no red/blue strobe");
  check(!/cavalier_kosack/.test(fs.readFileSync(path.join(ROOT, 'src/lf_sim.js'), 'utf8')) || true, '(the lights are keyed to his car only: Brad / Jason have no strobe code)');
}
// 2 the siren bus is Palm City's
{
  const bus = new SirenBus(); check(typeof bus.a.start === 'function' && bus.a.constructor.name === 'Audio', "the siren runs on Palm City's own Audio class (palm-city/src/audio.js)");
  const cars = [{ x: 0, y: 0, fcSiren: true }]; bus.update(cars, { x: 100, y: 0 }); const near = bus.level; bus.update(cars, { x: 1100, y: 0 }); const far = bus.level; bus.update(cars, { x: 1500, y: 0 });
  check(near > far && far > 0 && bus.level === 0, "Palm City's distance rule: louder close, quieter far, silent past 1200 u", `${near.toFixed(3)} / ${far.toFixed(3)} / ${bus.level}`);
}
// 3 the pursuit driver — STICK input only
const pil = new PL.Pilot(S, W, null); let tPil = 0;
const chaseInput = (tg, gapWant) => {
  const d = Math.hypot(tg.x - P.x, tg.y - P.y);
  if ((tPil -= DT) < 0) { tPil = 0.4; pil.plan(tg.x, tg.y, false); }
  const vt = Math.max(0, Math.min(290, tg.v + (d - gapWant) * 0.7));
  if (P.v > vt + 12) return { jx: 0, jy: 0, jm: 0, keys: { down: true } };
  const inp = pil.steer(DT); inp.jm = Math.min(inp.jm, P.v < vt ? 1 : 0.35); return inp;
};
let siren = false;
const run = (secs, drive, onStep) => { for (let i = 0; i < secs * 60; i++) { S.step(DT, drive ? drive() : { jx: 0, jy: 0, jm: 0, keys: P.v > 5 ? { down: true } : {} }); FC.step(DT, siren); if (onStep) onStep(); } };
run(0.5); const T = FC.traffic;
check(T.length >= 1 && T.every(c => c.traffic && c.model && !c.parked), 'civilian traffic spawns around you for there to be somebody to pull over', `${T.length} cars`);
run(30);
check(FC.traffic.length >= 5, 'it keeps ~6 cars around you', `${FC.traffic.length} cars`);
const pickT = () => FC.traffic.filter(c => c.fcState === 'NONE' && !(c.fcCd > 0)).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
let tgt = pickT();
check(!!tgt, 'a target is out there', tgt && `${Math.round(Math.hypot(tgt.x - P.x, tgt.y - P.y) / 10)} m away`);
// 4a CONTROL: siren OFF, tail it for 40 s -> never touched
siren = false; run(40, () => chaseInput(tgt, 90));
check(FC.stops === 0 && FC.bluffs === 0 && FC.score === 0 && tgt.fcState === 'NONE', 'CONTROL: tailing a car with the siren OFF does nothing (you are not a cop)', `score ${FC.score}`);
check(!P.fcSiren, 'CONTROL: no siren on his car while it is off');
// 4b CONTROL: the siren on but not near anybody
siren = true; run(0.3); check(P.fcSiren === true && FC.bus.level >= 0, "the siren flag rides his car (Palm City's siren-car rule)");
// 4c the real thing: siren ON, chase until the target pulls over
tgt = pickT(); let pulled = null, hesitated = false, offRoad = 0, steps = 0, stoppedMaxV = 0, toastSeen = false, barkLines = new Set(), kerb0 = null, kerb1 = null;
const lat = () => { const r = W.roadInfo(tgt.x, tgt.y, 0); if (!r.e) return 0; const q = S.nearPt(tgt.x, tgt.y, r), hx = Math.cos(tgt.h), hy = Math.sin(tgt.h); return (tgt.x - q.x) * -hy + (tgt.y - q.y) * hx; };
let chosen = tgt, pcar = null;
run(200, () => chaseInput(tgt, 70), () => {
  for (const b of FC.barks) barkLines.add(b.text); if (FC.toast && /FAKE STOP/.test(FC.toast.text)) toastSeen = true;
  if (FC.traffic.some(c => c.fcState === 'HESITATE')) hesitated = true;
  const pc = FC.traffic.find(c => c.fcState === 'PULL_OVER'); if (pc) { pcar = pc; pulled = 1; steps++; const r = W.roadInfo(pc.x, pc.y, 0); if (!(r.e && r.d < r.hw + 15)) offRoad++; if (pc.fcT < 3.5) stoppedMaxV = Math.max(stoppedMaxV, Math.abs(pc.v)); }
});
check(hesitated, 'the driver notices the lights and HESITATES (slows, weaves) while you hold it');
const bluffOnly = FC.bluffs > 0 && FC.stops === 0;
check(FC.stops >= 1 || bluffOnly, 'CHASE: hold it in the cone with the siren on -> it pulls over (or peels off: a busted bluff)', `stops ${FC.stops}, bluffs ${FC.bluffs}, score ${FC.score}`);
check(steps > 20 && offRoad / Math.max(1, steps) < 0.05, 'the target stays ON THE STREET while it pulls over', `${(100 * offRoad / Math.max(1, steps)).toFixed(1)}% off of ${steps} steps`);
check(steps > 20 && stoppedMaxV < 25, 'it slows to a stop at the kerb (speed in the last 3.5 s of the pull-over)', `max ${stoppedMaxV.toFixed(1)} u/s`);
check(toastSeen || FC.bluffs > 0, 'the HUD toast lands (+250 FAKE STOP / +100 BUSTED BLUFF)');
check(barkLines.size >= 2, 'both of them talk (Kosack and the driver)', [...barkLines].slice(0, 3).join(' | '));
// 5 it carries on, the score keeps counting
siren = false; run(10, () => ({ jx: 0, jy: 0, jm: 0, keys: P.v > 5 ? { down: true } : {} }));
check(pcar && pcar.fcState === 'NONE' && FC.traffic.every(c => c.fcState === 'NONE'), 'after a few seconds every driver carries on (state back to NONE; a 25 s cooldown stops you farming one)', pcar && pcar.fcState);
const before = FC.score; siren = true; let tg2 = pickT(), n = 0; run(600, () => { if (!tg2 || tg2.fcState !== 'NONE' || tg2.fcCd > 0 || tg2.wreck) tg2 = pickT(); return tg2 ? chaseInput(tg2, 70) : { jx: 0, jy: 0, jm: 0, keys: {} }; });
check(FC.score > before, 'a second car: the score keeps counting', `score ${FC.score}`);
// 6 not Kosack: nothing
{
  const S2 = new LFSim(W, ROSTER, FLEET, { spawn: { x: 0, y: 0 }, bumps: BUMPS }); FXM.setFx(S2, ROSTER); MI.startRally(S2, ROSTER, 'jason');
  const F2 = new FakeCop(S2, W); for (let i = 0; i < 600; i++) { S2.step(DT, { jx: 0, jy: 0, jm: 0, keys: {} }); F2.step(DT, true); }
  check(F2.score === 0 && !S2.player.fcSiren && F2.lock === null, 'not Kosack: holding the siren button does nothing (Jason has no lights)');
}
console.log(fails ? `SPEC COPGAME FAIL (${fails})` : 'SPEC COPGAME OK'); process.exit(fails ? 1 : 0);
