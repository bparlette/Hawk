// Lanternport: the whole game as a deterministic 30 Hz simulation with no rendering, so the browser client,
// the attract-mode bot and the headless tests all run exactly the same rules.
//
// An open-city sandbox in a storybook town: two switchable heroes, on-foot platforming (the verified
// kit/sm64-controller), hover-carts you can borrow, a Heat level policed by the Lantern Watch, and missions.
// Units are controller units (100 = 1 m, hero runs 32 per tick). Yaw for vehicles/NPCs is radians, 0 = +Z,
// forward = (sin yaw, cos yaw); heroes on foot use the controller's own 16-bit angle units.
import { Sm64Controller } from './lib/controller.js';
import { BoxWorld } from './lib/boxworld.js';

export const N = 6, PITCH = 4200, ROAD = 1200, HALF = (N * PITCH) / 2, WALK = 300, EDGE = HALF + ROAD / 2;
export const roadAt = (i) => -HALF + i * PITCH;
const ANG = (Math.PI * 2) / 0x10000;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const toS16 = (rad) => ((Math.round(rad / ANG) + 0x8000) & 0xFFFF) - 0x8000;

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const VEHICLES = {
  cart:  { max: 46, accel: 1.1, turn: 0.050, r: 150, name: 'hover-cart' },
  skiff: { max: 80, accel: 2.1, turn: 0.058, r: 140, name: 'sky-skiff' },
  wagon: { max: 70, accel: 1.9, turn: 0.054, r: 165, name: 'Watch wagon' },
  tithe: { max: 34, accel: 0.9, turn: 0.045, r: 185, name: 'tithe wagon' },
};
export const HEROES = [
  { name: 'Juniper', blurb: 'rooftop courier' },
  { name: 'Fen', blurb: 'skiff pilot' },
];
const SPECIAL = { '0,0': 'hideout', '2,0': 'bakery', '2,3': 'steps', '4,4': 'tailor', '5,5': 'docks', '3,2': 'plaza', '1,4': 'plaza', '4,1': 'counting' };

// ------------------------------------------------------------------------------------------------ city
export function buildCity(seed = 7) {
  const r = rng(seed), boxes = [], blocks = [], trees = [], glimSpots = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const b = { i, j, x0: roadAt(i) + ROAD / 2, x1: roadAt(i + 1) - ROAD / 2, z0: roadAt(j) + ROAD / 2, z1: roadAt(j + 1) - ROAD / 2, kind: SPECIAL[`${i},${j}`] || 'houses' };
    blocks.push(b);
    const L = { x0: b.x0 + WALK, x1: b.x1 - WALK, z0: b.z0 + WALK, z1: b.z1 - WALK };
    if (b.kind === 'steps') {
      // A rooftop staircase for the lamp mission: four terraces, each one hop higher.
      const w = (L.x1 - L.x0) / 4;
      for (let k = 0; k < 4; k++) boxes.push({ x0: L.x0 + k * w, x1: L.x0 + (k + 1) * w, y0: 0, y1: 200 * (k + 1), z0: L.z0 + 500, z1: L.z1, kind: 'house', hue: k % 5, roof: (k + 1) % 4 });
      continue;
    }
    if (b.kind === 'plaza' || b.kind === 'hideout' || b.kind === 'docks') {
      for (let k = 0; k < 7; k++) {
        const x = L.x0 + 200 + r() * (L.x1 - L.x0 - 400), z = L.z0 + 200 + r() * (L.z1 - L.z0 - 400);
        trees.push({ x, z, s: 0.8 + r() * 0.6 });
        boxes.push({ x0: x - 45, x1: x + 45, y0: 0, y1: 420, z0: z - 45, z1: z + 45, kind: 'trunk' });
      }
      for (let k = 0; k < 3; k++) glimSpots.push([L.x0 + r() * (L.x1 - L.x0), 90, L.z0 + r() * (L.z1 - L.z0)]);
      continue;
    }
    const nx = r() < 0.65 ? 2 : 1, nz = r() < 0.65 ? 2 : 1, alley = 340;
    const cw = (L.x1 - L.x0 - alley * (nx - 1)) / nx, cd = (L.z1 - L.z0 - alley * (nz - 1)) / nz;
    for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
      const h = 500 + Math.floor(r() * r() * 9) * 250;
      const x0 = L.x0 + a * (cw + alley), z0 = L.z0 + c * (cd + alley);
      const box = { x0, x1: x0 + cw, y0: 0, y1: h, z0, z1: z0 + cd, kind: 'house', hue: Math.floor(r() * 5), roof: Math.floor(r() * 4) };
      boxes.push(box);
      if (h <= 1000) glimSpots.push([(box.x0 + box.x1) / 2, h + 90, (box.z0 + box.z1) / 2]);
      if (h <= 750 && r() < 0.8) { // a crate on the pavement makes the low roofs an easy climb
        const cx = box.x0 + 200 + r() * (cw - 400), south = c === 0;
        boxes.push({ x0: cx - 100, x1: cx + 100, y0: 0, y1: 200, z0: south ? box.z0 - 200 : box.z1, z1: south ? box.z0 : box.z1 + 200, kind: 'crate' });
      }
      if (nx === 2 && a === 0 && r() < 0.5) glimSpots.push([box.x1 + alley / 2, 90, (box.z0 + box.z1) / 2]);
    }
  }
  const T = 300, H = 1400, E = EDGE;
  boxes.push({ x0: -E - T, x1: -E, y0: 0, y1: H, z0: -E - T, z1: E + T, kind: 'rampart' }, { x0: E, x1: E + T, y0: 0, y1: H, z0: -E - T, z1: E + T, kind: 'rampart' },
    { x0: -E, x1: E, y0: 0, y1: H, z0: -E - T, z1: -E, kind: 'rampart' }, { x0: -E, x1: E, y0: 0, y1: H, z0: E, z1: E + T, kind: 'rampart' });
  const mid = (i) => roadAt(i) + PITCH / 2;
  const places = {
    hideout: { x: roadAt(1) - 900, z: roadAt(1) - 350 },
    bakery: { x: mid(2), z: roadAt(1) - 350 },
    bakerCart: { x: mid(2) + 600, z: roadAt(1) - 330, yaw: -Math.PI / 2 },
    lamps: { x: mid(2), z: roadAt(3) + 350 },
    counting: { x: mid(4), z: roadAt(2) - 350 },
    tailor: { x: mid(4), z: roadAt(4) + 350 },
    docks: { x: roadAt(5) + 900, z: roadAt(5) + 350 },
    skiff: { x: roadAt(5) + 1400, z: roadAt(5) + 330, yaw: -Math.PI / 2 },
  };
  const sb = blocks.find((b) => b.kind === 'steps'), sw = (sb.x1 - sb.x0 - 2 * WALK) / 4;
  const lampSpots = [[sb.x0 + WALK + 300, 90, sb.z0 + WALK + 250]];
  for (let k = 0; k < 4; k++) lampSpots.push([sb.x0 + WALK + (k + 0.5) * sw, 200 * (k + 1) + 90, (sb.z0 + sb.z1) / 2 + 250]);
  return { seed, boxes, blocks, trees, glimSpots, lampSpots, places };
}

