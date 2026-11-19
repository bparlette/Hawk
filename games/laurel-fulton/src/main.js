// main.js — Laurel/Fulton sample boot: load the real road graph, the roster, the fleet; drive Brad's Camaro
// from Ledo Pizza on Palm City's touch controls (floating stick left half, keyboard arrows/WASD; hold F = turbo).
//   ?cam=x,y[,zoom]  static camera (captures)      ?spawn=x,y,heading   start elsewhere      ?model=<fleet id>
import { GraphWorld } from './world_graph.js';
import { LFSim } from './lf_sim.js';
import { GroundPainter, CHUNK } from './lf_ground.js';
import { Renderer } from './lf_render.js';
import { Input } from '../../palm-city/src/input.js';
import { Areas, poly } from './lf_areas.js';
import { players, startRally, stepRally, swapPlayerCar, pushTrail, makeBeat, stepBeat } from './lf_mission.js';
import { KingOfTheHill } from './lf_koth.js';
import { setFx, setFoot, setFootProject, setWalkers } from './lf_fx.js';
import { Roof, stepOnFoot, lookout, project } from './lf_climb.js';
import { RoofView } from './lf_roof.js';
import { learnLabel } from '../../palm-city/src/labels.js';
import { createFoot, stepFoot, exitCar, nearCar, nearAnyCar, FOOT } from './lf_foot.js';
import { Pilot } from './lf_pilot.js';
import { Net } from './lf_net.js';
import { Interior } from './lf_interior.js';
import { InteriorRenderer } from './lf_interior_render.js';
import { Places, PlaceInterior, doorPoint } from './lf_places.js';           // L12/L13: public enterable places (the Weis, Gringada) + the 108 Astro + Scott's Civic
import { PlaceRenderer, heroStyle, worldFx } from './lf_places_render.js';
import { placeVan, mergedSupport, hopLift } from './lf_van.js';        // L7 remainder: David Klink's Scooby-Doo van by Rigg's house (steppable exhaust tip)
import { Barker, bubbleAt } from './lf_riggisms.js';                   // L7 remainder: Rigg-isms (IGURT GOGURT / fuck shit diesel)
import { FakeCop } from './lf_fakecop.js';                               // M-B: Kosack's fake-cop pull-over minigame
import { NightParty } from './lf_party.js';                              // M-C: 100-guest night party (Kosack / Floyds)
import { ValetLots } from './lf_valet.js';                               // Palm City easy win: PARK IT! (Ledo / Weis / Atholton)
import { CurbDestruct } from './lf_destruct.js';                         // Palm City easy win: breakable curbside props + combo
import { Traffic } from './lf_traffic.js';                              // L15: LIGHT ambient traffic on the road graph (AMBIENT_MAX cars)
import { Cops } from './lf_cops.js';                                    // L15: cops / wanted v1 (stars, pursuit, BUSTED, siren)
import { LFHelp } from './lf_help.js';                                   // Palm City easy win: '?' HELP / JUMP quick-teleporter

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const VIEW_W = 420, view = { w: VIEW_W, h: 860 };
const MIN_ZOOM = VIEW_W / 28300;   // HARD CAP (owner, Nov 18): no zoomed-out view is EVER wider than 2,830 m across (10 wu = 1 m) — opening fit, world pulse, every start, every house
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
const LOGO = new Image(); LOGO.src = 'assets/logo-sign.webp';   // the logo (owner, Nov 18): the MD-216 Laurel/Scaggsville exit sign, painted in the game's style
let lastMsg = '';
const msg = (t) => {                                   // the loading screen: the sign logo over the loading line, WRAPPED to the screen
  lastMsg = t;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#1b1430'; ctx.fillRect(0, 0, VIEW_W, view.h); ctx.fillStyle = '#ffe4b0'; ctx.font = '800 17px system-ui'; ctx.textAlign = 'center';
  const lines = []; let cur = ''; for (const w of String(t).split(' ')) { if (ctx.measureText(cur + ' ' + w).width > VIEW_W - 40 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } lines.push(cur);
  let ty = view.h / 2;
  if (LOGO.complete && LOGO.naturalWidth) {            // logo centred, loading line under it
    const lw = Math.min(VIEW_W - 56, 320), lh = lw * LOGO.naturalHeight / LOGO.naturalWidth;
    const ly = Math.max(18, view.h / 2 - lh / 2 - 40);
    ctx.drawImage(LOGO, (VIEW_W - lw) / 2, ly, lw, lh); ty = ly + lh + 36;
  }
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, ty + i * 24));
};
LOGO.addEventListener('load', () => { if (lastMsg) msg(lastMsg); });   // repaint the loading screen the moment the sign arrives
msg((document.title || 'LAUREL / FULTON').toUpperCase() + ' — loading the real roads…');   // any factory city: its own name (play.html <title>)
const j = async (f) => { const r = await fetch(f); if (!r.ok) throw new Error(f + ' failed to load (' + r.status + ')'); return r.json(); };
// LOAD SPLIT (Moth, Nov 17 — the owner's phone said "doesn't load"): boot used to await EVERYTHING —
// 6.1 MB of JSON, every sprite, the roof, the interiors — before the first frame. Phase 1 is now only
// what the pick screen needs (roads, crew, cars, bumps); the heavy houses file (areas.json, 2.3 MB),
// the roof and the interiors stream in behind it and land when they land. The loading message names
// each file as it arrives, so a stall shows exactly where it stopped instead of looking dead.
const TITLE = (document.title || 'LAUREL / FULTON').toUpperCase(), got = [];
const tick = (what) => { got.push(what); msg(TITLE + ' — loading… ' + got.join(' · ')); };
const [G, roster, fleet, BJ, LMJ] = await Promise.all([
  j('data/graph.min.json').catch(() => j('data/graph.json')).then(v => (tick('roads'), v)),   // the packed graph (tools/graph_pack.py), 24% smaller
  j('data/roster.json').then(v => (tick('crew'), v)),
  j('assets/fleet.json').then(v => (tick('cars'), v)),
  j('data/bumps.json').then(v => (tick('bumps'), v)),
  j('data/landmarks.json').catch(() => null).then(v => (v && tick('landmarks'), v)),   // the pick screen's landmark starts; a city without the file (College Park) just offers house starts
]);
// ---- LANDMARK STARTS (owner, Nov 18): the pick screen's second selection — start at a named
// landmark (Weis, Atholton, Gringada, ...) instead of your house. startAt = a landmark id, or
// null = your house (the rally opening, unchanged). ?start=<id> arms one before the pick.
const LANDMARKS = (LMJ && LMJ.landmarks) || [];
let startAt = null;
if (Q.get('start')) { const lm0 = LANDMARKS.find(l => l.id === Q.get('start')); if (lm0) startAt = lm0.id; }
const startLm = () => LANDMARKS.find(l => l.id === startAt) || null;
roster.beats = await fetch('data/beats.json').then(r => r.ok ? r.json() : null).catch(() => null);   // L14: door staging for the arrival beats (Lazaris boots, Grant's mom)
const files = new Set(); for (const m of Object.values(fleet)) for (const k of ['color', 'shadow']) files.add(m[k].file);   // the 'light' sheets are never drawn: not loaded (11 fewer files at boot)
const imgs = {};
const BLANK = new Image(); BLANK.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
await Promise.all([...files].map(async (f) => { const im = new Image(); im.src = 'assets/' + f; try { await im.decode(); imgs[f] = im; } catch (e) { imgs[f] = BLANK; } }));   // a bad sprite must not kill the game
msg(TITLE + ' — building the map…'); await new Promise(r => setTimeout(r, 0));   // paint that line before the heavy setup
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
  const PJP = j('data/places.json').catch(() => null);   // L12/L13: the enterable places (data/places.json)
  Promise.all([j('data/areas.json'), PJP]).then(async ([AJ, PJ]) => {
    if (PJ) { PL = new Places(PJ); AJ.heroes.push(...PL.heroes()); PL.attach(sim); valet.attachPlaces(PL); renderer.heroStyle = heroStyle; renderer.placeFx = (g, S, gr, t, vis) => worldFx(g, S, PL, gr, t, vis); for (const p of PJ.places) { try { KITS[p.interior] = await j('data/interiors/' + p.interior + '.json'); } catch (e) {} } }
    areas = new Areas(AJ, W); ground.areas = areas; ground.cache.clear(); ground.job = null;
    if (renderer) renderer.areas = areas;
    sim.setBuildings(AJ.buildings); sim.setGreens(AJ.green); mapCv = null; tick('houses'); party.build(sim, areas);   // L17: the 100-person crowd needs the footprints
    if (!van) { van = placeVan(sim, 'rigg', inHouse); setFootProject(footProj); }   // L7: the Scooby-Doo van parks by Rigg's house once the footprints are known
  }).catch(e => { if (globalThis.showErr) showErr('houses failed to load: ' + e.message); });
  fetch('assets/ground-tiles/manifest.json').then(r => r.ok ? r.json() : null).then(man => { if (man) ground.setPainted(man); }).catch(() => {});   // the painted ground: tiles stream in lazily from here (lf_ground.js); a city without them just stays procedural
  fetch('data/roof.json').then(r => r.ok ? r.json() : null).then(RJ => { if (RJ) { RF = new Roof(RJ); renderer.roof = new RoofView(RF); setFootProject(footProj); } }).catch(() => {});   // task L5: a city without a climbable roof just has none
  j('data/culdesacs.json').then(sacs => { KOTH = new KingOfTheHill(sacs); }).catch(() => {});
  const ids = await fetch('data/interiors/index.json').then(r => r.ok ? r.json() : []).catch(() => []);
  for (const id of ids) { try { KITS[id] = await j('data/interiors/' + id + '.json'); } catch (e) {} }
  // ?player=<id> picks at module time, BEFORE the kits stream in (the load split): a run as someone with a house kit still STARTS inside — go in the moment the kit lands
  if (pendingIn && KITS[pendingIn] && !inside && !intro && foot && !foot.active && Math.abs(sim.player.v) < 1) {   // !intro: never cut the opening flight short — if it is still flying, frame()'s intro landing takes the player in instead
    // Nov 18 leftover fix: the pending entry only fires while the player is still AT the
    // pending house — a slow Brad driving on past used to get yanked inside the moment the
    // kit landed, however far down the road he had got. Past ~200 wu the flag is dropped.
    const ph = (roster.people.find(p => p.id === pendingIn) || {}).house;
    if (ph && Math.hypot(sim.player.x - ph[0], sim.player.y - ph[1]) <= 200) goIn(pendingIn, foot.who);
    else if (ph) pendingIn = null;
    else goIn(pendingIn, foot.who);
  }
})();
let pendingIn = null, inside = null, insideId = null; const IR = new InteriorRenderer(ctx), PIR = new PlaceRenderer(ctx); let PL = null;   // PL: L12/L13 places (lands with places.json)
// ---- L7 remainder hooks: the van's step-up support (merged with the roof's), its screen lift, Rigg's ambient barks
let van = null; const SUP = mergedSupport(() => RF, () => van); const footProj = (x, y, z) => hopLift(project(x, y, z, cam), foot);
const RIGGB = new Barker();
// GO IN works at ANY crew house with an interior kit, for whoever is on foot there (Brad's, Rigg's, ...). Crew CPUs home there (CrewWorld
// B.inside, via the net snapshot) — or, solo, whose car is parked at the house — are in the house with a beer: they come in as `guests`.
const goIn = (id, who) => {
  const P = roster.people.find(p => p.id === id) || { name: id }, car = sim.cars.find(c => c.owner === id), home = P.house && car && Math.hypot(car.x - P.house[0], car.y - P.house[1]) < 260 && Math.abs(car.v) < 25 && !car.follower;
  const guests = id !== who.id && home && (!net || car.inside === id) ? [{ id, name: P.name }] : [];
  const pGuests = party.interiorGuests(id, KITS[id]);   // ALL of the venue's indoor slots, placed on the kit's floors (no 18-cap row at the cpuIdle spot)
  for (const pg of pGuests) guests.push(pg);
  insideId = id; inside = new Interior(KITS[id], { who, house: P.name, guests, partyImgs: party.imgs }); if (foot) foot.active = false;
};
const goInPlace = (pl, who) => { inside = new PlaceInterior(KITS[pl.interior], { who, exitAt: pl }); if (foot) foot.active = false; };   // L12/L13: a public building, anyone
const goOut = () => {                                     // out the front door: on foot on the front walk, your car in the driveway
  if (inside && inside.exitAt) { const pl = inside.exitAt, d = doorPoint(pl); inside = null; foot.active = true; foot.x = d.x + d.nx * 14; foot.y = d.y + d.ny * 14; foot.h = Math.atan2(d.ny, d.nx); foot.px = foot.x; foot.py = foot.y; foot.z = 0; cam.x = foot.x; cam.y = foot.y; return; }   // out of a public place: on foot at its door
  const hp = roster.people.find(p => p.id === insideId) || PLAYERS.find(p => foot && p.id === foot.who.id) || foot.who, [hx, hy] = hp.house; inside = null; insideId = null;
  let c = sim.player; if (Math.hypot(c.x - hx, c.y - hy) > 400) { const r = W.roadInfo(hx, hy, 0); c = r.e ? sim.nearPt(hx, hy, r) : { x: hx + 60, y: hy }; }   // your car is elsewhere: out onto the front walk facing the street
  foot.active = true; foot.x = hx + (c.x - hx) * 0.35; foot.y = hy + (c.y - hy) * 0.35; foot.h = Math.atan2(c.y - hy, c.x - hx); foot.px = foot.x; foot.py = foot.y; foot.z = 0;
  cam.x = foot.x; cam.y = foot.y;
};
const doorOf = () => { if (!(foot && foot.active) || foot.z > 4) return null; for (const id of Object.keys(KITS)) { const P = roster.people.find(p => p.id === id); if (P && P.house && Math.hypot(foot.x - P.house[0], foot.y - P.house[1]) < 90) return id; } return null; };   // the crew house whose front door you are at
const atMyDoor = () => !!doorOf();
// is (x, y) inside a house footprint? (GET OUT never leaves you standing inside a wall —
// if the driver's side is inside a house, you step out the other side instead.)
const inHouse = (x, y) => { if (!sim || !sim.houses) return false; for (const f of sim.houses) { let ins = false; for (let k = 0; k < f.length; k += 2) { const ax = f[k], ay = f[k + 1], ex = f[(k + 2) % f.length], ey = f[(k + 3) % f.length]; if ((ay > y) !== (ey > y) && x < (ex - ax) * (y - ay) / (ey - ay) + ax) ins = !ins; } if (ins) return true; } return false; };
// (the roof wiring lives in phase 2 below — it lands with roof.json)
setFx(sim, roster);
setWalkers(() => { if (!net) return []; const out = []; for (const f of net.walkerMap.values()) { const who = roster.people.find(p => p.id === f.id); if (who) out.push({ who, x: f.x, y: f.y, px: f.px, py: f.py, h: f.h, dap: 0 }); } return out; });   // M-D: friends on foot, drawn by lf_fx
const fakeCop = new FakeCop(sim, W);
const party = new NightParty(); if (Q.get('party')) party.setVenue(Q.get('party'));
const valet = new ValetLots(W, roster);
const destruct = new CurbDestruct(W);
const help = new LFHelp();
const traffic = new Traffic(sim, W, {}), cops = new Cops(sim, W, traffic, {}), TRAFFIC_ON = Q.get('traffic') !== '0';   // L15 (?traffic=0 turns both off)
let forcedTod = null;
function jumpTo(it) {
  if (!it || !it.pos) return;
  if (inside) inside = null;
  if (foot) foot.active = false;
  if (it.carModel) {
    const kc = sim.cars.find(c => c.model === it.carModel);
    if (kc && kc !== sim.player) swapPlayerCar(sim, M, kc);
  }
  const r = W.roadInfo(it.pos[0], it.pos[1], 0);
  const pt = r.e ? sim.nearPt(it.pos[0], it.pos[1], r) : { x: it.pos[0], y: it.pos[1] };
  sim.player.x = pt.x; sim.player.y = pt.y; sim.player.v = 0; sim.player.layer = 0;
  if (r.e) sim.player.h = Math.atan2(r.dy, r.dx);
  if (it.night) forcedTod = 0.88;
  cam.x = sim.player.x; cam.y = sim.player.y; cam.zoom = 0.62;
  if (M) pushTrail(M, sim.player.x, sim.player.y, true);
}
// ---- task L2: PICK YOUR PLAYER -> RALLY THE CREW (lf_mission.js). ?free = just drive; ?player=<id> skips the pick.
const PLAYERS = players(roster);
let M = null, foot = null, picking = !Q.has('free') && !Q.has('cam') && !Q.has('map');
let pilot = null;
// ---- task L6: THE ONE WORLD. ?server=wss://<host>&key=<invite key>: open world, everyone else is CPU or a friend (lf_net.js)
const net = Q.get('server') && Q.get('key') ? new Net(Q.get('server'), Q.get('key')) : null;
if (net) net.onYou = (id, st) => {                        // take over that crew member IN PLACE, exactly as the CPU left them
  const mine = sim.cars.find(c => c.owner === id); sim.cars = sim.cars.filter(c => c !== sim.player);
  sim.player = mine; mine.player = true; mine.remote = false; Object.assign(mine, st); mine.parked = false;
  picking = false; foot = createFoot(PLAYERS.find(p => p.id === id)); setFoot(foot); renderer.mission = oM;
  cam.x = mine.x; cam.y = mine.y;                         // cut straight to them (they may be anywhere in the world)
};
// ---- M-D: THE ARRIVAL BEAT in the one world. The server rally runs the beat's timing (lf_world.js) and
// carries it in rallyState().beat; when it rides in on a snapshot, play the SAME beat here — the same
// stepper (lf_mission.stepBeat), the same figures, the same camera push-in — on a presentation-only
// mission (oM: no stops, nothing to join; the world already did that). Only if it is YOUR rally or it
// is happening where you can see it: a beat across town must not yank your camera away.
const oM = { stops: [], convoy: [], beat: null, camZoom: 1, complete: true };
let oBeatKey = '';
function stepOnlineBeat(dt) {
  const rb = net.rally && net.rally.beat;
  if (rb && !oM.beat) {
    const key = rb.x + ',' + rb.y + ',' + rb.who.join('.');
    if (key !== oBeatKey) {
      oBeatKey = key;
      const mine = net.me && net.rally.leader === net.me, near = sim.player && Math.hypot(sim.player.x - rb.x, sim.player.y - rb.y) < 800;
      if (mine || near) {
        const figs = [];
        rb.who.forEach((id, k) => {
          const c = sim.cars.find(c => c.owner === id), who = roster.people.find(p => p.id === id); if (!c || !who) return;
          const ang = k / rb.who.length * Math.PI * 2;
          figs.push({ who, k, cx: c.x, cy: c.y, hx: rb.x + Math.cos(ang) * 22, hy: rb.y + Math.sin(ang) * 22, x: c.x, y: c.y, vis: false, dap: 0 });
        });
        if (figs.length > 1) {
          oM.beat = makeBeat(figs, rb.x, rb.y, null);
          let left = Math.max(0, Math.min(4.6, rb.t || 0));   // join the beat where the world already is in it (snapshots are 10 Hz)
          while (left > 0 && oM.beat) { const s = Math.min(1 / 30, left); if (stepBeat(oM, s)) break; left -= s; }
        }
      }
    }
  }
  if (oM.beat) stepBeat(oM, dt);
}
// spawn at a landmark: the jumpTo placement (roadInfo -> nearPt, heading along the road), minus
// the camera snap — the opening intro flies to wherever the car is, landmark included. nearPt puts
// the car ON the nearest road centreline, so it can never start wedged in a footprint.
function spawnAtLandmark(lm) {
  const r = W.roadInfo(lm.x, lm.y, 0);
  const pt = r.e ? sim.nearPt(lm.x, lm.y, r) : { x: lm.x, y: lm.y };
  const c = sim.player;
  c.x = pt.x; c.y = pt.y; c.v = 0; c.layer = 0; c.z = 0; c.vz = 0; c.wreck = false;
  if (r.e) c.h = Math.atan2(r.dy, r.dx);
  if (M) pushTrail(M, c.x, c.y, true);                    // the convoy trail starts at the landmark, not back at the house
}
function pick(id) { if (net) { if (!net.takenBy(id)) net.pick(id); return; }
  M = startRally(sim, roster, id); renderer.mission = M; picking = false; foot = createFoot(PLAYERS.find(p => p.id === id)); setFoot(foot);
  const lm = startLm();
  if (lm && !Q.has('pilot')) spawnAtLandmark(lm);         // landmark start: your car on the road at the landmark — no indoor start; the rally runs as usual from there
  else if (KITS[id] && !Q.has('pilot')) introIn = id;   // PICK Brad -> you start in his house, but AFTER the opening flight: every start gets the same zoom-out first (Nov 18 consistency fix — a kit pick used to skip the intro entirely, so one house "didn't zoom out" and the next went the full width)
  else if (!Q.has('pilot')) pendingIn = id;               // (?player=: the kits have not landed yet)
  foot.onClimb = (c) => { learnLabel(sim, 'lf_roof'); if (c.onto === 'roof' && !foot.summited && M) { foot.summited = true; M.msg = 'THE LOOKOUT'; M.msgT = 3.5; } }; if (Q.has('pilot')) pilot = new Pilot(sim, W, M); startIntro(); if (introIn && !intro) { const g = introIn; introIn = null; goIn(g, foot.who); } }
