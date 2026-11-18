// main.js — Laurel/Fulton sample boot: load the real road graph, the roster, the fleet; drive Brad's Camaro
// from Ledo Pizza on Palm City's touch controls (floating stick left half, keyboard arrows/WASD; hold F = turbo).
//   ?cam=x,y[,zoom]  static camera (captures)      ?spawn=x,y,heading   start elsewhere      ?model=<fleet id>
import { GraphWorld } from './world_graph.js';
import { LFSim } from './lf_sim.js';
import { GroundPainter, CHUNK } from './lf_ground.js';
import { Renderer } from './lf_render.js';
import { Input } from '../../palm-city/src/input.js';
import { Areas, poly } from './lf_areas.js';
import { players, startRally, stepRally } from './lf_mission.js';
import { KingOfTheHill } from './lf_koth.js';
import { setFx, setFoot, setFootProject } from './lf_fx.js';
import { Roof, stepOnFoot, lookout, project } from './lf_climb.js';
import { RoofView } from './lf_roof.js';
import { learnLabel } from '../../palm-city/src/labels.js';
import { createFoot, stepFoot, exitCar, nearCar, FOOT } from './lf_foot.js';
import { Pilot } from './lf_pilot.js';
import { Net } from './lf_net.js';
import { Interior } from './lf_interior.js';
import { InteriorRenderer } from './lf_interior_render.js';

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const VIEW_W = 420, view = { w: VIEW_W, h: 860 };
let DPR = 1, renderer = null;
function resize() {
  const iw = innerWidth, ih = innerHeight;
  view.h = Math.round(Math.max(640, Math.min(1000, VIEW_W * ih / iw)));
  const sc = Math.min(iw / VIEW_W, ih / view.h);
  DPR = Q.has('dpr') ? Number(Q.get('dpr')) : Math.min(2, Math.max(1, (devicePixelRatio || 1) * sc));
  canvas.width = Math.round(VIEW_W * DPR); canvas.height = Math.round(view.h * DPR);
  canvas.style.width = Math.round(VIEW_W * sc) + 'px'; canvas.style.height = Math.round(view.h * sc) + 'px';
  if (renderer) renderer.resize(VIEW_W, view.h, DPR);
}
addEventListener('resize', resize); resize();
const msg = (t) => { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#1b1430'; ctx.fillRect(0, 0, VIEW_W, view.h); ctx.fillStyle = '#ffe4b0'; ctx.font = '800 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText(t, VIEW_W / 2, view.h / 2); };
msg((document.title || 'LAUREL / FULTON').toUpperCase() + ' — loading the real roads…');   // any factory city: its own name (play.html <title>)
const j = async (f) => { const r = await fetch(f); if (!r.ok) throw new Error(f + ' failed to load (' + r.status + ')'); return r.json(); };
// LOAD SPLIT (Moth, Nov 17 — the owner's phone said "doesn't load"): boot used to await EVERYTHING —
// 6.1 MB of JSON, every sprite, the roof, the interiors — before the first frame. Phase 1 is now only
// what the pick screen needs (roads, crew, cars, bumps); the heavy houses file (areas.json, 2.3 MB),
// the roof and the interiors stream in behind it and land when they land. The loading message names
// each file as it arrives, so a stall shows exactly where it stopped instead of looking dead.
const TITLE = (document.title || 'LAUREL / FULTON').toUpperCase(), got = [];
const tick = (what) => { got.push(what); msg(TITLE + ' — loading… ' + got.join(' · ')); };
const [G, roster, fleet, BJ] = await Promise.all([
  j('data/graph.min.json').catch(() => j('data/graph.json')).then(v => (tick('roads'), v)),   // the packed graph (tools/graph_pack.py), 24% smaller
  j('data/roster.json').then(v => (tick('crew'), v)),
  j('assets/fleet.json').then(v => (tick('cars'), v)),
  j('data/bumps.json').then(v => (tick('bumps'), v)),
]);
const files = new Set(); for (const m of Object.values(fleet)) for (const k of ['color', 'shadow']) files.add(m[k].file);   // the 'light' sheets are never drawn: not loaded (11 fewer files at boot)
const imgs = {};
const BLANK = new Image(); BLANK.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
await Promise.all([...files].map(async (f) => { const im = new Image(); im.src = 'assets/' + f; try { await im.decode(); imgs[f] = im; } catch (e) { imgs[f] = BLANK; } }));   // a bad sprite must not kill the game
const W = new GraphWorld(G);
let areas = new Areas({ buildings: [], parking: [], green: [], heroes: [] }, W);   // real areas land in phase 2
const ground = new GroundPainter(W, 64, areas, BJ.bumps);
const opts = { bumps: BJ.bumps };   // buildings arrive with areas.json in phase 2 -> sim.setBuildings
if (Q.get('spawn')) { const [x, y, h] = Q.get('spawn').split(',').map(Number); opts.spawn = { x, y }; opts.h = h || 0; }
if (Q.get('model')) opts.model = Q.get('model');
const sim = new LFSim(W, roster, fleet, opts);
if (!opts.spawn) {                                       // Ledo Pizza: face out of the lot, toward the way to Brad's
  const pa = Object.entries(G.anchors), r = pa.length > 1 ? W.route(pa[0][1].v, pa[pa.length - 1][1].v) : null;   // face out of the lot toward the first house
  if (r && r.pts.length > 3) sim.player.h = Math.atan2(r.pts[3][1] - r.pts[0][1], r.pts[3][0] - r.pts[0][0]);
}
renderer = new Renderer(ctx, W, ground, fleet, imgs, areas);
let RF = null;   // the roof lands in phase 2
// ---- task L7: walk-in interiors (data/interiors/<id>.json, tools/interior_build.py). A run as someone with one STARTS inside.
const KITS = {};   // interiors land in phase 2
let KOTH = null;   // Cul-de-Sac King of the Hill lands in phase 2 with its data
// ---- phase 2: the heavy/optional data streams in behind the pick screen (see LOAD SPLIT above)
(async () => {
  j('data/areas.json').then(AJ => {
    areas = new Areas(AJ, W); ground.areas = areas; ground.cache.clear(); ground.job = null;
    if (renderer) renderer.areas = areas;
    sim.setBuildings(AJ.buildings); mapCv = null; tick('houses');
  }).catch(e => { if (globalThis.showErr) showErr('houses failed to load: ' + e.message); });
  fetch('data/roof.json').then(r => r.ok ? r.json() : null).then(RJ => { if (RJ) { RF = new Roof(RJ); renderer.roof = new RoofView(RF); setFootProject((x, y, z) => project(x, y, z, cam)); } }).catch(() => {});   // task L5: a city without a climbable roof just has none
  j('data/culdesacs.json').then(sacs => { KOTH = new KingOfTheHill(sacs); }).catch(() => {});
  const ids = await fetch('data/interiors/index.json').then(r => r.ok ? r.json() : []).catch(() => []);
  for (const id of ids) { try { KITS[id] = await j('data/interiors/' + id + '.json'); } catch (e) {} }
})();
let inside = null; const IR = new InteriorRenderer(ctx);
const goIn = (id, who) => { inside = new Interior(KITS[id], { who }); if (foot) foot.active = false; };
const goOut = () => {                                     // out the front door: on foot on the front walk, your car in the driveway
  inside = null; const me = PLAYERS.find(p => foot && p.id === foot.who.id) || foot.who, [hx, hy] = me.house, c = sim.player;
  foot.active = true; foot.x = hx + (c.x - hx) * 0.35; foot.y = hy + (c.y - hy) * 0.35; foot.h = Math.atan2(c.y - hy, c.x - hx); foot.px = foot.x; foot.py = foot.y; foot.z = 0;
  cam.x = foot.x; cam.y = foot.y;
};
const atMyDoor = () => foot && foot.active && !(foot.z > 4) && KITS[foot.who.id] && foot.who.house && Math.hypot(foot.x - foot.who.house[0], foot.y - foot.who.house[1]) < 90;
// (the roof wiring lives in phase 2 below — it lands with roof.json)
setFx(sim, roster);
// ---- task L2: PICK YOUR PLAYER -> RALLY THE CREW (lf_mission.js). ?free = just drive; ?player=<id> skips the pick.
const PLAYERS = players(roster);
let M = null, foot = null, picking = !Q.has('free') && !Q.has('cam') && !Q.has('map');
let pilot = null;
// ---- task L6: THE ONE WORLD. ?server=wss://<host>&key=<invite key>: open world, everyone else is CPU or a friend (lf_net.js)
const net = Q.get('server') && Q.get('key') ? new Net(Q.get('server'), Q.get('key')) : null;
if (net) net.onYou = (id, st) => {                        // take over that crew member IN PLACE, exactly as the CPU left them
  const mine = sim.cars.find(c => c.owner === id); sim.cars = sim.cars.filter(c => c !== sim.player);
  sim.player = mine; mine.player = true; mine.remote = false; Object.assign(mine, st); mine.parked = false;
  picking = false; foot = createFoot(PLAYERS.find(p => p.id === id)); setFoot(foot); renderer.mission = null;
  cam.x = mine.x; cam.y = mine.y;                         // cut straight to them (they may be anywhere in the world)
};
function pick(id) { if (net) { if (!net.takenBy(id)) net.pick(id); return; }
  M = startRally(sim, roster, id); renderer.mission = M; picking = false; foot = createFoot(PLAYERS.find(p => p.id === id)); setFoot(foot);
  if (KITS[id] && !Q.has('pilot')) goIn(id, foot.who);   // PICK Brad -> you start in his house
  foot.onClimb = (c) => { learnLabel(sim, 'lf_roof'); if (c.onto === 'roof' && !foot.summited && M) { foot.summited = true; M.msg = 'THE LOOKOUT'; M.msgT = 3.5; } }; if (Q.has('pilot')) pilot = new Pilot(sim, W, M); startIntro(); }
// the opening (owner, Nov 17): the game starts zoomed out on the WHOLE MAP, then
// flies in to the picked person's house. Any tap skips it. Captures (?speed/?cam/
// ?pilot) and ?nointro skip it so their framing stays deterministic, and so does
// a pick that starts indoors (L7: Brad's house — you begin in the cutaway).
let intro = null;
function startIntro() {
  if (inside || Q.has('cam') || Q.has('pilot') || Q.has('speed') || Q.has('nointro')) return;   // NOT `fixed`: pick() can run before that const exists
  intro = { t: 0, dur: 3.0, x1: sim.player.x, y1: sim.player.y, z1: 0.62 };   // from = the camera's spot on the first frame (pick() can run before cam exists)
}
canvas.addEventListener('pointerdown', () => { if (intro) intro.t = intro.dur; });
if (Q.get('player')) pick(Q.get('player'));
const pickRows = () => PLAYERS.map((p, i) => ({ p, x: 24, y: 150 + i * 62, w: VIEW_W - 48, h: 54 }));
canvas.addEventListener('pointerdown', e => {
  if (!picking) return;
  const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * VIEW_W / b.width, y = (e.clientY - b.top) * view.h / b.height;
  const r = pickRows().find(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  if (r) { pick(r.p.id); e.stopPropagation(); }
}, { capture: true });
addEventListener('keydown', e => { if (picking && /^Digit[1-9]$/.test(e.code)) { const p = PLAYERS[+e.code.slice(5) - 1]; if (p) pick(p.id); } });
function drawPick() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = 'rgba(20,12,32,0.86)'; ctx.fillRect(0, 0, VIEW_W, view.h);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd25c'; ctx.font = '900 30px system-ui'; ctx.fillText('PICK YOUR PLAYER', VIEW_W / 2, 70);
  ctx.fillStyle = '#e8dcc8'; ctx.font = '600 13px system-ui'; ctx.fillText(net ? `the one world · ${net.status}` : 'then rally the crew — meet at ' + roster.meetup.name, VIEW_W / 2, 98);
  pickRows().forEach(({ p, x, y, w, h }, i) => {
    ctx.fillStyle = 'rgba(255,241,216,0.94)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
    const m = fleet[p.car.sprite], im = imgs[m.color.file], fw = im.width / m.cols, fh = im.height / Math.ceil(m.angles / m.cols);
    ctx.drawImage(im, 0, 0, fw, fh, x + 4, y + 4, h - 8, h - 8);                   // the car itself, side on (frame 0 = facing east)
    ctx.textAlign = 'left'; ctx.fillStyle = '#2a1430'; ctx.font = '900 17px system-ui'; ctx.fillText(`${i + 1}  ${p.name}`, x + h + 4, y + 22);
    ctx.font = '600 12px system-ui'; ctx.fillStyle = '#5a3c58'; ctx.fillText(`${p.car.model} · ${p.street}`, x + h + 4, y + 41);
    const tb = net && net.takenBy(p.id); if (tb || net) { ctx.textAlign = 'right'; ctx.font = '800 11px system-ui'; ctx.fillStyle = tb ? '#b8402a' : '#4a7a3a'; ctx.fillText(tb ? 'DRIVEN BY ' + tb.toUpperCase() : 'CPU — TAKE OVER', x + w - 10, y + 22); }
  });
}
function drawMissionHud() {
  if (!M) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const n = M.convoy.length, total = M.convoy.length + M.stops.filter(s => !s.done).reduce((a, s) => a + s.people.length, 0);
  ctx.textAlign = 'left'; ctx.font = '900 13px system-ui'; ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(12, 74, 150, 26, 12); ctx.fill();
  ctx.fillStyle = '#ffd25c'; ctx.fillText(M.complete ? 'CREW ASSEMBLED' : `CREW ${n + 1}/${total + 1}`, 24, 92);
  if (M.msgT > 0) { ctx.textAlign = 'center'; ctx.font = '900 22px system-ui'; ctx.fillStyle = 'rgba(27,20,48,0.7)'; const w = ctx.measureText(M.msg).width + 30; ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - w / 2, view.h * 0.22 - 24, w, 38, 14); ctx.fill(); ctx.fillStyle = '#ffe4b0'; ctx.fillText(M.msg, VIEW_W / 2, view.h * 0.22 + 2); }
  // the edge arrow: nearest pickup, then the school
  if (M.complete || M.beat) return;
  const c = sim.player, todo = M.stops.filter(s => !s.done);
  const tgt = todo.length ? todo.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0] : { x: M.meet.pos[0], y: M.meet.pos[1], people: [{ name: M.meet.name }] };
  const dx = tgt.x - cam.x, dy = tgt.y - cam.y, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
  if (d * cam.zoom < VIEW_W * 0.45) return;
  const rx = VIEW_W / 2 + Math.cos(a) * (VIEW_W / 2 - 36), ry = view.h / 2 + Math.sin(a) * (view.h / 2 - 90);
  ctx.save(); ctx.translate(rx, ry); ctx.rotate(a); ctx.fillStyle = '#ffd25c'; ctx.strokeStyle = '#2a1430'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, 11); ctx.lineTo(-4, 0); ctx.lineTo(-10, -11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.textAlign = 'center'; ctx.font = '800 11px system-ui'; ctx.fillStyle = '#fff1d8'; ctx.fillText(`${tgt.people.map(p => p.name.split(' ')[0]).join(' + ')} · ${(d / 10 / 1609).toFixed(1)} mi`, rx, ry + 26);
} renderer.resize(VIEW_W, view.h, DPR);
const input = new Input(canvas, view); input.fightOn = true;
const fixed = Q.get('cam') ? Q.get('cam').split(',').map(Number) : null;
const B0 = W.bounds, fitZ = Math.min(VIEW_W / (B0.x1 - B0.x0), view.h / (B0.y1 - B0.y0)) * 0.98;
const cam = fixed ? { x: fixed[0], y: fixed[1], zoom: fixed[2] || 1 }
  : (picking || Q.get('player')) && !Q.has('speed') && !Q.has('pilot') && !Q.has('nointro')
    ? { x: (B0.x0 + B0.x1) / 2, y: (B0.y0 + B0.y1) / 2, zoom: fitZ }   // open on the whole map
    : { x: sim.player.x, y: sim.player.y, zoom: 0.62 };   // owner Nov 17: zoom out, more world
