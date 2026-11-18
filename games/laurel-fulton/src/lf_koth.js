// lf_koth.js — Cul-de-Sac King of the Hill (owner, Nov 17): any real cul-de-sac on the map
// (data/culdesacs.json, tools/find_culdesacs.py — 302 of them) is an instant bumper-car ring.
// When EVERY car that's out is inside one cul-de-sac's circle, a round fires: a 3-count, then
// 30 seconds of bumper cars (the sim's kothBoost: no damage, headings glance off each other).
// Out of the circle for more than 0.75 s and you're eliminated. Last car in wins; if the clock
// runs out, the car closest to the centre takes it. The winner wears the crown for 30 s.
export class KingOfTheHill {
  constructor(sacs) {
    this.sacs = sacs || [];
    this.state = 'idle';        // idle | count | round | done
    this.t = 0;                 // the countdown / the round clock
    this.sac = null;
    this.alive = new Set();     // cars still in the round
    this.outT = new Map();      // car -> seconds spent outside the ring
    this.winner = null; this.winnerName = ''; this.crownT = 0; this.coolT = 0; this.lastOut = null;
  }
  participants(sim) { return sim.cars.filter(c => !c.parked && !c.remote && c.layer === 0 && !c.wreck); }
  inside(c) { return Math.hypot(c.x - this.sac.x, c.y - this.sac.y) <= this.sac.r; }
  step(sim, dt) {
    sim.kothBoost = this.state === 'round';
    if (this.crownT > 0) this.crownT -= dt;
    if (this.coolT > 0) this.coolT -= dt;
    const P = this.participants(sim);
    if (this.state === 'idle') {
      if (this.coolT > 0 || P.length < 2) return;
      for (const s of this.sacs) {
        this.sac = s;
        if (P.every(c => this.inside(c))) { this.state = 'count'; this.t = 3; return; }
      }
      this.sac = null;
    } else if (this.state === 'count') {
      if (P.length < 2 || !P.every(c => this.inside(c))) { this.state = 'idle'; this.sac = null; return; }   // someone bailed: no round
      this.t -= dt;
      if (this.t <= 0) { this.state = 'round'; this.t = 30; this.alive = new Set(P); this.outT = new Map(); this.lastOut = null; }
    } else if (this.state === 'round') {
      this.t -= dt;
      for (const c of [...this.alive]) {
        if (this.inside(c)) this.outT.set(c, 0);
        else { const o = (this.outT.get(c) || 0) + dt; this.outT.set(c, o); if (o > 0.75) { this.alive.delete(c); this.lastOut = c; } }
      }
      let win = null;
      if (this.alive.size === 1) win = [...this.alive][0];
      else if (this.alive.size === 0) win = this.lastOut;
      else if (this.t <= 0) { let bd = 1e18; for (const c of this.alive) { const d = Math.hypot(c.x - this.sac.x, c.y - this.sac.y); if (d < bd) { bd = d; win = c; } } }
      if (win) {
        this.winner = win;
        this.winnerName = (sim.roster.people.find(p => p.id === win.owner || (p.car && p.car.sprite === win.model)) || {}).name || win.model;
        this.state = 'done'; this.crownT = 30; this.coolT = 10; sim.kothBoost = false;
      }
    } else if (this.state === 'done') {
      if (this.crownT <= 0) { this.state = 'idle'; this.sac = null; this.winner = null; }
    }
  }
  banner() {
    if (this.state === 'count') return `CUL-DE-SAC KING OF THE HILL — ${this.sac.name} — ${Math.ceil(this.t)}`;
    if (this.state === 'round') return `KING OF THE HILL — ${Math.max(0, Math.ceil(this.t))}s — ${this.alive.size} IN THE RING`;
    if (this.state === 'done' && this.winner) return `${this.winnerName.toUpperCase()} TAKES THE CUL-DE-SAC!`;
    return null;
  }
}