// the opening (owner, Nov 17): the game starts zoomed out on the WHOLE MAP, then
// flies in to the picked person's house. Any tap skips it. Captures (?speed/?cam/
// ?pilot) and ?nointro skip it so their framing stays deterministic. A pick that
// starts indoors (L7: Brad's house) now flies FIRST and goes in when the flight
// lands — the opening is part of every start, identical for every house.
let intro = null, introIn = null;
// THE OPENING FIT, computed from the world itself (never from the live camera):
// the Nov 18 bug was capturing the intro's start from cam on the first frame —
// while the pick screen sat, the chase camera kept easing to the default car's
// street zoom (0.62), so a slow pick opened at ~68 m across and a fast pick at
// ~2,820 m. Same fit for every start, every house, every dwell time; clamped to
// the 2,830 m cap.
function openFit() { const B = W.bounds; return { x: (B.x0 + B.x1) / 2, y: (B.y0 + B.y1) / 2, z: Math.max(MIN_ZOOM, Math.min(VIEW_W / (B.x1 - B.x0), view.h / (B.y1 - B.y0)) * 0.98 * 1.5) }; }
function startIntro() {
  if (inside || Q.has('cam') || Q.has('pilot') || Q.has('speed') || Q.has('nointro')) return;   // NOT `fixed`: pick() can run before that const exists
  const F = openFit();
  intro = { t: 0, dur: 3.0, x0: F.x, y0: F.y, z0: F.z, x1: sim.player.x, y1: sim.player.y, z1: 0.62 };
}
canvas.addEventListener('pointerdown', () => { if (intro) intro.t = intro.dur; });
if (Q.get('player')) pick(Q.get('player'));
// G15/M-E: the detail line (model · street) word-wraps to the card's text budget and a row that
// needs two lines grows taller — full canon strings at the full 12px, never clipped off the card.
const PICK_DETAIL_FONT = '600 12px system-ui';
function wrapPickDetail(text, maxW) {
  ctx.font = PICK_DETAIL_FONT;
  if (ctx.measureText(text).width <= maxW) return [text];
  const words = text.split(' '), lines = []; let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = wd; } else cur = t; }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}
