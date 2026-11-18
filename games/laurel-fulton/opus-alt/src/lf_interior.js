// lf_interior.js — task L7, a walk-in INTERIOR from a kit (data/interiors/<id>.json, tools/interior_build.py), played as a
// SIDE CUTAWAY. Palm City's motel siege is the precedent and the model: floors are walkable spans, stairs are links between
// them, the hero walks at siege speeds (WALK 4.4 m/s, STAIR 2.7 m/s — siege.js), the side-view person sheet is Palm City's.
// Pure logic (spec + main.js); drawing is lf_interior_render.js.
//
//   const I = new Interior(kit, { who, seed })     you start on the landing inside the front door
//   I.step(dt, inp) -> 'exit' | null               Palm City input {jx, jy, jm, keys, action}
//   I.prompt()                                     what ACTION does right here: GRAB BEER / DRINK / PAT / EXIT / null
// STAIRS (split foyer): on the landing, push right = the half-flight UP (stick up-right too); push down-right = the
// half-flight DOWN. From either level, walk left off the top/foot of the flight and you are on it.
// BEERS: GRAB BEER at the cooler / fridge / mantle (the mantle's cans really go: 6 -> 5 ...), then DRINK anywhere — a 2.4 s
// moment (can up, tilt, sigh). Cosmetic only: a count in the corner, nothing else (owner: keep it light).
// RESIDENTS: two golden retrievers roam room to room and trail you; TETER never leaves her recliner and greets whoever
// comes upstairs (placeholder line until Gemini's G7 greeting).
export const MOVE = { walk: 4.4, stair: 2.7, reach: 0.9, drink: 2.4, dog: 1.7, dogRun: 3.6 };
const rngOf = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export class Interior {
  constructor(K, opts = {}) {
    this.K = K; this.rnd = rngOf(opts.seed || 7); this.time = 0; this.events = [];
    this.F = Object.fromEntries(K.floors.map(f => [f.id, f]));
    this.L = Object.fromEntries(K.links.map(l => [l.id, l]));
    this.mantle = (K.props.find(p => p.kind === 'fireplace') || {}).mantle || 0;
    this.hero = { who: opts.who || { id: K.id, name: K.id }, floor: K.door.floor, x: K.door.x + 0.5, z: this.F[K.door.floor].z, face: 1, link: null, t: 0, walk: 0, moving: false, beer: false, drinkT: 0, drank: 0 };
    this.teter = K.teter ? { ...K.teter, z: this.F[K.teter.floor].z, sayT: 0, said: null } : null;
    this.dogs = [];
    for (let i = 0; i < (K.dogs || 0); i++) {
      const fl = i % 2 ? 'lower' : 'main', f = this.F[fl] || this.F[K.door.floor];
      this.dogs.push({ i, floor: f.id, x: f.x0 + 1.5 + i * 2.5, z: f.z, face: 1, link: null, t: 0, walk: 0, goal: null, mode: 'lounge', wait: 1 + i * 2, patT: 0, rooms: new Set([f.id]) });
    }
  }
  // the floor graph: which link leaves floor a toward floor b (landing is the hub)
  route(from, to) {
    if (from === to) return null;
    const direct = this.K.links.find(l => (l.a === from && l.b === to) || (l.b === from && l.a === to));
    return direct || this.K.links.find(l => l.a === from || l.b === from);
  }
  enter(p, l) { p.link = l; p.t = p.floor === l.a ? 0 : 1; p.floor = null; }
  // walk p along its floor/link toward signed direction dir (-1/+1), at speed sp; stair choice for the hero comes from 'pick'
  moveOn(p, dir, sp, dt, pick) {
    if (p.link) {
      const l = this.L[p.link.id] || p.link, A = this.F[l.a], B = this.F[l.b], len = Math.hypot(l.bx - l.ax, B.z - A.z);
      p.t += dir * (l.bx > l.ax ? 1 : -1) * sp * dt / len;
      if (p.t <= 0) { p.link = null; p.floor = l.a; p.t = 0; p.x = l.ax - 0.01 * Math.sign(l.bx - l.ax); p.z = A.z; }
      else if (p.t >= 1) { p.link = null; p.floor = l.b; p.t = 0; p.x = l.bx + 0.01 * Math.sign(l.bx - l.ax); p.z = B.z; if (p === this.hero) this.arrived(l.b); }
      else { p.x = l.ax + (l.bx - l.ax) * p.t; p.z = A.z + (B.z - A.z) * p.t; }
      return;
    }
    const f = this.F[p.floor]; let nx = p.x + dir * sp * dt;
    for (const l of this.K.links) {                         // stepping off a floor's end onto a flight that starts there
      const end = l.a === f.id ? l.ax : l.b === f.id ? l.bx : null; if (end === null) continue;
      const other = l.a === f.id ? l.bx : l.ax, toward = Math.sign(other - end);
      if (toward === dir && ((dir > 0 && nx >= end - 0.3) || (dir < 0 && nx <= end + 0.3)) && (!pick || pick(l))) { p.x = end; this.enter(p, l); return; }
    }
    p.x = Math.max(f.x0 + 0.25, Math.min(f.x1 - 0.25, nx));
  }
  arrived(floor) {
    if (this.teter && floor === this.teter.floor) { this.teter.sayT = 3; this.teter.said = 'Hi hon! There’s beer in the cooler.'; this.events.push({ kind: 'teter_greet', t: this.time }); }
  }
  near(act) {
    const h = this.hero; if (h.link) return null;
    let best = null;
    for (const s of this.K.spots) if (s.floor === h.floor && (!act || s.act === act) && Math.abs(s.x - h.x) < MOVE.reach && (!best || Math.abs(s.x - h.x) < Math.abs(best.x - h.x))) best = s;
    return best;
  }
  dogNear() { const h = this.hero; return h.link ? null : this.dogs.find(d => d.floor === h.floor && Math.abs(d.x - h.x) < 1.0) || null; }
  prompt() {
    const h = this.hero; if (h.drinkT > 0) return null;
    const s = this.near();
    if (s && s.act === 'EXIT') return 'EXIT';
    if (s && s.act === 'GRAB BEER' && !h.beer && (s.src !== 'mantle' || this.mantle > 0)) return 'GRAB BEER';
    if (h.beer) return 'DRINK';
    if (this.dogNear()) return 'PAT';
    return null;
  }
  step(dt, inp = {}) {
    this.time += dt; const h = this.hero, k = inp.keys || {};
    let jx = inp.jx || 0, jy = inp.jy || 0, jm = inp.jm || 0;
    if (k.left || k.right || k.up || k.down) { jx = (k.right ? 1 : 0) - (k.left ? 1 : 0); jy = (k.down ? 1 : 0) - (k.up ? 1 : 0); jm = jx || jy ? 1 : 0; }
    let out = null;
    if (inp.action) {
      const pr = this.prompt();
      if (pr === 'EXIT') out = 'exit';
      else if (pr === 'GRAB BEER') { const s = this.near('GRAB BEER'); h.beer = s.src; if (s.src === 'mantle') this.mantle--; this.events.push({ kind: 'grab', src: s.src, t: this.time }); }
      else if (pr === 'DRINK') { h.drinkT = MOVE.drink; this.events.push({ kind: 'drink', room: this.roomOf(h), t: this.time }); }
      else if (pr === 'PAT') { const d = this.dogNear(); d.patT = 1.2; d.mode = 'lounge'; d.wait = 2; this.events.push({ kind: 'pat', dog: d.i, t: this.time }); }
    }
    if (h.drinkT > 0) { h.drinkT -= dt; h.moving = false; if (h.drinkT <= 0) { h.beer = false; h.drank++; } }
    else if (jm > 0.2 && Math.abs(jx) > 0.25) {
      const dir = Math.sign(jx); h.face = dir; h.moving = true; h.walk += dt;
      const down = jy > 0.35;                                // on the landing: down-right takes the half-flight DOWN
      const fork = this.K.links.filter(l => l.a === h.floor || l.b === h.floor).length > 1;   // only the landing is a fork
      this.moveOn(h, dir, h.link ? MOVE.stair : MOVE.walk, dt, (l) => !fork || (l.id === 'down') === down);
    } else h.moving = false;
    if (this.teter && this.teter.sayT > 0) this.teter.sayT -= dt;
    for (const d of this.dogs) this.stepDog(d, dt);
    return out;
  }
  roomOf(p) { const fl = p.floor; return (this.K.rooms.find(r => r.floor === fl && p.x >= r.x0 && p.x <= r.x1) || {}).name || 'stairs'; }
  stepDog(d, dt) {
    const h = this.hero;
    if (d.patT > 0) { d.patT -= dt; return; }
    if (d.mode === 'lounge') { if ((d.wait -= dt) > 0) return; d.mode = 'go'; }
    // trail you when you're about (60% of the time), else wander to a random spot in a random room
    if (!d.goal) {
      if (this.rnd() < 0.6 && !h.link) d.goal = { floor: h.floor, x: h.x - h.face * (0.9 + d.i * 0.6), trail: true };
      else { const r = this.K.rooms[Math.floor(this.rnd() * this.K.rooms.length)]; d.goal = { floor: r.floor, x: r.x0 + 0.6 + this.rnd() * (r.x1 - r.x0 - 1.2) }; }
    }
    if (d.goal.trail && !h.link) { d.goal.floor = h.floor; d.goal.x = h.x - h.face * (0.9 + d.i * 0.6); }
    const g = d.goal, run = g.trail && (d.floor !== g.floor || Math.abs(g.x - d.x) > 3) ? MOVE.dogRun : MOVE.dog;
    if (d.link) { const l = d.link, dir = (d.target === l.b ? 1 : -1) * Math.sign(l.bx - l.ax); this.moveOn(d, dir, run * 0.8, dt); d.face = dir; d.walk += dt; return; }
    if (d.floor !== g.floor) {                               // head for the flight toward the goal floor
      const l = this.route(d.floor, g.floor), end = l.a === d.floor ? l.ax : l.bx, other = l.a === d.floor ? l.b : l.a;
      if (Math.abs(end - d.x) < 0.1) { d.target = other; this.enter(d, l); d.rooms.add(other); return; }
      const dir = Math.sign(end - d.x); d.face = dir; d.walk += dt; d.x += dir * Math.min(run * dt, Math.abs(end - d.x)); return;
    }
    if (Math.abs(g.x - d.x) < 0.15) { d.goal = null; d.mode = 'lounge'; d.wait = g.trail ? 0.6 : 2 + this.rnd() * 5; return; }
    const dir = Math.sign(g.x - d.x), f = this.F[d.floor]; d.face = dir; d.walk += dt;
    d.x = Math.max(f.x0 + 0.3, Math.min(f.x1 - 0.3, d.x + dir * Math.min(run * dt, Math.abs(g.x - d.x))));
    d.rooms.add(d.floor);
  }
}
