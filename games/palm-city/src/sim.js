// sim.js — everything that moves: the player, traffic, pedestrians, police, wanted level, busted.
// Fixed-timestep and seeded, so ?demo plays the same route every time.

import { mulberry32 } from './world.js';

const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const CIVIL = ['sedan_coral', 'sedan_teal', 'sedan_cream', 'sedan_plum', 'conv_mint', 'conv_rose', 'van_sky', 'van_sun', 'taxi'];
const PED_OUTFITS = ['ped_sun', 'ped_rose', 'ped_white', 'ped_blue', 'ped_straw'];
const LANE = 23;          // lane centre offset from the loop centreline
const WALK = 60;          // sidewalk centreline offset

export class Sim {
  constructor(world, M, seed = 1, events = () => {}) {
    this.W = world; this.M = M; this.ev = events;
    this.rnd = mulberry32(seed);
    this.cars = []; this.peds = [];
    this.time = 0;
    this.stars = 0; this.starDecay = 0; this.lostT = 0;
    this.busted = null;
    this.msg = null;
    this.bustT = 0;
    this.nextId = 1;
    const [px, py] = world.L.spawn.player;
    this.player = { mode: 'foot', ped: this.makePed(px, py, 'player', null), car: null };
    this.player.ped.h = Math.PI;
    this.peds.push(this.player.ped);
    // parked cars at the kerbs (no alarm-free rides: any theft is +1 star)
    const parked = [
      [1302, 1300, -Math.PI / 2, 'conv_mint'], [470, 836, 0, 'sedan_teal'], [640, 836, 0, 'van_sun'],
      [900, 1384, Math.PI, 'sedan_plum'], [816, 1000, Math.PI / 2, 'taxi'], [744, 1240, -Math.PI / 2, 'sedan_cream'],
      [1302, 520, Math.PI / 2, 'conv_rose'],
    ];
    for (const [x, y, h, model] of parked) this.addCar(x, y, h, model, null, { parked: true });
    for (let i = 0; i < 10; i++) this.spawnTraffic(true);
    for (let i = 0; i < 40; i++) this.spawnPed(true);
  }

  // ------------------------------------------------------------------ factories
  addCar(x, y, h, model, driver, extra = {}) {
    const m = this.M.cars[model];
    const c = { id: this.nextId++, x, y, h, v: 0, model, kind: m.kind, driver, len: m.length, wid: m.width, parked: false, s: 0, dir: 1, siren: false, stuck: 0, ...extra };
    this.cars.push(c);
    return c;
  }

  makePed(x, y, outfit, path) {
    return { id: this.nextId++, x, y, h: 0, outfit, pose: 1, walk: 0, path, speed: 20 + this.rnd() * 14, mode: 'walk', downT: 0, fleeT: 0, vx: 0, vy: 0 };
  }

  focus() { return this.player.mode === 'car' ? this.player.car : this.player.ped; }

  spawnTraffic(anywhere) {
    const W = this.W, f = this.focus();
    for (let tries = 0; tries < 20; tries++) {
      const s = this.rnd() * W.loopPath.len;
      const dir = this.rnd() < 0.5 ? 1 : -1;
      const p = W.loopAt(s, LANE * dir);
      const d = Math.hypot(p.x - f.x, p.y - f.y);
      if ((!anywhere && (d < 520 || d > 1100)) || (anywhere && d < 220)) continue;
      if (this.cars.some(c => Math.hypot(c.x - p.x, c.y - p.y) < 90)) continue;
      const h = Math.atan2(p.ty * dir, p.tx * dir);
      const c = this.addCar(p.x, p.y, h, CIVIL[(this.rnd() * CIVIL.length) | 0], 'ai', { s, dir, cruise: 95 + this.rnd() * 45 });
      c.v = c.cruise * 0.8;
      return c;
    }
    return null;
  }

