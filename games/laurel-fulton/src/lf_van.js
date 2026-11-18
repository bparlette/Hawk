// lf_van.js — David Klink's Scooby-Doo van, parked by Rigg's house (owner, Nov 18; g12/SPECS.md, Rigg section).
// A Mystery-Machine-style panel van: a PROP CAR (a real, immovable car in sim.cars — cars bounce off it, nobody can GET IN: it is
// `remote`, the same flag another player's car carries) drawn top-down by this file (no fleet sprite exists for it; the drawing is
// painted, canvas-only). On foot the van is a SOLID (26 units: a wall, taller than a mantle from the road AND from the tip) — and its EXHAUST TIP, at the rear
// corner, is STEPPABLE: lf_climb.js-style support (support(x, y) -> {top, kind}, merged with the roof's by main.js) puts a 5-unit
// step there, so walking into it plays lf_climb's haul-up (a little step-up hop, drawn with an extra lift by hopLift) and the tailpipe
// answers with a PUFF of exhaust. Stand on it and it chuffs now and then. The body stays a wall even from up on the tip (26 - 5 > 20): no roof-hopping.
// Pure logic + canvas drawing; main.js wires it (sim car, support merge, step, FOOTPROJ lift), lf_render.drawCar calls draw().
export const VAN = { len: 52, wid: 21, h: 26, exhaustTop: 5, ex: { w: 10, d: 9 } };
const TAU = Math.PI * 2;

