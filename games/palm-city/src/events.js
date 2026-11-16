// events.js — CITY EVENTS (v2 step 6): WRECK IT! and VALET — PARK IT! Spec: shots/events-spec.md.
// Same pattern as jobs.js: one event at a time (sim.event). It starts from a golden beacon: drive
// into it and the FIGHT button — idle in a car otherwise — reads START <EVENT> (jobs.js asks
// eventButton() and routes the press to startEvent). Getting busted, wrecking the car (valet) or
// the clock ends it cleanly; the result lingers in sim.eventResult for the HUD. Money/points are
// score. The sites register in sim.eventSites ({name, kind, p}) — map.js already lists them, and a
// later indicator/help-panel can discover them (EVENTS is the registry). Voice hooks fire as
// sim.ev('vox_evt_*') exactly like jobs' vox_* hooks; no audio is wired here (separate task).
//
// WRECK IT! rides the destruction system untouched: every break already calls destruct.report(),
// which calls sim.eventBreak (set here) — the event only multiplies and chains. Domino anchors
// (hydrants, fuel drums) are ordinary sim.things of two new kinds registered with destruct.js.
import { hitCar, hitThing, burst, puff, report, registerKind, STAGES, D } from './destruct.js';
import { initChase, stepChase } from './chase.js';

const TAU = Math.PI * 2;
const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const dxy = (o, p) => Math.hypot(o.x - p[0], o.y - p[1]);

// ---------------------------------------------------------------- the registry
export const EVENTS = {
  wreck: { name: 'WRECK IT!', site: [1168, 470], radius: 430, time: 45, window: 2.2, medals: [2500, 5500, 9500] },
  valet: { name: 'VALET — PARK IT!', site: [760, 1690], time: 50, split: 16 },
};
// valet round 1: three wide bays on the Garage's south apron (x 720..1120, y 1650..1710 is open paving
// under the garage wall). u axis = along the stall (vertical), 34 wide x 60 deep per spec.
const BAYS = [[810, 1680], [920, 1680], [1030, 1680]].map(([x, y]) => ({ x, y, ax: Math.PI / 2, w: 34, l: 60, done: false }));
// wreck anchors, sat right next to palms / benches / parked cars so lines of dominoes exist
const ANCHORS = [
  ['drum', 1118, 462], ['drum', 1142, 484], ['hydrant', 1236, 424], ['drum', 1000, 598],
  ['hydrant', 884, 470], ['drum', 1286, 546], ['hydrant', 1276, 640],
];

STAGES.drum = [0.3, 0.6, 1]; STAGES.hydrant = [0.3, 0.6, 1];

export function initEvents(sim) {
  sim.event = null; sim.eventResult = null; sim.hitStopT = 0;
  sim.eventStats = { wreck: 0, valet: 0, chase: 0 };
  sim.eventSites = Object.entries(EVENTS).map(([kind, e]) => ({ kind, name: e.name, p: e.site }));
  sim.eventBreak = (x, y, pts, severity, label) => eventBreak(sim, x, y, pts, severity, label);
  initChase(sim);                                           // BOARD CHASE: its own site (it starts on the board, not in a car)
}

// ---------------------------------------------------------------- the button (jobs.js asks)
export function eventButton(sim) {
  const P = sim.player;
  if (P.mode !== 'car' || sim.job || sim.event || P.car.wreck) return null;
  for (const s of sim.eventSites) if (dxy(P.car, s.p) < 70 && Math.abs(P.car.v) < 140) return { kind: 'evstart', ev: s.kind, label: 'START ' + EVENTS[s.kind].name.replace(' — ', ' ') };
  return null;
}

const pay = (sim, pts, label, t = 1.6) => {
  sim.score = (sim.score || 0) + pts; sim.lastTrick = { name: label, pts, t, mult: 1 }; sim.ev('jobpay');
};

