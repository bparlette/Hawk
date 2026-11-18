// spec_cops.mjs — TEST-FIRST spec for task L15 (part 2), COPS / WANTED v1 (src/lf_cops.js; red until built).
//   node tools/spec_cops.mjs        (from games/laurel-fulton/)   exit 0 = green
// Everything is driven through the stick (lf_pilot) and the real sim: an offense raises the wanted level (1..3), cop cars spawn OUT OF
// SIGHT and pursue on the road graph, sitting pinned gets you BUSTED (a beat, no lasting penalty), losing them cools the level to 0.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js'); const { Pilot } = await import('../src/lf_pilot.js');
let CP = null, TR = null; try { TR = await import('../src/lf_traffic.js'); CP = await import('../src/lf_cops.js'); } catch (e) { check(false, 'src/lf_traffic.js + src/lf_cops.js load', String(e).slice(0, 160)); }
if (CP && TR) {
  const AREAS = J('data/areas.json'), G = J('data/graph.json'), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json'), BUMPS = J('data/bumps.json').bumps;
  const W = new GraphWorld(G), DT = 1 / 60;
  const ANCH = Object.values(G.anchors).map(a => W.verts[a.v]);
  const world = (copOpts = {}) => {
    const S = new LFSim(W, ROSTER, FLEET, { bumps: BUMPS, buildings: AREAS.buildings, greens: AREAS.green });
    const T = new TR.Traffic(S, W, { seed: 11, quiet: true }), C = new CP.Cops(S, W, T, { seed: 5, ...copOpts });
    const pilot = new Pilot(S, W, null); const from = ANCH[0], to = ANCH[ANCH.length - 1];
    const r = W.roadInfo(S.player.x, S.player.y, 0); if (r.e) S.player.h = Math.atan2(r.dy, r.dx);
    pilot.plan(to.x, to.y, false);
    const run = (secs, inpFn, each) => { for (let i = 0; i < secs * 60; i++) { const inp = inpFn ? inpFn() : { jx: 0, jy: 0, jm: 0, keys: {} }; S.step(DT, C.hold ? { jx: 0, jy: 0, jm: 0, keys: {} } : inp); T.step(DT); C.step(DT, { inCar: true }); if (each && each(i) === 'stop') return i / 60; } return secs; };
    const ahead = (n) => { const p = pilot.pts; let acc = 0, k = pilot.pi; while (k + 1 < p.length && acc < n) { acc += Math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]); k++; } return p[k]; };
    return { S, T, C, pilot, run, ahead };
  };
  check(CP.MAX_STARS === 3, 'wanted level is 1..3 (MAX_STARS named constant)', String(CP.MAX_STARS));
  for (const k of ['SPEED_OVER_MPH', 'COOL_TIME', 'BUST_TIME', 'BUST_SPEED', 'COP_SPAWN_MIN', 'COP_SPEED', 'OFFENSE_GAP']) check(typeof CP[k] === 'number', `tuning number ${k} is a named constant`, String(CP[k]));

  // 1 — a legal quiet drive raises nothing
  { const { S, C, pilot, run, ahead } = world({ noPatrol: true }); const p = ahead(380); C.spawnPatrol(p[0], p[1], S.player.h); let top = 0;
    run(45, () => { const i = pilot.steer(DT); i.jm = Math.min(i.jm, 0.2); return i; }, () => { top = Math.max(top, C.level); });
    check(C.level === 0 && top === 0, 'a calm drive past a cop never raises the wanted level', `level ${C.level}, speed ${Math.round(Math.abs(S.player.v) / 4.47)} mph`); }

  // 2 — SPEEDING in view of a patrol cop
  { const { S, T, C, pilot, run, ahead } = world({ noPatrol: true });
    run(5, () => pilot.steer(DT)); const p = ahead(650); C.spawnPatrol(p[0], p[1], S.player.h); let at = null; const maxMph = [];
    run(25, () => pilot.steer(DT), () => { maxMph.push(Math.abs(S.player.v) / 4.47); if (C.level > 0 && at === null) { at = S.time; return 'stop'; } });
    check(C.level === 1, 'speeding near a cop raises the level to 1', `level ${C.level} after ${at ? at.toFixed(1) : '-'} s at up to ${Math.round(Math.max(...maxMph))} mph`);
    check(C.log.some(l => l.kind === 'speeding'), 'the offense is logged as speeding', C.log.map(l => l.kind).join(','));
    check(C.chasers.length >= 1 || C.patrols.length >= 1, 'a cop is on you', `${C.chasers.length} chasing`); }
  // 2b — the same speed with NO cop around is not an offense
  { const { S, C, pilot, run } = world({ noPatrol: true }); run(15, () => pilot.steer(DT));
    check(C.level === 0, 'speeding with no cop in sight is not an offense', `level ${C.level} at ${Math.round(Math.abs(S.player.v) / 4.47)} mph`); }

  // 3/4/5 — RAM an ambient car: pursuit spawns out of sight, closes in by road, BUSTED when pinned, level clears
  { const { S, T, C, pilot, run, ahead } = world({ noPatrol: true });
    run(3, () => pilot.steer(DT)); const p = ahead(500); const car = T.spawnAt(p[0], p[1], S.player.h, { still: true });
    run(14, () => pilot.steer(DT), () => { if (C.level > 0) return 'stop'; });
    check(C.level >= 1, 'ramming an ambient car raises the level', `level ${C.level}, victim dmg ${car.dmg.toFixed(2)}`);
    check(C.log.some(l => l.kind === 'collision' || l.kind === 'wreck'), 'logged as a collision/wreck', C.log.map(l => l.kind).join(','));
    let near = null, samples = 0, off = 0, stuckMax = 0, stuck = new Map(), maxChasers = 0, ambOver = false;
    run(60, null, (i) => { maxChasers = Math.max(maxChasers, C.chasers.length); if (S.cars.filter(c => c.ambient).length > TR.AMBIENT_MAX) ambOver = true;
      for (const c of C.chasers) { if (i % 20 === 0) { samples++; const sf = W.surfaceAt(c.x, c.y, c.layer); if (sf === 'ground') off++; } const s = Math.abs(c.v) < 5 ? (stuck.get(c) || 0) + DT : 0; stuck.set(c, s); stuckMax = Math.max(stuckMax, s); if (Math.hypot(c.x - S.player.x, c.y - S.player.y) < 250 && near === null) near = S.time; }
      if (C.busted) return 'stop'; });
    check(C.stats.spawns.length >= 1 && C.stats.spawns.every(s => s.d >= 800), 'cop cars spawn out of sight (>= 80 m away)', C.stats.spawns.map(s => s.d | 0).join(','));
    check(near !== null, 'the pursuers reach you by road', near !== null ? `within 25 m at t=${near.toFixed(0)} s` : 'never');
    check(maxChasers >= 1 && maxChasers <= CP.MAX_STARS, 'pursuit size is capped by the level (<= 3 cars)', `max ${maxChasers}`);
    check(!ambOver, 'cops do not eat the ambient cap (ambient stays <= AMBIENT_MAX)');
    check(samples === 0 || off / samples < 0.25, 'pursuers drive the roads (< 25% of samples on lawns)', `${off}/${samples}`);
    check(stuckMax < 15, 'no pursuer stays wedged for long', `${stuckMax.toFixed(1)} s`);
    check(!!C.busted, 'sitting pinned with the cops on you ends in BUSTED', C.busted ? `t=${S.time.toFixed(0)} s` : 'not busted');
    const px = S.player.x, py = S.player.y; run(0.3);
    check(C.level === 0 && C.chasers.length === 0, 'a bust clears the level and ends the pursuit', `level ${C.level}, ${C.chasers.length} chasers`);
    check(S.cars.filter(c => c.cop && c.siren).length === 0, 'sirens go quiet after the bust');
    run(C.hold ? 6 : 0); check(!C.hold && !C.busted, 'the BUSTED beat ends by itself: control comes back (no lasting penalty)', `hold ${C.hold}`);
    check(!S.player.wreck && S.player.dmg < 1 && Math.hypot(S.player.x - px, S.player.y - py) < 400, 'no lasting penalty: same car, still on the road, not wrecked or teleported'); }

  // 6 — COOLDOWN: lose them and the level walks down to 0 by itself
  { const { S, T, C, run } = world({ noPatrol: true }); C.offense('test', 3);
    check(C.level === 3, 'level caps at 3 (three offenses at once)', String(C.level)); run(8);
    check(C.chasers.length >= 1 && C.chasers.length <= 3, 'three-star pursuit fields cops', `${C.chasers.length}`);
    C.opts.noSpawn = true; for (const c of C.chasers.slice()) { S.cars.splice(S.cars.indexOf(c), 1); } C.chasers.length = 0;   // they lost you: nobody in sight or near
    let first = null; const t0 = S.time; run(CP.COOL_TIME * 5, null, () => { if (C.level < 3 && first === null) first = S.time - t0; if (C.level === 0) return 'stop'; });
    check(first !== null && first <= CP.COOL_TIME + 1, 'out of sight and away from them the level starts dropping', `first drop after ${first ? first.toFixed(1) : '-'} s (COOL_TIME ${CP.COOL_TIME})`);
    check(C.level === 0, 'the cooldown clears the level to 0', `level ${C.level} after ${(S.time - t0).toFixed(0)} s`); }

  // 7 — HUD icons only, inside the slate budget
  { const { C } = world(); const b = C.hudBox(420, 860), frac = b.w * b.h / (420 * 860);
    check(frac <= 0.04, 'wanted indicator (stars only) fits the slate HUD budget (<= 4% of the screen)', `${(100 * frac).toFixed(2)}%`);
    const calls = []; const g = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : typeof k === 'symbol' ? undefined : (...a) => { calls.push(k); }, set: () => true });
    C.offense('test', 2); let ok = true; try { C.drawHud(g, 420, 860); } catch (e) { ok = false; }
    check(ok && calls.includes('fill'), 'drawHud paints the stars without throwing'); }

  // 8 — siren light bar + glow recipes exist (Palm City's drawSiren, ported)
  { const calls = []; const g = new Proxy({}, { get: (t, k) => k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : (...a) => { calls.push(k); }, set: () => true });
    let ok = true; try { CP.drawSirenGlow(g, { x: 0, y: 0, h: 0, len: 48, wid: 20 }, 1.0); CP.drawLightBar(g, { x: 0, y: 0, h: 0, len: 48, wid: 20 }, 1.0); } catch (e) { ok = false; }
    check(ok && calls.length > 4, 'light-bar flash + siren glow draw (red/blue alternating)'); }
}
console.log(fails ? `FAIL: ${fails} check(s)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
