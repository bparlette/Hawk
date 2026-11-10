// A small scripted player. It finishes the first job (walk to the bakery, borrow the cart, deliver it) and then
// cruises the streets. Used by the headless test and by attract mode (?auto=1). Assumes camYaw = 0.
import { roadAt, N } from './sim.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Bot {
  constructor(game) { this.g = game; this.stuck = 0; this.rev = 0; this.roam = null; }
  walk(tx, tz) { const p = this.g.hero.ctrl.pos, dx = tx - p[0], dz = tz - p[2], d = Math.hypot(dx, dz) || 1; return { stickX: -dx / d, stickY: dz / d, camYaw: 0 }; }
  drive(tx, tz) {
    const v = this.g.hero.vehicle, diff = wrap(Math.atan2(tx - v.x, tz - v.z) - v.yaw);
    if (this.rev > 0) { this.rev--; return { stickY: -1, stickX: clamp(diff * 2, -1, 1) }; }
    if (Math.abs(v.fwd) < 2) { if (++this.stuck > 45) { this.stuck = 0; this.rev = 30; } } else this.stuck = 0;
    return { stickY: Math.abs(diff) > 1.2 ? 0.35 : 1, stickX: clamp(-diff * 2.2, -1, 1) };
  }
  input() {
    const g = this.g, h = g.hero, m = g.mission, pulse = g.ticks % 4 < 2;
    if (!m && g.unlocked === 0 && !h.vehicle) { const b = g.city.places.bakery; return this.walk(b.x, b.z); }
    if (m && m.def.id === 'bread') {
      if (m.step === 0) return { ...this.walk(g.bakerCart.x, g.bakerCart.z), use: pulse };
      const t = g.city.places.hideout; return this.drive(t.x, t.z);
    }
    if (!h.vehicle) { // find any parked ride
      const p = h.ctrl.pos, v = g.vehicles.filter((o) => !o.driver).sort((a, b) => Math.hypot(a.x - p[0], a.z - p[2]) - Math.hypot(b.x - p[0], b.z - p[2]))[0];
      return v ? { ...this.walk(v.x, v.z), use: pulse } : {};
    }
    const v = h.vehicle; // cruise from junction to junction
    if (!this.roam || Math.hypot(this.roam[0] - v.x, this.roam[1] - v.z) < 500) {
      const [i, j] = g.node(v.x, v.z), o = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && a <= N && b >= 0 && b <= N);
      const [a, b] = o[(g.ticks * 7 + i * 3 + j) % o.length]; this.roam = [roadAt(a), roadAt(b)];
    }
    return this.drive(this.roam[0], this.roam[1]);
  }
}