// WORLD PULSE (owner, Nov 17): while driving, every so often the camera eases
// FAR out (~0.14 — about 300 m across) to show the world, holds, then eases
// back to the normal chase zoom. Skipped for captures, beats, foot and intro.
const PULSE = { far: 0.14, out: 3.0, hold: 3.0, back: 3.0, rest: 27.0 };
let pulseT = -PULSE.rest;
for (let cy = -2; cy <= 2; cy++) for (let cx = -1; cx <= 1; cx++) ground.get(Math.floor(cam.x / CHUNK) + cx, Math.floor(cam.y / CHUNK) + cy);
ground.stats.sync = 0;
const STEP = 1 / 60; let SPEED = Math.max(1, Math.min(16, Number(Q.get('speed')) || 1)); let acc = 0, last = performance.now();   // ?speed=N: N sim steps per frame (captures)
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; acc += dt * SPEED;   // dt clamped at 0 too: a rAF timestamp can predate the module-eval performance.now() (startup clock skew sent the intro's t negative and the zoom with it)
  let n = 0;
  if (pilot && M && M.complete) pilot = null;            // the autopilot's job ends at the finish: the stick is yours again
  while (acc >= STEP && n < 6 * SPEED) { const inp = pilot ? (input.read(), pilot.input(STEP)) : input.read(); if (picking) { acc = 0; break; }
    const beat = (M && M.beat) || intro, ZERO = { jx: 0, jy: 0, jm: 0, keys: {} };
    if (inside) { sim.step(STEP, ZERO); if (inside.step(STEP, inp) === 'exit') goOut(); }
    else if (foot && foot.active) { sim.step(STEP, ZERO); if (!beat) { stepOnFoot(foot, STEP, inp, RF); if (inp.action && nearCar(foot, sim.player)) foot.active = false; else if (inp.action && atMyDoor()) goIn(foot.who.id, foot.who); } }
    else { sim.step(STEP, beat ? ZERO : inp); if (foot && !beat && !pilot && inp.action && Math.abs(sim.player.v) < FOOT.exitV) exitCar(foot, sim.player); }
    if (KOTH) KOTH.step(sim, STEP); if (M) stepRally(sim, M, STEP); acc -= STEP; n++; }
  if (n >= 6 * SPEED) acc = 0;
  if (net) net.frame(sim, dt);
  const c = sim.player;
  let tx = c.x + Math.cos(c.h) * c.v * 0.42, ty = c.y + Math.sin(c.h) * c.v * 0.42, tz = 0.62 - Math.min(0.10, Math.abs(c.v) / 290 * 0.10);   // Palm City's chase framing, pulled back (owner Nov 17: zoom out — ~68 m across instead of ~42)
  if (M && M.beat) { tx = M.beat.cx; ty = M.beat.cy; } if (M) tz *= M.camZoom;      // the arrival beat: push in on the huddle
  if (foot && foot.active && !fixed) {                   // on foot: follow the walker, closer in
    tx = foot.x; ty = foot.y; tz = foot.climb ? 1.1 : 1.8;   // on foot (owner, Nov 17): 20% closer than the old 1.5
    if (RF && foot.z >= RF.h - 2 && !foot.air && !foot.climb) { const L = lookout(foot, RF, sim, M, view); tx = L.x; ty = L.y; tz = L.zoom; }   // L5: up top, the closing shot
  }
  if (fixed) { tx = fixed[0]; ty = fixed[1]; tz = fixed[2] || 1; }
  const pulseOK = !fixed && !(foot && foot.active) && !intro && !pilot && !Q.has('speed') && !(M && M.beat);
  if (pulseOK) { pulseT += dt; if (pulseT > PULSE.out + PULSE.hold + PULSE.back) pulseT = -PULSE.rest; }
  if (pulseOK && pulseT >= 0) {
    const p = pulseT, u = p < PULSE.out ? p / PULSE.out : p < PULSE.out + PULSE.hold ? 1 : 1 - (p - PULSE.out - PULSE.hold) / PULSE.back;
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    tz = tz + (PULSE.far - tz) * e;
  }
  if (intro) {
    if (intro.x0 === undefined) { intro.x0 = cam.x; intro.y0 = cam.y; intro.z0 = cam.zoom; }
    intro.t += dt; const u = Math.min(1, intro.t / intro.dur), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    cam.x = intro.x0 + (intro.x1 - intro.x0) * e; cam.y = intro.y0 + (intro.y1 - intro.y0) * e; cam.zoom = intro.z0 + (intro.z1 - intro.z0) * e;
    if (u >= 1) intro = null;
  } else {
    const k = fixed ? 1 : 1 - Math.exp(-dt * 3.2);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.zoom += (tz - cam.zoom) * (fixed ? 1 : 1 - Math.exp(-dt * 1.5));
  }
  if (inside) { IR.draw(inside, VIEW_W, view.h, DPR, now / 1000); drawControls(); requestAnimationFrame(frame); return; }
  renderer.draw(sim, cam, now / 1000);
  // Cul-de-Sac King of the Hill: the ring, the crown, the banner (screen space, over the world).
  // In idle the ring of the cul-de-sac you're sitting in shows DIM — it never starts itself.
  const ringSac = KOTH && KOTH.state !== 'done' ? (KOTH.state === 'idle' ? (KOTH.candidate ? KOTH.candidate(sim) : null) : KOTH.sac) : null;
  if (KOTH && ringSac) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sc = ringSac, cxp = (sc.x - cam.x) * cam.zoom + VIEW_W / 2, cyp = (sc.y - cam.y) * cam.zoom + view.h / 2, rp = sc.r * cam.zoom;
    ctx.beginPath(); ctx.arc(cxp, cyp, rp, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,210,92,0.07)'; ctx.fill();
    ctx.strokeStyle = KOTH.state === 'round' ? 'rgba(255,90,60,0.95)' : KOTH.state === 'count' ? 'rgba(255,210,92,0.95)' : 'rgba(255,210,92,0.45)'; ctx.lineWidth = 4; ctx.setLineDash([14, 8]); ctx.stroke(); ctx.setLineDash([]);
  }
  if (KOTH && KOTH.state === 'done' && KOTH.winner && KOTH.crownT > 0) {
    const wc = KOTH.winner;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.font = '26px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('👑', (wc.x - cam.x) * cam.zoom + VIEW_W / 2, (wc.y - cam.y) * cam.zoom + view.h / 2 - 30);
  }
  const kb = KOTH && KOTH.banner();
  if (kb) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.textAlign = 'center'; let fs = 20; ctx.font = `900 ${fs}px system-ui`; let w = ctx.measureText(kb).width + 30; if (w > VIEW_W - 16) { fs = Math.max(13, Math.floor(fs * (VIEW_W - 16) / w)); ctx.font = `900 ${fs}px system-ui`; w = ctx.measureText(kb).width + 30; } ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - w / 2, view.h * 0.22 - 24, w, 38, 14); ctx.fill(); ctx.fillStyle = '#ffd25c'; ctx.fillText(kb, VIEW_W / 2, view.h * 0.22 + 2); }
  // HUD: the real street under you + speed (≤ 15% of the screen)
  const r = W.roadInfo(c.x, c.y, c.layer), name = r.e && r.d < r.hw + 30 ? (r.e.name || r.e.ref || '') : '';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.textAlign = 'center';
  if (name) { ctx.font = '800 15px system-ui'; const w = ctx.measureText(name).width + 28; ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - w / 2, 18, w, 30, 15); ctx.fill(); ctx.fillStyle = '#ffe4b0'; ctx.fillText(name, VIEW_W / 2, 38); }
  if (!(foot && foot.active)) { ctx.font = '800 13px system-ui'; ctx.fillStyle = 'rgba(255,240,215,0.9)'; ctx.fillText(Math.round(Math.abs(c.v) / 10 * 2.237) + ' mph', VIEW_W / 2, 64); }
  // prefetch: the view + a margin + where the car will be in ~1.2 s, nearest first
  const hw = VIEW_W / 2 / cam.zoom + 320, hh = view.h / 2 / cam.zoom + 320, want = [];
  for (const [px, py] of [[cam.x, cam.y], [c.x + Math.cos(c.h) * c.v * 1.2, c.y + Math.sin(c.h) * c.v * 1.2]])
    for (let cy = Math.floor((py - hh) / CHUNK); cy <= Math.floor((py + hh) / CHUNK); cy++) for (let cx = Math.floor((px - hw) / CHUNK); cx <= Math.floor((px + hw) / CHUNK); cx++) want.push([cx, cy, (cx * CHUNK - cam.x) ** 2 + (cy * CHUNK - cam.y) ** 2]);
  want.sort((a, b) => a[2] - b[2]); ground.request(want.slice(0, 60)); ground.work(Math.min(12, Math.max(3, dt * 120)));
  requestAnimationFrame(frame);
}
// ---- task L10: the whole-area MAP (M key, or the MAP pill top-right): every real road, the footprints, the
// crew's homes and the POIs labelled "corner of X & Y", you as a live arrow. Painted once, then just blitted.
let mapOpen = Q.has('map');
addEventListener('keydown', e => { if (e.code === 'KeyM') mapOpen = !mapOpen; });
canvas.addEventListener('pointerdown', e => { const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * VIEW_W / b.width, y = (e.clientY - b.top) * view.h / b.height; if (x > VIEW_W - 76 && y > 12 && y < 46) { mapOpen = !mapOpen; e.stopPropagation(); } }, { capture: true });
canvas.addEventListener('pointerdown', e => { if (!KOTH || KOTH.state !== 'idle' || picking || mapOpen || inside || (foot && foot.active) || !KOTH.candidate || !KOTH.candidate(sim)) return; const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * VIEW_W / b.width, y = (e.clientY - b.top) * view.h / b.height, kb2 = kothBtnPos(); if (Math.hypot(x - kb2.x, y - kb2.y) <= kb2.r + 8) { KOTH.tryStart(sim); e.stopPropagation(); } }, { capture: true });
addEventListener('keydown', e => { if (e.code === 'KeyK' && KOTH && !inside) KOTH.tryStart(sim); });
let mapCv = null, mapK = 0, mapO = [0, 0];
function buildMap() {
  const B = W.bounds, pad = 40, cw = 840, k = Math.min((cw - pad * 2) / (B.x1 - B.x0), (cw * 1.33 - pad * 2) / (B.y1 - B.y0));
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = Math.round(cw * 1.33); const g = cv.getContext('2d');
  mapK = k; mapO = [pad - B.x0 * k, pad - B.y0 * k];
  g.fillStyle = '#e9dfc9'; g.fillRect(0, 0, cv.width, cv.height);
  g.setTransform(k, 0, 0, k, mapO[0], mapO[1]);
  g.fillStyle = 'rgba(110,150,90,0.35)'; for (const f of areas.A.green) { poly(g, f); g.fill(); }
  g.fillStyle = 'rgba(120,104,110,0.35)'; for (const f of areas.A.buildings) { poly(g, f); g.fill(); }
  const COL = { motorway: '#e0794a', trunk: '#e8924e', primary: '#efb35a', secondary: '#f2cf72', tertiary: '#f5f0dc' };
  for (const pass of [0, 1]) for (const e of W.edges) {
    if (e.hw === 'service') continue; const base = e.hw.replace('_link', '');
    g.strokeStyle = pass ? (COL[base] || '#ffffff') : '#7b6a6e';
    g.lineWidth = (pass ? 0.9 : 1.9) / k * (base === 'residential' || base === 'unclassified' ? 1 : 2);
    g.beginPath(); e.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const h of areas.heroes) {                        // the hero labels: who + the corner
    const x = h.cx * k + mapO[0], y = h.cy * k + mapO[1];
    g.fillStyle = h.kind === 'poi' ? '#e0a040' : '#d9583a'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.lineWidth = 2; g.strokeStyle = '#2a1430'; g.stroke();
    g.font = '800 15px system-ui'; g.textAlign = 'left'; g.fillStyle = '#2a1430'; g.fillText(h.who, x + 10, y - 2);
    g.font = '600 12px system-ui'; g.fillStyle = '#5a3c58'; g.fillText(h.corner, x + 10, y + 13);
  }
  return cv;
}
function drawMap(c) {
  if (!mapCv) mapCv = buildMap();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = 'rgba(20,12,32,0.8)'; ctx.fillRect(0, 0, VIEW_W, view.h);
  const s = Math.min((VIEW_W - 16) / mapCv.width, (view.h - 90) / mapCv.height), w = mapCv.width * s, h = mapCv.height * s, x0 = (VIEW_W - w) / 2, y0 = 60;
  ctx.drawImage(mapCv, x0, y0, w, h);
  const px = x0 + (c.x * mapK + mapO[0]) * s, py = y0 + (c.y * mapK + mapO[1]) * s;
  ctx.save(); ctx.translate(px, py); ctx.rotate(c.h); ctx.fillStyle = '#20a0ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, 6); ctx.lineTo(-4, 0); ctx.lineTo(-7, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.font = '800 16px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe4b0'; ctx.fillText(document.title.toUpperCase() + ' — tap MAP to close', VIEW_W / 2, 40);
}