export function startEvent(sim, kind) {
  if (sim.event || sim.job) return null;
  const E = EVENTS[kind], P = sim.player;
  const ev = sim.event = { kind, name: E.name, t: 0, timer: E.time, count: 3, car: P.mode === 'car' ? P.car : null, pts: 0, n: 0, spot: null, warned: false };
  sim.eventResult = null; sim.ev('jobstart', kind);
  if (kind === 'wreck') {
    Object.assign(ev, { chain: 1, maxChain: 1, lastBreak: -9, lastStop: -9, domino: 0, deaths: 0, spot: E.site });
    spawnAnchors(sim);
    if (sim.stars < 1 && sim.addStars) sim.addStars(1, 'event');            // district 1: a gentle ★1 response
    sim.say('WRECK IT — 3', 1); sim.ev('vox_evt_wreck_start');
  } else {
    ev.bays = BAYS.map(b => ({ ...b, done: false })); ev.idx = 0; ev.spot = [ev.bays[0].x, ev.bays[0].y];
    ev.yaw = 0; ev.lastH = ev.car.h; ev.hist = []; ev.jt = -9; ev.drt = -9; ev.settle = 0; ev.bayT = 0; ev.dmg0 = ev.car.dmg; ev.scraped = false;
    ev.mint = 0; ev.jturns = 0; ev.align = null; ev.inBay = false;
    sim.say('VALET — PARK IT — 3', 1); sim.ev('vox_evt_valet_start');
  }
  return ev;
}

function endEvent(sim, text, ok, extra) {
  const ev = sim.event;
  if (!ev) return;
  if (ev.kind === 'wreck') { sim.things = sim.things.filter(t => !t.evAnchor); }
  const result = { kind: ev.kind, name: ev.name, pts: ev.pts, ok, t: 6, text, ...extra };
  if (ev.kind === 'wreck') { const M = EVENTS.wreck.medals; result.medal = ev.pts >= M[2] ? 'GOLD' : ev.pts >= M[1] ? 'SILVER' : ev.pts >= M[0] ? 'BRONZE' : 'NONE'; }
  sim.event = null; sim.eventResult = result;
  if (ev.kind in sim.eventStats) sim.eventStats[ev.kind]++;
  if (text) sim.say(text, 2.4);
  sim.ev(ok ? 'jobdone' : 'jobfail');
}

// ---------------------------------------------------------------- WRECK IT!
function spawnAnchors(sim) {
  sim.things = sim.things.filter(t => !t.evAnchor);
  for (const [kind, x, y] of ANCHORS) {
    const t = { kind, evAnchor: true, x, y, r: kind === 'drum' ? 11 : 8, dmg: 0, stage: 0, hitT: -9, punch: 0.34, ax: 1, ay: 0, state: 'intact', fuse: 0, jet: 0, jetN: 0, pulse: sim.fxr() * 6 };
    t.step = stepAnchor; sim.things.push(t);
  }
}

registerKind('drum', (sim, t, before, after, dx, dy, cause) => {
  const l = Math.hypot(dx, dy) || 1; t.ax = dx / l; t.ay = dy / l;
  if (t.state === 'intact') { t.state = 'fuse'; t.fuse = 0.6; sim.ev('crack', 1); burst(sim, D.METAL, 3, t.x, t.y, t.ax, t.ay, 60, 0.7); }
  void before; void after; void cause;
});
registerKind('hydrant', (sim, t, before, after, dx, dy, cause) => {
  const l = Math.hypot(dx, dy) || 1; t.ax = dx / l; t.ay = dy / l;
  burst(sim, D.METAL, 2, t.x, t.y, t.ax, t.ay, 60, 0.7); sim.ev('dent', 0.6);
  if (after >= 1 && t.state === 'intact') {
    t.state = 'jet'; t.jet = 2.6; t.jetN = 0; sim.ev('snap', 0.5); sim.ev('vox_dest_hydrant');
    report(sim, t.x, t.y, 150, 0, cause, 'HYDRANT BLOWN');
  }
});

function stepAnchor(sim, t, dt) {
  if (t.state === 'fuse') { t.fuse -= dt; if (t.fuse <= 0) detonate(sim, t); }
  else if (t.state === 'jet') {
    t.jet -= dt; t.jetN += dt;
    if (t.jetN >= 0.2) {                                     // the jet shoves whatever stands in its line
      t.jetN = 0;
      const R = 60;
      for (const th of sim.things.slice()) {
        if (th === t || th.stage >= 3 || th.evAnchor && th.kind === 'hydrant') continue;
        const dx = th.x - t.x, dy = th.y - t.y, d = Math.hypot(dx, dy) - th.r;
        if (d > R || (dx * t.ax + dy * t.ay) < -10) continue;
        hitThing(sim, th, 0.14, dx, dy, 'player', 0);
      }
      for (const p of sim.peds) {
        if (p.hidden || p === sim.player.ped || p.mode === 'down') continue;
        const dx = p.x - t.x, dy = p.y - t.y;
        if (Math.hypot(dx, dy) < 50 && (dx * t.ax + dy * t.ay) > -6) sim.knockDown(p, t.ax * 150, t.ay * 150, 1.6);
      }
    }
    if (t.jet <= 0) { t.state = 'spent'; t.stage = Math.max(t.stage, 2); }
  }
}

