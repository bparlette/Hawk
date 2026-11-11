// A scripted player that can complete all 3 courier jobs (bread, lamps, tithe) end-to-end
// and then cruise the streets. Used by headless tests and by attract mode (?auto=1).
import { roadAt, N } from './sim.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Generate road waypoints from (startX, startZ) to (endX, endZ) along the road grid. */
function roadRoute(startX, startZ, endX, endZ) {
  const snap = (x, z) => {
    let bi = 0, bj = 0, bd = Infinity;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const d = Math.hypot(roadAt(i) - x, roadAt(j) - z);
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
    }
    return [bi, bj];
  };
  const [si, sj] = snap(startX, startZ);
  const [ei, ej] = snap(endX, endZ);
  const pts = [];
  let ci = si, cj = sj;
  pts.push([roadAt(ci), roadAt(cj)]);
  while (ci !== ei || cj !== ej) {
    if (ci < ei) ci++;
    else if (ci > ei) ci--;
    else if (cj < ej) cj++;
    else if (cj > ej) cj--;
    pts.push([roadAt(ci), roadAt(cj)]);
  }
  pts.push([endX, endZ]);
  return pts;
}

export class Bot {
  constructor(game) {
    this.g = game;
    this.stuck = 0;
    this.rev = 0;
    this.roam = null;
    this.jobPhase = 0;
    this.jumpTimer = 0;
    this.lastMission = null;
    this.route = null;
    this.routeIdx = 0;
  }

  walk(tx, tz) {
    const p = this.g.hero.ctrl.pos;
    const dx = tx - p[0], dz = tz - p[2], d = Math.hypot(dx, dz) || 1;
    return { stickX: -dx / d, stickY: dz / d, camYaw: 0 };
  }

  drive(tx, tz) {
    const v = this.g.hero.vehicle;
    if (!v) return {};
    const diff = wrap(Math.atan2(tx - v.x, tz - v.z) - v.yaw);
    if (this.rev > 0) {
      this.rev--;
      return { stickY: -1, stickX: clamp(diff * 2, -1, 1) };
    }
    if (Math.abs(v.fwd) < 2) {
      if (++this.stuck > 45) {
        this.stuck = 0;
        this.rev = 30;
      }
    } else {
      this.stuck = 0;
    }
    return { stickY: Math.abs(diff) > 1.2 ? 0.35 : 1, stickX: clamp(-diff * 2.2, -1, 1) };
  }

  followRoute(tx, tz, arriveDist = 500) {
    const v = this.g.hero.vehicle;
    if (!v) return {};
    if (!this.route || Math.hypot(this.route[this.route.length - 1][0] - tx, this.route[this.route.length - 1][1] - tz) > 100) {
      this.route = roadRoute(v.x, v.z, tx, tz);
      this.routeIdx = 0;
    }
    const [wx, wz] = this.route[this.routeIdx];
    const isEnd = this.routeIdx === this.route.length - 1;
    if (Math.hypot(wx - v.x, wz - v.z) < (isEnd ? arriveDist : 500)) {
      if (!isEnd) this.routeIdx++;
    }
    return this.drive(this.route[this.routeIdx][0], this.route[this.routeIdx][1]);
  }

