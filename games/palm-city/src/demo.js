// demo.js — ?demo autopilot. Feeds the sim the same joystick/button input a player would,
// so the demo exercises the real controls: walk to a parked convertible, jack it, drive the
// loop north along the ocean and round past the hotel, get chased, pull over, get busted.

export class DemoPilot {
  constructor(sim, world) {
    this.sim = sim; this.W = world;
    this.t = 0; this.phase = 'walk'; this.done = false; this.bustedAt = null;
  }

  input(dt) {
    this.t += dt;
    const S = this.sim, W = this.W, P = S.player;
    const none = { jx: 0, jy: 0, jm: 0, action: false, keys: {} };
    if (S.busted && this.bustedAt === null) this.bustedAt = this.t;
    if ((this.bustedAt !== null && this.t > this.bustedAt + 6.5) || this.t > 40) this.done = true;
    if (this.t < 1.0) return none;

    if (this.phase === 'walk') {
      const car = S.cars.find(c => c.parked && c.model === 'conv_mint');
      const p = P.ped;
      const dx = car.x - p.x, dy = car.y - p.y, d = Math.hypot(dx, dy);
      if (d < 32) { this.phase = 'drive'; return { ...none, action: true }; }
      return { jx: dx / d, jy: dy / d, jm: 1, action: false, keys: {} };
    }
    if (this.phase === 'drive' && P.mode === 'car') {
      if (this.t > 22.5) { this.phase = 'stop'; }
      const c = P.car;
      // drive counter-clockwise: north up the ocean road, west along the top past the hotel...
      const look = 130 + Math.abs(c.v) * 0.25;
      // weave: if something is ahead in our lane, swing into the oncoming lane (if it's clear)
      const blocked = (off, n = 4) => S.cars.some(o => {
        if (o === c) return false;
        for (let k = 0; k < n; k++) {
          const r = W.loopAt(S.playerS - 40 - k * 45, off);
          if (Math.hypot(o.x - r.x, o.y - r.y) < 24) return true;
        }
        return false;
      });
      if (this.laneT === undefined) { this.lane = -23; this.laneT = 0; }
      this.laneT -= dt;
      if (this.laneT <= 0) {
        if (blocked(this.lane)) { const alt = -this.lane; if (!blocked(alt)) { this.lane = alt; this.laneT = 1.2; } }
        else if (this.lane !== -23 && !blocked(-23)) { this.lane = -23; this.laneT = 1.2; }
      }
      const tgt = W.loopAt(S.playerS - look, this.lane);
      const dx = tgt.x - c.x, dy = tgt.y - c.y, d = Math.hypot(dx, dy) || 1;
      const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - c.h), Math.cos(Math.atan2(dy, dx) - c.h)));
      const jam = blocked(this.lane, 2);
      return { jx: dx / d, jy: dy / d, jm: jam ? 0.3 : diff > 0.6 ? 0.55 : 0.82, action: false, keys: {} };
    }
    return none;  // 'stop': hands off, the car rolls to a halt and the police box it in
  }
}