  spawnPed(anywhere) {
    const W = this.W, f = this.focus();
    for (let tries = 0; tries < 20; tries++) {
      let path, x, y;
      if (this.rnd() < 0.4) {
        path = { type: 'line', x: 1300 + (this.rnd() - 0.5) * 30, y: 40 + this.rnd() * 2120, dir: this.rnd() < 0.5 ? 1 : -1 };
        x = path.x; y = path.y;
      } else {
        const s = this.rnd() * W.loopPath.len, side = this.rnd() < 0.5 ? 1 : -1;
        path = { type: 'loop', s, off: WALK * side + (this.rnd() - 0.5) * 10, dir: this.rnd() < 0.5 ? 1 : -1 };
        const p = W.loopAt(s, path.off); x = p.x; y = p.y;
      }
      const d = Math.hypot(x - f.x, y - f.y);
      if ((!anywhere && (d < 480 || d > 900)) || (anywhere && d > 900)) continue;
      if (W.hitSolid(x, y, 4)) continue;
      const p = this.makePed(x, y, PED_OUTFITS[(this.rnd() * PED_OUTFITS.length) | 0], path);
      this.peds.push(p);
      return p;
    }
    return null;
  }

  crash(v) {
    if (this.time - (this.lastCrash || -9) < 0.5) return;
    this.lastCrash = this.time;
    this.ev('crash', v);
  }

  say(text, dur = 2.2) { this.msg = { text, t: dur, dur }; }

  addStars(n, why) {
    const before = this.stars;
    this.stars = clamp(this.stars + n, 0, 5);
    this.lostT = 0;
    if (this.stars > before) this.ev('star', this.stars);
  }

  // ------------------------------------------------------------------ main step
  step(dt, input) {
    this.time += dt;
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    const P = this.player;
    if (this.busted) {
      this.busted.t += dt;
      input = { jx: 0, jy: 0, jm: 0, action: false, keys: {} };
      if (this.busted.t > 3.4 && !this.busted.respawned) this.respawn();
      if (this.busted.t > 4.4) this.busted = null;
    }

    // --- player
    if (P.mode === 'foot') this.stepPlayerFoot(dt, input);
    else this.stepPlayerCar(dt, input);

    // --- AI cars
    for (const c of this.cars) {
      if (c.driver === 'ai') this.stepTraffic(c, dt);
      else if (c.driver === 'police') this.stepPolice(c, dt);
      else if (c.driver === null) { c.v *= Math.pow(0.05, dt); this.moveCar(c, dt); }
    }
    this.carCollisions(dt);

    // --- peds
    for (const p of this.peds) if (p !== P.ped) this.stepPed(p, dt);
    this.peds = this.peds.filter(p => !p.gone);

    // --- population management
    const f = this.focus();
    this.cars = this.cars.filter(c => {
      if (c.driver === 'player' || c === P.car) return true;
      const d = Math.hypot(c.x - f.x, c.y - f.y);
      if (c.driver === 'police') return d < 1500 || this.stars > 0;
      if (c.parked && c.fixed !== false) return true;
      return d < 1250;
    });
    const traffic = this.cars.filter(c => c.driver === 'ai').length;
    if (traffic < 10 && this.rnd() < dt * 2) this.spawnTraffic(false);
    this.peds = this.peds.filter(p => p === P.ped || p.mode === 'cop' || Math.hypot(p.x - f.x, p.y - f.y) < 1000);
    const walkers = this.peds.filter(p => p.mode !== 'cop' && p !== P.ped).length;
    if (walkers < 40 && this.rnd() < dt * 3) this.spawnPed(false);

    this.stepWanted(dt);
  }

  // ------------------------------------------------------------------ player
  stepPlayerFoot(dt, inp) {
    const p = this.player.ped;
    let jx = inp.jx, jy = inp.jy, jm = inp.jm;
    const k = inp.keys || {};
    if (k.up || k.down || k.left || k.right) {
      jx = (k.right ? 1 : 0) - (k.left ? 1 : 0); jy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      jm = Math.hypot(jx, jy) ? 1 : 0;
      if (jm) { const l = Math.hypot(jx, jy); jx /= l; jy /= l; }
    }
    if (jm > 0.12) {
      const sp = jm > 0.65 ? 74 : 30 + jm * 50;
      p.h = Math.atan2(jy, jx);
      this.walkMove(p, Math.cos(p.h) * sp * dt, Math.sin(p.h) * sp * dt);
      p.walk += sp * dt;
      p.pose = [0, 1, 2, 1][Math.floor(p.walk / 9) % 4];
    } else p.pose = 1;
    if (inp.action) this.tryEnterCar();
  }

