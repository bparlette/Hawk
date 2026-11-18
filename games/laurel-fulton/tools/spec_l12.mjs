// spec_l12.mjs — tasks L12 (WEIS + SCOTT) and L13 (GRINGADA + the 108 ASTRO).  node tools/spec_l12.mjs   (from games/laurel-fulton/)
// Stick + ACTION only, through the SAME step functions main.js calls: stepOnFoot(foot, dt, inp) on foot, PlaceInterior.step(dt, inp)
// indoors, Places.label/act for the door + the Astro. Proves:
//  1 data: the Weis is the REAL OSM Weis (way 175330281, All Saints Rd, Whiskey Bottom) on a real 4,500 m2 footprint; Gringada is a labelled
//    MEMORY BUILD in a real Columbia shopping center; Scott is a random real Whiskey Bottom Rd house — position only, NO house number — with a Civic
//  2 GO IN at the Weis door (on foot, ACTION) -> the 'store' cutaway: aisles, 3 checkout lanes, pizza counter, security desk; GO IN works for anyone
//  3 the crew: Jason at the security desk, Brad at the pizza counter (as NPCs, or YOU are him); grab + eat a slice
//  4 THE FIRING (you are not Rigg): walk up to Rigg in the soda aisle -> he opens a bottle -> Scott -> "You're fired." -> "Fuck Scott." -> Rigg leaves
//  5 THE FIRING as Rigg: OPEN SODA -> same scene -> you are walked out the door
//  6 GRINGADA: GO IN at the Hickory Ridge door; Brad cooks; Jimmy + Clayton (+ Zack) come in and steal; Zack: "why are you going to Clayton it";
//    Jimmy eats it super fast (< 1 s); as Jimmy: STEAL FOOD at the hot case
//  7 THE 108 ASTRO: parked on the road; ROB LIGHTS on foot -> the parking lights go dark, a bark; Scott's Civic parked at his house
//  8 the factory states the same interiors (interior_build.py weis store / gringada restaurant) byte-for-byte
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f)));
const PJ = J('data/places.json'), A = J('data/areas.json'), G = J('data/graph.json'), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json');
const { Places, PlaceInterior, doorPoint, PLACE } = await import('../src/lf_places.js');
const { stepOnFoot } = await import('../src/lf_climb.js'); const { createFoot } = await import('../src/lf_foot.js');
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const area = (f) => { let s = 0; const n = f.length / 2; for (let i = 0; i < n; i++) s += f[2 * i] * f[2 * ((i + 1) % n) + 1] - f[2 * ((i + 1) % n)] * f[2 * i + 1]; return Math.abs(s) / 2 / 25; };
const place = (id) => PJ.places.find(p => p.id === id), KW = J('data/interiors/weis.json'), KG = J('data/interiors/gringada.json');
const DT = 1 / 60, ZERO = { jx: 0, jy: 0, jm: 0, keys: {} };
// ---- 1 data
const wp = place('weis'), gp = place('gringada'), scott = PJ.npcs.find(n => n.id === 'scott');
check(wp.osm === 'way/175330281' && area(A.buildings[wp.b]) > 4000 && /brand=Weis/.test(wp.evidence) && /Whiskey Bottom/.test(wp.evidence), '1 the Weis is the REAL OSM Weis (way/175330281, Whiskey Bottom Center) on its real footprint', `${Math.round(area(A.buildings[wp.b]))} m2`);
check(gp.memory === true && gp.year === 1998 && /MEMORY BUILD/.test(gp.evidence) && KG.memory && /MEMORY/.test(KG.memory.label), '1 Gringada is a LABELLED memory build (1998), placed in Hickory Ridge Village Center, Columbia', gp.evidence.slice(0, 90));
const wbr = G.edges.filter(e => e.name === 'Whiskey Bottom Road'), dRoad = Math.min(...wbr.flatMap(e => e.pts.map(q => Math.hypot(q[0] - scott.house[0], q[1] - scott.house[1]))));
check(dRoad < 200 && !('number' in scott) && !/\d{3,}/.test(JSON.stringify(scott).replace(/\d+\.\d+/g, '').replace(/"b":\d+/, '')) && !/housenumber/.test(JSON.stringify(PJ)), '1 Scott: a real house beside Whiskey Bottom Road, position only, NO house number stored', `${Math.round(dRoad)} units off the road`);
check(FLEET[scott.car.sprite] && /Civic/.test(scott.car.model) && /NO Civic sprite/.test(scott.car.note), '1 Scott\'s car is a Civic — closest sprite reused and said so', scott.car.sprite);
// ---- 2 GO IN at the Weis door, on foot, through the real step functions
const W = new GraphWorld(G), S = new LFSim(W, ROSTER, FLEET, { spawn: { x: 0, y: 0 } }); S.setBuildings(A.buildings);
const PL = new Places(PJ); PL.attach(S);
const jason = ROSTER.people.find(p => p.id === 'jason'); const foot = createFoot(jason); const d = doorPoint(wp);
Object.assign(foot, { active: true, x: d.x + d.nx * 120, y: d.y + d.ny * 120, h: 0, z: 0 }); foot.px = foot.x; foot.py = foot.y;
check(PL.label(foot, S) === '' && PL.act(foot, S) === null, '2 far from the door: no GO IN');
for (let i = 0; i < 600 && PL.label(foot, S) !== 'GO IN'; i++) { const dx = d.x - foot.x, dy = d.y - foot.y, L = Math.hypot(dx, dy) || 1; stepOnFoot(foot, DT, { jx: dx / L, jy: dy / L, jm: 1, keys: {} }, null); }
const r = PL.act(foot, S);
check(PL.label(foot, S) === 'GO IN' && r && r.enter && r.enter.id === 'weis', '2 walked up to the Weis door with the stick -> GO IN (anyone, not just the owner)');
const K = KW; const cnt = (k) => K.props.filter(p => p.kind === k).length;
check(K.type === 'store' && cnt('register') >= 3 && cnt('shelf') + cnt('soda') >= 4 && cnt('pizza') === 1 && cnt('sec_desk') === 1 && K.spots.some(s => s.act === 'EXIT'), '2 the store cutaway kit: aisles, 3 checkout lanes, pizza counter, security desk', K.props.map(p => p.kind).join(','));
// helpers over an interior
const mk = (kit, who, id) => { const I = new PlaceInterior(kit, { who: { id: who, name: who }, exitAt: place(id) }); return I; };
const stick = (jx) => ({ jx, jy: 0, jm: jx ? 1 : 0, keys: {} });
const run = (I, inp, secs, until) => { for (let t = 0; t < secs; t += DT) { const o = I.step(DT, typeof inp === 'function' ? inp() : inp); if (o) return o; if (until && until()) return true; } return false; };
const goTo = (I, x) => run(I, () => stick(Math.sign(x - I.hero.x)), 30, () => Math.abs(I.hero.x - x) < 0.3);
const act = (I) => I.step(DT, { ...ZERO, action: true });
// ---- 3 the crew at their posts; a slice
{
  const I = mk(K, 'kosack', 'weis'), nj = I.actor('jason'), nb = I.actor('brad'), desk = K.props.find(p => p.kind === 'sec_desk').x, pz = K.props.find(p => p.kind === 'pizza').x;
  check(nj.role === 'SECURITY' && Math.abs(nj.x - desk) < 2.0 && nb.role === 'PIZZA' && Math.abs(nb.x - pz) < 2.2 && I.npcs.every(n => n.id !== 'kosack'), '3 Jason is SECURITY at the desk; Brad makes PIZZA at the pizza counter', `jason x${nj.x} desk x${desk}; brad x${nb.x} pizza x${pz}`);
  const Jx = mk(K, 'jason', 'weis'); check(!Jx.npcs.some(n => n.id === 'jason') && Jx.actor('jason') === Jx.hero, '3 play AS Jason: you are the guard (no second Jason)');
  check(I.prompt() === 'EXIT', '3 you start at the front door (EXIT)');
  I.done.add('fired');   // (walking past Rigg plays the lore scene — test that in 4)
  goTo(I, K.spots.find(s => s.act === 'GRAB SLICE').x); const p1 = I.prompt(); act(I); const p2 = I.prompt(); act(I); const eating = I.hero.eatT > 1; run(I, stick(0), 3);
  check(p1 === 'GRAB SLICE' && p2 === 'EAT' && eating && I.hero.ate === 1 && I.events.some(e => e.kind === 'eat'), '3 GRAB SLICE at the pizza counter, then EAT');
  // the guard's bark
  I.hero.x = desk + 3; run(I, stick(0), 25); check(I.said.some(s => s.who === 'jason'), '3 Jason barks at you as you pass', I.said.filter(s => s.who === 'jason').map(s => s.text).join(' | '));
}
// ---- 4 THE FIRING (you are a bystander)
{
  const I = mk(K, 'kosack', 'weis'), rg = I.actor('rigg'); const ev = (k) => I.events.find(e => e.kind === k);
  check(rg && Math.abs(rg.x - K.props.find(p => p.kind === 'soda').x) < 2 && !I.beat, '4 Rigg is stocking in the soda aisle');
  goTo(I, rg.x - 3); run(I, stick(0), 30, () => !I.beat && I.done.has('fired'));
  const say = (who, re) => I.said.findIndex(s => s.who === who && re.test(s.text)), iF = say('scott', /fired/i), iX = say('rigg', /^Fuck Scott\.$/);
  check(ev('soda_open') && iF >= 0 && iX > iF && ev('soda_open').t < I.said[iF].t, '4 the soda bottle opens -> Scott: "You\'re fired." -> Rigg: "Fuck Scott."', I.said.map(s => s.who + ': ' + s.text).join(' / '));
  check(say('scott', /Did you just open that/) >= 0 && ev('fired') && /FIRED/.test(ev('fired').banner), '4 the lore scene is complete: Scott catches him, the FIRED banner');
  run(I, stick(0), 20, () => !I.beat); check(rg.hidden && I.sodaOpen && !I.beat, '4 Rigg is walked out; the opened soda stays on the floor');
}
// ---- 5 THE FIRING AS RIGG
{
  const I = mk(K, 'rigg', 'weis'), sx = K.spots.find(s => s.act === 'OPEN SODA').x; goTo(I, sx);
  const pr = I.prompt(); const o = (act(I), run(I, stick(0), 40));
  check(pr === 'OPEN SODA' && I.said.some(s => s.who === 'rigg' && s.text === 'Fuck Scott.') && o === 'exit' && I.events.some(e => e.kind === 'fired'), '5 as Rigg: OPEN SODA -> "Fuck Scott." -> you are walked out the door', `prompt ${pr}, out ${o}`);
  const K2 = mk(K, 'kosack', 'weis'); K2.hero.x = sx; check(K2.prompt() !== 'OPEN SODA', '5 OPEN SODA is Rigg\'s alone');
}
// ---- 6 GRINGADA
{
  const gd = doorPoint(gp), f2 = createFoot(ROSTER.people.find(p => p.id === 'zack')); Object.assign(f2, { active: true, x: gd.x, y: gd.y, h: 0, z: 0 });
  const rr = PL.act(f2, S); check(rr && rr.enter && rr.enter.id === 'gringada' && gp.memory, '6 GO IN at the Gringada door (a memory build)');
  const I = mk(KG, 'kosack', 'gringada'), ev = (k) => I.events.find(e => e.kind === k), brad = I.actor('brad');
  check(KG.type === 'restaurant' && KG.rooms.map(r => r.name).join() === 'dining room,counter,kitchen' && brad.role === 'COOK', '6 kitchen + counter + dining; Brad cooks there', KG.rooms.map(r => r.name).join(' / '));
  goTo(I, 8); run(I, stick(0), 40, () => I.done.has('steal') && !I.beat);
  const iz = I.said.findIndex(s => s.who === 'zack' && s.text === 'why are you going to Clayton it'), st = ev('steal'), ef = ev('eat_fast');
  const jim = I.actor('jimmy'), seenIn = I.events.filter(e => e.kind === 'say').map(e => e.who);
  check(st && iz >= 0 && ef && I.said[iz].t > st.t && ef.t >= I.said[iz].t && seenIn.includes('clayton') && jim, '6 Jimmy + Clayton come in and steal food; Zack says it: "why are you going to Clayton it"', I.said.map(s => s.who + ': ' + s.text).join(' / '));
  // Jimmy eats it super fast: from eat_fast to the food being gone
  const I2 = mk(KG, 'kosack', 'gringada'); let tgone = null, t0 = null;
  for (let t = 0; t < 50; t += DT) { I2.step(DT, I2.hero.x < 8 ? stick(1) : stick(0)); const j = I2.actor('jimmy'); if (I2.events.some(e => e.kind === 'eat_fast') && t0 == null) t0 = I2.time; if (t0 != null && j && !j.hold && tgone == null) tgone = I2.time; }
  check(t0 != null && tgone != null && tgone - t0 < 1.0, '6 Jimmy eats it SUPER fast: gone in under a second', `${tgone && (tgone - t0).toFixed(2)} s (a slice by you takes ${1.9} s)`);
  check(I.caseLeft === 5, '6 the hot case really lost a burrito', 'left ' + I.caseLeft);
  const Ij = mk(KG, 'jimmy', 'gringada'); goTo(Ij, KG.spots.find(s => s.act === 'STEAL FOOD').x); const pj = Ij.prompt(); act(Ij); run(Ij, stick(0), 40, () => Ij.done.has('steal') && !Ij.beat);
  check(pj === 'STEAL FOOD' && Ij.said.some(s => s.who === 'zack' && s.text === 'why are you going to Clayton it') && Ij.events.some(e => e.kind === 'eat_fast'), '6 as Jimmy: STEAL FOOD at the hot case -> Zack\'s line -> you eat it fast');
  const Ib = mk(KG, 'brad', 'gringada'); check(!Ib.npcs.some(n => n.id === 'brad') && Ib.actor('brad') === Ib.hero, '6 play AS Brad: you are the one working Gringada');
  const Ie = mk(KG, 'kosack', 'gringada'); goTo(Ie, KG.spots.find(s => s.act === 'ORDER').x); act(Ie); run(Ie, stick(0), 2); check(Ie.said.some(s => s.who === 'brad' && /Welcome to Gringada/.test(s.text)) && Ie.hero.hold === 'chips', '6 ORDER at the counter: Brad greets you, chips + salsa');
}
// ---- 7 the 108 Astro + Scott's Civic
{
  const a = PL.astro(S), sp = PJ.setpieces[0], rd = W.roadInfo(a.x, a.y, 0);
  check(a && a.model === 'astro_billy' && a.parked && Math.hypot(a.x - sp.x, a.y - sp.y) < 1 && rd.e && rd.d < 90, '7 an Astro is parked at the roadside (stand-in for Route 108, flagged in the data)', `${rd.e && rd.e.name}, ${Math.round(rd.d)} units off the centreline; ${sp.note.slice(0, 60)}`);
  const f = createFoot(jason); Object.assign(f, { active: true, x: a.x + 30, y: a.y + 30, h: 0, z: 0 });
  for (let i = 0; i < 900 && PL.label(f, S) !== 'ROB LIGHTS'; i++) { const dx = a.x - f.x, dy = a.y - f.y, L = Math.hypot(dx, dy) || 1; stepOnFoot(f, DT, { jx: dx / L, jy: dy / L, jm: 1, keys: {} }, null); }
  const lit = a.lightsGone; const rr = PL.act(f, S);
  check(PL.label(f, S) === '' && !lit && a.lightsGone === true && rr.rob === a && PL.bark && /Parking lights/.test(PL.bark.text), '7 ROB LIGHTS as Jason: the parking lights go dark, a bark', PL.bark.text);
  check(PL.act(f, S) === null, '7 once robbed there is nothing left to rob');
  const c = S.cars.find(c => c.owner === 'scott'); check(c && c.model === scott.car.sprite && Math.hypot(c.x - scott.house[0], c.y - scott.house[1]) < 90 && c.parked, '7 Scott\'s Civic is parked at his house');
}
// ---- 8 the factory reproduces the kits byte-for-byte
const tmp = fs.mkdtempSync('/tmp/l12-'); fs.mkdirSync(path.join(tmp, 'data'));
for (const [id, ty] of [['weis', 'store'], ['gringada', 'restaurant']]) { execFileSync('python3', [path.join(ROOT, 'tools/interior_build.py'), id, ty], { env: { ...process.env, LF_ROOT: tmp, PYTHONDONTWRITEBYTECODE: '1' } }); check(fs.readFileSync(path.join(tmp, `data/interiors/${id}.json`), 'utf8') === fs.readFileSync(path.join(ROOT, `data/interiors/${id}.json`), 'utf8'), `8 the factory statement (interior ${id} ${ty}) reproduces the kit byte-for-byte`); }
console.log(fails ? `SPEC L12 FAIL (${fails})` : 'SPEC L12 OK'); process.exit(fails ? 1 : 0);
