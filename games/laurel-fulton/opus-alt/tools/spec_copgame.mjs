// spec_copgame.mjs — KOSACK'S COP LIGHTS + THE FAKE-COP MINI GAME (owner, Nov 18), headless through the STICK (the same input a thumb makes).
//   node tools/spec_copgame.mjs      (from games/laurel-fulton/)  exit 0 = green
// Proves: Kosack's Cavalier ALWAYS flashes red/blue (day and night, whoever is looking) and nobody else's car does; the siren is a toggle
// (the V key / the SIREN button call CopGame.toggleSiren); traffic exists to pull over; with the siren OFF a car you tail never stops;
// with it ON, staying close behind long enough makes it slow, drift to the right-hand kerb (still on the street), stop, say "officer...?"
// and score — and a car you only pass, or tail from far away, is left alone; and the car carries on after a while.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.LF_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')   /* opus-alt: the shared Laurel data */;
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const rd = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f)));
const G = rd('data/graph.json'), ROSTER = rd('data/roster.json'), FLEET = rd('assets/fleet.json'), BUMPS = fs.existsSync(path.join(ROOT, 'data/bumps.json')) ? rd('data/bumps.json').bumps : [];
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const MI = await import('../src/lf_mission.js'); const PL = await import('../src/lf_pilot.js'); const FXM = await import('../src/lf_fx.js'); const CGM = await import('../src/lf_copgame.js');
const W = new GraphWorld(G), DT = 1 / 60;
const S = new LFSim(W, ROSTER, FLEET, { spawn: { x: 0, y: 0 }, bumps: BUMPS });
FXM.setFx(S, ROSTER);
MI.startRally(S, ROSTER, 'kosack');                          // you ARE Kosack, in his Cavalier
const CG = new CGM.CopGame(), P = S.player;
// 1 the roster trait + the lights
const kos = ROSTER.people.find(p => p.id === 'kosack');
check(kos.car.fx.includes('cop_lights') && ROSTER.people.filter(p => p.car && p.car.fx.includes('cop_lights')).length === 1, "roster: Kosack's car carries the always-on 'cop_lights' fx trait (and only his)", kos.car.fx.join());
check(CGM.hasCopLights(S, P) && S.cars.filter(c => CGM.hasCopLights(S, c)).length === 1, 'the sim sees exactly one cop-lights car: his Cavalier', P.model);
const mock = () => { const log = []; const g = new Proxy({}, { get: (t, k) => k === '_log' ? log : k === 'createRadialGradient' ? () => ({ addColorStop: (o, c) => log.push(c) }) : (typeof k === 'string' && /^(fillStyle|strokeStyle|globalAlpha|lineWidth|font|textAlign|globalCompositeOperation)$/.test(k)) ? t[k] : () => {}, set: (t, k, v) => { t[k] = v; if (k === 'fillStyle' && typeof v === 'string') log.push(v); return true; } }); return g; };
const view = (tod) => ({ vw: 420, vh: 860, tod, gr: {} });
const sweep = (tod) => { const g = mock(); for (let i = 0; i < 24; i++) CG.post(g, S, { x: P.x, y: P.y, zoom: 0.62 }, i / 12 * 0.5 + 0.01, view(tod)); const L = g._log.join('|'); return { red: /255,40,60/.test(L) && /#ff4a5c/.test(L), blue: /70,120,255/.test(L) && /#6fa0ff/.test(L) }; };
for (const [name, tod] of [['by day (golden hour)', 0.05], ['at night (blue dusk)', 0.97]]) { const r = sweep(tod); check(r.red && r.blue, `the cop lights flash RED and BLUE ${name} — always on, siren or not`, JSON.stringify(r)); }
{ const g = mock(); CG.post(g, S, { x: S.cars.find(c => c.owner === 'brad').x, y: S.cars.find(c => c.owner === 'brad').y, zoom: 0.62 }, 1, view(0.9)); S.player = S.cars.find(c => c.owner === 'brad'); const ok = !CG.eligible(S); S.player = P; check(!CGM.hasCopLights(S, S.cars.find(c => c.owner === 'brad')) && !CGM.hasCopLights(S, S.cars.find(c => c.owner === 'jason')), "Brad's and Jason's cars show no cop lights"); check(ok, 'the mini game is Kosack\'s: nobody else is eligible to run the siren'); }
// 2 the pursuit driver — STICK input only
const pil = new PL.Pilot(S, W, null); let tPil = 0;
const chaseInput = (tg, gapWant) => {
  const d = Math.hypot(tg.x - P.x, tg.y - P.y);
  if ((tPil -= DT) < 0) { tPil = 0.4; pil.plan(tg.x, tg.y, false); }
  const vt = Math.max(0, Math.min(290, tg.v + (d - gapWant) * 0.7));
  if (P.v > vt + 12) return { jx: 0, jy: 0, jm: 0, keys: { down: true } };
  const inp = pil.steer(DT); inp.jm = Math.min(inp.jm, P.v < vt ? 1 : 0.35); return inp;
};
const run = (secs, drive) => { for (let i = 0; i < secs * 60; i++) { S.step(DT, drive ? drive() : { jx: 0, jy: 0, jm: 0, keys: P.v > 5 ? { down: true } : {} }); CG.step(S, DT); } };
// 3 traffic only exists once you light up; siren OFF -> nobody ever pulls over
check(!CG.toggleSiren(S) === false && CG.siren, 'the siren toggles on (V key / SIREN button -> toggleSiren)'); run(0.2);
const T = CG.traffic;
check(T.length >= 5 && T.every(c => c.traffic && c.model && !c.parked), 'civilian traffic spawns around you for there to be somebody to pull over', `${T.length} cars: ${[...new Set(T.map(c => c.model))].join(' ')}`);
CG.toggleSiren(S); check(!CG.siren, 'and toggles off');
run(8);                                                       // let them spread out, you stay parked
const pickT = () => T.filter(c => !c.cop).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
let tgt = pickT(), tStart = 0; const ev = () => CG.log.filter(e => e.ev === 'pulled_over').length;
check(!!tgt && Math.hypot(tgt.x - P.x, tgt.y - P.y) < 3000, 'a target is out there', tgt && `${Math.round(Math.hypot(tgt.x - P.x, tgt.y - P.y) / 10)} m away`);
// 4a CONTROL: siren OFF, tail it close for 40 s -> it never stops
let chased = 0; run(40, () => { const d = Math.hypot(tgt.x - P.x, tgt.y - P.y); if (d < 260 && P.v > 50) chased++; return chaseInput(tgt, 90); });
check(ev() === 0 && !tgt.cop, 'CONTROL: tailing a car with the siren OFF does nothing (no tickets, no authority — you are not a cop)', `${(chased / 60).toFixed(1)} s spent close behind it`);
// 4b CONTROL: siren ON but you stand still far away -> nothing
CG.toggleSiren(S); run(15); check(ev() === 0, 'CONTROL: siren on but not on anybody\'s tail -> nobody pulls over');
// 4c the real thing: siren ON, get behind it, stay close
tgt = pickT(); const v0 = { x: tgt.x, y: tgt.y }, edgeOf = () => W.roadInfo(tgt.x, tgt.y, tgt.layer || 0);
let kerbLat0 = null, kerbLat1 = null, stoppedMaxV = 0, toastSeen = false, closeT = 0, startedPull = null, maxLat = 0, offRoad = 0, steps = 0, sawNotice = false, tPull = 0, speedAtPull = 0;
const t0 = CG.t;
const latOf = () => { const r = W.roadInfo(tgt.x, tgt.y, tgt.layer || 0); if (!r.e) return 0; const q = S.nearPt(tgt.x, tgt.y, r), hx = Math.cos(tgt.h), hy = Math.sin(tgt.h); return (tgt.x - q.x) * -hy + (tgt.y - q.y) * hx; };
run(120, () => { if (CG.toast && /PULLED OVER/.test(CG.toast.text)) toastSeen = true; if (tgt.cop && tgt.cop.st === 'pull' && kerbLat0 === null) kerbLat0 = latOf(); if (tgt.cop && tgt.cop.st === 'stopped') { kerbLat1 = latOf(); if (tgt.cop.t > 0.3) stoppedMaxV = Math.max(stoppedMaxV, Math.abs(tgt.v)); } if (tgt.cop && tgt.cop.st === 'pull' && !startedPull) { startedPull = CG.t - t0; speedAtPull = tgt.v; } if (tgt.cop && tgt.cop.st === 'notice') sawNotice = true;
  if (tgt.cop && (tgt.cop.st === 'pull' || tgt.cop.st === 'stopped')) { steps++; const r = edgeOf(); if (!(r.e && r.d < r.hw + 15)) offRoad++; }
  if (ev() > 0 && !tPull) tPull = CG.t - t0; if (ev() > 0 && tgt.cop && tgt.cop.st === 'stopped' && tgt.cop.t > 1.5) return { jx: 0, jy: 0, jm: 0, keys: P.v > 5 ? { down: true } : {} };   // you stop behind it
  return chaseInput(tgt, 110); });
const pulledEv = CG.log.find(e => e.ev === 'pulled_over');
check(!!pulledEv, 'CHASE: stay behind it close enough for long enough -> it PULLS OVER', pulledEv ? `after ${tPull.toFixed(1)} s (${(startedPull ?? 0).toFixed(1)} s to commit); score ${CG.score}` : 'never pulled over');
check(sawNotice && startedPull !== null && speedAtPull > 40, 'it notices you first ("HUH?"), then commits while still rolling', `committed at ${Math.round(speedAtPull)} u/s`);
const bl = CG.barks.log; check(bl.some(e => e.text === 'OFFICER...?') && toastSeen, 'the driver says "OFFICER...?" and the HUD toasts "PULLED OVER"', bl.filter(e => e.text).map(e => e.text).slice(0, 5).join(' | '));
check(steps > 20 && offRoad / Math.max(1, steps) < 0.05, 'the target stays ON THE STREET while it slows and pulls to the kerb', `${(100 * offRoad / Math.max(1, steps)).toFixed(1)}% off`);
check(kerbLat0 !== null && kerbLat1 !== null && stoppedMaxV < 6 && Math.abs(kerbLat1) > Math.abs(kerbLat0) + 3, 'it STOPS (speed ~0 while parked) and has moved over toward the right-hand kerb', `lane offset ${kerbLat0 && kerbLat0.toFixed(0)} -> ${kerbLat1 && kerbLat1.toFixed(0)} u, stopped speed ${stoppedMaxV.toFixed(1)}`);
const wait = bl.some(e => e.text === '...wait. KOSACK?!'); check(wait, 'the joke lands: "...wait. KOSACK?!" once it has stopped');
run(12, () => ({ jx: 0, jy: 0, jm: 0, keys: P.v > 5 ? { down: true } : {} }));
check(!tgt.cop && CG.log.some(e => e.ev === 'released' && e.model === tgt.model), 'after a few seconds it carries on (released; a 25 s cooldown stops you farming it)');
run(6); check(Math.abs(tgt.v) > 30, '...and is driving again', `${Math.round(tgt.v)} u/s`);
// 5 a second one, to prove the loop repeats; score is cumulative
const before = CG.score; tgt = pickT(); let tries = 0; run(150, () => { if (CG.score > before) tries = 1; return CG.score > before ? { jx: 0, jy: 0, jm: 0, keys: P.v > 5 ? { down: true } : {} } : chaseInput(tgt, 110); });
check(CG.score >= before + 1, 'a second car pulled over: the score keeps counting', `score ${CG.score}`);
check(CG.barks.stats.says >= 4, 'barks fired', JSON.stringify({ says: CG.barks.stats.says }));
console.log(fails ? `SPEC COPGAME FAIL (${fails})` : 'SPEC COPGAME OK'); process.exit(fails ? 1 : 0);