export class ScoobyVan {
  constructor(car) {
    this.car = car; car.van = this; this.puffs = []; this.standing = false; this.chuffT = 0; this.pop = 0; this.t = 0;
  }
  get c() { return this.car; }
  // the exhaust tip's centre: behind the rear bumper, at the right-hand (passenger) rear corner
  exhaust() {
    const c = this.car, fx = Math.cos(c.h), fy = Math.sin(c.h), rx = -fy, ry = fx;
    const b = -VAN.len / 2 - 3.5, s = VAN.wid / 2 - 5;
    return { x: c.x + fx * b + rx * s, y: c.y + fy * b + ry * s, a: c.h, fx, fy };
  }
  // lf_climb's Roof.support, for the van: the highest surface under (x, y) -> { top, kind }
  support(x, y) {
    const c = this.car, dx = x - c.x, dy = y - c.y;
    if (Math.abs(dx) > 60 || Math.abs(dy) > 60) return { top: 0, kind: 'ground' };
    const ca = Math.cos(c.h), sa = Math.sin(c.h);
    let s = { top: 0, kind: 'ground' };
    if (Math.abs(dx * ca + dy * sa) < VAN.len / 2 && Math.abs(-dx * sa + dy * ca) < VAN.wid / 2) s = { top: VAN.h, kind: 'van' };
    const e = this.exhaust(), ex = x - e.x, ey = y - e.y;
    if (Math.abs(ex * ca + ey * sa) < VAN.ex.w / 2 && Math.abs(-ex * sa + ey * ca) < VAN.ex.d / 2 && VAN.exhaustTop > s.top) s = { top: VAN.exhaustTop, kind: 'exhaust' };
    return s;
  }
  puff(n = 6) {
    const e = this.exhaust();
    for (let i = 0; i < n; i++) this.puffs.push({ x: e.x - e.fx * 2, y: e.y - e.fy * 2, vx: -e.fx * (14 + Math.random() * 16) + (Math.random() - 0.5) * 14, vy: -e.fy * (14 + Math.random() * 16) + (Math.random() - 0.5) * 14 - 10, r: 3 + Math.random() * 2, life: 0, max: 0.9 + Math.random() * 0.5 });
    this.pop = 0.9; this.count = (this.count || 0) + 1;
  }
  // every frame: are you standing on the tip? a fresh step-on = a burst; stand there and it chuffs
  step(dt, foot) {
    this.t += dt; if (this.pop > 0) this.pop -= dt;
    const on = !!foot && foot.active && !foot.climb && !foot.air && (foot.z || 0) >= VAN.exhaustTop - 0.5 && (foot.z || 0) <= VAN.exhaustTop + 0.5 && this.support(foot.x, foot.y).kind === 'exhaust';
    if (on && !this.standing) { this.puff(8); this.chuffT = 1.4; this.steppedOn = (this.steppedOn || 0) + 1; }
    else if (on && (this.chuffT -= dt) <= 0) { this.puff(4); this.chuffT = 1.1 + Math.random() * 0.8; }
    this.standing = on;
    for (const p of this.puffs) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.r += dt * 7; }
    this.puffs = this.puffs.filter(p => p.life < p.max);
  }
  // 'shadow' pass (under the cars) and 'color' pass; the puffs ride the colour pass so they float over the van
  draw(g, c, which, time = 0) {
    const L = VAN.len, W = VAN.wid;
    if (which === 'shadow') { g.save(); g.translate(c.x + 5, c.y - 1.5); g.rotate(c.h); g.fillStyle = 'rgba(24,20,40,0.5)'; g.beginPath(); g.roundRect(-L / 2, -W / 2, L, W, 4); g.fill(); g.restore(); return; }
    g.save(); g.translate(c.x, c.y); g.rotate(c.h);
    const rr = (x, y, w, h, r, fill, stroke) => { g.beginPath(); g.roundRect(x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.1; g.stroke(); } };
    // bumpers + the rear step, the chrome tailpipe poking out at the right-hand rear corner
    rr(-L / 2 - 2.5, -W / 2 + 1, 3.5, W - 2, 1.4, '#b9bec4', '#2a1430'); rr(L / 2 - 1, -W / 2 + 1, 3.5, W - 2, 1.4, '#b9bec4', '#2a1430');
    const ex = VAN.wid / 2 - 5; g.fillStyle = '#8c9298'; g.fillRect(-L / 2 - 6, ex - 2.2, 4.5, 4.4); g.fillStyle = '#d8dde2'; g.fillRect(-L / 2 - 6, ex - 2.2, 1.5, 4.4); g.fillStyle = '#15110f'; g.beginPath(); g.ellipse(-L / 2 - 6, ex, 1.1, 1.9, 0, 0, TAU); g.fill();
    // the body: teal, a lime flash down both sides, the cab + hood forward (right), cargo roof behind
    rr(-L / 2, -W / 2, L, W, 4.5, '#2fb3b0', '#2a1430');
    g.fillStyle = '#8fd13f'; g.fillRect(-L / 2 + 3, -W / 2 + 1.6, L - 14, 2.2); g.fillRect(-L / 2 + 3, W / 2 - 3.8, L - 14, 2.2);          // the green stripe
    rr(-L / 2 + 3, -W / 2 + 5, L - 20, W - 10, 3, '#3fc4c0');                                                                          // roof panel
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(-L / 2 + 5, -W / 2 + 6, L - 24, 2);
    g.fillStyle = '#2a8f8c'; g.fillRect(-L / 2 + 8, -0.5, L - 28, 1); g.fillRect(-L / 2 + 22, -W / 2 + 5, 1, W - 10);                    // roof seams
    rr(L / 2 - 14, -W / 2 + 2, 14, W - 4, 3, '#2a9f9c', '#2a1430');                                                                     // hood
    g.fillStyle = '#16303a'; g.beginPath(); g.moveTo(L / 2 - 15, -W / 2 + 2.6); g.lineTo(L / 2 - 20, -W / 2 + 4.6); g.lineTo(L / 2 - 20, W / 2 - 4.6); g.lineTo(L / 2 - 15, W / 2 - 2.6); g.closePath(); g.fill();   // windshield
    g.fillStyle = 'rgba(190,230,255,0.4)'; g.beginPath(); g.moveTo(L / 2 - 16, -W / 2 + 4); g.lineTo(L / 2 - 18.5, -W / 2 + 5.4); g.lineTo(L / 2 - 18.5, -2); g.lineTo(L / 2 - 16, -2.5); g.fill();
    g.fillStyle = '#fff3a8'; g.fillRect(L / 2 - 1.5, -W / 2 + 2.2, 1.6, 3.2); g.fillRect(L / 2 - 1.5, W / 2 - 5.4, 1.6, 3.2);               // headlights
    g.fillStyle = '#c8281e'; g.fillRect(-L / 2 + 0.2, -W / 2 + 2, 1.6, 3); g.fillRect(-L / 2 + 0.2, W / 2 - 5, 1.6, 3);                    // tail lights
    g.fillStyle = '#1f4a54'; g.fillRect(-L / 2 + 0.4, -0.5, 1.2, 1);                                                                    // the rear doors' split
    rr(L / 2 - 20, -W / 2 - 1.6, 2.6, 2, 1, '#2a1430'); rr(L / 2 - 20, W / 2 - 0.4, 2.6, 2, 1, '#2a1430');                              // mirrors
    // the flower power + the paw (the Mystery Machine read): three orange flowers on the roof, a Scooby paw print
    for (const [fx, fy, s] of [[-14, -4.8, 1], [-4, 5, 0.85], [6, -4, 0.9]]) {
      g.fillStyle = '#ff8c2a'; for (let i = 0; i < 5; i++) { const a = i * TAU / 5; g.beginPath(); g.arc(fx + Math.cos(a) * 1.9 * s, fy + Math.sin(a) * 1.9 * s, 1.5 * s, 0, TAU); g.fill(); }
      g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(fx, fy, 1.15 * s, 0, TAU); g.fill();
    }
    g.fillStyle = '#6a3a1a'; g.beginPath(); g.ellipse(-20.5, 3.2, 1.9, 1.5, 0, 0, TAU); g.fill(); for (const [dx, dy] of [[-3.3, 1.8], [-3.6, 4.4], [-1.8, 5.6], [-0.4, 4.2]]) { g.beginPath(); g.arc(-20.5 - dx * 0.7, 3.2 + (dy - 3.2) * 0.9, 0.85, 0, TAU); g.fill(); }
    g.restore();
    // the exhaust puffs: grey-black clouds that swell and thin out
    for (const p of this.puffs) { const u = p.life / p.max; g.globalAlpha = 0.55 * (1 - u); g.fillStyle = u < 0.3 ? '#4a4648' : '#8a8688'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    if (this.pop > 0) { const e = this.exhaust(); g.save(); g.globalAlpha = Math.min(1, this.pop * 2); g.font = '900 11px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(27,20,48,0.85)'; g.fillStyle = '#ffe9c4'; const y = e.y - 16 - (0.9 - this.pop) * 14; g.strokeText('pfft!', e.x, y); g.fillText('pfft!', e.x, y); g.restore(); }
  }
}