  walkMove(p, dx, dy) {
    const W = this.W;
    const ok = (x, y) => !W.hitSolid(x, y, 3) && x > 4 && y > 4 && x < W.L.world.w - 4 && y < W.L.world.h - 4 && x < W.shoreX(y) + 6;
    if (ok(p.x + dx, p.y + dy)) { p.x += dx; p.y += dy; }
    else if (ok(p.x + dx, p.y)) p.x += dx;
    else if (ok(p.x, p.y + dy)) p.y += dy;
    // don't walk through cars
    for (const c of this.cars) {
      const lx = p.x - c.x, ly = p.y - c.y;
      const ca = Math.cos(c.h), sa = Math.sin(c.h);
      const u = lx * ca + ly * sa, v = -lx * sa + ly * ca;
      const hu = c.len / 2 + 3, hv = c.wid / 2 + 3;
      if (Math.abs(u) < hu && Math.abs(v) < hv) {
        const pu = hu - Math.abs(u), pv = hv - Math.abs(v);
        if (pu < pv) { const s = Math.sign(u) * pu; p.x += ca * s; p.y += sa * s; }
        else { const s = Math.sign(v) * pv; p.x += -sa * s; p.y += ca * s; }
      }
    }
  }

  tryEnterCar() {
    const p = this.player.ped;
    let best = null, bd = 40;
    for (const c of this.cars) {
      const d = dist(c, p);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return;
    const c = best;
    let stars = 1;
    if (c.driver === 'ai' || c.driver === 'police') {
      // pull the driver out; they run
      const side = { x: c.x - Math.sin(c.h) * -18, y: c.y + Math.cos(c.h) * -18 };
      const d = this.makePed(side.x, side.y, c.driver === 'police' ? 'cop' : PED_OUTFITS[(this.rnd() * PED_OUTFITS.length) | 0], null);
      d.mode = 'flee'; d.fleeT = 4; d.from = { x: p.x, y: p.y };
      this.peds.push(d);
      if (c.driver === 'police') stars = 2;
    }
    if (c.driver === 'police') { c.siren = false; c.kind = 'police'; }
    c.driver = 'player'; c.parked = false; c.fixed = false;
    this.player.mode = 'car'; this.player.car = c;
    p.hidden = true;
    this.addStars(stars, 'jack');
    this.say(c.kind === 'police' ? 'COP CAR STOLEN' : 'CAR JACKED');
    this.ev('jack');
  }

  stepPlayerCar(dt, inp) {
    const c = this.player.car;
    const k = inp.keys || {};
    let throttle = 0, steer = 0;
    if (k.up || k.down || k.left || k.right) {
      throttle = (k.up ? 1 : 0) - (k.down ? 1 : 0);
      steer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    } else if (inp.jm > 0.15) {
      const ta = Math.atan2(inp.jy, inp.jx);
      const diff = wrap(ta - c.h);
      if (Math.abs(diff) > 2.3 && c.v < 70) {
        throttle = -inp.jm * 0.7;                        // stick pulled back: reverse
        steer = clamp(-wrap(ta + Math.PI - c.h) * 2.2, -1, 1);
      } else {
        throttle = inp.jm * (1 - Math.min(0.55, Math.abs(diff) / 3));
        steer = clamp(diff * 2.4, -1, 1);
      }
    }
    this.driveCar(c, throttle, steer, dt, 290);
    if (inp.action && Math.abs(c.v) < 60) this.exitCar();
  }

  exitCar() {
    const c = this.player.car, p = this.player.ped;
    for (const side of [-1, 1]) {
      const x = c.x + Math.sin(c.h) * 20 * side, y = c.y - Math.cos(c.h) * 20 * side;
      if (!this.W.hitSolid(x, y, 3)) { p.x = x; p.y = y; break; }
    }
    p.h = c.h; p.hidden = false;
    c.driver = null; c.v = 0; c.parked = true; c.fixed = false;
    this.player.mode = 'foot'; this.player.car = null;
    this.ev('door');
  }

  // ------------------------------------------------------------------ car physics
  driveCar(c, throttle, steer, dt, vmax) {
    const accel = throttle > 0 ? (c.v < 0 ? 520 : 240) : throttle < 0 ? (c.v > 0 ? 520 : 200) : 0;
    c.v += throttle * accel * dt;
    if (throttle === 0) c.v *= Math.pow(0.35, dt);
    c.v = clamp(c.v, -100, vmax);
    c.v *= Math.pow(0.9, dt);
    const grip = Math.min(1, Math.abs(c.v) / 70);
    c.h = wrap(c.h + steer * 2.7 * grip * Math.sign(c.v) * dt);
    this.moveCar(c, dt);
  }

  carBlocked(c, x, y, h) {
    const W = this.W, ca = Math.cos(h), sa = Math.sin(h);
    for (const [u, v] of [[c.len / 2, c.wid / 2], [c.len / 2, -c.wid / 2], [-c.len / 2, c.wid / 2], [-c.len / 2, -c.wid / 2], [c.len / 2, 0]]) {
      const px = x + ca * u - sa * v, py = y + sa * u + ca * v;
      if (!W.isDrivable(px, py)) return true;
    }
    return false;
  }

  moveCar(c, dt) {
    const dx = Math.cos(c.h) * c.v * dt, dy = Math.sin(c.h) * c.v * dt;
    if (!this.carBlocked(c, c.x + dx, c.y + dy, c.h)) { c.x += dx; c.y += dy; return; }
    if (Math.abs(c.v) > 120 && c.driver === 'player') this.crash(Math.abs(c.v));
    if (!this.carBlocked(c, c.x + dx, c.y, c.h)) { c.x += dx; c.v *= 0.8; }
    else if (!this.carBlocked(c, c.x, c.y + dy, c.h)) { c.y += dy; c.v *= 0.8; }
    else c.v *= -0.25;
  }

  carCollisions(dt) {
    const cs = this.cars;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      const reach = (a.len + b.len) / 4 + (a.wid + b.wid) / 4;
      if (d > reach || d < 0.01) continue;
      // separate along the centre line; police and the player are heavier and shove traffic aside
      const mass = (c) => c.driver === 'police' ? 3 : c.driver === 'player' ? 2 : 1;
      const ma = mass(a), mb = mass(b);
      const push = (reach - d), nx = dx / d, ny = dy / d;
      const pa = push * mb / (ma + mb), pb = push * ma / (ma + mb);
      const closing = (Math.cos(b.h) * b.v - Math.cos(a.h) * a.v) * nx + (Math.sin(b.h) * b.v - Math.sin(a.h) * a.v) * ny;
      if (!this.carBlocked(a, a.x - nx * pa, a.y - ny * pa, a.h)) { a.x -= nx * pa; a.y -= ny * pa; }
      if (!this.carBlocked(b, b.x + nx * pb, b.y + ny * pb, b.h)) { b.x += nx * pb; b.y += ny * pb; }
      const rel = Math.abs(a.v - b.v);
      if (rel > 90 && (a.driver === 'player' || b.driver === 'player') && closing < 0) {
        this.crash(rel);
        const other = a.driver === 'player' ? b : a;
        if (other.driver === 'police' && !this.busted && this.time - (this.lastRam || -9) > 4) { this.addStars(1, 'ram'); this.lastRam = this.time; }
      }
      // damp speeds only while closing, so cars that touch don't stay glued at a crawl
      if (closing < 0) { a.v *= ma > mb ? 0.92 : ma < mb ? 0.6 : 0.75; b.v *= mb > ma ? 0.92 : mb < ma ? 0.6 : 0.75; }
    }
  }