// ------------------------------------------------------------------------------------------------ missions
// Each step: text (string or fn), optional timer (ticks), begin(g), done(g), target(g) for the map beacon.
export const MISSIONS = [
  {
    id: 'bread', name: 'Hot Bread Run', place: 'bakery', reward: 150,
    brief: 'The baker owes us a favour. Their cart is the favour.',
    begin(g) { const p = g.city.places.bakerCart, v = g.bakerCart; if (v.driver !== 'hero') Object.assign(v, { x: p.x, z: p.z, yaw: p.yaw, vx: 0, vz: 0 }); },
    steps: [
      { text: "Borrow the baker's hover-cart", done: (g) => g.hero.vehicle === g.bakerCart, target: (g) => g.bakerCart },
      { text: 'Get the bread to the hideout while it is hot', timer: 75 * 30, target: (g) => g.city.places.hideout,
        done: (g) => g.hero.vehicle === g.bakerCart && g.near(g.bakerCart, g.city.places.hideout, 420) },
    ],
  },
  {
    id: 'lamps', name: 'Lamplighters', place: 'lamps', reward: 250,
    brief: 'Five moon-lamps on the terrace roofs. Nobody will miss them until dark.',
    begin(g) { g.pickups = g.pickups.filter((p) => p.kind !== 'lamp'); for (const [x, y, z] of g.city.lampSpots) g.pickups.push({ kind: 'lamp', x, y, z, taken: false }); },
    steps: [
      { text: (g) => `Collect the moon-lamps (${g.pickups.filter((p) => p.kind === 'lamp' && p.taken).length}/5)`, timer: 100 * 30,
        done: (g) => g.pickups.every((p) => p.kind !== 'lamp' || p.taken), target: (g) => g.pickups.find((p) => p.kind === 'lamp' && !p.taken) },
      { text: 'The Watch saw the glow. Lose them: rooftops and alleys break their line of sight', begin: (g) => g.setHeat(2), done: (g) => g.heat === 0 },
    ],
  },
  {
    id: 'tithe', name: 'Tithe Day', place: 'counting', reward: 600,
    brief: 'The tithe wagon is slow, heavy, and full of other people\'s money.',
    begin(g) {
      g.tithe = g.spawnVehicle('tithe', roadAt(4), roadAt(3), Math.PI, 'npc', { from: [4, 3], to: [4, 2] }); g.tithe.hits = 0;
      const o = g.heroes[1 - g.active], d = g.city.places.docks; // the other twin waits at the docks
      if (o.vehicle) { o.vehicle.driver = null; o.vehicle = null; }
      o.ctrl = new Sm64Controller(g.world, { x: d.x, y: 0, z: d.z, yaw: 0x8000 });
    },
    end(g) { g.vehicles = g.vehicles.filter((v) => v !== g.tithe); g.tithe = null; g.pickups = g.pickups.filter((p) => p.kind !== 'chest'); },
    steps: [
      { text: (g) => `Ram the tithe wagon until it drops the strongbox (${g.tithe.hits}/3)`, done: (g) => g.tithe.hits >= 3, target: (g) => g.tithe },
      { text: 'Grab the strongbox', begin(g) { g.tithe.driver = null; g.pickups.push({ kind: 'chest', x: g.tithe.x + 260, y: 60, z: g.tithe.z, taken: false }); g.setHeat(3); },
        done: (g) => g.pickups.some((p) => p.kind === 'chest' && p.taken), target: (g) => g.pickups.find((p) => p.kind === 'chest') },
      { text: (g) => `Hand the strongbox to ${HEROES[1 - g.active].name} at the docks`, target: (g) => g.posOf(g.heroes[1 - g.active]),
        done: (g) => g.near(g.posOf(g.hero), g.posOf(g.heroes[1 - g.active]), 450) },
      { text: (g) => `You are ${HEROES[g.active].name} now. Lose the Watch`, begin(g) { g.active = 1 - g.active; g.events.push('switch'); }, done: (g) => g.heat === 0 },
    ],
  },
];