function detonate(sim, t) {
  t.state = 'boom'; t.dmg = 1; t.stage = 3; t.boomT = sim.time;
  const ev = sim.event, R = 95;
  burst(sim, D.METAL, 12, t.x, t.y, 0, -1, 150, 1.1); burst(sim, D.CHIP, 8, t.x, t.y, 0, -1, 110, 1);
  puff(sim, t.x, t.y, 1, 2.6); puff(sim, t.x + 8, t.y - 6, 1, 2); puff(sim, t.x - 8, t.y + 4, 0, 1.6);
  sim.ev('wreck'); sim.ev('crash', 140);
  let n = 0;
  const P = sim.player;
  for (const c of sim.cars) {
    const dx = c.x - t.x, dy = c.y - t.y, d = Math.hypot(dx, dy), reach = R + c.len / 2;
    if (d > reach || c.wreck) continue;
    const f = 1 - d / reach, own = P.mode === 'car' && P.car === c;
    hitCar(sim, c, (0.25 + 0.6 * f) * (own ? 0.4 : 1), dx / (d || 1), dy / (d || 1), 'player'); n++;
  }
  for (const th of sim.things.slice()) {
    if (th === t || th.stage >= 3) continue;
    const dx = th.x - t.x, dy = th.y - t.y, d = Math.hypot(dx, dy), reach = R + th.r;
    if (d > reach) continue;
    if (th.evAnchor && th.kind === 'drum') { if (th.state === 'intact') { th.state = 'fuse'; th.fuse = 0.3; } continue; }   // the next drum goes up
    if (th.evAnchor) { hitThing(sim, th, 0.5, dx, dy, 'player', 0); continue; }
    hitThing(sim, th, 0.35 + 0.65 * (1 - d / reach), dx / (d || 1), dy / (d || 1), 'player', 0); n++;
  }
  for (const p of sim.peds) {
    if (p.hidden || p === P.ped || p.mode === 'down') continue;
    const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy);
    if (d < R) sim.knockDown(p, dx / (d || 1) * 230, dy / (d || 1) * 230, 2.4);
  }
  if (ev) { ev.blasts = (ev.blasts || []); ev.blasts.push({ x: t.x, y: t.y, t: 0 }); }
  report(sim, t.x, t.y, 300, 0, 'player', 'DOMINO BLAST');
  if (n >= 3 && ev) { ev.domino++; sim.ev('vox_evt_wreck_domino'); sim.say('DOMINO ×' + n, 1.6); }
  bigBreak(sim, true);
}

function bigBreak(sim, force) {
  const ev = sim.event;
  if (!force && ev && sim.time - ev.lastStop < 0.35) return;
  if (ev) ev.lastStop = sim.time;
  sim.hitStopT = Math.max(sim.hitStopT || 0, 0.05);            // 50 ms = 3 ticks
  sim.punchZoom = 1;                                           // main.js: the 2D zoom-punch
}

// destruct.report() lands here for every player-caused break while an event runs
function eventBreak(sim, x, y, pts, severity, label) {
  const ev = sim.event;
  if (!ev || ev.kind !== 'wreck' || ev.count > 0 || pts <= 0) return;
  const E = EVENTS.wreck;
  const inside = Math.hypot(x - E.site[0], y - E.site[1]) < E.radius;
  if (inside && sim.time - ev.lastBreak <= E.window) ev.chain = Math.min(8, ev.chain + 1); else ev.chain = 1;
  ev.lastBreak = sim.time; ev.n++;
  if (!inside) { ev.chain = 1; ev.pts += pts; return; }
  const gain = pts * ev.chain;
  sim.score = (sim.score || 0) + pts * (ev.chain - 1);          // report() already banked the base points
  ev.pts += gain; sim.lastTrick = { name: ev.chain > 1 ? `${label} · CHAIN ×${ev.chain}` : label, pts: gain, t: 1.2, mult: 1 };
  if (ev.chain > ev.maxChain) { ev.maxChain = ev.chain; if (ev.chain === 5) sim.ev('vox_evt_wreck_chain_5x'); }
  if (severity >= 2 || ev.chain >= 3) bigBreak(sim, false);
}