  // ------------------------------------------------------------------ traffic AI
  syncS(c, off = LANE * c.dir, span = 40) {
    const W = this.W;
    let best = 1e18, bs = c.s;
    for (let ds = -span; ds <= span; ds += 5) {
      const p = W.loopAt(c.s + ds, off);
      const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      if (d < best) { best = d; bs = c.s + ds; }
    }
    c.s = bs;
  }

  aheadClear(c, range) {
    const ca = Math.cos(c.h), sa = Math.sin(c.h);
    const check = (x, y, r) => {
      const lx = x - c.x, ly = y - c.y;
      const u = lx * ca + ly * sa, v = -lx * sa + ly * ca;
      return u > 0 && u < range && Math.abs(v) < r;
    };
    for (const o of this.cars) if (o !== c && check(o.x, o.y, 16)) return false;
    const pp = this.player.ped;
    if (this.player.mode === 'foot' && check(pp.x, pp.y, 16)) return false;
    return true;
  }

  stepTraffic(c, dt) {
    this.syncS(c);
    const W = this.W;
    const tgt = W.loopAt(c.s + c.dir * 55, LANE * c.dir);
    const ta = Math.atan2(tgt.y - c.y, tgt.x - c.x);
    const diff = wrap(ta - c.h);
    const clear = this.aheadClear(c, 75);
    c.waitT = clear ? 0 : (c.waitT || 0) + dt;
    // never jam forever: after a few seconds of waiting, creep on and let the bumpers sort it out
    const want = (clear || c.waitT > 2.5) ? c.cruise * (1 - Math.min(0.5, Math.abs(diff))) * (clear ? 1 : 0.4) : 0;
    const throttle = c.v < want ? 0.8 : (c.v > want + 20 ? -1 : 0);
    this.driveCar(c, throttle, clamp(diff * 3, -1, 1), dt, 200);
    if (Math.abs(c.v) < 5 && want > 0) { c.stuck += dt; if (c.stuck > 3) { c.v = -60; c.stuck = 0; } } else c.stuck = 0;
  }