  input() {
    const g = this.g, h = g.hero, m = g.mission, pulse = g.ticks % 4 < 2;

    // Reset phase when mission starts / changes
    if (m !== this.lastMission) {
      this.lastMission = m;
      this.jobPhase = 0;
      this.jumpTimer = 0;
      this.route = null;
    }

    // -------------------------------------------------- Job 1: Hot Bread Run
    if (!m && g.unlocked === 0 && !h.vehicle) {
      const b = g.city.places.bakery;
      return this.walk(b.x, b.z);
    }
    if (m && m.def.id === 'bread') {
      if (m.step === 0) return { ...this.walk(g.bakerCart.x, g.bakerCart.z), use: pulse };
      const t = g.city.places.hideout;
      return this.drive(t.x, t.z);
    }

    // -------------------------------------------------- Job 2: Lamplighters
    if (!m && g.unlocked === 1) {
      const lp = g.city.places.lamps; // [-2100, 350]
      if (h.vehicle) {
        const d = Math.hypot(lp.x - h.vehicle.x, lp.z - h.vehicle.z);
        if (d < 500) {
          if (Math.abs(h.vehicle.fwd) > 6) return { stickY: -1 };
          return { use: true };
        }
        return this.followRoute(lp.x, lp.z);
      }
      return this.walk(lp.x, lp.z);
    }

    if (m && m.def.id === 'lamps') {
      // If hero entered the mission still inside a vehicle, hop out immediately
      if (h.vehicle) {
        if (Math.abs(h.vehicle.fwd) > 6) return { stickY: -1 };
        return { use: true };
      }
      const p = h.ctrl.pos;
      if (m.step === 0) {
        if (this.jumpTimer > 0) {
          this.jumpTimer--;
          return { stickX: 0, stickY: 1, a: this.jumpTimer === 44 };
        }
        // Phase 0: Walk to lamp 1 at [-3000, 1150]
        if (this.jobPhase === 0) {
          if (Math.hypot(p[0] - (-3000), p[2] - 1150) < 40) this.jobPhase = 1;
          else return this.walk(-3000, 1150);
        }
        // Phase 1: Walk to z=1350, jump up to roof 1
        if (this.jobPhase === 1) {
          if (p[2] < 1345) return this.walk(-3000, 1350);
          this.jumpTimer = 45; this.jobPhase = 2;
          return { stickY: 1, a: true };
        }
        // Phase 2: Walk to lamp 2 at [-3000, 2350]
        if (this.jobPhase === 2) {
          if (Math.hypot(p[0] - (-3000), p[2] - 2350) < 40) this.jobPhase = 3;
          else return this.walk(-3000, 2350);
        }
        // Phase 3: Walk to x=-2750, jump up to roof 2
        if (this.jobPhase === 3) {
          if (p[0] < -2755) return this.walk(-2750, 2350);
          this.jumpTimer = 45; this.jobPhase = 4;
          return { stickX: -1, a: true };
        }
        // Phase 4: Walk to lamp 3 at [-2400, 2350]
        if (this.jobPhase === 4) {
          if (Math.hypot(p[0] - (-2400), p[2] - 2350) < 40) this.jobPhase = 5;
          else return this.walk(-2400, 2350);
        }
        // Phase 5: Walk to x=-2150, jump up to roof 3
        if (this.jobPhase === 5) {
          if (p[0] < -2155) return this.walk(-2150, 2350);
          this.jumpTimer = 45; this.jobPhase = 6;
          return { stickX: -1, a: true };
        }
        // Phase 6: Walk to lamp 4 at [-1800, 2350]
        if (this.jobPhase === 6) {
          if (Math.hypot(p[0] - (-1800), p[2] - 2350) < 40) this.jobPhase = 7;
          else return this.walk(-1800, 2350);
        }
        // Phase 7: Walk to x=-1550, jump up to roof 4
        if (this.jobPhase === 7) {
          if (p[0] < -1555) return this.walk(-1550, 2350);
          this.jumpTimer = 45; this.jobPhase = 8;
          return { stickX: -1, a: true };
        }
        // Phase 8: Walk to lamp 5 at [-1200, 2350]
        if (this.jobPhase === 8) {
          return this.walk(-1200, 2350);
        }
      }
      if (m.step === 1) {
        // Step 1: Lose heat perched on roof 4 (y=800 > 300)
        return {};
      }
    }

    // -------------------------------------------------- Job 3: Tithe Day
    if (!m && g.unlocked === 2 && !g.completed.includes('tithe')) {
      const cp = g.city.places.counting; // [6300, -4550]
      if (!h.vehicle) {
        // Hero is coming down from roof 4. Head to the cart parked at [2600, -330],
        // keeping well clear of the lamps beacon at [-2100, 350].
        const p = h.ctrl.pos;
        const cart = g.vehicles.find((v) => !v.driver && v.kind === 'cart' && Math.hypot(v.x - 2600, v.z - (-330)) < 200);
        if (cart) {
          const d = Math.hypot(p[0] - cart.x, p[2] - cart.z);
          return { ...this.walk(cart.x, cart.z), use: d < 300 && pulse };
        }
        return this.walk(cp.x, cp.z);
      }
      // When approaching counting house, brake to avoid hitting pedestrians
      const d = Math.hypot(h.vehicle.x - cp.x, h.vehicle.z - cp.z);
      if (d < 600 && h.vehicle.fwd > 10) return { stickY: -1 };
      return this.followRoute(cp.x, cp.z, 200);
    }

    if (m && m.def.id === 'tithe') {
      const v = h.vehicle;
      if (m.step === 0) {
        if (!v) {
          const p = h.ctrl.pos;
          const ride = g.vehicles.filter((o) => !o.driver && o.kind !== 'tithe')
            .sort((a, b) => Math.hypot(a.x - p[0], a.z - p[2]) - Math.hypot(b.x - p[0], b.z - p[2]))[0];
          return ride ? { ...this.walk(ride.x, ride.z), use: pulse } : {};
        }
        if (g.tithe) {
          const d = Math.hypot(g.tithe.x - v.x, g.tithe.z - v.z);
          if (g.tithe.hitCd > 0 && d < 600) return { stickY: -0.5, stickX: 0 };
          const tx = g.tithe.x + (g.tithe.vx || 0) * 8;
          const tz = g.tithe.z + (g.tithe.vz || 0) * 8;
          return this.drive(tx, tz);
        }
      }
      if (m.step === 1) {
        const chest = g.pickups.find((p) => p.kind === 'chest' && !p.taken);
        if (chest) return v ? this.drive(chest.x, chest.z) : this.walk(chest.x, chest.z);
      }
      if (m.step === 2) {
        const docks = g.city.places.docks;
        return v ? this.followRoute(docks.x, docks.z, 400) : this.walk(docks.x, docks.z);
      }
      if (m.step === 3) {
        // Step 3: We are Fen at the docks.
        const p = h.ctrl.pos;
        if (this.jumpTimer > 0) {
          this.jumpTimer--;
          return { stickX: 0, stickY: 1, a: this.jumpTimer === 44 };
        }
        if (!v) {
          if (this.jobPhase === 0) {
            const skiff = g.vehicles.find((o) => o.kind === 'skiff' && !o.driver && Math.hypot(o.x - 9300, o.z - 8750) < 1200);
            if (skiff) {
              const d = Math.hypot(skiff.x - p[0], skiff.z - p[2]);
              return { ...this.walk(skiff.x, skiff.z), use: d < 260 && pulse };
            }
          }
          if (this.jobPhase === 2) {
            // First align to x=-3000, z=1150 before jumping to roof 1
            if (Math.hypot(p[0] - (-3000), p[2] - 1150) > 40) return this.walk(-3000, 1150);
            this.jobPhase = 25;
            return {};
          }
          if (this.jobPhase === 25) {
            if (p[2] < 1345) return this.walk(-3000, 1350);
            this.jumpTimer = 45; this.jobPhase = 3;
            return { stickY: 1, a: true };
          }
          if (this.jobPhase === 3) {
            if (p[0] < -2755) return this.walk(-2750, 2350);
            this.jumpTimer = 45; this.jobPhase = 4;
            return { stickX: -1, a: true };
          }
          if (this.jobPhase === 4) {
            if (p[0] < -2155) return this.walk(-2150, 2350);
            this.jumpTimer = 45; this.jobPhase = 5;
            return { stickX: -1, a: true };
          }
          if (this.jobPhase === 5) {
            if (p[0] < -1555) return this.walk(-1550, 2350);
            this.jumpTimer = 45; this.jobPhase = 6;
            return { stickX: -1, a: true };
          }
          if (this.jobPhase === 6) {
            return {};
          }
        } else {
          this.jobPhase = 1;
          const target = [-3000, 1150];
          if (Math.hypot(v.x - target[0], v.z - target[1]) < 400) {
            if (Math.abs(v.fwd) > 8) return { stickY: -1 };
            this.jobPhase = 2;
            return { use: true };
          }
          return this.followRoute(target[0], target[1], 400);
        }
      }
    }

    // -------------------------------------------------- Roam mode
    if (!h.vehicle) {
      const p = h.ctrl.pos, v = g.vehicles.filter((o) => !o.driver).sort((a, b) => Math.hypot(a.x - p[0], a.z - p[2]) - Math.hypot(b.x - p[0], b.z - p[2]))[0];
      return v ? { ...this.walk(v.x, v.z), use: pulse } : {};
    }
    const v = h.vehicle;
    if (!this.roam || Math.hypot(this.roam[0] - v.x, this.roam[1] - v.z) < 500) {
      const [i, j] = g.node(v.x, v.z), o = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && a <= N && b >= 0 && b <= N);
      const [a, b] = o[(g.ticks * 7 + i * 3 + j) % o.length];
      this.roam = [roadAt(a), roadAt(b)];
    }
    return this.drive(this.roam[0], this.roam[1]);
  }
}