function stepWreck(sim, ev, dt) {
  const E = EVENTS.wreck, P = sim.player;
  if (ev.count > 0) { ev.count -= dt; sim.say(ev.count > 2 ? 'WRECK IT — 3' : ev.count > 1 ? 'WRECK IT — 2' : ev.count > 0 ? 'WRECK IT — 1' : 'GO!', 1); if (ev.count <= 0) { ev.count = 0; sim.say('GO!', 1.2); } return; }
  ev.timer -= dt;
  if (ev.chain > 1 && sim.time - ev.lastBreak > E.window) { ev.chain = 1; ev.deaths++; }      // the combo dies when you stop breaking things
  if (!ev.warned && ev.timer <= 10) { ev.warned = true; sim.ev('vox_evt_wreck_10s'); sim.say('10 SECONDS', 1.4); }
  // a car through an anchor sets it off
  if (P.mode === 'car') {
    const c = P.car, sp = Math.abs(c.v);
    if (sp > 50) for (const t of sim.things) {
      if (!t.evAnchor || t.state !== 'intact') continue;
      if (Math.hypot(t.x - c.x, t.y - c.y) < c.len / 2 + t.r) { hitThing(sim, t, 0.5, Math.cos(c.h) * Math.sign(c.v), Math.sin(c.h) * Math.sign(c.v), 'player', sp); c.v *= 0.82; sim.ev('crash', sp); }
    }
  }
  if (ev.timer <= 0) {
    const M = E.medals, gold = ev.pts >= M[2];
    if (gold) sim.ev('vox_evt_wreck_gold');
    endEvent(sim, "TIME — " + ev.pts.toLocaleString() + ' PTS', true, { chain: ev.maxChain, domino: ev.domino });
  }
}

// ---------------------------------------------------------------- VALET
// angle between the car's axis and the bay's axis, either end first (parking nose-in or tail-in)
export function bayAlign(c, b) { return Math.abs(wrap((c.h - b.ax) * 2) / 2); }
// all four car corners inside the stall
export function inBay(c, b) {
  const ca = Math.cos(c.h), sa = Math.sin(c.h), ba = Math.cos(b.ax), bs = Math.sin(b.ax);
  for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const px = c.x + ca * su * c.len / 2 - sa * sv * c.wid / 2 - b.x, py = c.y + sa * su * c.len / 2 + ca * sv * c.wid / 2 - b.y;
    const u = px * ba + py * bs, v = -px * bs + py * ba;
    if (Math.abs(u) > b.l / 2 || Math.abs(v) > b.w / 2) return false;
  }
  return true;
}

