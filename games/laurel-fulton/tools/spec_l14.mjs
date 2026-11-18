// spec_l14.mjs — task L14, KOSACK'S HOUSE (three-level cutaway) + DOOR STAGING at the Lazaris house and Grant's (owner, Nov 18).
//   node tools/spec_l14.mjs        (from games/laurel-fulton/)   exit 0 = green
// Built FROM the existing kit (interior_build.py -> data/interiors/<id>.json, lf_interior.js), no new system:
//  1 three levels: basement (ARCADE + FULL BAR + GIANT HOLE IN THE WALL, the party room) + the big top two floors; registered
//  2 the bark beat, verbatim and in order: Kosack (top stair hallway) "Chinese food is here." -> Rigg "watch wang wash wang." ->
//    Kosack "shut up."; as Kosack you say his lines yourself
//  3 framing (the viral-short audit): every speaker stands within 4.5 m of the front door, so the bubbles stay in the portrait frame
//  4 it plays through the real input path: stick down the stairs to the arcade (PLAY), the bar (GRAB BEER, DRINK), out the door
//  5 door staging inside the rally's own arrival beat: Lazaris — the boots + Rigg "why are my boots in the yard" -> Jimmy
//    "Mamma duke a timberland hater" (in that order); Grant — his mom at the door: "move your car"
//  6 the factory statement reproduces kosack.json byte-for-byte
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f)));
const K = J('data/interiors/kosack.json'), IX = J('data/interiors/index.json');
const { Interior } = await import('../src/lf_interior.js');
const F = Object.fromEntries(K.floors.map(f => [f.id, f])), kinds = (fl) => K.props.filter(p => p.floor === fl).map(p => p.kind);
check(K.type === 'three-level' && F.lower.z < 0 && F.main && F.upper && F.upper.z > F.main.z && IX.includes('kosack'), '1 a THREE-LEVEL cutaway (basement + the big top two floors), registered in index.json', `floors ${K.floors.map(f => f.id + '@' + f.z).join(' ')}`);
check(['arcade', 'bar', 'hole'].every(k => kinds('lower').includes(k)) && K.party && K.party.floor === 'lower', '1 the basement: an arcade, a full bar, a GIANT HOLE IN THE WALL — and it is the night party room', kinds('lower').join(','));
const want = [['kosack', 'Chinese food is here.'], ['rigg', 'watch wang wash wang.'], ['kosack', 'shut up.']];
const play = (who) => { const I = new Interior(K, { who }); for (let t = 0; t < 8; t += 1 / 60) I.step(1 / 60, { jx: 0, jy: 0, jm: 0, keys: {} }); return I; };
const I1 = play({ id: 'brad', name: 'Brad' }), got = I1.events.filter(e => e.kind === 'bark').map(e => [e.who, e.text]);
check(JSON.stringify(got) === JSON.stringify(want), '2 the bark beat, verbatim and in order (walking in as Brad)', got.map(g => g[1]).join(' -> '));
check(K.barks[0].floor === 'upper' && K.rooms.some(r => r.floor === 'upper' && r.name === 'top stair hallway' && K.barks[0].x >= r.x0 && K.barks[0].x <= r.x1), '2 Kosack yells from the TOP STAIR HALLWAY');
const I2 = play({ id: 'kosack', name: 'Kosack' });
check(I2.callers.length === 1 && I2.callers[0].id === 'rigg' && I2.events.filter(e => e.kind === 'bark').length === 3, '2 as Kosack: you yell your own lines, Rigg answers', I2.callers.map(c => c.id).join(','));
check(K.barks.every(b => Math.abs(b.x - K.door.x) <= 4.5), '3 framing: every speaker within 4.5 m of the front door (bubbles stay in the portrait frame)', K.barks.map(b => `${b.who}@${(b.x - K.door.x).toFixed(1)}m`).join(' '));
// 4 the real input path
const I = new Interior(K, { who: { id: 'jason', name: 'Jason' } }), h = I.hero, DT = 1 / 60;
const run = (inp, secs, until) => { for (let t = 0; t < secs; t += DT) { const r = I.step(DT, inp); if (r) return r; if (until && until()) return true; } return false; };
const stick = (jx, jy = 0) => ({ jx, jy, jm: 1, keys: {} }), act = () => I.step(DT, { jx: 0, jy: 0, jm: 0, keys: {}, action: true });
const L = K.links.find(l => l.id === 'down');
run(stick(1), 8, () => Math.abs(h.x - L.ax) < 0.2); run(stick(0, 1), 6, () => h.floor === 'lower');
check(h.floor === 'lower', '4 down the stairs to the basement (stick)');
const ar = K.spots.find(s => s.act === 'PLAY'); run(stick(Math.sign(ar.x - h.x)), 8, () => Math.abs(h.x - ar.x) < 0.3);
const p1 = I.prompt(); act(); check(p1 === 'PLAY' && I.events.some(e => e.kind === 'arcade'), '4 PLAY a cabinet in the arcade');
const bs = K.spots.find(s => s.src === 'bar'); run(stick(Math.sign(bs.x - h.x)), 10, () => Math.abs(h.x - bs.x) < 0.3);
const p2 = I.prompt(); act(); const p3 = I.prompt(); act(); run(stick(0), 3);
check(p2 === 'GRAB BEER' && p3 === 'DRINK' && h.drank === 1, '4 a beer from the full bar, drunk in the basement', `drank ${h.drank}`);
run(stick(-1), 10, () => Math.abs(h.x - L.bx) < 0.2); run(stick(0, -1), 6, () => h.floor === 'main'); run(stick(-1), 8, () => Math.abs(h.x - K.door.x) < 0.3);
check(I.prompt() === 'EXIT' && act() === 'exit', '4 back up and out the front door');
// 5 door staging, inside the rally's own arrival beat
const MI = await import('../src/lf_mission.js'); const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const RO = J('data/roster.json'); RO.beats = J('data/beats.json');
const W = new GraphWorld(J('data/graph.json'));
const doorBeat = (me, houseOf) => {
  const S = new LFSim(W, RO, J('assets/fleet.json'), { spawn: { x: 0, y: 0 } }), M = MI.startRally(S, RO, me);
  const st = M.stops.find(s => s.people.some(p => p.id === houseOf)); S.player.x = st.kx; S.player.y = st.ky; S.player.v = 0;
  const said = []; let boots = false, door = null;
  for (let t = 0; t < 14 && !st.done; t += DT) { MI.stepRally(S, M, DT); const B = M.beat; if (B && B.say && said[said.length - 1] !== B.say.who + ':' + B.say.text) said.push(B.say.who + ':' + B.say.text); if (B && B.stage) { door = B.stage.door; boots = boots || !!B.stage.boots; } }
  return { st, said, boots, door };
};
const lz = doorBeat('rigg', 'jimmy');
check(lz.st.done && lz.door && Math.hypot(lz.door.x - RO.people.find(p => p.id === 'jimmy').house[0], lz.door.y - RO.people.find(p => p.id === 'jimmy').house[1]) < 1 && lz.boots, "5 Lazaris: Jimmy's mom at the FRONT DOOR, the boots thrown into the yard", '');
check(JSON.stringify(lz.said) === JSON.stringify(['rigg:why are my boots in the yard', 'jimmy:Mamma duke a timberland hater']), '5 Lazaris: Rigg "why are my boots in the yard" -> Jimmy "Mamma duke a timberland hater", in that order', lz.said.join(' -> '));
const gr = doorBeat('brad', 'grant');
check(gr.st.done && gr.door && gr.said.length >= 1 && gr.said.every(s => s.startsWith('door:') && /move your car/i.test(s)), "5 Grant: his mom at the front door yelling \"move your car\"", gr.said.join(' -> '));
check(!fs.existsSync(path.join(ROOT, 'data/interiors/jimmy.json')) && !fs.existsSync(path.join(ROOT, 'data/interiors/grant.json')), '5 neither house gets an interior (the beat is at the door)');
// 6 factory reproduction
const tmp = fs.mkdtempSync('/tmp/l14-'); fs.mkdirSync(path.join(tmp, 'data'));
execFileSync('python3', [path.join(ROOT, 'tools/interior_build.py'), ...'kosack three-level up couch,tv,rug,lamp,cooler,fridge,table upper picture,plant,bed,speaker down arcade,couch,hole,bar,speaker mantle-beers 8 host Kosack'.split(' ')], { env: { ...process.env, LF_ROOT: tmp } });
check(fs.readFileSync(path.join(tmp, 'data/interiors/kosack.json'), 'utf8') === fs.readFileSync(path.join(ROOT, 'data/interiors/kosack.json'), 'utf8'), '6 the factory statement reproduces kosack.json byte-for-byte');
console.log(fails ? `SPEC L14 FAIL (${fails})` : 'SPEC L14 OK'); process.exit(fails ? 1 : 0);