const pickRows = () => {
  const w = VIEW_W - 48, maxW = w - 67;   // text starts 57px into the card; 10px clear of its right edge
  let y = 158;
  return PLAYERS.map(p => {
    const lines = wrapPickDetail(`${p.car.model} · ${p.street}`, maxW);
    const h = lines.length > 1 ? 67 : 53, row = { p, x: 24, y, w, h, lines };
    y += h + 8;
    return row;
  });
};
// the landmark chips: HOME + every landmark, 4 across in 2 rows, under the person cards — the
// pick screen's second selection. Tapping a chip ARMS it (it turns gold, the header names it);
// tapping your player then starts there. HOME — or tapping the armed chip again — is the house
// start, exactly as before. Chips never start the game by themselves.
const LM_COLS = 4, LM_CHIP_H = 30;
function lmChips() {
  const rows = pickRows(), endY = rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].h : 158;
  const items = [{ id: null, short: 'HOME', name: 'Your house' }, ...LANDMARKS];
  const w = (VIEW_W - 48 - (LM_COLS - 1) * 6) / LM_COLS;
  return { headY: endY + 24, chips: items.map((l, i) => ({ lm: l, x: 24 + (i % LM_COLS) * (w + 6), y: endY + 32 + Math.floor(i / LM_COLS) * (LM_CHIP_H + 6), w, h: LM_CHIP_H })) };
}
canvas.addEventListener('pointerdown', e => {
  if (!picking) return;
  const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * VIEW_W / b.width, y = (e.clientY - b.top) * view.h / b.height;
  if (LANDMARKS.length) { const ch = lmChips().chips.find(c => x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h); if (ch) { startAt = startAt === ch.lm.id ? null : ch.lm.id; e.stopPropagation(); return; } }
  const r = pickRows().find(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  if (r) { pick(r.p.id); e.stopPropagation(); }
}, { capture: true });
addEventListener('keydown', e => { if (picking && /^Digit[1-9]$/.test(e.code)) { const p = PLAYERS[+e.code.slice(5) - 1]; if (p) pick(p.id); } });
function drawPick() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = 'rgba(20,12,32,0.86)'; ctx.fillRect(0, 0, VIEW_W, view.h);
  if (LOGO.complete && LOGO.naturalWidth) { const lh = 82, lw = lh * LOGO.naturalWidth / LOGO.naturalHeight; ctx.drawImage(LOGO, (VIEW_W - lw) / 2, 8, lw, lh); }   // the sign logo heads the pick screen
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd25c'; ctx.font = '900 30px system-ui'; ctx.fillText('PICK YOUR PLAYER', VIEW_W / 2, 122);
  ctx.fillStyle = '#e8dcc8'; ctx.font = '600 13px system-ui'; ctx.fillText(net ? `the one world · ${net.status}` : 'then rally the crew — meet at ' + roster.meetup.name, VIEW_W / 2, 146);
  pickRows().forEach(({ p, x, y, w, h, lines }, i) => {
    ctx.fillStyle = 'rgba(255,241,216,0.94)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
    const m = fleet[p.car.sprite], im = imgs[m.color.file], fw = im.width / m.cols, fh = im.height / Math.ceil(m.angles / m.cols);
    ctx.drawImage(im, 0, 0, fw, fh, x + 4, y + (h - 45) / 2, 45, 45);             // the car itself, side on (frame 0 = facing east)
    ctx.textAlign = 'left'; ctx.fillStyle = '#2a1430'; ctx.font = '900 17px system-ui'; ctx.fillText(`${i + 1}  ${p.name}`, x + 57, y + 22);
    ctx.font = PICK_DETAIL_FONT; ctx.fillStyle = '#5a3c58'; lines.forEach((ln, k) => ctx.fillText(ln, x + 57, y + 41 + k * 14));
    const tb = net && net.takenBy(p.id); if (tb || net) { ctx.textAlign = 'right'; ctx.font = '800 11px system-ui'; ctx.fillStyle = tb ? '#b8402a' : '#4a7a3a'; ctx.fillText(tb ? 'DRIVEN BY ' + tb.toUpperCase() : 'CPU — TAKE OVER', x + w - 10, y + 22); }
  });
  if (LANDMARKS.length) {                                 // the landmark start: header names the armed start, the armed chip turns gold
    const { headY, chips } = lmChips(), lm = startLm();
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffd25c'; ctx.font = '900 13px system-ui'; ctx.fillText('START AT', 24, headY);
    ctx.textAlign = 'right'; ctx.fillStyle = '#e8dcc8'; ctx.font = '700 13px system-ui'; ctx.fillText(lm ? lm.name.toUpperCase() : 'YOUR HOUSE', VIEW_W - 24, headY);
    for (const ch of chips) {
      const on = (ch.lm.id || null) === startAt;
      ctx.fillStyle = on ? '#ffd25c' : 'rgba(255,241,216,0.92)'; ctx.beginPath(); ctx.roundRect(ch.x, ch.y, ch.w, ch.h, 9); ctx.fill();
      ctx.fillStyle = on ? '#2a1430' : '#5a3c58'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(ch.lm.short.toUpperCase(), ch.x + ch.w / 2, ch.y + 19);
    }
  }
}
function drawMissionHud() {
  if (!M) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const n = M.convoy.length, total = M.convoy.length + M.stops.filter(s => !s.done).reduce((a, s) => a + s.people.length, 0);
  // DRIFT BANKING (Nov 18): the game has no cash/score of its own, so cashed drift points bank
  // into the rally pill itself — the session total rides next to CREW once it exists.
  const crewTxt = (M.complete ? 'CREW ASSEMBLED' : `CREW ${n + 1}/${total + 1}`) + (sim.drift && sim.drift.total > 0 ? ` · DRIFT ${sim.drift.total}` : '');
  ctx.textAlign = 'left'; ctx.font = '900 13px system-ui'; ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(12, 74, Math.max(150, ctx.measureText(crewTxt).width + 48), 26, 12); ctx.fill();
  ctx.fillStyle = '#ffd25c'; ctx.fillText(crewTxt, 24, 92);
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
// DRIFT BANKING (Nov 18, lf_drift.js): while a drift banks, the growing bank rides just over the
// player's car (transient — it exists only while the bank does, no new persistent HUD); on
// cash-in / loss a popup floats up from the car and fades. The compass arrow (when it lands)
// orbits OUTSIDE this readout's slot, so the two never stack.
function drawDrift() {
  const D = sim.drift, c = sim.player;
  if (!D || !c || picking || inside || (foot && foot.active)) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.textAlign = 'center';
  if (D.bank >= 1) {
    const x = (c.x - cam.x) * cam.zoom + VIEW_W / 2, y = (c.y - cam.y) * cam.zoom + view.h / 2;
    ctx.font = '900 15px system-ui';
    const t = `DRIFT ${Math.floor(D.bank)}` + (D.mult > 1.05 ? ` ×${D.mult.toFixed(1)}` : '');
    const w = ctx.measureText(t).width + 22;
    ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 64, w, 24, 10); ctx.fill();
    ctx.fillStyle = '#ffd25c'; ctx.fillText(t, x, y - 47);
  }
  for (const p of D.popups) {
    const px = (p.x - cam.x) * cam.zoom + VIEW_W / 2, py = (p.y - cam.y) * cam.zoom + view.h / 2 - 54 - p.t * 30;
    if (px < -80 || px > VIEW_W + 80 || py < -20 || py > view.h + 20) continue;
    ctx.font = '900 17px system-ui'; ctx.globalAlpha = Math.max(0, 1 - p.t / 1.25);
    ctx.fillStyle = p.kind === 'lost' ? '#ff9a7a' : '#ffd25c';
    ctx.fillText(p.txt, px, py);
    ctx.globalAlpha = 1;
  }
}
const input = new Input(canvas, view); input.fightOn = true;
const fixed = Q.get('cam') ? Q.get('cam').split(',').map(Number) : null;
const B0 = W.bounds, fitZ = Math.max(MIN_ZOOM, Math.min(VIEW_W / (B0.x1 - B0.x0), view.h / (B0.y1 - B0.y0)) * 0.98 * 1.5);   // Nov 18 (owner): the opening sits halfway back from the whole-map fit (~2,830 m across, never wider — the MIN_ZOOM cap); startIntro() recomputes this same fit via openFit() so the flight's start never depends on the live camera
const cam = fixed ? { x: fixed[0], y: fixed[1], zoom: fixed[2] || 1 }
  : (picking || Q.get('player')) && !Q.has('speed') && !Q.has('pilot') && !Q.has('nointro')
    ? { x: (B0.x0 + B0.x1) / 2, y: (B0.y0 + B0.y1) / 2, zoom: fitZ }   // open wide on the map (half-fit since Nov 18)
    : { x: sim.player.x, y: sim.player.y, zoom: 0.62 };   // owner Nov 17: zoom out, more world
