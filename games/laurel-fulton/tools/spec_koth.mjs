// spec_koth.mjs — Cul-de-Sac King of the Hill: BUTTON start (never auto-fires), bumper rules, eliminations, winners.
//   node tools/spec_koth.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { GraphWorld } = await import(path.join(ROOT, 'src/world_graph.js'));
const { LFSim } = await import(path.join(ROOT, 'src/lf_sim.js'));
const { KingOfTheHill } = await import(path.join(ROOT, 'src/lf_koth.js'));
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const W = new GraphWorld(J('data/graph.json')), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json'), BUMPS = J('data/bumps.json').bumps, SACS = J('data/culdesacs.json');
let fails = 0; const check = (ok, label, extra = '') => { console.log((ok ? 'PASS' : 'FAIL'), label, extra); if (!ok) fails++; };
const ZERO = { jx: 0, jy: 0, jm: 0, keys: {}, action: false, punch: false, turbo: false };
check(SACS.length > 250, 'the map has its cul-de-sacs', SACS.length + ' rings');
const sac = SACS.find(s => s.name === 'Dulaney Place') || SACS[0];
const boot = () => {
  const S = new LFSim(W, ROSTER, FLEET, { spawn: { x: sac.x, y: sac.y }, bumps: BUMPS });
  const K = new KingOfTheHill(SACS);
  const billy = S.cars.find(c => c.owner === 'billy');
  return { S, K, billy };
};
const run = (S, K, secs) => { for (let i = 0; i < secs * 30; i++) { K.step(S, 1 / 30); S.step(1 / 30, ZERO); } };
// 1) everyone in, NOBODY presses: NO round, ever (owner, Nov 17: the rally piles the crew into
//    cul-de-sacs at every house stop — the mode must never auto-fire)
{ const { S, K, billy } = boot(); billy.parked = false; billy.x = sac.x + 40; billy.y = sac.y; billy.v = 0;
  run(S, K, 3); check(K.state === 'idle', 'everyone in but no button press: no round', K.state);
  check(!!K.candidate(S), 'the player sitting in a cul-de-sac is the candidate ring', ''); }
// 1b) the button alone in the ring: refused, with the hint
{ const { S, K } = boot();
  check(K.tryStart(S) === false && K.state === 'idle' && (K.banner() || '').includes('NEED A RIVAL'), 'button alone: refused with the rival hint', K.banner() || ''); }
// 1c) the button starts it; the starter driving off during the count cancels it
{ const { S, K, billy } = boot(); billy.parked = false; billy.x = sac.x + 40; billy.y = sac.y; billy.v = 0;
  check(K.tryStart(S) === true && K.state === 'count', 'button with a rival in: the countdown fires', K.state);
  S.player.x = sac.x + 900; run(S, K, 0.5); check(K.state === 'idle', 'starter left during the count: round cancelled', K.state); }
// 2) button -> countdown -> round; bumper contact dents nothing; exit eliminates; last car wins
{ const { S, K, billy } = boot(); billy.parked = false; billy.x = sac.x + 40; billy.y = sac.y; billy.v = 0;
  K.tryStart(S); run(S, K, 0.5); check(K.state === 'count', 'countdown running', K.state);
  run(S, K, 3.2); check(K.state === 'round' && S.kothBoost, 'round on, bumper rules on', K.state);
  const P = S.player; P.x = sac.x; P.y = sac.y; P.h = 0; P.dirx = 1; P.diry = 0; P.v = 150;
  billy.x = sac.x + 30; billy.y = sac.y; billy.h = Math.PI; billy.dirx = -1; billy.diry = 0; billy.v = 150;
  run(S, K, 0.5);
  check(P.dmg === 0 && billy.dmg === 0, 'bumper contact dents NOTHING', `dmg ${P.dmg}/${billy.dmg}`);
  billy.x = sac.x + 500; billy.y = sac.y; run(S, K, 1.2);
  check(K.state === 'done' && K.winner === P, 'out of the ring: eliminated; last car in wins', `${K.state} / ${K.winnerName}`);
  check((K.banner() || '').includes('TAKES THE CUL-DE-SAC'), 'the banner crowns the winner', K.banner() || '');
  check(K.winnerName === 'Brad', 'the winner is named', K.winnerName);
}
// 3) the clock decides: closest to the centre when time runs out
{ const { S, K, billy } = boot(); billy.parked = false; billy.x = sac.x + 15; billy.y = sac.y; billy.v = 0;
  const P = S.player; P.x = sac.x + 100; P.y = sac.y; P.v = 0;
  K.tryStart(S); run(S, K, 4.5); check(K.state === 'round', 'round 3 running', K.state);
  K.t = 0.05; run(S, K, 0.2);
  check(K.state === 'done' && K.winner === billy, 'time out: closest to the centre takes it', K.winnerName);
}
console.log(fails ? `SPEC KOTH FAIL (${fails})` : 'SPEC KOTH OK'); process.exit(fails ? 1 : 0);
