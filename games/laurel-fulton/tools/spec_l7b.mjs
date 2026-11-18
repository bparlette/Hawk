// spec_l7b.mjs — L7 REMAINDER (Nov 18): computer + mom, CPU Brad indoors, Rigg's house, the Scooby-Doo van, Rigg-isms.
//   node tools/spec_l7b.mjs   (from games/laurel-fulton/)   Stick + ACTION only (Palm City's input shape) through Interior.step /
//   lf_climb.stepOnFoot — the calls main.js makes each frame. (The CrewWorld half of "CPU Brad idles inside" is spec_l6 9-11.)
//  1 Brad's basement COMPUTER (screen: eDonkey) is in the kit AND the cutaway draws it; Brad's mom greets in two beats:
//    "Hi guys, what are you getting into today?...." then "You are all alcoholics."
//  3 a crew CPU at home is IN the house (guest): Jason walks into Brad's house and CPU Brad is down by the fire with a beer, sipping
//  4 RIGG'S HOUSE (kit two-story-entry, reproduced byte-for-byte from the factory statement): big two-story entryway, Brian's bedroom door
//    visible from it, stairs are push-UP/DOWN; walk in -> the dad yells "Brrrrrriiiiiiaaaaannnn" -> Brian comes down the stairs (not when
//    you ARE Brian); the basement = his computer (eDonkey) + a CD writer; EXIT works
//  5 the Scooby-Doo van: its body is a wall on foot, its EXHAUST TIP is a step: walk into it -> lf_climb haul-up, a puff, you stand on it
//  6 Rigg-isms: IGURT GOGURT / fuck shit diesel at random, spaced out, never twice in a row; indoors too, only for Rigg
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f)));
const KB = J('data/interiors/brad.json'), KR = J('data/interiors/rigg.json');
const { Interior } = await import('../src/lf_interior.js'), { Barker, RIGGISMS } = await import('../src/lf_riggisms.js');
const { ScoobyVan, mergedSupport, VAN } = await import('../src/lf_van.js'), { stepOnFoot } = await import('../src/lf_climb.js');
const DT = 1 / 60, stick = (jx, jy = 0) => ({ jx, jy, jm: Math.hypot(jx, jy) ? 1 : 0, keys: {} });
const driver = (I) => {
  const h = I.hero;
  const run = (inp, secs, until) => { for (let t = 0; t < secs; t += DT) { const r = I.step(DT, typeof inp === 'function' ? inp() : inp); if (r) return r; if (until && until()) return true; } return false; };
  const act = () => I.step(DT, { jx: 0, jy: 0, jm: 0, keys: {}, action: true });
  const goTo = (x) => run(() => stick(Math.sign(x - h.x)), 10, () => Math.abs(h.x - x) < 0.3 && !h.link);
  return { h, run, act, goTo };
};
// ---------- 1 computer + mom
const P = (K, k) => K.props.filter(p => p.kind === k);
check(P(KB, 'computer')[0]?.floor === 'lower' && P(KB, 'computer')[0].screen === 'eDonkey', "1 Brad's basement computer is in the kit (floor lower), its screen says eDonkey");
{
  const calls = []; const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (...a) => { calls.push([k, ...a]); if (/^create.*Gradient$/.test(k)) return { addColorStop() {} }; if (k === 'measureText') return { width: 40 }; return undefined; }, set: (t, k, v) => { t[k] = v; return true; } });
  globalThis.document = { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };
  const { InteriorRenderer } = await import('../src/lf_interior_render.js'), IR = new InteriorRenderer(ctx);
  const I = new Interior(KB, { who: { id: 'brad', name: 'Brad' } }); IR.draw(I, 420, 860, 2, 1.0);
  check(calls.some(c => c[0] === 'fillText' && c[1] === 'eDonkey') && calls.some(c => c[0] === 'fillText' && /eDonkey2000/.test(c[1])), "1 the cutaway DRAWS the computer: the word eDonkey is painted on its screen");
  const IRg = new Interior(KR, { who: { id: 'jason', name: 'Jason' } }); calls.length = 0; IR.draw(IRg, 420, 860, 2, 1.0);
  check(calls.some(c => c[0] === 'fillText' && c[1] === 'eDonkey') && calls.some(c => c[0] === 'fillText' && c[1] === 'CD-R 4x') && calls.some(c => c[0] === 'fillText' && c[1] === 'BRIAN'), "1/4 Rigg's cutaway draws his computer (eDonkey), the CD writer and the BRIAN bedroom door");
}
{
  const I = new Interior(KB, { who: { id: 'jason', name: 'Jason' } }), { h, run } = driver(I);
  run(stick(1, -0.3), 6, () => h.floor === 'main'); const first = I.teter.said; run(stick(0), 3.4);
  check(first === 'Hi guys, what are you getting into today?....' && I.teter.said === 'You are all alcoholics.', "1 Brad's mom (HOUSE BEAT): 'Hi guys, what are you getting into today?....' then 'You are all alcoholics.'", `"${first}" -> "${I.teter.said}"`);
}
// ---------- 3 CPU Brad inside
{
  const I = new Interior(KB, { who: { id: 'jason', name: 'Jason' }, guests: [{ id: 'brad', name: 'Brad' }] }), g = I.guests[0], { h, run } = driver(I);
  let sipped = false; run(stick(0), 14, () => { if (g.drinkT > 0) sipped = true; return false; });
  check(g && g.floor === 'lower' && g.x === KB.cpuIdle.x && g.floor === P(KB, 'fireplace')[0].floor && Math.abs(g.x - P(KB, 'fireplace')[0].x) < 2 && sipped, '3 Jason walks into Brad\'s house: CPU Brad is down by the fire with a beer, and sips it', `Brad @ ${g && g.floor}:${g && g.x}, fire @ ${P(KB, 'fireplace')[0].x}`);
  const J2 = new Interior(KB, { who: { id: 'brad', name: 'Brad' }, guests: [{ id: 'brad', name: 'Brad' }] });
  check(J2.guests.length === 0, '3 ... but when YOU are Brad there is no second Brad');
}
// ---------- 4 Rigg's house
{
  const F = Object.fromEntries(KR.floors.map(f => [f.id, f]));
  check(KR.type === 'two-story-entry' && F.upper.z - F.main.z > 2.4 && KR.rooms.find(r => r.name === 'two-story entryway').h > 5 && P(KR, 'door')[0]?.label === 'BRIAN' && P(KR, 'door')[0].floor === 'upper' && F.lower.z < KR.grade, "4 Rigg's kit: a TWO-STORY entryway (open to the roof), Brian's bedroom door upstairs, a sunk basement", `storey ${(F.upper.z - F.main.z).toFixed(1)} m`);
  check(P(KR, 'computer')[0]?.floor === 'lower' && P(KR, 'computer')[0].screen === 'eDonkey' && P(KR, 'cdwriter')[0]?.floor === 'lower' && KR.dad && KR.son && KR.cpuIdle.floor === 'lower', '4 basement = his computer + CD writer; the dad and Brian are cast; CPU-Brian idles down there');
  // the beat, with a visitor
  const I = new Interior(KR, { who: { id: 'jason', name: 'Jason' } }), { h, run, act, goTo } = driver(I), seen = new Set();
  check(h.floor === 'main' && I.son.floor === 'upper', '4 you walk in on the FIRST floor; Brian is up in his bedroom');
  run(stick(0), 8, () => { seen.add(I.son.link ? 'link' : I.son.floor); return I.events.some(e => e.kind === 'son_down'); });
  const ev = (k) => I.events.find(e => e.kind === k);
  check(ev('dad_yell') && I.dad.said === 'Brrrrrriiiiiiaaaaannnn' && ev('dad_yell').t < ev('son_coming').t && ev('son_coming').t < ev('son_down').t, "4 HOUSE BEAT: the old guy yells 'Brrrrrriiiiiiaaaaannnn', THEN Brian starts for the stairs", `yell ${ev('dad_yell')?.t.toFixed(1)} s, coming ${ev('son_coming')?.t.toFixed(1)} s`);
  check(seen.has('upper') && seen.has('link') && I.son.floor === 'main' && ev('son_down') && Math.abs(I.son.x - (h.x + 1.4)) < 1.3, '4 ... Brian comes DOWN THE STAIRS (bedroom floor -> the flight -> the first floor) and meets you at the foot of them', `son @ ${I.son.floor}:${I.son.x.toFixed(2)}, hero ${h.x.toFixed(2)}`);
  check(new Interior(KR, { who: { id: 'rigg', name: 'Rigg' } }).son === null, '4 ... when YOU are Brian there is no second Brian');
  // stairs: plain walking right does NOT climb (the flight overlaps the floor); push UP at the foot does
  I.hero.x = 0.9; run(stick(1, 0), 3, () => h.x > 3.5);
  check(h.floor === 'main' && h.x > 3.5, '4 stairs overlap the floor: walking right along the entry does NOT climb them');
  goTo(0.9); run(stick(1, -0.7), 8, () => h.floor === 'upper');
  check(h.floor === 'upper' && Math.abs(h.z - F.upper.z) < 1e-6, '4 push UP at the foot -> up the long flight to the upstairs hall', `z ${h.z.toFixed(2)}`);
  goTo(P(KR, 'door')[0].x - 1.0); const roomHall = I.roomOf(h);
  run(stick(-1, 0), 4, () => h.floor !== 'upper'); const stillUp = h.floor === 'upper';
  check(roomHall === 'upstairs hall' && stillUp, "4 Brian's bedroom door is at the end of the hall; walking left along it does not drop you down the stairs");
  run(stick(-1, 0.8), 8, () => h.floor === 'main'); check(h.floor === 'main', '4 push DOWN at the top of the stairs -> back to the entry');
  goTo(KR.props.find(p => p.kind === 'cellardoor').x); run(stick(0, 0.8), 6, () => h.floor === 'lower');
  check(h.floor === 'lower', '4 the cellar door at the back -> down to the basement');
  goTo(P(KR, 'cooler')[0].x); const pr = I.prompt(); act(); const pr2 = I.prompt(); act(); run(stick(0), 3);
  check(pr === 'GRAB BEER' && pr2 === 'DRINK' && h.drank === 1, "4 a beer in Brian's basement (cooler, DRINK)");
  goTo(P(KR, 'computer')[0].x + 0.5); check(I.roomOf(h) === "Brian's basement", "4 down at the computer: Brian's basement");
  run(stick(1, -0.7), 8, () => h.floor === 'main'); check(h.floor === 'main', '4 push UP at the foot of the cellar stairs -> back up');
  goTo(0.35); const out = (I.prompt() === 'EXIT') && act();
  check(out === 'exit', '4 out the front door');
}
{
  const tmp = fs.mkdtempSync('/tmp/l7b-'); fs.mkdirSync(path.join(tmp, 'data'));
  execFileSync('python3', [path.join(ROOT, 'tools/interior_build.py'), 'rigg', 'two-story-entry', 'up', 'couch,tv,rug,lamp,plant,chandelier', 'down', 'cooler,computer,cdwriter,couch,rug,lamp', 'upper', 'picture,plant,lamp,speaker,bed', 'dad', "Brian's dad", 'son', 'Brian'], { env: { ...process.env, LF_ROOT: tmp } });
  check(fs.readFileSync(path.join(tmp, 'data/interiors/rigg.json'), 'utf8') === fs.readFileSync(path.join(ROOT, 'data/interiors/rigg.json'), 'utf8'), '4 the factory statement (interior rigg two-story-entry ...) reproduces rigg.json byte-for-byte');
  const sp = fs.readFileSync(path.join(ROOT, 'tools/factory/examples/laurel-fulton.spec'), 'utf8');
  check(sp.includes('interior rigg two-story-entry') && sp.includes('lamp,computer mantle-beers'), '4/1 the factory example spec states both kits (Brad with the computer, Rigg)');
}
// ---------- 5 the van
{
  const car = { x: 1000, y: 500, h: 0, len: VAN.len, wid: VAN.wid }, van = new ScoobyVan(car), SUP = mergedSupport(() => null, () => van), e = van.exhaust();
  const foot = (x, y, h) => ({ who: { id: 'rigg', name: 'Rigg' }, active: true, x, y, h, px: x, py: y, walk: 0, pose: 1, punchT: 0, punchCd: 0, z: 0, vz: 0, air: false, climb: null, land: 0 });
  check(van.support(car.x, car.y).kind === 'van' && van.support(car.x, car.y).top === VAN.h && van.support(e.x, e.y).kind === 'exhaust' && van.support(e.x, e.y).top === VAN.exhaustTop && van.support(car.x + 200, car.y).top === 0, '5 the van: body = a solid wall, the exhaust tip at the rear corner = a 0.5 m step, nothing else', `tip @ ${e.x.toFixed(1)},${e.y.toFixed(1)}`);
  const F = foot(car.x, car.y + 40, -Math.PI / 2);
  for (let t = 0; t < 2.5; t += DT) { stepOnFoot(F, DT, stick(0, -1), SUP); van.step(DT, F); }
  check(F.z === 0 && F.y >= car.y + VAN.wid / 2 - 2 && !F.climb, 'on foot the van BODY is a wall (taller than a mantle): you stop at its side', `y ${F.y.toFixed(1)} (side at ${(car.y + VAN.wid / 2).toFixed(1)})`);
  const G = foot(e.x - 22, e.y, 0); let climbed = null, minZ = 0, peak = 0;
  for (let t = 0; t < 2.4; t += DT) { const r = stepOnFoot(G, DT, stick(1, 0), SUP); if (r === 'climb') climbed = { ...G.climb }; van.step(DT, G); peak = Math.max(peak, G.z); }
  check(climbed && climbed.onto === 'exhaust' && G.z === VAN.exhaustTop && !G.climb && van.standing, '5 walk into the exhaust tip: lf_climb hauls you up (the step-up hop) and you are STANDING on it', `climb ${climbed ? climbed.dur.toFixed(2) + ' s onto ' + climbed.onto : 'none'}, z ${G.z}`);
  check(van.steppedOn === 1 && van.count >= 1 && van.puffs.length > 0, '5 ... and the tailpipe answers with a PUFF of exhaust', `${van.puffs.length} puff particles`);
  for (let t = 0; t < 3; t += DT) { stepOnFoot(G, DT, stick(0, 0), SUP); van.step(DT, G); }
  check(van.count >= 2, '5 stand on it and it chuffs again', `${van.count} puffs so far`);
  for (let t = 0; t < 1.5; t += DT) { stepOnFoot(G, DT, stick(-1, 0), SUP); van.step(DT, G); }
  check(G.z === 0 && !van.standing, '5 step back off: down to the road, no longer standing on it', `z ${G.z}`);
}
// ---------- 6 Rigg-isms
{
  const B = new Barker(7), said = [], gaps = []; let lastT = 0;
  for (let t = 0; t < 1200; t += 0.1) { const b = B.step(0.1); if (b) { said.push(b); gaps.push(t - lastT); lastT = t; } }
  check(said.includes('IGURT GOGURT') && said.includes('fuck shit diesel') && said.every(s => RIGGISMS.includes(s)) && said.every((s, i) => i === 0 || s !== said[i - 1]), "6 Rigg-isms: 'IGURT GOGURT' and 'fuck shit diesel', random, never the same one twice running", `${said.length} barks in 20 min`);
  check(gaps.slice(1).every(g => g >= 13.9 && g <= 30.5) && said.length > 20 && said.length < 120, '6 ... light: one every 14-30 s (ambient, not constant)', `gaps ${Math.min(...gaps.slice(1)).toFixed(0)}-${Math.max(...gaps.slice(1)).toFixed(0)} s`);
  const I = new Interior(KR, { who: { id: 'rigg', name: 'Rigg' } }), { run } = driver(I); let shown = null; run(stick(0), 60, () => { if (I.hero.said) shown = I.hero.said; return false; });
  const J2 = new Interior(KR, { who: { id: 'jason', name: 'Jason' } }), d2 = driver(J2); d2.run(stick(0), 60);
  check(RIGGISMS.includes(shown) && I.events.some(e => e.kind === 'rigg_bark') && !J2.events.some(e => e.kind === 'rigg_bark'), '6 indoors Rigg barks over his head too — and only Rigg does', `shown "${shown}"`);
}
console.log(fails ? `SPEC L7b FAIL (${fails})` : 'SPEC L7b OK'); process.exit(fails ? 1 : 0);