// WORLD PULSE (owner, Nov 17): while driving, every so often the camera eases
// FAR out to show the world, holds, then eases back to the normal chase zoom.
// Nov 18 (owner): the far reach was halved, then set halfway back — 0.21, about
// 200 m across (was 0.14, ~300 m). Identical at every house, and the MIN_ZOOM
// cap in frame() floors every zoomed-out view regardless of path.
// Skipped for captures, beats, foot and intro.
const PULSE = { far: 0.21, out: 3.0, hold: 3.0, back: 3.0, rest: 27.0 };
let pulseT = -PULSE.rest;
for (let cy = -2; cy <= 2; cy++) for (let cx = -1; cx <= 1; cx++) ground.get(Math.floor(cam.x / CHUNK) + cx, Math.floor(cam.y / CHUNK) + cy);
ground.stats.sync = 0;
const STEP = 1 / 60; let SPEED = Math.max(1, Math.min(16, Number(Q.get('speed')) || 1)); let acc = 0, last = performance.now();   // ?speed=N: N sim steps per frame (captures)
// DAY/NIGHT PARITY (owner, Nov 18): Palm City's own clock — same curve, same HUD time.
// ?t=0..1 pins the time of day (0 = golden hour, 1 = blue dusk) for captures, as in Palm City.
let simTime = 0;
const fixedT = Q.has('t') ? Math.min(1, Math.max(0, Number(Q.get('t')))) : null;
function timeOfDay() {
  if (forcedTod !== null) return forcedTod;
  if (fixedT !== null) return fixedT;
  return Math.min(0.97, 0.18 + simTime / 200);  // ~3 minutes from golden hour into blue dusk, then holds (Palm City main.js, verbatim)
}
function clockText(t) {   // Palm City hud.js, verbatim: 6:38 pm golden hour -> 7:48 pm blue dusk
  const mins = 18 * 60 + 38 + Math.round(t * 70);
  const h = Math.floor(mins / 60) - 12, m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')} PM`;
}
let cornerT = 0, cornerS = '';
// L10: street names written ALONG the roads once you are zoomed in enough to read them (deduped, upright, haloed)
function drawStreetLabels() {
  if (cam.zoom < 0.3 || cam.zoom > 1.3) return;
  const hw = VIEW_W / 2 / cam.zoom, hh = view.h / 2 / cam.zoom, seen = [], z = cam.zoom; let n = 0;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.font = '800 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const e of W.edges) {
    const nm = e.name; if (!nm || e.hw === 'service' || e.len < 260 || n > 9) continue;
    const k = e.pts.length >> 1, [mx, my] = e.pts[k], sx = (mx - cam.x) * z + VIEW_W / 2, sy = (my - cam.y) * z + view.h / 2;
    if (sx < 30 || sx > VIEW_W - 30 || sy < 70 || sy > view.h - 120) continue;
    if (seen.some(q => q[0] === nm && Math.hypot(q[1] - sx, q[2] - sy) < 260) || seen.some(q => Math.hypot(q[1] - sx, q[2] - sy) < 40)) continue;
    const [ax, ay] = e.pts[Math.max(0, k - 1)], [bx, by] = e.pts[Math.min(e.pts.length - 1, k + 1)]; let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    seen.push([nm, sx, sy]); n++; ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(27,20,48,0.8)'; ctx.strokeText(nm, 0, 0); ctx.fillStyle = 'rgba(255,240,215,0.95)'; ctx.fillText(nm, 0, 0); ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
}
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; acc += dt * SPEED;   // dt clamped at 0 too: a rAF timestamp can predate the module-eval performance.now() (startup clock skew sent the intro's t negative and the zoom with it)
  let n = 0;
  if (pilot && M && M.complete) pilot = null;            // the autopilot's job ends at the finish: the stick is yours again
  while (acc >= STEP && n < 6 * SPEED) { const inp = pilot ? (input.read(), pilot.input(STEP)) : input.read(); if (picking) { acc = 0; break; }
    const beat = (M && M.beat) || oM.beat || intro, ZERO = { jx: 0, jy: 0, jm: 0, keys: {} };
    if (inside) { sim.step(STEP, ZERO); if (inside.step(STEP, inp) === 'exit') goOut(); }
    else if (foot && foot.active) { sim.step(STEP, ZERO); if (!beat) { stepOnFoot(foot, STEP, inp, SUP); const nc = inp.action && !(PL && PL.label(foot, sim)) ? nearAnyCar(foot, sim.cars) : null; /* a public door / the 108 Astro's lights win over GET IN */ if (nc) { if (nc !== sim.player) swapPlayerCar(sim, M, nc); foot.active = false; } else if (inp.action && atMyDoor()) goIn(doorOf(), foot.who); else if (inp.action && PL) { const r = PL.act(foot, sim); if (r && r.enter && KITS[r.enter.interior]) goInPlace(r.enter, foot.who); } } }   // L12/L13: GO IN at a public door / ROB LIGHTS at the Astro
    else { sim.step(STEP, beat || cops.hold ? ZERO : inp);   /* L15: BUSTED holds your input */ if (foot && !beat && !pilot && inp.action && Math.abs(sim.player.v) < FOOT.exitV) { exitCar(foot, sim.player); if (inHouse(foot.x, foot.y)) { const c = sim.player, a = c.h + Math.PI / 2, d = (c.wid || 20) / 2 + 7; foot.x = c.x + Math.cos(a) * d; foot.y = c.y + Math.sin(a) * d; foot.px = foot.x; foot.py = foot.y; } } }
    if (van) van.step(STEP, foot);
    if (!inside && !picking) RIGGB.step(STEP);   // Rigg-isms: the street-side barker (indoors, the interior has its own)
    if (PL) PL.step(STEP); if (KOTH) KOTH.step(sim, STEP); if (M) stepRally(sim, M, STEP); if (net) stepOnlineBeat(STEP);
    party.step(timeOfDay(), sim.player);
    fakeCop.step(STEP, !!(sim.player.model === 'cavalier_kosack' && ((inp.action && Math.abs(sim.player.v) >= FOOT.exitV) || sirenKey)));
    if (TRAFFIC_ON && !picking) { traffic.step(STEP); cops.step(STEP, { inCar: !(foot && foot.active) && !inside }); }   // L15
    valet.step(sim, STEP);
    destruct.step(sim, STEP);
    simTime += STEP; acc -= STEP; n++; }
  if (n >= 6 * SPEED) acc = 0;
  if (net) net.frame(sim, dt, foot && foot.active ? foot : null);
  const c = sim.player;
  let tx = c.x + Math.cos(c.h) * c.v * 0.42, ty = c.y + Math.sin(c.h) * c.v * 0.42, tz = 0.62 - Math.min(0.10, Math.abs(c.v) / 290 * 0.10);   // Palm City's chase framing, pulled back (owner Nov 17: zoom out — ~68 m across instead of ~42)
  const ab = M && M.beat ? M : oM.beat ? oM : null;      // the arrival beat, solo or shared: push in on the huddle
  if (ab) { tx = ab.beat.cx; ty = ab.beat.cy; } if (M) tz *= M.camZoom; else if (oM.beat) tz *= oM.camZoom;
  if (foot && foot.active && !fixed) {                   // on foot: follow the walker, closer in
    tx = foot.x; ty = foot.y; tz = foot.climb ? 1.1 : 1.8;   // on foot (owner, Nov 17): 20% closer than the old 1.5
    if (RF && foot.z >= RF.h - 2 && !foot.air && !foot.climb) { const L = lookout(foot, RF, sim, M, view); tx = L.x; ty = L.y; tz = L.zoom; }   // L5: up top, the closing shot
  }
  if (fixed) { tx = fixed[0]; ty = fixed[1]; tz = fixed[2] || 1; }
  const pulseOK = !fixed && !(foot && foot.active) && !intro && !picking && !pilot && !Q.has('speed') && !((M && M.beat) || oM.beat);   // !picking: the pulse clock starts when you start driving — the same post-meeting rhythm at every house
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
    if (u >= 1) { intro = null; const g = introIn || (pendingIn && KITS[pendingIn] ? pendingIn : null); if (g) { introIn = null; if (pendingIn === g) pendingIn = null; goIn(g, foot && foot.who); } }   // the flight has landed: a house-kit start goes inside NOW — every start saw the same opening first
  } else if (!picking || fixed) {   // while the pick screen is up the camera HOLDS the wide opening view: it used to ease to the default car's street zoom behind the overlay, eating the intro's start (the Nov 18 inconsistency)
    const k = fixed ? 1 : 1 - Math.exp(-dt * 3.2);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.zoom += (tz - cam.zoom) * (fixed ? 1 : 1 - Math.exp(-dt * 1.5));
  }
  if (!fixed && cam.zoom < MIN_ZOOM) cam.zoom = MIN_ZOOM;   // HARD CAP (owner, Nov 18): never wider than 2,830 m across, whatever path set the zoom
  if (inside) { (inside.place ? PIR : IR).draw(inside, VIEW_W, view.h, DPR, now / 1000); drawControls(); requestAnimationFrame(frame); return; }
  // KOTH circle road (owner, Nov 17): the cul-de-sac you're sitting in — or fighting over — is
  // REAL pavement: the same sac the ring below draws gets its disc painted as asphalt, road grip
  // in the sim and black (not dirt-brown) skid marks. setPave no-ops until the sac changes.
  ground.setPave(KOTH && KOTH.state !== 'done' ? (KOTH.state === 'idle' ? (KOTH.candidate ? KOTH.candidate(sim) : null) : KOTH.sac) : null);
  const tod = timeOfDay();
  renderer.draw(sim, cam, now / 1000, tod); if (!picking && !mapOpen && !help.open) drawStreetLabels();
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
  // HUD: the real street under you + speed (<= 15% of the screen) — hidden on pick screen so MD-216 sign stays crisp
  if (!picking) {
    const r = W.roadInfo(c.x, c.y, c.layer); if ((cornerT -= dt) < 0) { cornerT = 0.4; cornerS = r.e && r.d < r.hw + 30 ? areas.cornerNear(c.x, c.y, c.layer) : ''; }
    const name = cornerS;                                   // L10: "corner of X & Y" — the street you are on and the nearest cross street
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.textAlign = 'center';
    if (name) { ctx.font = '800 15px system-ui'; const w = ctx.measureText(name).width + 28; ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - w / 2, 18, w, 30, 15); ctx.fill(); ctx.fillStyle = '#ffe4b0'; ctx.fillText(name, VIEW_W / 2, 38); }
    ctx.font = '800 13px system-ui'; ctx.fillStyle = 'rgba(255,240,215,0.9)';
    ctx.fillText((foot && foot.active) ? clockText(tod) : Math.round(Math.abs(c.v) / 10 * 2.237) + ' mph · ' + clockText(tod), VIEW_W / 2, 64);   // Palm City's clock rides the HUD line: 6:38 PM -> 7:48 PM as dusk falls
    const pb = party.banner();
    if (pb) { ctx.font = '900 11px system-ui'; const pw = ctx.measureText(pb).width + 20; ctx.fillStyle = 'rgba(27,20,48,0.82)'; ctx.beginPath(); ctx.roundRect(VIEW_W - pw - 12, 74, pw, 24, 10); ctx.fill(); ctx.fillStyle = '#d48aff'; ctx.textAlign = 'center'; ctx.fillText(pb, VIEW_W - pw / 2 - 12, 90); }
  }
  // prefetch: the view + a margin + where the car will be in ~1.2 s, nearest first
  const hw0 = VIEW_W / 2 / cam.zoom + 320, hh0 = view.h / 2 / cam.zoom + 320, want = [], hwf = Math.min(hw0, 1400), hhf = Math.min(hh0, 1800);
  const hw = hwf, hh = hhf, farOut = hw0 * hh0 > 4e6;                           // zoomed right out: prefetch only round the car (the view's ground is drawn as roads, renderer FAR_CHUNKS)
  for (const [px, py] of farOut ? [[c.x, c.y]] : [[cam.x, cam.y], [c.x + Math.cos(c.h) * c.v * 1.2, c.y + Math.sin(c.h) * c.v * 1.2]])
    for (let cy = Math.floor((py - hh) / CHUNK); cy <= Math.floor((py + hh) / CHUNK); cy++) for (let cx = Math.floor((px - hw) / CHUNK); cx <= Math.floor((px + hw) / CHUNK); cx++) want.push([cx, cy, (cx * CHUNK - cam.x) ** 2 + (cy * CHUNK - cam.y) ** 2]);
  want.sort((a, b) => a[2] - b[2]); ground.request(want.slice(0, 60)); ground.work(Math.min(12, Math.max(3, dt * 120)));
  requestAnimationFrame(frame);
}
// ---- task L10: the whole-area MAP (M key, or the MAP pill top-right): every real road, the footprints, the
// crew's homes and the POIs labelled "corner of X & Y", you as a live arrow. Painted once, then just blitted.
let mapOpen = Q.has('map'), sirenKey = false;
addEventListener('keydown', e => {
  if (e.code === 'KeyM') mapOpen = !mapOpen;
  if (e.code === 'KeyH') sirenKey = true;
});
addEventListener('keyup', e => { if (e.code === 'KeyH') sirenKey = false; });
canvas.addEventListener('pointerdown', e => {
  if (picking) return;
  const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * VIEW_W / b.width, y = (e.clientY - b.top) * view.h / b.height;
  const hit = help.tap(x, y, view.h, help.items(sim, roster, PL, party));
  if (hit) { if (hit.type === 'jump') jumpTo(hit.item); e.stopPropagation(); return; }
  if (x > VIEW_W - 76 && y > 12 && y < 46) { mapOpen = !mapOpen; e.stopPropagation(); }
}, { capture: true });
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
  const label = inside ? (inside.prompt() || '') : onFoot ? ((PL && PL.label(foot, sim)) || (nearAnyCar(foot, sim.cars) ? 'GET IN' : atMyDoor() ? 'GO IN' : '')) : (Math.abs(sim.player.v) < FOOT.exitV ? 'GET OUT' : (sim.player.model === 'cavalier_kosack' ? 'SIREN' : ''));
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
renderer.worldFx = (g, S, t, vis, vx0, vy0, vx1, vy1) => {
  destruct.draw(g, vx0, vy0, vx1, vy1);
  valet.drawWorld(g, t);
  party.drawWorld(g, t, vis);
};
renderer.postLights = (g, S, gr, t, vis) => {
  party.drawLights(g, timeOfDay(), t, vis);
  fakeCop.drawWorld(g, t);
};
const _draw = renderer.draw.bind(renderer);
renderer.draw = (S, cam, t, tod) => {
  _draw(S, cam, t, tod);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.font = '800 13px system-ui'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(VIEW_W - 72, 14, 60, 28, 12); ctx.fill(); ctx.fillStyle = '#ffe4b0'; ctx.fillText('MAP', VIEW_W - 42, 33);
  drawMissionHud();
  drawDrift();
  if (M && M.barks && M.barks.drawScreen) M.barks.drawScreen(ctx, cam, VIEW_W, view.h);   // L17: the convoy's speech bubbles (lf_barks.js)
  fakeCop.drawHud(ctx, VIEW_W);
  cops.drawHud(ctx, VIEW_W, view.h);                        // L15: wanted stars + BUSTED / LOST THEM
  valet.drawHud(ctx, VIEW_W);
  destruct.drawHud(ctx, VIEW_W);
  if (!inside && RIGGB.sayT > 0) {                          // Rigg-isms over Rigg: on foot (you are Rigg) or over his car (you or the CPU)
    const rf = foot && foot.active && foot.who.id === 'rigg' ? foot : S.cars.find(c => c.owner === 'rigg');
    if (rf) { const x = (rf.x - cam.x) * cam.zoom + VIEW_W / 2, y = (rf.y - cam.y) * cam.zoom + view.h / 2 - (rf === foot ? 36 : 34); if (x > -60 && x < VIEW_W + 60 && y > 30 && y < view.h) bubbleAt(ctx, x, y, RIGGB.said, Math.min(1, RIGGB.sayT * 2), VIEW_W); }
  }
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
    const ra = net.rally;                                   // the rally in the one world: who leads, how many are in, what just happened
    if (ra) {
      const lead = (roster.people.find(p => p.id === ra.leader) || { name: ra.leader }).name.split(' ')[0], mine = net.me === ra.leader;
      ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(12, 104, 190, 24, 11); ctx.fill(); ctx.fillStyle = '#ffd25c'; ctx.font = '900 11px system-ui';
      ctx.fillText(ra.complete ? 'CREW ASSEMBLED' : `${mine ? 'YOUR' : lead.toUpperCase() + "'S"} RALLY · ${ra.crew}/${ra.total}`, 24, 120);
      if (ra.msg) { ctx.textAlign = 'center'; ctx.font = '900 20px system-ui'; ctx.fillStyle = 'rgba(27,20,48,0.7)'; const w = ctx.measureText(ra.msg).width + 28; ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - w / 2, view.h * 0.22 - 22, w, 34, 13); ctx.fill(); ctx.fillStyle = '#ffe4b0'; ctx.fillText(ra.msg, VIEW_W / 2, view.h * 0.22 + 1); }
    }
  }
  drawControls();
  if (!picking && !mapOpen) help.draw(ctx, view.h, help.items(sim, roster, PL, party));
  if (mapOpen) drawMap(S.player);
  if (picking) drawPick();
};
requestAnimationFrame(frame);
window.__lf = { places: () => PL, goInPlace, door: () => doorOf(), van: () => van, get areas() { return areas; }, inside: () => inside, setSpeed: (k) => { SPEED = k; }, roof: () => RF, sim, W, ground, cam, input, renderer, map: () => mapOpen, mission: () => M, koth: () => KOTH, fakeCop: () => fakeCop, party: () => party, valet: () => valet, destruct: () => destruct, help: () => help, jumpTo, pick, landmarks: () => LANDMARKS, startAt: () => startAt, lmChips: () => lmChips(), picking: () => picking, pilot: () => pilot, foot: () => foot, tod: () => timeOfDay(), simTime: () => simTime, net: () => net, obeat: () => oM.beat };
window.__lf.traffic = traffic; window.__lf.cops = cops;   // L15
