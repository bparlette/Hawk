// lf_places.js — task L12/L13: the ENTERABLE PLACES (data/places.json, tools/places_build.py) + the world set-pieces.
// Pure logic (spec + main.js); drawing is lf_places_render.js. THE HOOKS main.js calls (everything else lives here):
//   const PL = new Places(PJ)            PJ = data/places.json
//   PL.heroes()                          hero entries to push onto areas.json's heroes (the Weis, Gringada) — hero tier draws them
//   PL.attach(sim)                       parks the 108 Astro on Route 108 and Scott's Civic at Scott's house (idempotent)
//   PL.label(foot, sim) -> 'GO IN' | 'ROB LIGHTS' | ''          what the big ACTION button says on foot
//   PL.act(foot, sim)  -> { enter: place } | { rob: car } | null   ACTION on foot (GO IN a public building / ROB LIGHTS)
//   new PlaceInterior(kit, { who, seed })  a walk-in public building: same API as Interior (step(dt, inp) -> 'exit' | null, prompt())
// PUBLIC places (the Weis, Gringada) are NOT a crew house: anyone can GO IN at the door, and you come out of the same door.
import { Interior, MOVE } from './lf_interior.js';
import { carDist } from './lf_foot.js';

export const PLACE = { doorR: 78, astroR: 46, S: 1.12 };           // GO IN radius at the door (world units); the hero tier draws POI footprints x1.12
const rngOf = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// where the DOOR is in the world: the visible (x1.12) wall point + the outward normal * 26 — you walk up to the sign
export function doorPoint(p) {
  const [wx, wy] = p.door.wall, S = PLACE.S;
  return { x: p.cx + (wx - p.cx) * S + p.door.nx * 26, y: p.cy + (wy - p.cy) * S + p.door.ny * 26, nx: p.door.nx, ny: p.door.ny };
}

export class Places {
  constructor(PJ) { this.PJ = PJ || { places: [], npcs: [], setpieces: [] }; this.bark = null; this.t = 0; this.attached = null; }
  heroes() { return this.PJ.places.map(p => ({ b: p.b, who: p.name, kind: 'poi', style: p.style, memory: !!p.memory, year: p.year, door: p.door, place: p.id })); }
  place(id) { return this.PJ.places.find(p => p.id === id); }
  // ---- the set-pieces
  attach(sim) {
    if (this.attached === sim) return; this.attached = sim;
    for (const s of this.PJ.setpieces) {
      if (!sim.fleet[s.sprite] || sim.cars.some(c => c.owner === s.id)) continue;
      const c = sim.addCar(s.sprite, s.x, s.y, s.h, { owner: s.id, parked: true, set: s.id }); c.lightsGone = false;
    }
    for (const n of this.PJ.npcs) {                         // Scott's Civic in his driveway (reuses the closest sprite — see places.json)
      if (!n.car || !sim.fleet[n.car.sprite] || sim.cars.some(c => c.owner === n.id)) continue;
      const [hx, hy] = n.house, r = sim.W.roadInfo(hx, hy, 0), c = sim.addCar(n.car.sprite, hx, hy, 0, { owner: n.id, parked: true, set: n.id + '-car' });
      if (r.e) { const q = sim.nearPt(hx, hy, r), a = Math.atan2(q.y - hy, q.x - hx); c.x = hx + Math.cos(a) * 55; c.y = hy + Math.sin(a) * 55; c.h = a; }
    }
  }
  astro(sim) { return sim.cars.find(c => c.set === 'astro108') || null; }
  nearAstro(foot, sim) { const c = this.astro(sim); return c && !c.lightsGone && !(foot.z > 4) && carDist(foot, c) < PLACE.astroR ? c : null; }
  nearDoor(foot) {
    if (foot.z > 4) return null; let best = null, bd = PLACE.doorR;
    for (const p of this.PJ.places) { const d = doorPoint(p), q = Math.hypot(foot.x - d.x, foot.y - d.y); if (q < bd) { bd = q; best = p; } }
    return best;
  }
  label(foot, sim) { return this.nearDoor(foot) ? 'GO IN' : this.nearAstro(foot, sim) ? 'ROB LIGHTS' : ''; }
  act(foot, sim) {
    const pl = this.nearDoor(foot); if (pl) return { enter: pl };
    const c = this.nearAstro(foot, sim);
    if (c) {                                                // Jason's beat: the parking lights come off the parked Astro
      c.lightsGone = true; const me = foot.who && foot.who.id;
      this.bark = { x: foot.x, y: foot.y - 40, t: 3.4, text: me === 'jason' ? 'Parking lights. Mine now.' : (foot.who ? foot.who.name : 'Someone') + ': Jason would take these.' };
      return { rob: c };
    }
    return null;
  }
  step(dt) { this.t += dt; if (this.bark && (this.bark.t -= dt) <= 0) this.bark = null; }
}

