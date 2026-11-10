// Capture camera kit for filming Lanternport: slow motion with no drift, a detachable free camera, and a sim
// digest for proving the two never change the game. Pure logic (no DOM, no three.js) so it is testable headless.
export const TIMESCALES = [0.25, 0.5, 1, 2];

/**
 * Fixed-step clock with a timescale. The sim always advances in whole 1/hz ticks; the timescale only changes how
 * much real time one tick is worth, and rendering blends between the last two ticks. So at 0.25x the game runs the
 * exact same tick sequence as at 1x, just spread over four times as many frames: slow motion cannot drift.
 */
export class SimClock {
  constructor(hz = 30) { this.step = 1 / hz; this.acc = 0; this.scale = 1; this.ticks = 0; }
  /** Call once per rendered frame with real seconds elapsed. Runs tickFn 0..n times; returns the 0..1 blend factor. */
  advance(dtReal, tickFn) {
    this.acc += Math.min(dtReal, 0.25) * this.scale;
    let n = 0;
    while (this.acc >= this.step - 1e-9 && n < 8) { tickFn(); this.acc -= this.step; this.ticks++; n++; }
    if (n === 8) this.acc = 0; // fell far behind (tab was hidden): drop the backlog rather than fast-forward
    return Math.max(0, Math.min(1, this.acc / this.step));
  }
  setScale(s) { this.scale = TIMESCALES.includes(s) ? s : 1; return this.scale; }
  /** Step to the next (dir = 1) or previous (dir = -1) timescale. */
  nudge(dir) { const i = TIMESCALES.indexOf(this.scale); return this.setScale(TIMESCALES[Math.max(0, Math.min(TIMESCALES.length - 1, (i < 0 ? 2 : i) + dir))]); }
}

/** Everything that defines the state of a Lanternport match, rounded and joined: equal digests = equal games. */
export function simDigest(g) {
  const r = (n) => Math.round(n * 1000) / 1000, out = [g.ticks, g.active, g.coins, g.heat, g.mission ? `${g.mission.k}.${g.mission.step}` : '-'];
  for (const h of g.heroes) { const p = g.posOf(h); out.push(r(p.x), r(p.y), r(p.z), h.vehicle ? h.vehicle.id : h.ctrl.action); }
  for (const v of g.vehicles) out.push(r(v.x), r(v.z), r(v.yaw));
  for (const p of g.peds) out.push(r(p.x), r(p.z));
  for (const q of g.guards) out.push(r(q.x), r(q.z));
  return out.join('|');
}

/**
 * Free camera: an orbit rig around a pivot. orbit() turns it, pan() slides the pivot across the view plane,
 * fly() moves the pivot along the view direction (and strafes / lifts), dolly() changes the distance.
 * Angles in radians; yaw 0 looks along +Z (the same convention as the follow camera). Units are scene metres.
 */
export class FreeCam {
  constructor() { this.on = false; this.pivot = [0, 1.5, 0]; this.yaw = 0; this.pitch = 0.3; this.dist = 10; }
  /** Detach from the follow camera, starting exactly where it is looking from. */
  takeOver(camPos, lookAt) {
    const dx = lookAt[0] - camPos[0], dy = lookAt[1] - camPos[1], dz = lookAt[2] - camPos[2], d = Math.hypot(dx, dy, dz) || 1;
    this.pivot = [...lookAt]; this.dist = d; this.yaw = Math.atan2(dx, dz); this.pitch = Math.asin(Math.max(-1, Math.min(1, -dy / d))); this.on = true;
  }
  release() { this.on = false; }
  dir() { const c = Math.cos(this.pitch); return [Math.sin(this.yaw) * c, -Math.sin(this.pitch), Math.cos(this.yaw) * c]; }
  position() { const d = this.dir(); return [this.pivot[0] - d[0] * this.dist, this.pivot[1] - d[1] * this.dist, this.pivot[2] - d[2] * this.dist]; }
  orbit(dYaw, dPitch) { this.yaw += dYaw; this.pitch = Math.max(-1.45, Math.min(1.5, this.pitch + dPitch)); }
  pan(dRight, dUp) { const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw); this.pivot[0] += rx * dRight; this.pivot[2] += rz * dRight; this.pivot[1] = Math.max(0.1, this.pivot[1] + dUp); }
  fly(forward, right, up) { const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw); this.pivot[0] += fx * forward - Math.cos(this.yaw) * right; this.pivot[2] += fz * forward + Math.sin(this.yaw) * right; this.pivot[1] = Math.max(0.1, this.pivot[1] + up); }
  dolly(factor) { this.dist = Math.max(1.5, Math.min(400, this.dist * factor)); }
}