  // ------------------------------------------------------------------ police
  stepPolice(c, dt) {
    const W = this.W, f = this.focus();
    c.siren = true;
    const d = dist(c, f);
    let tx = f.x, ty = f.y;
    if (this.player.mode === 'car') { tx += Math.cos(f.h) * f.v * 0.4; ty += Math.sin(f.h) * f.v * 0.4; }
    // far away or blocked line of sight: follow the loop toward the player
    let los = true;
    for (let i = 1; i < 8; i++) {
      const x = c.x + (tx - c.x) * i / 8, y = c.y + (ty - c.y) * i / 8;
      if (!W.isDrivable(x, y)) { los = false; break; }
    }
    if (!los || d > 420) {
      this.syncS(c, 0, 90);
      const ps = W.loopNearestFast ? W.loopNearestFast(f.x, f.y) : this.playerS;
      let ds = (ps - c.s) % W.loopPath.len;
      if (ds < -W.loopPath.len / 2) ds += W.loopPath.len;
      if (ds > W.loopPath.len / 2) ds -= W.loopPath.len;
      c.dir = ds >= 0 ? 1 : -1;
      const p = W.loopAt(c.s + c.dir * 70, LANE * c.dir * 0.4);
      tx = p.x; ty = p.y;
    }
    const ta = Math.atan2(ty - c.y, tx - c.x);
    const diff = wrap(ta - c.h);
    let throttle = 1 - Math.min(0.7, Math.abs(diff) / 2.2);
    if (d < 70 && (this.player.mode === 'foot' || Math.abs(f.v) < 40)) throttle = c.v > 10 ? -1 : 0;
    if (Math.abs(diff) > 2.4 && c.v < 60) { throttle = -0.7; }
    this.driveCar(c, throttle, clamp((throttle < 0 && c.v < 0 ? -1 : 1) * diff * 2.6, -1, 1), dt, 350);
    if (Math.abs(c.v) < 40 && throttle > 0.3 && d > 90) { c.stuck += dt; if (c.stuck > 1.2) { c.v = -90; c.h = wrap(c.h + (this.rnd() - 0.5)); c.stuck = 0; } } else c.stuck = 0;
    // cops jump out for a foot chase
    if (this.player.mode === 'foot' && d < 140 && Math.abs(c.v) < 40 && !c.copOut) {
      c.copOut = true;
      const cop = this.makePed(c.x + Math.sin(c.h) * 18, c.y - Math.cos(c.h) * 18, 'cop', null);
      cop.mode = 'cop'; cop.speed = 82;
      this.peds.push(cop);
    }
  }