function stepValet(sim, ev, dt) {
  const c = ev.car, P = sim.player, E = EVENTS.valet;
  if (P.mode !== 'car' || P.car !== c) { endEvent(sim, 'VALET OVER', ev.n > 0, { bays: ev.n }); return; }
  // yaw history over the last 2 s: the J-turn / slide detectors (the car is kinematic — no slip angle — so the whip is read from yaw swing)
  ev.yaw += wrap(c.h - ev.lastH); ev.lastH = c.h;
  ev.hist.push([sim.time, ev.yaw, Math.abs(c.v)]);
  while (ev.hist.length && sim.time - ev.hist[0][0] > 2) ev.hist.shift();
  let swing = 0, peak = 0;
  for (const [t, y, v] of ev.hist) { peak = Math.max(peak, v); if (sim.time - t <= 1.1) swing = Math.max(swing, Math.abs(ev.yaw - y)); }
  if (swing >= 2.356 && peak >= 180) ev.jt = sim.time;                      // 135° inside 1.1 s from ≥180 u/s
  else if (swing >= 0.87 && peak >= 100) ev.drt = sim.time;                 // a 50° whip at speed: the power-slide
  if (ev.count > 0) { ev.count -= dt; if (ev.count <= 0) { ev.count = 0; sim.say('PARK IT!', 1.2); } return; }
  ev.timer -= dt; ev.bayT += dt;
  if (ev.timer <= 0) { endEvent(sim, 'OUT OF TIME', ev.n > 0, { bays: ev.n }); return; }
  const b = ev.bays[ev.idx];
  ev.align = bayAlign(c, b); ev.inBay = inBay(c, b);
  if (!ev.scraped && c.dmg - ev.dmg0 > 0.004) { ev.scraped = true; sim.ev('vox_evt_valet_scrape'); sim.say('SCRAPE — MINT BONUS GONE', 1.6); }
  if (ev.inBay && ev.align <= 0.436 && Math.abs(c.v) < 15) ev.settle += dt; else ev.settle = 0;     // ±25° to lock, ±14° is clean
  if (ev.settle < 0.45) return;
  // locked: score the bay
  const clean = ev.align <= 0.245, jt = sim.time - ev.jt < 2.5, sl = sim.time - ev.drt < 2.5;
  const mult = jt ? 5 : sl ? 2.5 : 1, mint = clean && !ev.scraped;
  const spare = Math.max(0, Math.floor(E.split - ev.bayT));
  const total = Math.round(200 * mult) + (mint ? 300 : 0) + spare * 20;
  pay(sim, total, (jt ? 'J-TURN PARK! 5×' : sl ? 'POWER-SLIDE PARK 2.5×' : clean ? 'PARKED' : 'SLOPPY PARK') + (mint ? ' · MINT' : ''), 2.2);
  ev.pts += total; ev.n++; b.done = true; if (mint) ev.mint++; if (jt) ev.jturns++;
  ev.lastMult = mult; ev.lastClean = clean;
  if (jt) { sim.ev('vox_evt_valet_jturn'); sim.hitStopT = Math.max(sim.hitStopT || 0, 0.12); sim.punchZoom = 1; burst(sim, D.TIRE, 8, c.x, c.y, -Math.cos(c.h), -Math.sin(c.h), 90, 1); puff(sim, c.x, c.y, 0, 1.8); }
  else if (sl) sim.ev('vox_evt_valet_drift'); else if (mint) sim.ev('vox_evt_valet_mint');
  ev.idx++; ev.bayT = 0; ev.settle = 0; ev.dmg0 = c.dmg; ev.scraped = false; ev.jt = ev.drt = -9;
  if (ev.idx >= ev.bays.length) { sim.ev('vox_evt_valet_complete'); endEvent(sim, 'VALET COMPLETE', true, { bays: ev.n, mint: ev.mint, jturns: ev.jturns }); return; }
  ev.spot = [ev.bays[ev.idx].x, ev.bays[ev.idx].y];
}

// ---------------------------------------------------------------- step (sim.step calls this every tick)
// walk away from the running event (used by JUMP); points already banked stay banked
export function quitEvent(sim) { const ev = sim.event; if (ev) endEvent(sim, ev.name + ' OVER', false, ev.kind === 'valet' ? { bays: ev.n } : undefined); }

export function stepEvents(sim, dt) {
  if (sim.eventResult) { sim.eventResult.t -= dt; if (sim.eventResult.t <= 0) sim.eventResult = null; }
  const ev = sim.event;
  if (!ev) return;
  ev.t += dt;
  if (sim.busted && ev.kind === 'chase') { endEvent(sim, 'BOARD CHASE — BUSTED', false, { cp: ev.idx, of: 4 }); return; }
  if (sim.busted) { if (ev.kind === 'wreck') sim.ev('vox_evt_wreck_busted'); endEvent(sim, ev.kind === 'wreck' ? 'BUSTED — ' + ev.pts.toLocaleString() + ' PTS KEPT' : 'VALET — BUSTED', false); return; }
  if (ev.car && ev.car.wreck && ev.kind === 'valet') { endEvent(sim, 'VALET — CAR WRECKED', false, { bays: ev.n }); return; }
  if (ev.kind === 'chase') stepChase(sim, ev, dt, (text, ok, extra) => endEvent(sim, text, ok, extra), (pts, label) => pay(sim, pts, label, 2));
  else if (ev.kind === 'wreck') stepWreck(sim, ev, dt); else stepValet(sim, ev, dt);
}