// Where the van parks: alongside Rigg's Celica (the shared-driveway rule: a second car sits 28+ units to the side), on whichever side is
// clear of every house footprint (inHouse) and of the road. Falls back to the near side.
export function placeVan(sim, personId = 'rigg', inHouse = () => false) {
  const base = sim.cars.find(c => c.owner === personId); if (!base) return null;
  if (!sim.fleet.van_klink) sim.fleet.van_klink = { ...(sim.fleet.astro_billy || Object.values(sim.fleet)[0]), length: VAN.len, width: VAN.wid };   // a fleet entry just for the prop: its own model key, no crew fx
  let best = null;
  for (const side of [1, -1]) for (const back of [0, -22, 22]) {
    const x = base.x + Math.cos(base.h + Math.PI / 2) * 34 * side + Math.cos(base.h) * back, y = base.y + Math.sin(base.h + Math.PI / 2) * 34 * side + Math.sin(base.h) * back;
    const r = sim.W.roadInfo(x, y, 0), bad = (r.e && r.d < r.hw + 24) || [[0, 0], [30, 0], [-30, 0], [0, 12], [0, -12]].some(([dx, dy]) => inHouse(x + Math.cos(base.h) * dx - Math.sin(base.h) * dy, y + Math.sin(base.h) * dx + Math.cos(base.h) * dy));
    if (!bad) { best = { x, y }; break; }
  }
  if (!best) best = { x: base.x + Math.cos(base.h + Math.PI / 2) * 34, y: base.y + Math.sin(base.h + Math.PI / 2) * 34 };
  const car = sim.addCar('van_klink', best.x, best.y, base.h, { owner: 'klink', parked: true, remote: true, prop: true });   // `remote` = immovable here + nobody can GET IN
  return new ScoobyVan(car);
}

// the on-foot support main.js hands lf_climb.stepOnFoot: the roof's (when it has loaded) and the van's, whichever is higher
export function mergedSupport(getRoof, getVan) {
  return { support(x, y) { const r = getRoof() ? getRoof().support(x, y) : { top: 0, kind: 'ground' }, v = getVan() ? getVan().support(x, y) : null; return v && v.top > r.top ? v : r; } };
}
// the step-up hop, drawn: lf_climb's haul-up onto the tip is a few units of rise — far too small to see — so the foot's draw point is lifted on
// a little arc while it climbs (and a hair while it stands there). `p` is lf_climb.project's {x, y, k}; returns it.
export function hopLift(p, foot) {
  if (!foot) return p;
  if (foot.climb && foot.climb.onto === 'exhaust') { const u = Math.min(1, foot.climb.t / foot.climb.dur); p.y -= Math.sin(Math.PI * u) * 9 + u * 3; }
  else if ((foot.sup || 0) === VAN.exhaustTop && (foot.z || 0) === VAN.exhaustTop) p.y -= 3;
  return p;
}
