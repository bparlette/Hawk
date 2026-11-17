// sim.js — everything that moves: the player, traffic, pedestrians, police, wanted level, busted.
// Fixed-timestep and seeded, so ?demo plays the same route every time.

import { mulberry32 } from './world.js';
import { enterSiege, stepSiege } from './siege.js';
import { initPressure, stepPressure } from './pressure.js';
import { initHeli, stepHeli, stepHeliState, nearHeli, stealOrBoard } from './heli.js';
import { initJobs, stepJobs } from './jobs.js';
import { stepTurbo, TURBO } from './controls.js';
import { initSkid, layMarks } from './skid.js';
import { chaseArmed, startChase, boardRack } from './chase.js';
import { initActivities, jump } from './activities.js';
import { initEvents, stepEvents, startEvent } from './events.js';
import { initSkate, stepBoard, stepCombo, nearBoard, mount, boardSpeed } from './skate.js';
import { initWatercraft, stepCraft, stepWaterFx, nearCraft, mountCraft } from './watercraft.js';
import { initDestruct, stepDestruct, punchWorld, carState, carImpact, carsCollide, hitThing, palmImpact, initProps, propImpact } from './destruct.js';
import { openRoadArmed, stepRouteCar } from './openroad.js';
import { stepLabels } from './labels.js';

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
    this.fxr = mulberry32(seed * 7 + 11);   // cosmetic randomness only, so effects never disturb the seeded run
    this.shakes = {}; this.leaves = [];     // palm index -> { t, amp, ax, ay }; falling leaves
    this.fx = [];                           // short-lived hit flashes { kind, x, y, t }
    initDestruct(this);                     // debris + smoke pools, breakable things (destruct.js)
    this.cars = []; this.peds = [];
    this.time = 0;
    this.stars = 0; this.starDecay = 0; this.lostT = 0;
    this.draft = 0; this.draftCar = null;               // traffic slipstream (polish bundle): charge + target
    this.labelUse = { id: null, t: 0 };                  // helper-label retirement (labels.js): continuous-use tracker
    this.labelFadeAt = {};                               // label id -> sim.time it retired this session (the fade)
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
    // FABLE candidate: kerbside cars in the shell (tools/geo/geo_to_shell.py). They are DORMANT — outside
    // sim.cars, costing nothing — until the player comes within WAKE_R; an untouched car (still parked,
    // never moved, no damage) goes back to sleep beyond SLEEP_R. The same objects wake and sleep: the
    // population never grows or shrinks.
    this.dormant = [];
    if (world.shell && world.shell.parked) for (const [x, y, h, model] of world.shell.parked) {
      const c = this.addCar(x, y, h, model, null, { parked: true, shellPark: true, home: { x, y } });
      this.cars.splice(this.cars.indexOf(c), 1); this.dormant.push(c);
    }
    initSkate(this);
    initWatercraft(this);                   // the jetski + cigarette boat at the pier, the police boat (watercraft.js)
    initSkid(this);
    // things you'd expect to be solid are: bench slats, the fountain basin, the lifeguard towers
    this.obst = [];
    for (const b of this.benches) for (const k of [-11, 0, 11]) this.obst.push({ x: b.x + Math.cos(b.a) * k, y: b.y + Math.sin(b.a) * k, r: 5.5, kind: 'bench' });
    for (const p of world.L.props) this.obst.push({ x: p.x, y: p.y, r: p.type === 'fountain' ? 30 : 12, kind: p.type });
    initProps(this);                                     // benches, lamps, lifeguard towers can be broken (destruct.js)
    initPressure(this);                                  // the chopper, roadblocks, spikes (pressure.js)
    initHeli(this);                                      // the hospital helicopter + its walkable roof (heli.js)
    initJobs(this);                                      // job vehicles + the one job slot (jobs.js)
    initEvents(this);                                    // WRECK IT! + VALET sites and the one event slot (events.js)
    initActivities(this);                    // the registry the markers, map and HELP read
    // two people strolling the pier, out to the end and back
    const PR = world.L.pier;
    for (const [fx, dir, outfit, dy] of [[0.3, 1, 'ped_straw', -5], [0.75, -1, 'ped_blue', 5]]) {
      const q = this.makePed(PR.x + PR.w * fx, PR.y + PR.h / 2 + dy, outfit, { type: 'pier', y: PR.y + PR.h / 2 + dy, dir, wait: 0 }, 22);
      q.keep = true; this.peds.push(q);
    }
    // one patrol car cruises the loop, so there can be a cop to see you even at zero stars
    { const s = world.loopPath.len * 0.55, q = world.loopAt(s, LANE);
      const c = this.addCar(q.x, q.y, Math.atan2(q.ty, q.tx), 'police', 'ai', { s, dir: 1, cruise: 105, patrol: true }); c.v = 80; }
    for (let i = 0; i < 10; i++) this.spawnTraffic(true);
    for (let i = 0; i < 40; i++) this.spawnPed(true);
  }

  // ------------------------------------------------------------------ factories
  addCar(x, y, h, model, driver, extra = {}) {
    const m = this.M.cars[model];
    const c = { id: this.nextId++, x, y, h, v: 0, model, kind: m.kind, driver, len: m.length, wid: m.width, parked: false, s: 0, dir: 1, siren: false, stuck: 0, ...extra };
    carState(c);                              // dents, glass, wreck (destruct.js)
    this.cars.push(c);
    return c;
  }

  makePed(x, y, outfit, path, speed) {
    return { id: this.nextId++, x, y, h: 0, outfit, pose: 1, walk: 0, path, speed: speed ?? 20 + this.rnd() * 14, mode: 'walk', downT: 0, fleeT: 0, vx: 0, vy: 0 };
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
      if (W.hitSolid(x, y, 4) || W.hitTrunk(x, y, 6)) continue;
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

  // A palm takes a knock: the trunk jolts along the impact, the fronds rustle, a few leaves fall.
  shakeTree(tr, power, ax, ay) {
    const l = Math.hypot(ax, ay) || 1, old = this.shakes[tr.i];
    if (old && old.t < 0.15 && old.amp >= power) return;
    this.shakes[tr.i] = { t: 0, amp: Math.min(1, power), ax: ax / l, ay: ay / l };
    const n = 2 + Math.round(power * 5), r = this.fxr;
    for (let i = 0; i < n && this.leaves.length < 60; i++) {
      const a = r() * TAU, d = (20 + r() * 22) * tr.sc, out = 16 + r() * 26;   // shaken loose from the crown's rim, drifting outward
      this.leaves.push({ x: tr.x + Math.cos(a) * d, y: tr.y + Math.sin(a) * d, vx: ax / l * 12 + Math.cos(a) * out, vy: ay / l * 12 + Math.sin(a) * out, t: -r() * 0.25, life: 1.1 + r() * 0.9, rot: r() * TAU, vr: (r() - 0.5) * 7 });
    }
    this.ev('rustle', power);
  }

  // A pedestrian staggers off the way they were shoved, then carries on (or runs).
  stumble(p, nx, ny, speed) {
    if (p.mode === 'down' || p.mode === 'stumble') return;
    p.after = p.mode === 'cop' ? 'cop' : p.mode === 'flee' || !p.path ? 'flee' : 'return';
    p.mode = 'stumble'; p.stT = 0.55; p.vx = nx * speed; p.vy = ny * speed; p.bumpT = this.time;
    if (!p.from) p.from = { x: p.x - nx, y: p.y - ny };
  }

  // A pedestrian goes down, slides, lies there, then gets up and runs.
  knockDown(p, vx, vy, dur) {
    p.mode = 'down'; p.down = true; p.downT = dur; p.vx = vx; p.vy = vy; p.spin = 0; p.bumpT = this.time;
  }

  say(text, dur = 2.2) { this.msg = { text, t: dur, dur }; }

  // Honest work (owner, Nov 16): while a legal job runs — TAXI, TOW, BUS — the cops leave you
  // alone: no new stars, no pursuit, no bust. GETAWAY is a crime by design and gets no cover.
  // (The taxi undercover-fed fare is a scripted trap with its own bust path in jobs.js; it does
  // not come through here and still works as designed.)
  legalJob() { return !!(this.job && this.job.kind !== 'getaway'); }

  addStars(n, why) {
    if (n > 0 && this.legalJob()) return;      // on a legal job the heat cannot rise
    const before = this.stars;
    this.stars = clamp(this.stars + n, 0, 5);
    this.lostT = 0;
    if (this.stars > before) this.ev('star', this.stars);
  }

  // ------------------------------------------------------------------ main step
  step(dt, input) {
    if (this.hitStopT > 0) { this.hitStopT -= dt; return; }     // events.js hit-stop: the world freezes a few ticks on a big break
    this.time += dt;
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    const P = this.player;
    if (input.jump) jump(this, input.jump);            // HELP / start page JUMP (recorded like any other input)
    if (this.busted) {
      this.busted.t += dt;
      input = { jx: 0, jy: 0, jm: 0, action: false, keys: {} };
      if (this.busted.t > 3.4 && !this.busted.respawned) this.respawn();
      if (this.busted.t > 4.4) this.busted = null;
    }

    // --- effects
    for (const k in this.shakes) { const s = this.shakes[k]; s.t += dt; if (s.t > 1.3) delete this.shakes[k]; }
    for (const l of this.leaves) { l.t += dt; if (l.t > 0) { l.x += l.vx * dt; l.y += l.vy * dt; l.vx *= Math.pow(0.2, dt); l.vy *= Math.pow(0.2, dt); l.rot += l.vr * dt; } }
    if (this.leaves.length) this.leaves = this.leaves.filter(l => l.t < l.life);
    if (P.slowT > 0) P.slowT -= dt;
    if (P.ped.hopT > 0) P.ped.hopT -= dt;
    if (P.punchCd > 0) P.punchCd -= dt;
    for (const f of this.fx) f.t += dt;
    if (this.fx.length) this.fx = this.fx.filter(f => f.t < 0.36);
    stepDestruct(this, dt);

    // --- player
    if (P.stunT > 0) { P.stunT -= dt; input = { ...input, jm: 0, action: false, keys: {} }; }
    if (P.mode === 'foot') this.stepPlayerFoot(dt, input);
    else if (P.mode === 'board') {
      if (input.punch && chaseArmed(this)) { startChase(this); input = { ...input, punch: false }; }   // A at the pier marker: START BOARD CHASE
      stepBoard(this, dt, input);
    }
    else if (P.mode === 'water') stepCraft(this, dt, input);
    else if (P.mode === 'siege') stepSiege(this, dt, input);
    else if (P.mode === 'air') stepHeli(this, dt, input);
    else this.stepPlayerCar(dt, input);
    stepHeliState(this, dt);
    stepJobs(this, dt, input);
    stepEvents(this, dt);
    stepLabels(this, dt);                   // helper labels retire after ~3 s of continuous use (labels.js)
    stepCombo(this, dt);
    stepWaterFx(this, dt);                  // spray decay, moored craft settling, the police boat
    // a board left alone rolls to a stop
    if (!this.board.ridden) { const b = this.board, f = Math.exp(-3 * dt); b.vx *= f; b.vy *= f; const bx = b.x + b.vx * dt, by = b.y + b.vy * dt; if (this.canStand(bx, by) && !this.W.hitTrunk(bx, by, 2)) { b.x = bx; b.y = by; } else { b.vx = b.vy = 0; } }   // never rolls off into the sea or through a rail

    // --- AI cars
    for (const c of this.cars) {
      if (c.driver === 'ai') this.stepTraffic(c, dt);
      else if (c.driver === 'police') this.stepPolice(c, dt);
      else if (c.driver === 'route') stepRouteCar(this, c, dt);   // OPEN ROAD shell traffic (openroad.js)
      else if (c.driver === null) { c.v *= Math.pow(0.05, dt); if (Math.abs(c.v) > 0.5) this.moveCar(c, dt); else c.v = 0; }   // FABLE candidate: a car at rest skips the collision probe (84 kerbside cars in the shell)
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
      if ((c.parked && c.fixed !== false) || c.patrol || c.job || c.towTarget || c.towed) return true;
      return d < 1250;
    });
    const traffic = this.cars.filter(c => c.driver === 'ai').length;
    if (traffic < 10 && this.rnd() < dt * 2) this.spawnTraffic(false);
    this.peds = this.peds.filter(p => p === P.ped || p.keep || p.mode === 'cop' || Math.hypot(p.x - f.x, p.y - f.y) < 1000);
    const walkers = this.peds.filter(p => p.mode !== 'cop' && p !== P.ped).length;
    if (walkers < 40 && this.rnd() < dt * 3) this.spawnPed(false);

    this.stepDormant(dt);
    stepPressure(this, dt);
    this.stepWanted(dt);
  }

  // FABLE candidate: wake shell kerbside cars near the player, put untouched ones back to sleep (see ctor).
  stepDormant(dt) {
    if (!this.dormant || !this.dormant.length && !this.cars.some(c => c.shellPark)) return;
    this.dormT = (this.dormT || 0) - dt;
    if (this.dormT > 0) return;
    this.dormT = 0.25;
    const f = this.focus(), WAKE_R = 1400, SLEEP_R = 1700;
    for (let i = this.dormant.length - 1; i >= 0; i--) {
      const c = this.dormant[i];
      if (Math.hypot(c.x - f.x, c.y - f.y) < WAKE_R) { this.dormant.splice(i, 1); this.cars.push(c); }
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (!c.shellPark || c.driver || !c.parked || c.dmg > 0 || c.v !== 0 || c === this.player.car) continue;
      if (Math.hypot(c.x - c.home.x, c.y - c.home.y) > 1) { c.shellPark = false; continue; }   // moved: it is the world's now
      if (Math.hypot(c.x - f.x, c.y - f.y) > SLEEP_R) { this.cars.splice(i, 1); this.dormant.push(c); }
    }
  }

  // ------------------------------------------------------------------ player
  stepPlayerFoot(dt, inp) {
    const p = this.player.ped, P0 = this.player;
    let jx = inp.jx, jy = inp.jy, jm = inp.jm;
    const k = inp.keys || {};
    if (k.up || k.down || k.left || k.right) {
      jx = (k.right ? 1 : 0) - (k.left ? 1 : 0); jy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      jm = Math.hypot(jx, jy) ? 1 : 0;
      if (jm) { const l = Math.hypot(jx, jy); jx /= l; jy /= l; }
    }
    if (jm > 0.12) {
      const sp = (jm > 0.65 ? 74 : 30 + jm * 50) * (this.player.slowT > 0 ? 0.35 : 1);
      p.h = Math.atan2(jy, jx);
      const tr = this.walkMove(p, Math.cos(p.h) * sp * dt, Math.sin(p.h) * sp * dt);
      if (tr && sp > 55 && this.time - (this.lastBump || -9) > 0.45) {      // ran into a palm
        this.lastBump = this.time; this.player.slowT = 0.3;
        this.shakeTree(tr, 0.35, tr.x - p.x, tr.y - p.y); this.ev('bump');
      }
      this.bumpPeds(p, sp);
      // low rails (promenade, plaza): on foot you hop them
      for (const r of this.rails) {
        if (r.pier) continue;
        const vx = r.x1 - r.x0, vy = r.y1 - r.y0, t = ((p.x - r.x0) * vx + (p.y - r.y0) * vy) / (r.len * r.len);
        const side = Math.sign(vx * (p.y - r.y0) - vy * (p.x - r.x0));
        const gap = r.segs && r.segs[Math.max(0, Math.min(r.segs.length - 1, Math.floor(t * r.segs.length)))].stage >= 2;   // snapped section: step through
        if (t >= 0 && t <= 1 && r.side && side && side !== r.side && !(p.hopT > 0) && !gap) { p.hopT = 0.26; this.player.slowT = Math.max(this.player.slowT || 0, 0.16); this.ev('hop'); }
        r.side = t >= 0 && t <= 1 ? side || r.side : 0;
      }
      p.walk += sp * dt;
      p.pose = [0, 1, 2, 1][Math.floor(p.walk / 9) % 4];
    } else p.pose = 1;
    // the fight button: a punch with a short lunge
    if (P0.punchT > 0) { P0.punchT -= dt; if (P0.punchT > 0.14) this.walkMove(p, Math.cos(p.h) * 100 * dt, Math.sin(p.h) * 100 * dt); }
    if (inp.punch && openRoadArmed(this)) { startEvent(this, 'openroad'); return; }   // A in the start circle: into the waiting grid car, countdown on
    if (inp.punch && !(P0.punchCd > 0)) this.punch();
    if (inp.action && this.nearMotelDoor()) { enterSiege(this); return; }
    if (inp.action) {
      boardRack(this);   // INSTANT-START: recall a stray board to the pier rack before the mount test below
      if (nearHeli(this)) { stealOrBoard(this); return; }   // the hospital helicopter (heli.js)
      if (this.player.roof) return;                          // nothing else to use up on the roof
      // the board wins if it's right at your feet and nearer than any car; a moored craft at
      // the pier wins over both — you came to the dock for it
      const p2 = this.player.ped, b = this.board;
      const bd = Math.hypot(b.x - p2.x, b.y - p2.y);
      const cd = Math.min(...this.cars.map(c => Math.hypot(c.x - p2.x, c.y - p2.y)));
      const cr = nearCraft(this);
      const wd = cr ? Math.hypot(cr.x - p2.x, cr.y - p2.y) : 1e9;
      if (nearBoard(this) && bd < cd && bd < wd) mount(this);
      else if (cr && wd < cd) mountCraft(this, cr);
      else this.tryEnterCar();
    }
  }

  // The motel's door (layout.motelDoor): on foot here, the action button is ENTER -> Motel Siege.
  nearMotelDoor() {
    const p = this.player.ped, d = this.W.L.motelDoor;
    return this.player.mode === 'foot' && !this.busted && Math.hypot(p.x - d[0], p.y - d[1]) < 30;
  }

  // Is there a cop who can see this spot? A patrol or pursuit car, or an officer on foot, in range
  // with nothing solid in between.
  copSees(x, y) {
    const W = this.W;
    const los = (ax, ay) => { for (let i = 1; i < 8; i++) if (W.hitSolid(ax + (x - ax) * i / 8, ay + (y - ay) * i / 8, 0)) return false; return true; };
    for (const c of this.cars) if (c.kind === 'police' && c.driver && c.driver !== 'player' && Math.hypot(c.x - x, c.y - y) < 300 && los(c.x, c.y)) return true;
    for (const o of this.peds) if (o.mode === 'cop' && Math.hypot(o.x - x, o.y - y) < 240 && los(o.x, o.y)) return true;
    return false;
  }

  // Throw a punch. Snaps to whoever is in front, lunges, and the hit lands at once: first hit
  // staggers, a second (or one on someone already reeling) puts them on the ground. Bystanders
  // run or stop and stare. Do it where a cop can see and the wanted level goes up.
  punch() {
    const P = this.player, p = P.ped;
    P.punchT = 0.26; P.punchCd = 0.42; P.punchN = (P.punchN || 0) + 1;
    let best = null, bd = 34;
    for (const o of this.peds) {
      if (o === p || o.hidden || o.mode === 'down') continue;
      const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
      if (d >= bd) continue;
      if (d > 13 && Math.abs(wrap(Math.atan2(dy, dx) - p.h)) > 1.25) continue;   // has to be roughly in front
      bd = d; best = o;
    }
    if (!best) {                                         // no one in reach: the world takes it (destruct.js)
      if (punchWorld(this, p)) P.punchHit = (P.punchHit || 0) + 1; else this.ev('swing');
      return;
    }
    const o = best, d = Math.max(0.01, bd), nx = (o.x - p.x) / d, ny = (o.y - p.y) / d;
    p.h = Math.atan2(ny, nx);
    P.punchHit = (P.punchHit || 0) + 1;
    this.fx.push({ kind: 'pow', x: p.x + nx * Math.min(d, 14), y: p.y + ny * Math.min(d, 14), t: 0 });
    this.ev('punch');
    const reeling = o.mode === 'stumble';
    o.hp = (o.hp ?? 2) - 1;
    o.from = { x: p.x, y: p.y };
    if (o.mode === 'cop') { o.mode = 'cop'; this.stumble(o, nx, ny, 70); }
    else if (reeling || o.hp <= 0) { o.mode = 'walk'; this.knockDown(o, nx * 90, ny * 90, 2.6); o.hp = 1; }
    else { this.stumble(o, nx, ny, 70); if (this.fxr() < 0.65) o.after = 'flee'; }
    // witnesses: most run, some stop and stare
    for (const w of this.peds) {
      if (w === o || w === p || w.mode !== 'walk' || dist(w, p) > 150) continue;
      if (this.fxr() < 0.6) { w.mode = 'flee'; w.fleeT = 3; w.from = { x: p.x, y: p.y }; }
      else w.gawkT = 1.4 + this.fxr();
    }
    const hitCop = o.outfit === 'cop';
    if ((hitCop || this.copSees(p.x, p.y)) && !this.busted && this.time - (this.lastPunchStar || -9) > 2.5) {
      this.lastPunchStar = this.time;
      this.addStars(1, 'assault');
      this.say(hitCop ? 'ASSAULTING AN OFFICER' : 'A COP SAW THAT', 1.8);
    }
  }

  // The player on foot never passes through people: walking nudges them aside, running into
  // someone makes them stumble and costs the player a beat.
  bumpPeds(p, sp) {
    for (const o of this.peds) {
      if (o === p || o.hidden || o.mode === 'down') continue;
      const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
      if (d >= 9 || d < 0.01) continue;
      const nx = dx / d, ny = dy / d, push = 9 - d;
      p.x -= nx * push * 0.5; p.y -= ny * push * 0.5;
      if (this.W.hitSolid(p.x, p.y, 3)) { p.x += nx * push * 0.5; p.y += ny * push * 0.5; }
      if (o.mode !== 'cop') this.walkMove(o, nx * push * 0.5, ny * push * 0.5);
      if (sp > 55 && o.mode !== 'cop' && o.mode !== 'stumble' && this.time - (o.bumpT || -9) > 0.8) {
        this.stumble(o, nx, ny, 52);
        this.player.slowT = 0.25; this.ev('bump');
      }
    }
  }

  // Where feet can be: land up to the waterline, or the pier deck between its rails.
  canStand(x, y) {
    const W = this.W;
    if (W.shell && x < 0)   // the extension shell: any non-water surface, causeway aprons included
      return !W.hitSolid(x, y, 3) && x > W.bounds.x0 + 4 && y > 4 && y < W.L.world.h - 4 && W.surfaceAt(x, y) !== 'water';
    return !W.hitSolid(x, y, 3) && x > 4 && y > 4 && x < W.L.world.w - 4 && y < W.L.world.h - 4 && (x < W.shoreX(y) + 6 || W.onPier(x, y, 4));
  }

  // Moves a walker with building, shoreline, car and palm collisions. Returns the palm trunk it
  // pressed against this step (or null) so callers can react.
  walkMove(p, dx, dy) {
    const W = this.W;
    const ok = (x, y) => this.canStand(x, y) || (p === this.player.ped && this.roofStand && this.roofStand(x, y));   // the player may stand on the hospital roof (heli.js)
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
    // palm trunks are solid: slide round them
    const tr = W.hitTrunk(p.x, p.y, 3);
    if (tr) {
      let nx = p.x - tr.x, ny = p.y - tr.y, d = Math.hypot(nx, ny);
      if (d < 0.01) { nx = 1; ny = 0; d = 1; }
      p.x = tr.x + nx / d * (tr.r + 3); p.y = tr.y + ny / d * (tr.r + 3);
    }
    // benches, the fountain, the lifeguard towers: walk round them
    for (const o of this.obst) {
      let nx = p.x - o.x, ny = p.y - o.y, d = Math.hypot(nx, ny), r = o.r + 3;
      if (d >= r) continue;
      const mv = Math.hypot(dx, dy);
      if (o.kind !== 'bench' && mv > 0 && d > 0.01 && Math.abs(nx * dy - ny * dx) < 0.05 * d * mv) { nx += -dy / mv; ny += dx / mv; d = Math.hypot(nx, ny); }   // dead-centre on a round thing: pick a side
      if (d < 0.01) { nx = 1; ny = 0; d = 1; }
      const qx = o.x + nx / d * r, qy = o.y + ny / d * r;
      if (this.canStand(qx, qy)) { p.x = qx; p.y = qy; }
    }
    return tr;
  }

  tryEnterCar() {
    const p = this.player.ped;
    let best = null, bd = 40;
    for (const c of this.cars) {
      if (c.wreck) continue;                            // a wreck goes nowhere
      const d = dist(c, p);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return;
    const c = best;
    let stars = 1;
    const copCar = c.kind === 'police' && !!c.driver;
    if (c.driver === 'ai' || c.driver === 'police') {
      // pull the driver out; they run
      const side = { x: c.x - Math.sin(c.h) * -18, y: c.y + Math.cos(c.h) * -18 };
      const d = this.makePed(side.x, side.y, copCar ? 'cop' : PED_OUTFITS[(this.rnd() * PED_OUTFITS.length) | 0], null);
      d.mode = 'flee'; d.fleeT = 4; d.from = { x: p.x, y: p.y };
      this.peds.push(d);
      if (copCar) stars = 2;
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
    if (c.wreck) { throttle = 0; steer = 0; }            // dead: all you can do is get out
    const boost = stepTurbo(this, c, !!inp.turbo, throttle, dt);                   // A held: turbo
    const draftMul = 1 + 0.08 * (this.draft || 0);       // slipstream: up to +8% while the draft holds
    const top = (c.heavy ? 235 : 290) * (1 + (TURBO.mult - 1) * (c.turbo || 0)) * draftMul;         // eases in and back out, never snaps
    this.driveCar(c, throttle * (boost ? TURBO.accel : 1) * draftMul, steer * (c.heavy ? 0.72 : 1), dt, top);   // the bus: slower, wider turns
    this.stepDraft(dt);
    if (inp.action && Math.abs(c.v) < 60) this.exitCar();
  }

  // ------------------------------------------------------------------ traffic slipstream
  // Sit in the ~60-unit cone behind a moving traffic car and the DRAFT charges over ~1.4 s: wind
  // streaks (render.js reads sim.draft) and up to +8% accel/top speed (applied in stepPlayerCar).
  // Swing past the car you were drafting and it pays out: SLINGSHOT +50 and a small director mark.
  // Traffic only: parked cars, cops, the patrol and job vehicles give nothing.
  stepDraft(dt) {
    const c = this.player.car;
    if (!c || c.wreck) { this.draft = 0; this.draftCar = null; return; }
    let best = null, bestGap = 1e9;
    for (const o of this.cars) {
      if (o === c || o.driver !== 'ai' || o.parked || o.patrol || o.job || o.wreck || o.kind === 'police') continue;
      const dx = c.x - o.x, dy = c.y - o.y, ca = Math.cos(o.h), sa = Math.sin(o.h);
      const u = dx * ca + dy * sa;                       // player position in the target's frame: u < 0 = behind
      const v = -dx * sa + dy * ca;
      const gap = -u - o.len / 2;                        // clear space behind the target's rear bumper
      if (gap < -4 || gap > 60 || Math.abs(v) > o.wid / 2 + 10 || Math.abs(c.v) < 60) continue;
      if (gap < bestGap) { bestGap = gap; best = o; }
    }
    if (best) {
      this.draftCar = best;
      this.draft = Math.min(1, this.draft + dt / 1.4);
      return;
    }
    const o = this.draftCar;
    if (o && this.draft > 0.5) {                         // no longer behind it: did we swing past?
      const dx = c.x - o.x, dy = c.y - o.y, ca = Math.cos(o.h), sa = Math.sin(o.h);
      const u = dx * ca + dy * sa;
      if (u > o.len / 2 + c.len / 2 + 6) {               // fully ahead of the car we were drafting
        this.score = (this.score || 0) + 50;
        this.lastTrick = { name: 'SLINGSHOT', pts: 50, t: 1.2, mult: 1 };
        this.ev('sling');
      }
    }
    this.draft = Math.max(0, this.draft - dt * 2);
    if (this.draft <= 0) this.draftCar = null;
  }

  exitCar() {
    const c = this.player.car, p = this.player.ped;
    for (const side of [-1, 1]) {
      const x = c.x + Math.sin(c.h) * 20 * side, y = c.y - Math.cos(c.h) * 20 * side;
      if (!this.W.hitSolid(x, y, 3) && !(this.W.shell && x < 0 && this.W.surfaceAt(x, y) === 'water')) { p.x = x; p.y = y; break; }   // don't step out into the bay on a causeway
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
    vmax *= 1 - 0.4 * c.dmg;                           // a battered car is slower
    c.v = clamp(c.v, -100, vmax);
    c.v *= Math.pow(0.9, dt);
    const grip = Math.min(1, Math.abs(c.v) / 70);
    c.h = wrap(c.h + steer * 2.7 * grip * Math.sign(c.v) * dt);
    this.moveCar(c, dt);
    if (c.driver === 'player' || c.driver === 'police') layMarks(this, c, throttle, steer, grip, dt);   // slipping tyres leave marks
  }

  carBlocked(c, x, y, h) {
    const W = this.W, ca = Math.cos(h), sa = Math.sin(h);
    for (const [u, v] of [[c.len / 2, c.wid / 2], [c.len / 2, -c.wid / 2], [-c.len / 2, c.wid / 2], [-c.len / 2, -c.wid / 2], [c.len / 2, 0]]) {
      const px = x + ca * u - sa * v, py = y + sa * u + ca * v;
      if (!W.isDrivable(px, py)) return true;
      const H = this.heli;   // a helicopter parked on the ground is a solid (heli.js)
      if (H && H.state === 'parked' && !H.onRoof && (px - H.x) ** 2 + (py - H.y) ** 2 < 27 * 27) return true;
      for (const o of this.obst) if ((px - o.x) ** 2 + (py - o.y) ** 2 < o.r * o.r) { this.hitObst = o; return true; }
      const tr = W.hitTrunk(px, py, 1);
      if (tr) { this.hitTree = tr; return true; }
    }
    return false;
  }

  moveCar(c, dt) {
    const dx = Math.cos(c.h) * c.v * dt, dy = Math.sin(c.h) * c.v * dt;
    this.hitTree = null; this.hitObst = null;
    if (!this.carBlocked(c, c.x + dx, c.y + dy, c.h)) { c.x += dx; c.y += dy; return; }
    const cause = c.driver === 'player' ? 'player' : 'world';
    if (this.hitTree) {                                   // a palm: the tree answers, scaled by speed
      const tr = this.hitTree, sp = Math.abs(c.v), palm = this.palms[tr.i];
      if (sp > 20) this.shakeTree(tr, Math.min(1, 0.25 + sp / 220), dx, dy);
      if (sp > 60 && c.driver === 'player') this.crash(sp);
      carImpact(this, c, sp, cause);
      if (palm && this.time - palm.hitT > 0.3) hitThing(this, palm, palmImpact(sp), dx, dy, cause, sp);
      if (this.W.felled[tr.i]) { c.v *= 0.6; return; }  // snapped it: plough on, slower
      c.v *= -0.15;
      return;
    }
    if (Math.abs(c.v) > 120 && c.driver === 'player') this.crash(Math.abs(c.v));
    carImpact(this, c, Math.abs(c.v), cause);           // walls dent the leading panel, scaled by speed
    const prop = this.hitObst && this.hitObst.thing;
    if (prop) {                                           // a bench or a tower: it breaks by speed
      const sp = Math.abs(c.v);
      if (this.time - prop.hitT > 0.3) hitThing(this, prop, propImpact(prop.kind, sp), dx, dy, cause, sp);
      if (prop.stage >= 3) { c.v *= 0.7; return; }      // smashed through: plough on
    }
    if (!this.carBlocked(c, c.x + dx, c.y, c.h)) { c.x += dx; c.v *= 0.8; }
    else if (!this.carBlocked(c, c.x, c.y + dy, c.h)) { c.y += dy; c.v *= 0.8; }
    else c.v *= -0.25;
  }

  carCollisions(dt) {
    const cs = this.cars;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      if ((a.towed && b.driver === 'player') || (b.towed && a.driver === 'player')) continue;   // the tow truck and its own payload (jobs.js owns that pair)
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
      if (closing < -45) carsCollide(this, a, b, -closing, nx, ny, ma, mb);   // both take damage (destruct.js)
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
    if (this.player.mode !== 'car' && check(pp.x, pp.y, 16)) return false;
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
    if ((!los || d > 420) && !(W.shell && c.x < 0 && f.x < 0)) {   // OPEN ROAD: in the shell the loop is another world — hunt the driver, not the loop
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
    if (d < 70 && (this.player.mode !== 'car' || Math.abs(f.v) < 40)) throttle = c.v > 10 ? -1 : 0;
    if (Math.abs(diff) > 2.4 && c.v < 60) { throttle = -0.7; }
    this.driveCar(c, throttle, clamp((throttle < 0 && c.v < 0 ? -1 : 1) * diff * 2.6, -1, 1), dt, 350);
    if (Math.abs(c.v) < 40 && throttle > 0.3 && d > 90) { c.stuck += dt; if (c.stuck > 1.2) { c.v = -90; c.h = wrap(c.h + (this.rnd() - 0.5)); c.stuck = 0; } } else c.stuck = 0;
    // cops jump out for a foot chase
    if (this.player.mode !== 'car' && d < 140 && Math.abs(c.v) < 40 && !c.copOut) {
      c.copOut = true;
      const cop = this.makePed(c.x + Math.sin(c.h) * 18, c.y - Math.cos(c.h) * 18, 'cop', null);
      cop.mode = 'cop'; cop.speed = 82;
      this.peds.push(cop);
    }
  }

  stepWanted(dt) {
    if (this.siege) return;                     // inside the motel the siege owns the stars and the arrest
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

    // a patrol car close by joins the chase the moment you're wanted (never on a legal job)
    if (this.stars > 0 && !this.busted && !this.legalJob()) for (const c of this.cars) if (c.patrol && c.driver === 'ai' && dist(c, f) < 650) c.driver = 'police';        // 7C: wider re-acquire
    const police = this.cars.filter(c => c.driver === 'police');
    const want = this.stars > 0 && !this.busted && !this.legalJob() ? Math.min(4, this.stars + 1) : 0;
    if (police.length < want && !(this.event && this.event.kind === 'openroad') && this.rnd() < dt * 0.6) {   // OPEN ROAD runs exactly its own two-car pursuit: no fresh spawns off the loop
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
    if (this.stars === 0 || this.legalJob()) {
      for (const c of police) { c.driver = 'ai'; c.siren = false; c.cruise = 120; c.copOut = false; this.syncS(c); }
    }
    // losing the heat
    const near = police.some(c => dist(c, f) < 600) || (this.chopper && this.chopper.lock);   // in the searchlight = seen
    if (this.stars > 0 && !near) {
      this.lostT += dt;
      if (this.lostT > 22) { this.stars--; this.lostT = 0; if (this.stars === 0) this.say('LOST THEM'); }
    } else this.lostT = 0;
    // busted?
    if (this.busted || this.stars === 0 || this.legalJob()) { this.bustT = 0; return; }
    if (this.player.mode === 'water') return;   // on the water the police boat owns the bust meter (watercraft.js)
    let pinned = false;
    if (this.player.mode === 'car') {
      const c = this.player.car;
      // 7C: the meter fills ONLY while crashed / pinned / boxed in (below 15% of the car's top speed)
      const vmax = (c.heavy ? 235 : 290) * (1 - 0.4 * c.dmg);
      pinned = Math.abs(c.v) < 0.15 * vmax && police.some(p => dist(p, c) < 64);
    } else {
      const p = this.player.ped, lp = this.lastPedPos || { x: p.x, y: p.y };
      const still = Math.hypot(p.x - lp.x, p.y - lp.y) < 0.6 * dt * 60 * 0.5;       // on foot: only while not moving
      this.lastPedPos = { x: p.x, y: p.y };
      pinned = still && (police.some(c => dist(c, p) < 46 && Math.abs(c.v) < 50) ||
               this.peds.some(o => o.mode === 'cop' && dist(o, p) < 14));
    }
    if (this.player.mode === 'air' || this.player.roof) pinned = false;   // unreachable: airborne, or up on the hospital roof
    // fill: 2.8 s standing in a cop's grip (car), 1.5 s on foot; drain at 3x the fill rate once you are moving
    this.bustT = pinned ? this.bustT + dt : Math.max(0, this.bustT - dt * 3);
    if (this.bustT > (this.player.mode === 'car' ? 2.8 : 1.5)) {
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
    if (P.mode === 'board') { P.mode = 'foot'; this.board.ridden = false; this.combo = null; }
    if (P.mode === 'water') {               // busted on the water: back on foot, the craft goes home to its mooring
      P.mode = 'foot';
      if (this.water.ride) {
        const cr = this.water.ride; cr.ridden = false;
        if (cr.home) { cr.x = cr.home.x; cr.y = cr.home.y; cr.h = cr.home.h; cr.vx = 0; cr.vy = 0; cr.farT = 0; }   // INSTANT-START: a bust never strands the craft mid-bay
        this.water.ride = null;
      }
      this.water.cop = null;
    }
    if (P.mode === 'air') { P.mode = 'foot'; P.ped.hidden = false; }
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
    p.holdPose = false;
    if (p.mode === 'down') {
      p.downT -= dt;
      const sx = p.x + p.vx * dt, sy = p.y + p.vy * dt;
      if (W.hitSolid(sx, sy, 2) || W.hitTrunk(sx, sy, 2)) { p.vx = p.vy = 0; } else { p.x = sx; p.y = sy; }
      p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt);
      p.spin = (p.spin || 0) + (Math.hypot(p.vx, p.vy) * 0.02) * dt;
      if (p.downT <= 0) { p.down = false; p.mode = 'flee'; p.fleeT = 3; p.from = { x: p.x - p.vx, y: p.y - p.vy }; }
      return;
    }
    // hit by a car?
    for (const c of this.cars) {
      if (Math.abs(c.v) < 8) continue;
      const lx = p.x - c.x, ly = p.y - c.y, ca = Math.cos(c.h), sa = Math.sin(c.h);
      const u = lx * ca + ly * sa, v = -lx * sa + ly * ca;
      if (Math.abs(u) < c.len / 2 + 4 && Math.abs(v) < c.wid / 2 + 4) {
        if (p.mode === 'cop' && c.driver !== 'player') continue;
        const side = Math.sign(v) || 1;
        if (Math.abs(c.v) < 45) {                         // a slow bumper: shoved aside, stumbling
          if (p.mode !== 'stumble' && this.time - (p.bumpT || -9) > 0.5) {
            this.stumble(p, -sa * side * 0.8 + ca * Math.sign(c.v) * 0.6, ca * side * 0.8 + sa * Math.sign(c.v) * 0.6, 58);
            if (c.driver === 'player') { c.v *= 0.8; this.ev('bump'); }
          }
          continue;
        }
        this.knockDown(p, ca * c.v * 0.7 - sa * side * 60, sa * c.v * 0.7 + ca * side * 60, 5);
        if (c.driver === 'player') c.v *= 0.88;           // the car sheds a little momentum
        this.ev('hit');
        if (c.driver === 'player' && (this.time - (this.lastHitStar || -9)) > 2.5) { this.addStars(1, 'hit'); this.lastHitStar = this.time; }
        for (const o of this.peds) if (o.mode === 'walk' && dist(o, p) < 160) { o.mode = 'flee'; o.fleeT = 3; o.from = { x: c.x, y: c.y }; }
        return;
      }
    }
    if (p.mode === 'stumble') {
      p.stT -= dt;
      this.walkMove(p, p.vx * dt, p.vy * dt);
      p.vx *= Math.pow(0.01, dt); p.vy *= Math.pow(0.01, dt);
      p.walk += 40 * dt; p.pose = [0, 1, 2, 1][Math.floor(p.walk / 4) % 4];
      if (p.stT <= 0) { p.mode = p.after; if (p.mode === 'flee') p.fleeT = Math.max(p.fleeT || 0, 2.2); }
      return;
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
      if (p.gawkT > 0) { p.gawkT -= dt; const t = this.player.ped; p.h = Math.atan2(t.y - p.y, t.x - p.x); p.pose = 1; return; }   // stopped to stare
      if (p.path.type === 'crowd') {
        // an event crowd (spotlight.js): stands at home on the verge, faces the action and
        // bounces — p.cheer (0..2, set by the event) is the bounce rate; shoved or scattered,
        // it walks back home. The pose is held against the shared tail below.
        if (p.mode === 'return') p.mode = 'walk';
        const t = this.focus();
        p.h = Math.atan2(t.y - p.y, t.x - p.x);
        const dx = p.path.x - p.x, dy = p.path.y - p.y;
        if (dx * dx + dy * dy > 49) { mx = dx; my = dy; sp = 52; }
        else { p.walk += (6 + (p.cheer || 0) * 15) * dt; p.pose = [0, 1, 2, 1][Math.floor(p.walk / 5) % 4]; p.holdPose = true; }
      } else if (p.path.type === 'loop') {
        if (p.mode === 'return') {
          p.path.s = W.loopNearest(p.x, p.y); p.mode = 'walk';
        }
        p.path.s += p.path.dir * p.speed * dt;
        const q = W.loopAt(p.path.s + p.path.dir * 8, p.path.off);
        mx = q.x - p.x; my = q.y - p.y;
      } else {
        if (p.path.type === 'pier') {
          // stroll to the end of the pier, look at the sea a while, stroll back to the promenade
          const PR = W.L.pier, q = p.path;
          p.mode = 'walk';
          if (q.wait > 0) { q.wait -= dt; p.h = q.dir > 0 ? Math.PI : 0; p.pose = 1; return; }
          mx = (q.dir > 0 ? PR.x + PR.w - 12 : PR.x - 60) - p.x; my = q.y - p.y;
          if (Math.abs(mx) < 4) { q.dir *= -1; q.wait = q.dir < 0 ? 4 : 1; }
        } else if (p.mode === 'return') { mx = p.path.x - p.x; my = 0; if (Math.abs(mx) < 3) p.mode = 'walk'; }
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
    } else if (!p.holdPose) p.pose = 1;
  }
}