  stepWanted(dt) {
    const W = this.W, f = this.focus();
    this.playerS = this.playerS === undefined ? W.loopNearest(f.x, f.y) : this.playerS;
    // keep the player's loop position fresh with a cheap local search
    let best = 1e18, bs = this.playerS;
    for (let ds = -120; ds <= 120; ds += 10) {
      const p = W.loopAt(this.playerS + ds);
      const d = (p.x - f.x) ** 2 + (p.y - f.y) ** 2;
      if (d < best) { best = d; bs = this.playerS + ds; }
    }
    if (best > 300 * 300 && Math.floor(this.time * 2) % 4 === 0) bs = W.loopNearest(f.x, f.y);
    this.playerS = bs;
    W.loopNearestFast = () => this.playerS;

    const police = this.cars.filter(c => c.driver === 'police');
    const want = this.stars > 0 && !this.busted ? Math.min(4, this.stars + 1) : 0;
    if (police.length < want && this.rnd() < dt * 0.6) {
      // police arrive from behind: spawn back along the loop, opposite the way the player is heading
      let back = this.rnd() < 0.5 ? -1 : 1;
      if (this.player.mode === 'car') {
        const c = this.player.car, tp = W.loopAt(this.playerS);
        const along = Math.cos(c.h) * tp.tx + Math.sin(c.h) * tp.ty;
        if (Math.abs(along) > 0.3 && Math.abs(c.v) > 40) back = -Math.sign(along * Math.sign(c.v));
      }
      for (let tries = 0; tries < 12; tries++) {
        const s = this.playerS + back * (430 + this.rnd() * 200);
        const dir = -back;
        const p = W.loopAt(s, LANE * dir);
        if (Math.hypot(p.x - f.x, p.y - f.y) < 380) continue;
        if (this.cars.some(c => Math.hypot(c.x - p.x, c.y - p.y) < 60)) continue;
        const c = this.addCar(p.x, p.y, Math.atan2(p.ty * dir, p.tx * dir), 'police', 'police', { s, dir });
        c.v = 160;
        this.ev('siren');
        break;
      }
    }
    if (this.stars === 0) {
      for (const c of police) { c.driver = 'ai'; c.siren = false; c.cruise = 120; c.copOut = false; this.syncS(c); }
    }
    // losing the heat
    const near = police.some(c => dist(c, f) < 460);
    if (this.stars > 0 && !near) {
      this.lostT += dt;
      if (this.lostT > 14) { this.stars--; this.lostT = 0; if (this.stars === 0) this.say('LOST THEM'); }
    } else this.lostT = 0;
    // busted?
    if (this.busted || this.stars === 0) { this.bustT = 0; return; }
    let pinned = false;
    if (this.player.mode === 'car') {
      const c = this.player.car;
      pinned = Math.abs(c.v) < 30 && police.some(p => dist(p, c) < 64);
    } else {
      const p = this.player.ped;
      pinned = police.some(c => dist(c, p) < 46 && Math.abs(c.v) < 50) ||
               this.peds.some(o => o.mode === 'cop' && dist(o, p) < 14);
    }
    this.bustT = pinned ? this.bustT + dt : Math.max(0, this.bustT - dt);
    if (this.bustT > (this.player.mode === 'car' ? 1.3 : 0.5)) {
      this.busted = { t: 0 };
      this.bustT = 0;
      this.say('BUSTED', 4.2);
      this.ev('busted');
    }
  }

  respawn() {
    const P = this.player;
    if (P.mode === 'car') {
      const c = P.car;
      c.driver = null; c.parked = true; c.v = 0;
      P.mode = 'foot'; P.car = null;
    }
    const [rx, ry] = this.W.L.spawn.respawn;
    P.ped.x = rx; P.ped.y = ry; P.ped.h = -Math.PI / 2; P.ped.hidden = false;
    this.stars = 0;
    this.playerS = this.W.loopNearest(rx, ry);
    for (const c of this.cars) if (c.driver === 'police') { c.driver = 'ai'; c.siren = false; c.cruise = 110; c.copOut = false; this.syncS(c); }
    this.peds = this.peds.filter(p => p.mode !== 'cop');
    this.busted.respawned = true;
    this.ev('respawn');
  }

