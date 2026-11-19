// GPS breadcrumb (easy-five feature 5, COLLEGE PARK ONLY): a fading dotted line along the
// actual road network from the player's car to the current rally target. Laurel keeps its
// existing guidance (edge arrow + compass) — this draws only in College Park, gated on the
// page title, which is how this codebase already knows which city it is (main.js's TITLE).
// The route comes from lf_pilot.js's roadPath — the same router the autopilot and the cops
// use. No second router: if roadPath's answer changes, the dots change with it.
import { roadPath } from './lf_pilot.js';

export const CRUMB = {
  dotEvery: 46,        // world units between dots (4.6 m)
  skipHead: 70,        // no dots under the car itself
  recomputeMove: 150,  // re-route after the player has driven this far from the anchor
  maxDots: 110,        // longer routes space their dots wider instead of drawing thousands
  fadeFloor: 0.22,     // alpha at the far end of the line (the near end is 1)
};

export const isCollegePark = (title) => /college park/i.test(title || '');

export class Breadcrumb {
  constructor(W, S) { this.W = W; this.S = S; this.pts = null; this.tx = null; this.ty = null; this.ax = 0; this.ay = 0; this.routeLen = 0; }

  // Dots for the route player -> target: [{x, y, f}] with f the fade (1 at the car, fading
  // toward the target). Cached: recomputed only when the target changes or the player has
  // moved CRUMB.recomputeMove from the anchor the current route was planned at.
  dots(c, target) {
    if (!c || !target) { this.pts = null; this.tx = null; return []; }
    const moved = Math.hypot(c.x - this.ax, c.y - this.ay);
    if (this.pts && this.tx === target.x && this.ty === target.y && moved < CRUMB.recomputeMove) return this.pts;
    const raw = roadPath(this.W, this.S, c.x, c.y, target.x, target.y);
    this.ax = c.x; this.ay = c.y; this.tx = target.x; this.ty = target.y;
    // densify: total length first (for spacing + fade), then walk placing dots
    let total = 0; const seg = [];
    for (let i = 0; i + 1 < raw.length; i++) { const L = Math.hypot(raw[i + 1][0] - raw[i][0], raw[i + 1][1] - raw[i][1]); seg.push(L); total += L; }
    this.routeLen = total;
    const every = Math.max(CRUMB.dotEvery, total / CRUMB.maxDots);
    const out = [];
    let nextAt = CRUMB.skipHead, acc = 0;
    for (let i = 0; i + 1 < raw.length; i++) {
      const [ax, ay] = raw[i], [bx, by] = raw[i + 1], L = seg[i];
      while (nextAt <= acc + L) {
        const t = L ? (nextAt - acc) / L : 0;
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        // no dots on grass: the route's first metres cross the start property's lawn to the
        // kerb — the line begins at the street, where guidance actually starts.
        if (this.W.surfaceAt(x, y) !== 'ground')
          out.push({ x, y, f: 1 - (nextAt / Math.max(1, total)) * (1 - CRUMB.fadeFloor) });
        nextAt += every;
      }
      acc += L;
    }
    this.pts = out;
    return out;
  }
}