// ======================================================================================================================
// the walk-in PUBLIC building: one long floor, residents (npcs) at their posts, scripted beats, a bite to eat
// ======================================================================================================================
export class PlaceInterior extends Interior {
  constructor(K, opts = {}) {
    super(K, opts);
    this.place = K.id; this.exitAt = opts.exitAt || null; this.rnd = rngOf(opts.seed || 11);
    const h = this.hero; this.me = h.who.id; Object.assign(h, { hold: null, eatT: 0, speech: null, frozen: false, auto: null, ate: 0 });
    this.npcs = (K.npcs || []).filter(n => n.id !== this.me).map(n => ({ ...n, z: this.F[n.floor].z, walk: 0, moving: false, speech: null, hold: null, eatT: 0, fast: false, goal: null, idleT: 3 + this.rnd() * 7, hidden: !!n.hidden }));
    this.beat = null; this.done = new Set(); this.later = []; this.flags = {}; this.said = []; this.banner = null; this.fx = [];
    this.caseLeft = 6; this.sodaOpen = false; this.focus = null;
  }
  actor(id) { return id === this.me ? this.hero : this.npcs.find(n => n.id === id) || null; }
  say(id, text, dur = 2.2) { const a = this.actor(id); if (!a) return; a.speech = { text, t: dur }; this.said.push({ who: id, text, t: this.time }); this.events.push({ kind: 'say', who: id, text, t: this.time }); }
  // ---- the spots: ACTION does what's under your feet. A spot can be `only` one person (OPEN SODA is Rigg's, STEAL FOOD is Jimmy's).
  spot() {
    const h = this.hero; let best = null;
    for (const s of this.K.spots) if (s.floor === h.floor && (!s.only || s.only === this.me) && Math.abs(s.x - h.x) < MOVE.reach && (!best || Math.abs(s.x - h.x) < Math.abs(best.x - h.x))) best = s;
    return best;
  }
  prompt() {
    const h = this.hero; if (h.frozen || h.auto || h.eatT > 0 || this.beat) return null;
    const s = this.spot();
    if (s && s.act === 'EXIT') return 'EXIT';
    if (h.hold) return 'EAT';
    if (!s) return null;
    if (s.act === 'STEAL FOOD' && this.caseLeft < 1) return null;
    if (s.act === 'ORDER' && this.me === 'brad') return 'GRAB CHIPS';
    return s.act;
  }
  later_(t, fn) { this.later.push({ t, fn }); }
  // ---- the beats (scripts). A step is [verb, ...]; blocking verbs: wait, walk. `me` plays his own part.
  startBeat(name) {
    if (this.beat || this.done.has(name)) return false; this.done.add(name); this.hero.frozen = true;
    const K = this.K, steps = [];
    if (name === 'fired') {
      const rig = this.me === 'rigg' ? this.hero.x : (this.actor('rigg') || { x: 28 }).x, door = K.door.x + 0.2;
      steps.push(['say', 'rigg', 'Warm. Gotta make sure it’s not flat.', 2.3], ['wait', 2.4], ['do', 'pop'], ['say', 'rigg', 'Oh. That’s gonna be on the floor.', 1.8], ['wait', 1.9],
        ['show', 'scott', 45.4], ['say', 'scott', 'BRIAN.', 1.2], ['walk', [['scott', rig + 2.1]], 4.2], ['say', 'scott', 'Did you just open that?', 2.2], ['wait', 2.4],
        ['say', 'rigg', 'It was warm.', 1.5], ['wait', 1.6], ['say', 'scott', 'You’re fired.', 1.8], ['wait', 1.9],
        ['say', 'rigg', 'Fuck Scott.', 2.6], ['do', 'fired'], ['wait', 2.7], ['walk', [['rigg', door]], 3.9], ['say', 'jason', 'Another one.', 1.8], ['wait', 0.5], ['hide', 'rigg'], ['walk', [['scott', 46.6]], 2.6], ['hide', 'scott'], ['do', 'free']);
    } else if (name === 'steal') {
      const jimmyFirst = this.me === 'jimmy', case_ = (K.props.find(p => p.kind === 'hot_case') || { x: 15 }).x, door = K.door.x - 0.4;
      const crew = [['jimmy', case_ - 0.5], ['clayton', case_ - 1.5], ['zack', case_ - 2.7]];
      steps.push(['say', 'brad', 'Be right with you guys!', 2.0], ['face', 'brad', 1]);
      if (jimmyFirst) steps.push(['do', 'steal'], ['show', 'clayton', 0.4], ['show', 'zack', -0.4], ['walk', crew.slice(1), 4.0]);
      else steps.push(['show', 'jimmy', 0.2], ['show', 'clayton', -0.8], ['show', 'zack', -1.8], ['walk', crew, 4.0], ['do', 'steal']);
      steps.push(['say', 'clayton', 'Go. Go. Brad’s not looking.', 1.9], ['wait', 1.4],
        ['say', 'zack', 'why are you going to Clayton it', 2.8], ['wait', 1.7], ['do', 'eatfast'], ['wait', 1.2], ['say', 'jimmy', '...', 1.2], ['wait', 0.5],
        ['face', 'brad', -1], ['say', 'brad', 'HEY!', 1.5], ['wait', 0.6], ['walk', crew.map(c => [c[0], door]), 5.2], ['hide', 'jimmy'], ['hide', 'clayton'], ['hide', 'zack'],
        ['say', 'brad', 'Every. Single. Time.', 2.2], ['wait', 1.2], ['do', 'free']);
    }
    this.focus = name === 'fired' ? (this.me === 'rigg' ? this.hero.x : (this.actor('rigg') || { x: 28 }).x) + 1.0 : (K.props.find(p => p.kind === 'hot_case') || { x: 15 }).x - 1.5;   // the camera frames the scene
    this.beat = { name, steps, i: 0, w: 0, walkers: [] }; this.events.push({ kind: 'beat', name, t: this.time }); return true;
  }
  runBeat(dt) {
    const b = this.beat; if (!b) return;
    for (let guard = 0; guard < 40; guard++) {
      if (b.w > 0) { b.w -= dt; if (b.w > 0) return; dt = 0; }
      if (b.walkers.length) { b.walkers = b.walkers.filter(a => a.goal || (a === this.hero && this.hero.auto)); if (b.walkers.length) return; }
      const s = b.steps[b.i++]; if (!s) { this.beat = null; this.focus = null; this.hero.frozen = false; this.events.push({ kind: 'beat_done', name: b.name, t: this.time }); return; }
      const [v] = s;
      if (v === 'say') this.say(s[1], s[2], s[3]);
      else if (v === 'wait') b.w = s[1];
      else if (v === 'show') { const a = this.actor(s[1]); if (a && a !== this.hero) { a.hidden = false; a.x = s[2]; a.face = 1; } }
      else if (v === 'hide') { const a = this.actor(s[1]); if (a && a !== this.hero) { a.hidden = true; a.goal = null; } }
      else if (v === 'face') { const a = this.actor(s[1]); if (a) a.face = s[2]; }
      else if (v === 'walk') for (const [id, x] of s[1]) {
        const a = this.actor(id); if (!a) continue;
        if (a === this.hero) { if (id === 'rigg') { this.hero.auto = { x, sp: s[2] }; b.walkers.push(a); } }   // only Rigg's walk-out moves YOU
        else { a.goal = { x, sp: s[2] }; b.walkers.push(a); }
      }
      else if (v === 'do') this.doBeat(s[1]);
    }
  }
  doBeat(what) {
    if (what === 'pop') { this.sodaOpen = true; this.fx.push({ kind: 'fizz', x: (this.K.props.find(p => p.kind === 'soda') || { x: 27 }).x, t: 0 }); this.events.push({ kind: 'soda_open', t: this.time }); }
    else if (what === 'fired') { this.banner = { text: 'BRIAN (RIGG) GOT FIRED · THE SODA', t: 5 }; this.events.push({ kind: 'fired', who: 'rigg', banner: this.banner.text, t: this.time }); }
    else if (what === 'steal') { this.caseLeft = Math.max(0, this.caseLeft - 1); const j = this.actor('jimmy'); j.hold = 'burrito'; this.events.push({ kind: 'steal', who: 'jimmy', t: this.time }); }
    else if (what === 'eatfast') { const j = this.actor('jimmy'); j.eatT = 0.85; j.fast = true; this.events.push({ kind: 'eat_fast', who: 'jimmy', t: this.time }); }
    else if (what === 'free') { this.hero.frozen = false; this.hero.auto = null; }
  }
  // ---- the residents
  moveToward(a, dt) {
    const g = a.goal; if (!g) { a.moving = false; return; }
    const d = g.x - a.x; if (Math.abs(d) < 0.08) { a.x = g.x; a.goal = null; a.moving = false; return; }
    a.face = Math.sign(d); a.moving = true; a.walk += dt; a.x += Math.sign(d) * Math.min(Math.abs(d), g.sp * dt);
  }
  stepNpcs(dt) {
    const h = this.hero;
    for (const a of this.npcs) {
      if (a.speech && (a.speech.t -= dt) <= 0) a.speech = null;
      if (a.eatT > 0 && (a.eatT -= dt) <= 0) { a.hold = null; a.fast = false; }
      this.moveToward(a, dt);
      if (a.hidden || this.beat || a.goal) continue;
      if (a.id === 'jason' && Math.abs(h.x - a.x) < 9) a.face = Math.sign(h.x - a.x) || a.face;      // the guard watches you
      if ((a.idleT -= dt) <= 0) { a.idleT = 9 + this.rnd() * 9; if (a.barks && a.barks.length && Math.abs(h.x - a.x) < 12) this.say(a.id, a.barks[Math.floor(this.rnd() * a.barks.length)], 3); }
    }
  }
  triggers() {
    const h = this.hero;
    if (this.beat || h.frozen) return;
    if (this.K.beats.includes('fired') && this.me !== 'rigg' && !this.done.has('fired')) { const r = this.actor('rigg'); if (r && Math.abs(h.x - r.x) < 5.5) this.startBeat('fired'); }
    if (this.K.beats.includes('steal') && this.me !== 'jimmy' && !this.done.has('steal') && this.time > 3.2 && h.x > 3.5) this.startBeat('steal');
  }
  step(dt, inp = {}) {
    this.time += dt; const h = this.hero, k = inp.keys || {};
    let jx = inp.jx || 0, jm = inp.jm || 0;
    if (k.left || k.right || k.up || k.down) { jx = (k.right ? 1 : 0) - (k.left ? 1 : 0); jm = jx || (k.up || k.down) ? 1 : 0; }
    let out = null;
    for (const f of this.later) f.t -= dt; for (const f of this.later.filter(f => f.t <= 0)) f.fn(); this.later = this.later.filter(f => f.t > 0);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    for (const f of this.fx) f.t += dt; this.fx = this.fx.filter(f => f.t < 2.4);
    if (h.speech && (h.speech.t -= dt) <= 0) h.speech = null;
    this.runBeat(dt); this.stepNpcs(dt);
    if (inp.action && !h.frozen && !h.auto && !this.beat) {
      const pr = this.prompt(), s = this.spot();
      if (pr === 'EXIT') out = 'exit';
      else if (pr === 'EAT') { h.eatT = 1.9; this.events.push({ kind: 'eat', what: h.hold, t: this.time }); }
      else if (pr === 'GRAB SLICE') { h.hold = 'slice'; this.events.push({ kind: 'grab', src: s.src, t: this.time }); }
      else if (pr === 'GRAB CHIPS') { h.hold = 'chips'; this.events.push({ kind: 'grab', src: s.src, t: this.time }); }
      else if (pr === 'ORDER') { this.say('brad', 'Welcome to Gringada. What can I get you?', 2.4); this.events.push({ kind: 'order', t: this.time }); this.later_(1.3, () => { h.hold = 'chips'; }); }
      else if (pr === 'OPEN SODA') this.startBeat('fired');
      else if (pr === 'STEAL FOOD') this.startBeat('steal');
    }
    if (h.eatT > 0) { h.eatT -= dt; h.moving = false; if (h.eatT <= 0) { h.hold = null; h.ate++; } }
    else if (h.auto) {                                       // walking you out (Rigg, fired)
      const d = h.auto.x - h.x;
      if (Math.abs(d) < 0.15) { h.auto = null; h.frozen = false; this.events.push({ kind: 'walked_out', t: this.time }); out = 'exit'; }
      else { h.face = Math.sign(d); h.moving = true; h.walk += dt; h.x += Math.sign(d) * Math.min(Math.abs(d), h.auto.sp * dt); }
    } else if (!h.frozen && jm > 0.2 && Math.abs(jx) > 0.25) {
      const dir = Math.sign(jx), f = this.F[h.floor]; h.face = dir; h.moving = true; h.walk += dt;
      h.x = Math.max(f.x0 + 0.25, Math.min(f.x1 - 0.25, h.x + dir * MOVE.walk * dt));
    } else h.moving = false;
    this.triggers();
    return out;
  }
  roomOf(p) { return (this.K.rooms.find(r => p.x >= r.x0 && p.x <= r.x1) || {}).name || ''; }
}