  // ------------------------------------------------------------------ pedestrians
  stepPed(p, dt) {
    const W = this.W;
    if (p.mode === 'down') {
      p.downT -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt);
      p.spin = (p.spin || 0) + (Math.hypot(p.vx, p.vy) * 0.02) * dt;
      if (p.downT <= 0) { p.down = false; p.mode = 'flee'; p.fleeT = 3; p.from = { x: p.x - p.vx, y: p.y - p.vy }; }
      return;
    }
    // hit by a car?
    for (const c of this.cars) {
      if (Math.abs(c.v) < 45) continue;
      const lx = p.x - c.x, ly = p.y - c.y, ca = Math.cos(c.h), sa = Math.sin(c.h);
      const u = lx * ca + ly * sa, v = -lx * sa + ly * ca;
      if (Math.abs(u) < c.len / 2 + 4 && Math.abs(v) < c.wid / 2 + 4) {
        if (p.mode === 'cop' && c.driver !== 'player') continue;
        p.mode = 'down'; p.down = true; p.downT = 5;
        p.vx = ca * c.v * 0.7 - sa * Math.sign(v) * 60; p.vy = sa * c.v * 0.7 + ca * Math.sign(v) * 60;
        p.spin = 0;
        this.ev('hit');
        if (c.driver === 'player' && (this.time - (this.lastHitStar || -9)) > 2.5) { this.addStars(1, 'hit'); this.lastHitStar = this.time; }
        for (const o of this.peds) if (o.mode === 'walk' && dist(o, p) < 160) { o.mode = 'flee'; o.fleeT = 3; o.from = { x: c.x, y: c.y }; }
        return;
      }
    }
    let mx = 0, my = 0, sp = p.speed;
    if (p.mode === 'cop') {
      const t = this.player.ped;
      if (this.player.mode === 'car' || this.stars === 0) { p.gone = this.stars === 0; mx = 0; my = 0; }
      else { mx = t.x - p.x; my = t.y - p.y; }
    } else if (p.mode === 'flee') {
      p.fleeT -= dt; sp = 78;
      mx = p.x - p.from.x; my = p.y - p.from.y;
      if (p.fleeT <= 0) {
        if (!p.path) { p.gone = true; return; }
        p.mode = 'return';
      }
    } else {
      // scare: player car speeding close by
      const pc = this.player.car;
      if (pc && Math.abs(pc.v) > 150 && dist(pc, p) < 70) { p.mode = 'flee'; p.fleeT = 2; p.from = { x: pc.x, y: pc.y }; }
      if (!p.path) { p.gone = true; return; }
      if (p.path.type === 'loop') {
        if (p.mode === 'return') {
          p.path.s = W.loopNearest(p.x, p.y); p.mode = 'walk';
        }
        p.path.s += p.path.dir * p.speed * dt;
        const q = W.loopAt(p.path.s + p.path.dir * 8, p.path.off);
        mx = q.x - p.x; my = q.y - p.y;
      } else {
        if (p.mode === 'return') { mx = p.path.x - p.x; my = 0; if (Math.abs(mx) < 3) p.mode = 'walk'; }
        else {
          p.path.y += p.path.dir * p.speed * dt;
          if (p.path.y < 30 || p.path.y > W.L.world.h - 30) p.path.dir *= -1;
          mx = p.path.x - p.x; my = p.path.y - p.y;
        }
      }
    }
    const l = Math.hypot(mx, my);
    if (l > 0.5) {
      const step = Math.min(l, sp * dt);
      p.h = Math.atan2(my, mx);
      const bx = p.x, by = p.y;
      this.walkMove(p, mx / l * step, my / l * step);
      const moved = Math.hypot(p.x - bx, p.y - by);
      p.walk += moved;
      if (moved < step * 0.2 && (p.mode === 'walk' || p.mode === 'return')) { p.stuckT = (p.stuckT || 0) + dt; if (p.stuckT > 2) { p.x += mx / l * step; p.y += my / l * step; } } else p.stuckT = 0;
      p.pose = [0, 1, 2, 1][Math.floor(p.walk / 8) % 4];
    } else p.pose = 1;
  }
}
