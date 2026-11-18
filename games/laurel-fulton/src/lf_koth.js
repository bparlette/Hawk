// lf_koth.js — Cul-de-Sac King of the Hill (owner, Nov 17): any real cul-de-sac on the map
// (data/culdesacs.json, tools/find_culdesacs.py — 302 of them) is a bumper-car ring.
// STARTING IS A DECISION (owner, Nov 17 evening): the rally makes the crew follow the player
// and pile up at every house stop — half of them in cul-de-sacs — so the mode must NEVER
// auto-fire. When the player is sitting in a cul-de-sac, the ring shows dim and the crown
// button appears (main.js); pressing it (or K) with at least 2 cars in the ring starts a
// 3-count, then 30 seconds of bumper cars (the sim's kothBoost: no damage, headings glance
// off each other). Out of the circle for more than 0.75 s and you're eliminated. Last car
// in wins; if the clock runs out, the car closest to the centre takes it. Crown for 30 s.
export class KingOfTheHill {
  constructor(sacs) {
    this.sacs = sacs || [];
    this.state = 'idle';        // idle | count | round | done
    this.t = 0;                 // the countdown / the round clock
    this.sac = null;
    this.alive = new Set();     // cars still in the round
    this.outT = new Map();      // car -> seconds spent outside the ring
    this.winner = null; this.winnerName = ''; this.crownT = 0; this.coolT = 0; this.lastOut = null;
    this.notice = null; this.noticeT = 0;   // the 'need a rival' hint, shown via banner()
  }
  participants(sim) { return sim.cars.filter(c => !c.parked && !c.remote && !c.ambient && !c.cop && c.layer === 0 && !c.wreck); }
  insideSac(c, s) { return Math.hypot(c.x - s.x, c.y - s.y) <= s.r; }
  inside(c) { return this.sac ? this.insideSac(c, this.sac) : false; }
  candidate(sim) {   // the ring the PLAYER is sitting in (the button shows for this one)
    const P = sim.player;
    if (!P || P.parked || P.remote || P.layer !== 0 || P.wreck) return null;
    return this.sacs.find(s => this.insideSac(P, s)) || null;
  }
  insiders(sim, s) { return this.participants(sim).filter(c => this.insideSac(c, s)); }
  tryStart(sim) {   // THE BUTTON: start a round in the player's cul-de-sac, if a rival is in
    if (this.state !== 'idle' || this.coolT > 0) return false;
    const s = this.candidate(sim); if (!s) return false;
    if (this.insiders(sim, s).length < 2) { this.notice = 'NEED A RIVAL IN THE RING — BRING THE CREW IN'; this.noticeT = 3; return false; }
    this.sac = s; this.state = 'count'; this.t = 3; return true;
  }
  step(sim, dt) {
    sim.kothBoost = this.state === 'round';
    if (this.crownT > 0) this.crownT -= dt;
    if (this.coolT > 0) this.coolT -= dt;
    if (this.noticeT > 0) this.noticeT -= dt;
    if (this.state === 'count') {
      if (!this.inside(sim.player)) { this.state = 'idle'; this.sac = null; return; }   // the starter drove off: no round
      this.t -= dt;
      if (this.t <= 0) {
        const P = this.insiders(sim, this.sac);
        if (P.length < 2) { this.state = 'idle'; this.sac = null; return; }              // the rival bailed during the count
        this.state = 'round'; this.t = 30; this.alive = new Set(P); this.outT = new Map(); this.lastOut = null;
      }
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
    if (this.state === 'idle' && this.noticeT > 0 && this.notice) return this.notice;
    if (this.state === 'count') return `CUL-DE-SAC KING OF THE HILL — ${this.sac.name} — ${Math.ceil(this.t)}`;
    if (this.state === 'round') return `KING OF THE HILL — ${Math.max(0, Math.ceil(this.t))}s — ${this.alive.size} IN THE RING`;
    if (this.state === 'done' && this.winner) return `${this.winnerName.toUpperCase()} TAKES THE CUL-DE-SAC!`;
    return null;
  }
}