// ------------------------------------------------------------------------------------------------ game
export class Game {
  constructor(seed = 7) {
    this.city = buildCity(seed);
    this.rand = rng(seed * 977 + 13);
    this.world = new BoxWorld({ groundY: 0, boxes: this.city.boxes });
    this.solid = this.city.boxes;
    this.ticks = 0; this.events = []; this.coins = 0; this.heat = 0; this.unseen = 0; this.seen = false;
    this.mission = null; this.unlocked = 0; this.completed = []; this.armed = true; this.banner = null;
    this.vehicles = []; this.peds = []; this.guards = []; this.pickups = []; this.nextId = 1;
    this._use = false; this._swap = false; this.prompt = '';
    const P = this.city.places;
    this.heroes = [
      { ...HEROES[0], ctrl: new Sm64Controller(this.world, { x: P.hideout.x, y: 0, z: P.hideout.z, yaw: 0x4000 }), vehicle: null },
      { ...HEROES[1], ctrl: new Sm64Controller(this.world, { x: P.docks.x, y: 0, z: P.docks.z, yaw: 0x8000 }), vehicle: null },
    ];
    this.active = 0;
    this.bakerCart = this.spawnVehicle('cart', P.bakerCart.x, P.bakerCart.z, P.bakerCart.yaw, null); this.bakerCart.tag = 'baker';
    this.spawnVehicle('skiff', P.skiff.x, P.skiff.z, P.skiff.yaw, null);
    this.spawnVehicle('skiff', roadAt(3) + 700, roadAt(3) + 330, -Math.PI / 2, null);
    this.spawnVehicle('cart', roadAt(1) - 1700, roadAt(1) - 330, -Math.PI / 2, null);
    for (let k = 0; k < 9; k++) { // traffic
      const i = 1 + Math.floor(this.rand() * (N - 1)), j = Math.floor(this.rand() * N), to = [i, j + 1];
      if (k === 0 || !this.vehicles.some((v) => v.ai && v.ai.from[0] === i && v.ai.from[1] === j))
        this.spawnVehicle('cart', roadAt(i) - 300, roadAt(j) + 900, 0, 'npc', { from: [i, j], to });
    }
    const walkers = this.city.blocks.filter((b) => b.kind !== 'steps');
    for (let k = 0; k < 26; k++) {
      const b = walkers[Math.floor(this.rand() * walkers.length)], c = Math.floor(this.rand() * 4), [x, z] = corner(b, c);
      this.peds.push({ id: this.nextId++, x, z, px: x, pz: z, yaw: 0, block: b, c, dir: this.rand() < 0.5 ? 1 : -1, state: 'walk', t: 0, hue: Math.floor(this.rand() * 6) });
    }
    this.cuccos = []; this.swarmT = 0; this.swarmGrace = 0;
    const cuccoHomes = [];
    for (const [bi, bj] of [[3, 2], [1, 4], [0, 0]]) { const cx = roadAt(bi) + PITCH / 2, cz = roadAt(bj) + PITCH / 2; for (let k = 0; k < (bi === 0 ? 2 : 4); k++) cuccoHomes.push([cx + (this.rand() - 0.5) * 1400, cz + (this.rand() - 0.5) * 1400]); }
    for (const [x, z] of cuccoHomes) this.cuccos.push({ id: this.nextId++, x, z, px: x, pz: z, hx: x, hz: z, tx: x, tz: z, yaw: this.rand() * 6.28, state: 'peck', t: 30 + Math.floor(this.rand() * 60), phase: this.rand() * 6.28, peckCd: 0, fx: 0, fz: 0 });
    for (const [x, y, z] of this.city.glimSpots) this.pickups.push({ kind: 'glim', x, y, z, taken: false });
  }

  get hero() { return this.heroes[this.active]; }
  posOf(h) { return h.vehicle ? { x: h.vehicle.x, y: 0, z: h.vehicle.z } : { x: h.ctrl.pos[0], y: h.ctrl.pos[1], z: h.ctrl.pos[2] }; }
  near(a, b, r) { return Math.hypot(a.x - b.x, a.z - b.z) < r; }
  spawnVehicle(kind, x, z, yaw, driver, ai = null) {
    const v = { id: this.nextId++, kind, x, z, yaw, px: x, pz: z, pyaw: yaw, vx: 0, vz: 0, fwd: 0, steer: 0, driver, ai, stuck: 0, rev: 0, hits: 0, hitCd: 0, slow: 0 };
    this.vehicles.push(v); return v;
  }
  setHeat(n) { if (n > this.heat) { this.heat = n; this.unseen = 0; this.events.push('heatUp'); } }
  addHeat(n, cap = 5) { if (this.heat < cap) this.setHeat(Math.min(cap, this.heat + n)); else this.unseen = 0; }
  clearHeat(ev) {
    this.heat = 0; this.unseen = 0; this.guards = [];
    this.vehicles = this.vehicles.filter((v) => v.driver !== 'watch');
    if (ev) this.events.push(ev);
  }
  /** Test/debug helper: put a hero on foot at a point. */
  place(i, x, y, z) { const h = this.heroes[i]; if (h.vehicle) { h.vehicle.driver = null; h.vehicle = null; } h.ctrl = new Sm64Controller(this.world, { x, y, z }); }