function kothBtnPos() { return { x: VIEW_W - 72, y: view.h - 232, r: 34 }; }   // the crown button: above ACTION
// Palm City's control graphics (its hud.js), drawn over the world: the stick while
// it is held, the big ACTION button (GET OUT / GET IN), and the A button — TURBO in
// a car (chevrons + the car's turbo charge as the ring), PUNCH on foot (the fist).
function drawControls() {
  if (picking || mapOpen || (!M && !net)) return;
  const g = ctx, TAU2 = Math.PI * 2;
  if (input.stick) { const s2 = input.stick; g.beginPath(); g.arc(s2.bx, s2.by, 56, 0, TAU2); g.fillStyle = 'rgba(255,240,220,0.16)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,240,220,0.55)'; g.stroke(); g.beginPath(); g.arc(s2.kx, s2.ky, 24, 0, TAU2); g.fillStyle = 'rgba(255,240,220,0.5)'; g.fill(); }
  const b = input.button(), onFoot = foot && foot.active;
  const label = inside ? (inside.prompt() || '') : onFoot ? (nearCar(foot, sim.player) ? 'GET IN' : atMyDoor() ? 'GO IN' : '') : (Math.abs(sim.player.v) < FOOT.exitV ? 'GET OUT' : '');
  g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU2); g.fillStyle = input.btnDown ? 'rgba(255,140,90,0.55)' : 'rgba(255,240,220,0.18)'; g.fill();
  g.lineWidth = 3; g.strokeStyle = label ? 'rgba(255,214,120,0.95)' : 'rgba(255,240,220,0.55)'; g.stroke();
  g.beginPath(); g.arc(b.x, b.y, b.r * 0.42, 0, TAU2); g.fillStyle = label ? 'rgba(255,214,120,0.9)' : 'rgba(255,240,220,0.5)'; g.fill();
  if (label) { g.font = '800 13px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff4dc'; g.fillText(label, b.x, b.y - b.r - 12); }
  if (inside) return;                                     // indoors: just the stick and ACTION
  const f = input.fight();
  if (onFoot || inside) {
    const hot = input.fightDown || foot.punchT > 0;
    g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU2); g.fillStyle = hot ? 'rgba(255,110,90,0.6)' : 'rgba(255,240,220,0.16)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,150,120,0.95)'; g.stroke();
    g.fillStyle = 'rgba(255,196,170,0.95)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(f.x - 9 + i * 6, f.y - 5, 3.6, 0, TAU2); g.fill(); }
    g.fillRect(f.x - 12, f.y - 4, 24, 12); g.beginPath(); g.arc(f.x - 12, f.y + 3, 4, 0, TAU2); g.fill();
    g.font = '800 12px system-ui'; g.textAlign = 'center'; g.fillStyle = '#ffe2d4'; g.fillText('PUNCH', f.x, f.y - f.r - 11);
  } else {
    const c = sim.player, hot = (c.turbo || 0) > 0.05;
    g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU2); g.fillStyle = hot ? 'rgba(255,170,60,0.6)' : 'rgba(255,240,220,0.16)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,196,90,0.95)'; g.stroke();
    g.strokeStyle = 'rgba(255,226,150,0.98)'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const dx of [-7, 5]) { g.beginPath(); g.moveTo(f.x + dx - 5, f.y - 10); g.lineTo(f.x + dx + 5, f.y); g.lineTo(f.x + dx - 5, f.y + 10); g.stroke(); }
    g.strokeStyle = 'rgba(255,120,60,0.95)'; g.lineWidth = 3.5;
    g.beginPath(); g.arc(f.x, f.y, f.r + 5, -Math.PI / 2, -Math.PI / 2 + TAU2 * Math.max(0, Math.min(1, c.turbo || 0))); g.stroke();
    g.font = '800 12px system-ui'; g.textAlign = 'center'; g.fillStyle = '#ffe9c4'; g.fillText('TURBO', f.x, f.y - f.r - 11);
  }
  // Cul-de-Sac King of the Hill: the crown button — shown only while you're sitting in a
  // cul-de-sac; the mode starts when YOU press it, never by itself (owner, Nov 17).
  if (!onFoot && KOTH && KOTH.state === 'idle' && KOTH.candidate && KOTH.candidate(sim)) {
    const kb2 = kothBtnPos();
    g.beginPath(); g.arc(kb2.x, kb2.y, kb2.r, 0, TAU2); g.fillStyle = 'rgba(255,240,220,0.18)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,214,120,0.95)'; g.stroke();
    g.beginPath(); g.arc(kb2.x, kb2.y, kb2.r * 0.62, 0, TAU2); g.fillStyle = 'rgba(255,214,120,0.85)'; g.fill();
    g.font = '22px system-ui'; g.textAlign = 'center'; g.fillText('👑', kb2.x, kb2.y + 8);
    g.font = '800 12px system-ui'; g.fillStyle = '#ffe9c4'; g.fillText('KING', kb2.x, kb2.y - kb2.r - 11);
  }
}
const _draw = renderer.draw.bind(renderer);
renderer.draw = (S, cam, t) => {
  _draw(S, cam, t);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.font = '800 13px system-ui'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(VIEW_W - 72, 14, 60, 28, 12); ctx.fill(); ctx.fillStyle = '#ffe4b0'; ctx.fillText('MAP', VIEW_W - 42, 33);
  drawMissionHud();
  if (net) {                                               // L6: who's who — a tag over every car a FRIEND is driving, and the online pill
    ctx.font = '800 12px system-ui'; ctx.textAlign = 'center';
    for (const c of S.cars) if (c.human || (c === S.player && net.me)) {
      const x = (c.x - cam.x) * cam.zoom + VIEW_W / 2, y = (c.y - cam.y) * cam.zoom + view.h / 2 - 30;
      if (x < -40 || x > VIEW_W + 40 || y < -40 || y > view.h + 40) continue;
      const t = c === S.player ? 'YOU' : c.human, w = ctx.measureText(t).width + 16;
      ctx.fillStyle = c === S.player ? 'rgba(255,214,90,0.92)' : 'rgba(110,200,255,0.92)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 13, w, 20, 8); ctx.fill();
      ctx.fillStyle = '#1b1430'; ctx.fillText(t, x, y + 2);
    }
    const on = new Set(net.crew.filter(p => p.human).map(p => p.human)).size;
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(12, 74, 190, 26, 12); ctx.fill();
    ctx.fillStyle = net.status === 'online' ? '#9fe08a' : '#ff9a7a'; ctx.font = '900 12px system-ui';
    ctx.fillText(net.status === 'online' ? `ONE WORLD · ${on} FRIEND${on === 1 ? '' : 'S'} ON` : net.status, 24, 92);
  }
  drawControls();
  if (mapOpen) drawMap(S.player);
  if (picking) drawPick();
};
requestAnimationFrame(frame);
window.__lf = { get areas() { return areas; }, inside: () => inside, setSpeed: (k) => { SPEED = k; }, roof: () => RF, sim, W, ground, cam, input, renderer, map: () => mapOpen, mission: () => M, koth: () => KOTH, pick, picking: () => picking, pilot: () => pilot, foot: () => foot };
