// spec_party.mjs — THE NIGHT PARTY (owner, Nov 18): ~100 people at Kosack's (basement walk-out + the pool in the back yard) or the Floyds' split foyer.
//   node tools/spec_party.mjs      (from games/laurel-fulton/)  exit 0 = green
// Headless: the layout is deterministic, so it counts heads and checks where they stand against the REAL footprints + road graph.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.LF_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const rd = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f)));
const G = rd('data/graph.json'), ROSTER = rd('data/roster.json'), FLEET = rd('assets/fleet.json'), AJ = rd('data/areas.json');
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js'); const { Areas } = await import('../src/lf_areas.js'); const { Party, PARTY } = await import('../src/lf_party.js'); const FX = await import('../src/lf_fx.js');
const W = new GraphWorld(G), S = new LFSim(W, ROSTER, FLEET, { spawn: { x: 0, y: 0 } }); S.setBuildings(AJ.buildings); const areas = new Areas(AJ, W);
const PT = new Party({ venue: 'both' }); check(PT.build(S, areas) && PT.sites.length === 2, 'both venues build against the real map (Kosack + the Floyds)', PT.sites.map(s => s.id).join(' '));
const inPoly = (f, x, y) => { let ins = false; for (let k = 0; k < f.length; k += 2) { const ax = f[k], ay = f[k + 1], ex = f[(k + 2) % f.length], ey = f[(k + 3) % f.length]; if ((ay > y) !== (ey > y) && x < (ex - ax) * (y - ay) / (ey - ay) + ax) ins = !ins; } return ins; };
const onBuilding = (x, y) => S.houses.some((f, i) => { const b = S.houseBox[i]; return x > b[0] && x < b[2] && y > b[1] && y < b[3] && inPoly(f, x, y); });
for (const st of PT.sites) {
  const tag = `[${st.id}]`, kinds = {}; for (const p of st.people) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
  check(st.people.length === PARTY.total, `${tag} a party of ${PARTY.total} people`, JSON.stringify(kinds));
  const bad = st.people.filter(p => onBuilding(p.ox, p.oy) || inPoly(st.big, p.ox, p.oy) || (() => { const r = W.roadInfo(p.ox, p.oy, 0); return r.e && r.d < r.hw; })());
  check(bad.length === 0, `${tag} nobody stands inside a house or in the road`, `${bad.length} bad of ${st.people.length}`);
  const far = st.people.filter(p => Math.hypot(p.ox - st.cx, p.oy - st.cy) > 450);
  check(far.length === 0, `${tag} everyone is at the house (within 45 m)`, `${far.length} farther`);
  const outs = new Set(st.people.map(p => p.o)); check([...outs].every(o => FX.PED_OUTFITS.includes(o)) && outs.size >= 6, `${tag} the crowd is Palm City's own ped sprites (${outs.size} different outfits, none redrawn)`);
  check((kinds.front || 0) >= 8 && (kinds.patio || 0) >= 10 && (kinds.yard || 0) >= 10, `${tag} spread over the front yard, the basement patio and the back lawn`);
  if (st.pool) {
    const p = st.pool, ok = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].every(([a, b]) => { const lx = a * (p.w / 2 + 14), ly = b * (p.h / 2 + 14), x = p.cx + Math.cos(p.a) * lx - Math.sin(p.a) * ly, y = p.cy + Math.sin(p.a) * lx + Math.cos(p.a) * ly, r = W.roadInfo(x, y, 0); return !onBuilding(x, y) && !(r.e && r.d < r.hw); });
    const back = (p.cx - st.cx) * Math.cos(st.fa) + (p.cy - st.cy) * Math.sin(st.fa);
    check(ok && back < 0, `${tag} the POOL (11 x 6 m) sits in the back yard — behind the house, off every road and neighbour`, `${(back / 10).toFixed(0)} m behind the centre`);
    check((kinds.pool || 0) >= 8 && (kinds.deck || 0) >= 14, `${tag} swimmers in the pool and guests on the deck`, `${kinds.pool} in, ${kinds.deck} around`);
  } else check(!st.pool, `${tag} (split foyer: no pool, the party is front + back + basement)`);
}
check(PT.count(0.05) === 0 && PT.count(0.3) === 0, 'golden hour: the yard is empty', `${PT.count(0.05)} people`);
const c = [0.5, 0.6, 0.7, 0.8, 0.9, 0.97].map(t => PT.count(t)); check(c.every((v, i) => !i || v >= c[i - 1]) && c[0] === 0 && c[5] === 100 && c[2] > 0 && c[2] < 100, 'as the Palm City dusk deepens the crowd ARRIVES (monotonic 0 -> 100)', c.join(' -> '));
const sh = PT.shown(PT.sites[0], 0.7).length; check(sh === PT.count(0.7), 'the heads on screen match the count at that hour', `${sh} at t=0.7`);
// render smoke: every pass runs at day and night with a recording context, nothing throws
const mock = () => new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop() {} }) : (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
let threw = null; try { for (const tod of [0.1, 0.7, 0.97]) { const g = mock(); const st = PT.sites[0], cam = { x: st.cx, y: st.cy, zoom: 0.62 }, v = { vw: 420, vh: 860, tod, vis: () => true }; PT.under(g, S, cam, 3, v); PT.over(g, S, cam, 3, v); PT.post(g, S, cam, 3, v); } } catch (e) { threw = e; }
check(!threw, 'under / over / post draw passes run at golden hour, dusk and night', threw ? String(threw.stack).slice(0, 200) : '');
// the LIVE wrapper (main.js uses NightParty: drawWorld = under, drawLights = the crowd + lights in world space after the grade; banner / HELP / interiors)
{
  const { NightParty } = await import('../src/lf_party.js'); const NP = new NightParty(); NP.build(S, areas);
  const g = mock(); let ok = true; try { for (const tod of [0.1, 0.7, 0.97]) { NP.step(tod, { x: PT.sites[1].cx, y: PT.sites[1].cy }); NP.drawWorld(g, 3, () => true); NP.drawLights(g, tod, 3, () => true); } } catch (e) { ok = String(e.stack).slice(0, 200); }
  check(ok === true, 'NightParty (the live wrapper main.js calls) draws world + lights at day, dusk and night', ok === true ? '' : ok);
  NP.step(0.97, { x: PT.sites[1].cx, y: PT.sites[1].cy }); check(NP.count() === 100 && /NIGHT PARTY · 100 GUESTS \(FLOYDS\)/.test(NP.banner()), 'the banner follows the venue you are nearer to (the Floyds here)', NP.banner());
  NP.step(0.97, { x: PT.sites[0].cx, y: PT.sites[0].cy }); check(/KOSACK/.test(NP.banner()), 'and Kosack\'s when you are there', NP.banner());
  NP.step(0.1, { x: 0, y: 0 }); check(NP.banner() === null, 'no banner at golden hour');
  NP.setVenue('floyds'); NP.step(0.97, { x: PT.sites[0].cx, y: PT.sites[0].cy }); check(/FLOYDS/.test(NP.banner()), '?party=floyds forces the featured venue (venue rotation off)', NP.banner());
}
console.log(fails ? `SPEC PARTY FAIL (${fails})` : 'SPEC PARTY OK'); process.exit(fails ? 1 : 0);