  // ---------------------------------------------------------------------------- geometry helpers
  /** True if the ground-level segment is not blocked by any box taller than minTop. */
  los(x0, z0, x1, z1, minTop = 150) {
    const dx = x1 - x0, dz = z1 - z0;
    for (const b of this.solid) {
      if (b.y1 <= minTop) continue;
      let t0 = 0, t1 = 1;
      if (Math.abs(dx) < 1e-9) { if (x0 < b.x0 || x0 > b.x1) continue; }
      else { let a = (b.x0 - x0) / dx, c = (b.x1 - x0) / dx; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) continue; }
      if (Math.abs(dz) < 1e-9) { if (z0 < b.z0 || z0 > b.z1) continue; }
      else { let a = (b.z0 - z0) / dz, c = (b.z1 - z0) / dz; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) continue; }
      return false;
    }
    return true;
  }
  /** Push a circle out of every box; returns the last contact normal or null. */
  collide(o, r) {
    let hit = null;
    for (const b of this.solid) {
      const cx = clamp(o.x, b.x0, b.x1), cz = clamp(o.z, b.z0, b.z1);
      let dx = o.x - cx, dz = o.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); dx /= d; dz /= d; o.x = cx + dx * r; o.z = cz + dz * r; hit = { nx: dx, nz: dz }; }
      else {
        const l = o.x - b.x0, rr = b.x1 - o.x, n = o.z - b.z0, f = b.z1 - o.z, m = Math.min(l, rr, n, f);
        if (m === l) { o.x = b.x0 - r; hit = { nx: -1, nz: 0 }; } else if (m === rr) { o.x = b.x1 + r; hit = { nx: 1, nz: 0 }; }
        else if (m === n) { o.z = b.z0 - r; hit = { nx: 0, nz: -1 }; } else { o.z = b.z1 + r; hit = { nx: 0, nz: 1 }; }
      }
    }
    return hit;
  }
  free(x, z, r) { return Math.abs(x) < EDGE - r && Math.abs(z) < EDGE - r && !this.solid.some((b) => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r); }
  node(x, z) { return [clamp(Math.round((x + HALF) / PITCH), 0, N), clamp(Math.round((z + HALF) / PITCH), 0, N)]; }
  /** Where a chaser at (x,z) should head to reach (tx,tz): straight if visible, else along the street grid. */
  nav(e, tx, tz) {
    if (this.los(e.x, e.z, tx, tz)) { e.wp = null; return [tx, tz]; }
    if (!e.wp || Math.hypot(e.wp[0] - e.x, e.wp[1] - e.z) < 320) {
      let [i, j] = this.node(e.x, e.z); const [bi, bj] = this.node(tx, tz);
      if (Math.hypot(roadAt(i) - e.x, roadAt(j) - e.z) < 320) {
        if (i === bi && j === bj) return [tx, tz];
        if (Math.abs(bi - i) >= Math.abs(bj - j)) i += Math.sign(bi - i); else j += Math.sign(bj - j);
      }
      e.wp = [roadAt(i), roadAt(j)];
    }
    return e.wp;
  }

  // ---------------------------------------------------------------------------- tick
  /** input: { stickX, stickY, camYaw, a, b, z, use, swap }. In a vehicle: stickY throttle, stickX steer, a handbrake. */
  tick(input = {}) {
    this.events.length = 0; this.ticks++;
    const use = !!input.use && !this._use, swap = !!input.swap && !this._swap;
    this._use = !!input.use; this._swap = !!input.swap;
    if (swap) { if (this.heat === 0 && !this.mission) { this.active = 1 - this.active; this.events.push('switch'); } else this.events.push('denied'); }
    const h = this.hero;
    if (use) this._useVehicle(h);

    this.heroes.forEach((o, k) => {
      if (o.vehicle) return;
      o.ctrl.tick(k === this.active ? input : {});
      if (k === this.active) for (const e of o.ctrl.events) this.events.push(e);
    });
    this._vehicles(input);
    this._heroVsVehicles();
    this._peds();
    this._cuccos();
    this._watch();
    this._pickups();
    this._heat();
    this._missions();
    this._prompt();
  }

  _useVehicle(h) {
    if (h.vehicle) {
      const v = h.vehicle, T = VEHICLES[v.kind];
      if (Math.abs(v.fwd) > 14) return;
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), d = T.r + 110;
      for (const [ox, oz] of [[fz, -fx], [-fz, fx], [-fx, -fz], [fx, fz]]) {
        const x = v.x + ox * d, z = v.z + oz * d;
        if (!this.free(x, z, 60)) continue;
        h.ctrl = new Sm64Controller(this.world, { x, y: 0, z, yaw: toS16(v.yaw) }); h.vehicle = null; v.driver = null; this.events.push('exit'); return;
      }
      return;
    }
    const p = h.ctrl.pos; if (p[1] > 120) return;
    let best = null, bd = 300;
    for (const v of this.vehicles) { const d = Math.hypot(v.x - p[0], v.z - p[2]) - VEHICLES[v.kind].r; if (d < bd && v.driver !== 'watch' && v.driver !== 'hero' && v.kind !== 'tithe' && Math.abs(v.fwd) < 22) { bd = d; best = v; } }
    if (!best) return;
    if (best.driver === 'npc') { // the driver bails out and runs for it
      const b = this.city.blocks[Math.floor(this.rand() * this.city.blocks.length)];
      this.peds.push({ id: this.nextId++, x: p[0], z: p[2], px: p[0], pz: p[2], yaw: 0, block: b, c: 0, dir: 1, state: 'flee', t: 240, hue: 5 });
      this.addHeat(1, 2); this.events.push('jack');
    }
    best.driver = 'hero'; h.vehicle = best; this.events.push('enter');
  }

  _drive(v, tx, tz, cruise) { // simple pursuit steering used by traffic and the Watch
    const diff = wrap(Math.atan2(tx - v.x, tz - v.z) - v.yaw);
    if (v.rev > 0) { v.rev--; return [-1, clamp(diff * 2, -1, 1), false]; }
    if (Math.abs(v.fwd) < 2) { if (++v.stuck > 40) { v.stuck = 0; v.rev = 28; } } else v.stuck = 0;
    const want = Math.abs(diff) > 1.1 ? cruise * 0.45 : cruise;
    return [v.fwd < want ? 1 : v.fwd > want + 6 ? -0.5 : 0, clamp(-diff * 2.2, -1, 1), false];
  }

  _vehicles(input) {
    const hp = this.posOf(this.hero);
    for (const v of this.vehicles) {
      const T = VEHICLES[v.kind];
      v.px = v.x; v.pz = v.z; v.pyaw = v.yaw; if (v.hitCd > 0) v.hitCd--;
      let thr = 0, steer = 0, hb = false;
      if (v.driver === 'hero') {
        if (this.hero.vehicle === v) { thr = clamp(input.stickY || 0, -1, 1); steer = clamp(input.stickX || 0, -1, 1); hb = !!input.a; } else hb = true;
      } else if (v.driver === 'npc') {
        const [fi, fj] = v.ai.from, [ti, tj] = v.ai.to, fx = Math.sign(ti - fi), fz = Math.sign(tj - fj);
        const tx = roadAt(ti), tz = roadAt(tj), s = (tx - v.x) * fx + (tz - v.z) * fz;
        if (s < 520) { // pick the next street at the junction
          const opts = [[ti + 1, tj], [ti - 1, tj], [ti, tj + 1], [ti, tj - 1]].filter(([a, b]) => a >= 0 && a <= N && b >= 0 && b <= N && !(a === fi && b === fj));
          v.ai = { from: v.ai.to, to: opts[Math.floor(this.rand() * opts.length)] };
        }
        const ahead = Math.max(0, s - 900);
        [thr, steer] = this._drive(v, tx - fz * 300 - fx * ahead, tz + fx * 300 - fz * ahead, v.kind === 'tithe' ? 16 : 24);
        const hx = Math.sin(v.yaw), hz = Math.cos(v.yaw); // brake for anything right in front
        const blocked = (o) => { const dx = o.x - v.x, dz = o.z - v.z, d = Math.hypot(dx, dz); return d > 1 && d < 650 && (dx * hx + dz * hz) / d > 0.8; };
        if (!v.rev && (blocked(hp) || this.vehicles.some((o) => o !== v && blocked(o)))) { thr = v.fwd > 2 ? -1 : 0; v.stuck = 0; }
      } else if (v.driver === 'watch') {
        const [tx, tz] = this.nav(v, hp.x, hp.z);
        [thr, steer] = this._drive(v, tx, tz, T.max);
      } else hb = true;

      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = -fz, rz = fx;
      let fwd = v.vx * fx + v.vz * fz, side = v.vx * rx + v.vz * rz;
      if (thr) fwd += thr * (thr * fwd >= 0 ? T.accel : T.accel * 2.2);
      fwd -= (fwd * T.accel) / T.max;
      if (!thr) fwd *= 0.985;
      if (hb) fwd *= v.driver ? 0.955 : 0.88;
      side *= hb ? 0.94 : 0.72;
      v.vx = fx * fwd + rx * side; v.vz = fz * fwd + rz * side;
      v.yaw -= steer * T.turn * clamp(fwd / 18, -1, 1) * (hb ? 1.6 : 1);
      v.x += v.vx; v.z += v.vz; v.fwd = fwd; v.steer = steer; v.skid = hb && Math.abs(fwd) > 15 || Math.abs(side) > 6;
      const hit = this.collide(v, T.r);
      if (hit) {
        const vn = v.vx * hit.nx + v.vz * hit.nz;
        if (vn < 0) { v.vx -= 1.3 * vn * hit.nx; v.vz -= 1.3 * vn * hit.nz; if (vn < -9 && v.driver === 'hero') this.events.push('crash'); }
      }
    }
    // vehicle against vehicle
    const vs = this.vehicles;
    for (let a = 0; a < vs.length; a++) for (let b = a + 1; b < vs.length; b++) {
      const A = vs[a], B = vs[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), min = VEHICLES[A.kind].r + VEHICLES[B.kind].r;
      if (d >= min || d < 1e-3) continue;
      const nx = dx / d, nz = dz / d, push = (min - d) / 2, rel = (A.vx - B.vx) * nx + (A.vz - B.vz) * nz;
      A.x -= nx * push; A.z -= nz * push; B.x += nx * push; B.z += nz * push;
      if (rel > 0) { const jimp = rel * 0.75; A.vx -= jimp * nx; A.vz -= jimp * nz; B.vx += jimp * nx; B.vz += jimp * nz; }
      const hv = this.hero.vehicle;
      if (rel > 9 && (A === hv || B === hv)) {
        const o = A === hv ? B : A; this.events.push('crash');
        if (!o.hitCd) { o.hitCd = 25; o.hits++; if (o.driver === 'watch') this.addHeat(1, 4); else if (o.driver === 'npc' && o.kind !== 'tithe') this.addHeat(1, 1); if (o.kind === 'tithe') this.events.push('ram'); }
      }
    }
  }

  _heroVsVehicles() {
    for (const o of this.heroes) {
      if (o.vehicle || o.ctrl.pos[1] > 150) continue;
      const p = o.ctrl.pos;
      for (const v of this.vehicles) {
        const dx = p[0] - v.x, dz = p[2] - v.z, d = Math.hypot(dx, dz), min = VEHICLES[v.kind].r + 45;
        if (d < min && d > 1e-3) { p[0] = Math.fround(v.x + (dx / d) * min); p[2] = Math.fround(v.z + (dz / d) * min); }
      }
    }
  }

  _peds() {
    const h = this.hero, hp = this.posOf(h), hv = h.vehicle, act = hv ? '' : h.ctrl.action;
    const tackle = act === 'dive' || act === 'bellySlide' || act === 'jumpKick' || act === 'poundLand' || act === 'longJump';
    this.peds = this.peds.filter((p) => !(p.state === 'flee' && p.t <= 0 && Math.hypot(p.x - hp.x, p.z - hp.z) > 3000));
    for (const p of this.peds) {
      p.px = p.x; p.pz = p.z;
      if (p.state === 'down') { if (--p.t <= 0) { p.state = 'flee'; p.t = 200; } continue; }
      if (p.state === 'flee') p.t--;
      const [tx, tz] = corner(p.block, p.c), dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), sp = p.state === 'flee' && p.t > 0 ? 15 : 5;
      if (d <= sp) { p.x = tx; p.z = tz; p.c = (p.c + p.dir + 4) % 4; } else { p.x += (dx / d) * sp; p.z += (dz / d) * sp; p.yaw = Math.atan2(dx, dz); }
      const hd = Math.hypot(p.x - hp.x, p.z - hp.z);
      const hitByCart = hv && hd < VEHICLES[hv.kind].r + 70 && Math.abs(hv.fwd) > 12;
      if (hitByCart || (!hv && tackle && hd < 140 && hp.y < 120)) {
        p.state = 'down'; p.t = 110; this.events.push('bonk'); this.addHeat(1, 2);
        this.pickups.push({ kind: 'coin', x: p.x + 90, y: 70, z: p.z + 60, taken: false, ttl: 600 });
      }
    }
  }

  /** Cuccos: placid plaza birds — until one is struck. Then the whole flock swarms the active hero
   *  for 12 s, pecking (pressure and knockback, never damage), and the fuss raises Heat to 3 lanterns
   *  so the Watch joins in: the Zelda layer answered by the GTA layer. */
  _cuccos() {
    const h = this.hero, hp = this.posOf(h), hv = h.vehicle, act = hv ? '' : h.ctrl.action;
    if (this.swarmGrace > 0) this.swarmGrace--;
    if (this.swarmT > 0) {
      this.swarmT--; if (this.heat < 3) this.setHeat(3);
      if (this.swarmT === 0) { this.events.push('cuccoCalm'); this.swarmGrace = 300; for (const c of this.cuccos) { c.state = 'walk'; c.tx = c.hx; c.tz = c.hz; c.t = 900; } }
    }
    const tackle = act === 'dive' || act === 'bellySlide' || act === 'jumpKick' || act === 'longJump' || act === 'tripleJump' || act === 'backflip' || act === 'sideFlip' || act === 'rollout';
    let struck = null;
    for (const c of this.cuccos) {
      c.px = c.x; c.pz = c.z; if (c.peckCd > 0) c.peckCd--;
      const dx = c.x - hp.x, dz = c.z - hp.z, hd = Math.hypot(dx, dz);
      if (this.swarmT > 0) { // the swarm: fly straight at the hero (airborne — no ground collision), peck on contact
        if (hd > 60) { c.x += ((hp.x - c.x) / hd) * 21; c.z += ((hp.z - c.z) / hd) * 21; c.yaw = Math.atan2(hp.x - c.x, hp.z - c.z); }
        if (hd < 110 && c.peckCd === 0) {
          c.peckCd = 18; this.events.push('peck');
          if (!hv && hd > 1) { const p = h.ctrl.pos; p[0] = Math.fround(p[0] + ((p[0] - c.x) / hd) * 30); p[2] = Math.fround(p[2] + ((p[2] - c.z) / hd) * 30); }
        }
        continue;
      }
      if (!struck && this.swarmGrace === 0) { // a strike lands: hero tackle/spin contact, a ground-pound landing nearby, or any vehicle at speed
        if (!hv && hp.y < 140 && ((tackle && hd < 150) || (act === 'poundLand' && hd < 250))) struck = c;
        else for (const v of this.vehicles) if (Math.abs(v.fwd) > 12 && Math.hypot(c.x - v.x, c.z - v.z) < VEHICLES[v.kind].r + 60) { struck = c; break; }
      }
      if (c.state === 'flee') {
        const fx = c.x - c.fx, fz = c.z - c.fz, fd = Math.hypot(fx, fz) || 1;
        c.x += (fx / fd) * 13; c.z += (fz / fd) * 13; c.yaw = Math.atan2(fx, fz);
        if (--c.t <= 0) { c.state = 'peck'; c.t = 30; }
      } else {
        let threat = null; // scatter from anything fast and close
        if (!hv && hd < 230 && Math.abs(h.ctrl.fvel) > 14) threat = hp;
        else for (const v of this.vehicles) if (Math.abs(v.fwd) > 10 && Math.hypot(c.x - v.x, c.z - v.z) < 280) { threat = v; break; }
        if (threat) { c.state = 'flee'; c.t = 42; c.fx = threat.x; c.fz = threat.z; }
        else if (c.state === 'walk') {
          const wx = c.tx - c.x, wz = c.tz - c.z, wd = Math.hypot(wx, wz);
          if (wd < 12 || --c.t <= 0) { c.state = 'peck'; c.t = 40 + Math.floor(this.rand() * 60); }
          else { c.x += (wx / wd) * 4.5; c.z += (wz / wd) * 4.5; c.yaw = Math.atan2(wx, wz); }
        } else if (--c.t <= 0) { c.tx = c.hx + (this.rand() - 0.5) * 900; c.tz = c.hz + (this.rand() - 0.5) * 900; c.state = 'walk'; c.t = 320; }
      }
      this.collide(c, 40);
    }
    for (let a = 0; a < this.cuccos.length; a++) for (let b = a + 1; b < this.cuccos.length; b++) { // gentle separation, no stacking
      const A = this.cuccos[a], B = this.cuccos[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d > 1 && d < 80) { const push = (80 - d) * 0.2; A.x -= (dx / d) * push; A.z -= (dz / d) * push; B.x += (dx / d) * push; B.z += (dz / d) * push; }
    }
    if (struck) { this.swarmT = 360; if (this.heat < 3) this.setHeat(3); this.events.push('cuccoAggro'); }
  }

  _watch() {
    const h = this.hero, hp = this.posOf(h), hv = h.vehicle;
    if (this.heat > 0 && this.ticks % 15 === 0) {
      const wantG = [0, 1, 2, 2, 3, 3][this.heat], wantW = [0, 0, 0, 1, 2, 3][this.heat];
      const wagons = this.vehicles.filter((v) => v.driver === 'watch');
      const spot = () => {
        const [ci, cj] = this.node(hp.x, hp.z), opts = [];
        for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const m = Math.abs(i - ci) + Math.abs(j - cj); if (m >= 1 && m <= 2 && Math.hypot(roadAt(i) - hp.x, roadAt(j) - hp.z) > 2600) opts.push([i, j]); }
        const [i, j] = opts[Math.floor(this.rand() * opts.length)] || [ci, cj]; return [roadAt(i), roadAt(j)];
      };
      if (this.guards.length < wantG) { const [x, z] = spot(); this.guards.push({ id: this.nextId++, x: x + 150, z: z + 150, px: x, pz: z, yaw: 0, down: 0, wp: null }); }
      else if (wagons.length < wantW) { const [x, z] = spot(); this.spawnVehicle('wagon', x, z, Math.atan2(hp.x - x, hp.z - z), 'watch'); }
      for (const g of this.guards) if (Math.hypot(g.x - hp.x, g.z - hp.z) > 11000) { const [x, z] = spot(); g.x = x; g.z = z; g.wp = null; }
    }
    for (const g of this.guards) {
      g.px = g.x; g.pz = g.z;
      if (g.down > 0) { g.down--; continue; }
      const [tx, tz] = this.nav(g, hp.x, hp.z), dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
      if (d > 27) { g.x += (dx / d) * 27; g.z += (dz / d) * 27; g.yaw = Math.atan2(dx, dz); }
      this.collide(g, 60);
      const hd = Math.hypot(g.x - hp.x, g.z - hp.z);
      if (hv) {
        if (hd < VEHICLES[hv.kind].r + 80 && Math.abs(hv.fwd) > 12) { g.down = 110; this.events.push('bonk'); this.addHeat(1, 4); }
        else if (hd < 320 && Math.abs(hv.fwd) < 6) { if (++hv.slow > 40) return this._busted(); } else if (hd < 320) hv.slow = 0;
      } else if (hd < 110 && hp.y < 150) return this._busted();
    }
    if (!hv && hp.y < 150) for (const v of this.vehicles) if (v.driver === 'watch' && Math.hypot(v.x - hp.x, v.z - hp.z) < VEHICLES.wagon.r + 70) return this._busted();
  }

  _busted() {
    const h = this.hero, P = this.city.places.hideout;
    this.coins = Math.floor(this.coins * 0.8);
    if (h.vehicle) { h.vehicle.driver = null; h.vehicle.slow = 0; h.vehicle = null; }
    h.ctrl = new Sm64Controller(this.world, { x: P.x, y: 0, z: P.z, yaw: 0x4000 });
    this.clearHeat('busted');
    if (this.mission) this._endMission(false);
  }

  _pickups() {
    const h = this.hero, hp = this.posOf(h), reach = h.vehicle ? VEHICLES[h.vehicle.kind].r + 90 : 125;
    for (const p of this.pickups) {
      if (p.taken) continue;
      if (p.ttl && --p.ttl <= 0) { p.taken = true; continue; }
      if (Math.hypot(p.x - hp.x, p.z - hp.z) > reach || Math.abs(p.y - (hp.y + 80)) > (h.vehicle ? 140 : 150)) continue;
      p.taken = true;
      if (p.kind === 'glim') { this.coins += 10; this.events.push('coin'); }
      else if (p.kind === 'coin') { this.coins += 5; this.events.push('coin'); }
      else this.events.push(p.kind);
    }
  }

  _heat() {
    this.seen = false;
    if (this.heat === 0) return;
    const hp = this.posOf(this.hero), top = Math.max(hp.y, 150) + 50;
    const sees = (w) => { const d = Math.hypot(w.x - hp.x, w.z - hp.z); return d < 2800 && !(hp.y > 300 && d > 900) && this.los(w.x, w.z, hp.x, hp.z, top); };
    this.seen = this.guards.some((g) => !g.down && sees(g)) || this.vehicles.some((v) => v.driver === 'watch' && sees(v));
    if (this.seen) this.unseen = 0;
    else if (++this.unseen >= this.heatCooldown) this.clearHeat('heatLost');
    const T = this.city.places.tailor;
    if (this.heat > 0 && this.coins >= 40 && this.near(hp, T, 320)) { this.coins -= 40; this.clearHeat('tailor'); }
  }
  get heatCooldown() { return 150 + 45 * this.heat; }

  _missions() {
    const hp = this.posOf(this.hero), m = this.mission;
    if (this.banner && --this.banner.t <= 0) this.banner = null;
    if (!m) {
      const at = MISSIONS.findIndex((d, k) => k <= this.unlocked && this.near(hp, this.city.places[d.place], 300));
      if (at < 0) { this.armed = true; return; }
      if (!this.armed || this.heat > 0) return;
      const d = MISSIONS[at];
      this.mission = { k: at, step: -1, timer: null, def: d };
      d.begin?.(this); this.events.push('missionStart'); this.banner = { title: d.name, sub: d.brief, t: 120 };
      this._nextStep();
      return;
    }
    const s = m.def.steps[m.step];
    if (m.timer !== null && --m.timer <= 0) return this._endMission(false);
    if (s.done(this)) this._nextStep();
  }
  _nextStep() {
    const m = this.mission; m.step++;
    if (m.step >= m.def.steps.length) return this._endMission(true);
    const s = m.def.steps[m.step];
    m.timer = s.timer || null; s.begin?.(this);
    if (m.step > 0) this.events.push('step');
  }
  _endMission(won) {
    const m = this.mission, d = m.def; this.mission = null; this.armed = false;
    d.end?.(this);
    if (won) {
      this.coins += d.reward; if (!this.completed.includes(d.id)) this.completed.push(d.id);
      this.unlocked = Math.min(MISSIONS.length - 1, Math.max(this.unlocked, m.k + 1));
      this.events.push('missionPassed'); this.banner = { title: 'Job done', sub: `${d.name}  +${d.reward} glim`, t: 150 };
    } else { this.events.push('missionFailed'); this.banner = { title: 'Job botched', sub: `${d.name}: walk back into the beacon to retry`, t: 150 }; }
  }
  get objective() { const m = this.mission; if (!m) return null; const s = m.def.steps[m.step]; return { text: typeof s.text === 'function' ? s.text(this) : s.text, timer: m.timer, target: s.target ? s.target(this) : null }; }

  _prompt() {
    const h = this.hero; this.prompt = '';
    if (h.vehicle) { if (Math.abs(h.vehicle.fwd) <= 14) this.prompt = 'F  hop out'; return; }
    const p = h.ctrl.pos; if (p[1] > 120) return;
    for (const v of this.vehicles) if (v.driver !== 'watch' && v.kind !== 'tithe' && Math.hypot(v.x - p[0], v.z - p[2]) - VEHICLES[v.kind].r < 300) { this.prompt = `F  ${v.driver === 'npc' ? 'commandeer' : 'borrow'} the ${VEHICLES[v.kind].name}`; return; }
  }

  /** Beacons for the world and the map. */
  markers() {
    const P = this.city.places, out = [{ kind: 'hideout', x: P.hideout.x, z: P.hideout.z }, { kind: 'tailor', x: P.tailor.x, z: P.tailor.z }];
    if (!this.mission) MISSIONS.forEach((d, k) => { if (k <= this.unlocked) out.push({ kind: 'job', x: P[d.place].x, z: P[d.place].z, label: d.name, done: this.completed.includes(d.id) }); });
    else { const t = this.objective.target; if (t) out.push({ kind: 'goal', x: t.x, z: t.z }); }
    return out;
  }
}

function corner(b, c) { const m = 60; return [[b.x0 + m, b.z0 + m], [b.x1 - m, b.z0 + m], [b.x1 - m, b.z1 - m], [b.x0 + m, b.z1 - m]][c]; }
