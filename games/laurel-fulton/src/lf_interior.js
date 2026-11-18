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
// comes upstairs: "Hi guys, what are you getting into today?.... You are all alcoholics." (owner's HOUSE BEAT, Nov 18; two beats).
// RIGG'S HOUSE (Nov 18, kit type two-story-entry): the flights overlap a floor, so they are `press` links — push UP at the foot of the
// stairs to climb, DOWN at the top / at the cellar door to descend. THE BEAT: you walk in on the first floor, the old guy (Brian's dad)
// yells "Brrrrrriiiiiiaaaaannnn", and Brian comes down the stairs from his bedroom (skipped when YOU are Brian).
// GUESTS: crew CPUs idling here (CrewWorld B.inside, lf_world.js) are drawn at their kit cpuIdle spot with a beer — CPU Brad is by the fire.
// RIGG-ISMS: when Rigg is the one walking about, he barks IGURT GOGURT / fuck shit diesel at random (lf_riggisms.js) — hero.said.
import { Barker } from './lf_riggisms.js';
export const MOVE = { walk: 4.4, stair: 2.7, reach: 0.9, drink: 2.4, dog: 1.7, dogRun: 3.6 };
const rngOf = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export class Interior {
  constructor(K, opts = {}) {
    this.K = K; this.rnd = rngOf(opts.seed || 7); this.time = 0; this.events = [];
    this.F = Object.fromEntries(K.floors.map(f => [f.id, f]));
    this.L = Object.fromEntries(K.links.map(l => [l.id, l]));
    this.mantle = (K.props.find(p => p.kind === 'fireplace') || {}).mantle || 0;
    this.hero = { who: opts.who || { id: K.id, name: K.id }, floor: K.door.floor, x: K.door.x + 0.5, z: this.F[K.door.floor].z, face: 1, link: null, t: 0, walk: 0, moving: false, beer: false, drinkT: 0, drank: 0 };
    this.teter = K.teter ? { ...K.teter, z: this.F[K.teter.floor].z, sayT: 0, said: null, queue: [] } : null;
    this.houseName = opts.house || this.hero.who.name;
    this.dad = K.dad ? { ...K.dad, z: this.F[K.dad.floor].z, sayT: 0, said: null, queue: [] } : null;     // the old guy in his recliner (Rigg's house beat)
    this.son = K.son && this.hero.who.id !== K.id ? { ...K.son, z: this.F[K.son.floor].z, face: -1, link: null, t: 0, walk: 0, moving: false, state: 'wait', sayT: 0, said: null, queue: [] } : null;
    this.beat = this.dad ? { stage: 0 } : null;
    // guests: crew CPUs home here, idling at the kit's cpuIdle spot with a beer (a sip every few seconds)
    this.guests = (opts.guests || []).filter(g => g.id !== this.hero.who.id && this.F[(K.cpuIdle || {}).floor]).map((g, i) => ({ id: g.id, name: g.name || g.id, floor: K.cpuIdle.floor, x: K.cpuIdle.x + i * 0.9, z: this.F[K.cpuIdle.floor].z, face: -1, sip: 2 + i * 1.7, drinkT: 0, drank: 0 }));
    this.barker = this.hero.who.id === 'rigg' ? new Barker(opts.seed || 1998) : null;
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
      if (toward === dir && ((dir > 0 && nx >= end - 0.3) || (dir < 0 && nx <= end + 0.3)) && (!l.press || Math.abs(nx - end) < 0.6) && (!pick || pick(l))) { p.x = end; this.enter(p, l); return; }
    }
    p.x = Math.max(f.x0 + 0.25, Math.min(f.x1 - 0.25, nx));
  }
  arrived(floor) {
    if (this.teter && floor === this.teter.floor) { this.say(this.teter, this.teter.lines || ['Hi hon! There’s beer in the cooler.'], 3.2); this.events.push({ kind: 'teter_greet', t: this.time }); }
  }
  // a resident says a line, or a sequence of lines one after another (the bubble shows r.said while r.sayT > 0)
  say(r, lines, dur = 2.6) { r.queue = lines.map(t => ({ t, dur })); const f = r.queue.shift(); r.said = f.t; r.sayT = f.dur; }
  tickSay(r, dt) { if (r.sayT > 0) { r.sayT -= dt; if (r.sayT <= 0 && r.queue && r.queue.length) { const f = r.queue.shift(); r.said = f.t; r.sayT = f.dur; } } }
  // press links: which one is under the hero's feet and which way it goes (up / down); null if none within reach
  pressHere() {
    const h = this.hero; if (h.link) return null;
    for (const l of this.K.links) {
      if (!l.press || (l.a !== h.floor && l.b !== h.floor)) continue;
      const here = l.a === h.floor, end = here ? l.ax : l.bx, other = this.F[here ? l.b : l.a];
      if (Math.abs(h.x - end) < 0.6) return { l, end, toward: Math.sign((here ? l.bx : l.ax) - end), up: other.z > this.F[h.floor].z };
    }
    return null;
  }
  hint() { const ph = this.pressHere(); return ph ? (ph.up ? 'push UP to climb the stairs' : 'push DOWN to take the stairs') : null; }
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
    else if (jm > 0.2 && (Math.abs(jx) > 0.25 || (Math.abs(jy) > 0.5 && (h.link || this.pressHere())))) {
      // pushing straight UP / DOWN works on stairs: at a press link's foot it takes the flight, and on a flight it runs it (up = toward the higher floor)
      let dir = Math.sign(jx);
      if (Math.abs(jx) <= 0.25) { if (h.link) { const l = this.L[h.link.id] || h.link, hi = this.F[l.b].z > this.F[l.a].z ? 'b' : 'a', toB = (jy < 0) === (hi === 'b'); dir = (toB ? 1 : -1) * Math.sign(l.bx - l.ax); } else dir = this.pressHere().toward; }
      h.face = dir; h.moving = true; h.walk += dt;
      const down = jy > 0.35;                                // on the landing: down-right takes the half-flight DOWN
      const fork = this.K.links.filter(l => !l.press && (l.a === h.floor || l.b === h.floor)).length > 1;   // only the landing is a fork
      this.moveOn(h, dir, h.link ? MOVE.stair : MOVE.walk, dt, (l) => {
        if (l.press) { const up = this.F[l.a === h.floor ? l.b : l.a].z > this.F[h.floor].z; return up ? jy < -0.3 : jy > 0.3; }   // stairs that overlap a floor: push up / down at the foot
        return !fork || (l.id === 'down') === down;
      });
    } else h.moving = false;
    this.tickSay(this.teter || {}, dt);
    this.stepBeat(dt);
    if (this.barker) { const b = this.barker.step(dt); if (b) { h.said = b; h.sayT = this.barker.hold; this.events.push({ kind: 'rigg_bark', text: b, t: this.time }); } }
    if (h.sayT > 0) { h.sayT -= dt; if (h.sayT <= 0) h.said = null; }
    for (const g of this.guests) { if (g.drinkT > 0) { g.drinkT -= dt; if (g.drinkT <= 0) g.drank++; } else if ((g.sip -= dt) <= 0) { g.drinkT = MOVE.drink; g.sip = 5 + this.rnd() * 5; } }
    for (const d of this.dogs) this.stepDog(d, dt);
    return out;
  }
  // the house beat (Rigg's): walk in -> the old guy yells for Brian -> Brian comes down the stairs and meets you at the foot of them
  stepBeat(dt) {
    const B = this.beat, D = this.dad, S = this.son; if (D) this.tickSay(D, dt); if (S) this.tickSay(S, dt);
    if (!B) return;
    if (B.stage === 0 && this.time > 0.9) { B.stage = 1; this.say(D, [D.yell || 'Brrrrrriiiiiiaaaaannnn'], 3.4); this.events.push({ kind: 'dad_yell', t: this.time }); }
    if (!S) return;
    if (B.stage === 1 && this.time > 2.3) { B.stage = 2; S.state = 'down'; this.events.push({ kind: 'son_coming', t: this.time }); }
    if (S.state === 'down') {
      const dt2 = dt, sp = S.link ? MOVE.stair : MOVE.walk; S.moving = true; S.walk += dt2;
      if (S.link || S.floor === 'upper') { S.face = -1; this.moveOn(S, -1, sp, dt2, () => S.floor === 'upper'); }   // along the hall, down the flight (press links: only from the top)
      else {                                                  // on the first floor: walk out to the foot of the stairs where you are
        const tx = Math.max(2.1, this.hero.x + 1.4), d = tx - S.x; S.face = d < 0 ? -1 : 1;
        if (Math.abs(d) < 0.12) { S.state = 'there'; S.moving = false; S.face = -1; this.say(S, ['…yeah?'], 2.2); this.events.push({ kind: 'son_down', t: this.time }); }
        else this.moveOn(S, Math.sign(d), MOVE.walk, dt2, () => false);
      }
    }
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
