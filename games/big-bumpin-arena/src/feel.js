// Feel: pure helpers for game-feel, so they can be unit-tested headless. Nothing here touches the sim, so a match
// stays a pure function of (seed, inputs); hitstop only pauses the *wall-clock* accumulator in the browser loop.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Hitstop: 40-80 ms freeze on hard hits (closing speed) and on every goal. Returns milliseconds, 0 for no stop. */
export const HITSTOP = { minMs: 40, maxMs: 80, hardForce: 5, fullForce: 12 };
export function hitstopMs(e) {
  if (e.type === 'goal') return HITSTOP.maxMs;
  if (e.type === 'flatten') return 70;
  if (e.type === 'hit' && e.kind !== 'ball-wall' && e.force >= HITSTOP.hardForce) {
    const k = clamp((e.force - HITSTOP.hardForce) / (HITSTOP.fullForce - HITSTOP.hardForce), 0, 1);
    return Math.round(HITSTOP.minMs + k * (HITSTOP.maxMs - HITSTOP.minMs));
  }
  return 0;
}
/** The longest stop asked for by this tick's events. */
export function hitstopFor(events) { let m = 0; for (const e of events) m = Math.max(m, hitstopMs(e)); return m; }

/** How much trauma (0..1) an event adds. Impacts scale with closing speed; set pieces are fixed. */
export function traumaFor(e) {
  switch (e.type) {
    case 'hit': return e.kind === 'ball-wall' ? 0 : e.force > 1.2 ? clamp(e.force / 16, 0, 1) * 0.75 : 0;
    case 'goal': return 0.9;
    case 'shock': return 0.65;
    case 'flatten': return 0.7;
    case 'spin': return 0.3;
    case 'onetimer': return 0.35;
    default: return 0;
  }
}

/** Trauma-based camera shake (Squirrel Eiserloh): offset ~ trauma^2, linear smooth decay, smooth noise not white. */
export class Trauma {
  constructor(decayPerSec = 1.5) { this.v = 0; this.decay = decayPerSec; this.t = 0; }
  add(a) { this.v = Math.min(1, this.v + a); }
  update(dt) { this.t += dt; this.v = Math.max(0, this.v - this.decay * dt); }
  get amount() { return this.v * this.v; }
  /** Smooth pseudo-noise in [-1, 1] (sum of incommensurate sines), so the shake wobbles instead of buzzing. */
  noise(seed) { const t = this.t * 24 + seed * 17.3; return (Math.sin(t) * 0.55 + Math.sin(t * 2.13 + 1.7) * 0.3 + Math.sin(t * 4.31 + 0.4) * 0.15); }
  offset(maxPx = 22, maxRad = 0.03) { const a = this.amount; return { x: maxPx * a * this.noise(1) + 0, y: maxPx * a * this.noise(2) + 0, rot: maxRad * a * this.noise(3) + 0 }; } // + 0 turns -0 into 0
}

/** 0..1: how close and how dangerous the ball is to either goal. Drives the crowd swell. */
export function goalTension(game) {
  if (game.state !== 'play') return 0;
  const A = game.arena, b = game.ball.body, v = game.M.Body.getVelocity(b); let best = 0;
  for (let i = 0; i < A.goals.length; i++) {
    const g = A.goals[i], dx = g.x - b.position.x, dy = g.y - b.position.y, d = Math.hypot(dx, dy) || 1;
    const prox = clamp(1 - d / (A.w * 0.42), 0, 1), toward = clamp((v.x * dx + v.y * dy) / d / 9, 0, 1), mouth = clamp(1 - Math.abs(b.position.y - g.y) / (g.half * 2.2), 0, 1);
    best = Math.max(best, prox * (0.3 + 0.7 * toward) * (0.4 + 0.6 * mouth));
  }
  return clamp(best * 1.6, 0, 1);
}

/** Adaptive music mood: calm (kick-off, countdown, menus), play (live ball), goal (celebration and final whistle). */
export function moodFor(game, started) {
  if (!started || game.state === 'kickoff' || game.state === 'faceoff') return 'calm';
  if (game.state === 'goal' || game.state === 'over') return 'goal';
  return 'play';
}
