// lf_cops.js — task L15: COPS / WANTED v1 on the road graph. Logic + HUD + siren + light bar; main.js steps it once per sim tick.
//
//   const C = new Cops(sim, W, traffic, { seed })   C.step(dt, { inCar })   C.level (0..3)   C.chasers   C.busted   C.hold
//   C.drawHud(ctx, vw, vh)     drawLightBar(g, car, t) + drawSirenGlow(g, car, t)  (lf_render.js)     C.voice  (WebAudio siren)
//
// OFFENSES raise the level (never above MAX_STARS = 3): SPEEDING past the posted limit in a cop's sight, a hard hit on another car,
// WRECKING another car, a hard crash into a house or guardrail where a cop can see it. COP CARS spawn out of sight and chase on the road
// graph; losing them (out of sight AND away) for COOL_TIME walks the level down; sitting pinned with a cop on you for BUST_TIME is
// BUSTED: a short beat, no lasting penalty (no money system exists) — the pursuit stops and the level clears.
//
// REUSE FROM PALM CITY (games/palm-city/src), adapted — its numbers do NOT transfer, every one here is a named constant:
//   * sim.js stepWanted / stepPolice / addStars — the shape of the system: stars, a patrol car close by that JOINS the chase, cops
//     spawning far from the player and arriving, a line-of-sight test (8 samples), "near = a cop within range keeps the heat on, else
//     lostT counts up and a star drops", the bust meter that fills only while PINNED (slow + a cop close) and drains 3x when moving,
//     the stand-down (siren off, cop goes back to ordinary driving). Palm City runs this on its loop; here the cops follow
//     lf_pilot.roadPath on the road graph through traffic.follow (lf_traffic.js), and close in straight (stepPolice's d < 420 branch).
//   * audio.js — the SIREN: a triangle at 760 Hz swept +-180 Hz by a 0.9 Hz LFO through a 900 Hz band-pass, gain 0.05 x (1 - d/1300).
//   * render.js drawSiren — the light-bar flash: alternating red (255,40,60) / blue (60,110,255) at 6 Hz, radial pools of 70 units.
//   * hud.js — the five-star wanted row (same star shape and colours, flashing while the siren runs), the big red BUSTED message.
// Palm City-only rules are NOT carried over: the 3x driven-car damage and "cops stand down on TAXI/TOW/BUS" (there are no jobs here).
import { roadPath } from './lf_pilot.js';
import { dense, limitMph, MPH } from './lf_traffic.js';

export const MAX_STARS = 3;                           // wanted level 1..3
export const SPEED_OVER_MPH = 12;                     // over the posted limit by this much ...
export const SPEED_TIME = 1.0;                        // ... for this long (s) in a cop's sight = SPEEDING
export const COP_SIGHT_R = 800;                       // a cop sees you (line of sight) within this
export const HIT_APPROACH = 90;                       // u/s closing speed of a hit on another car that counts as an offense
export const HIT_WRECK_STARS = 2;                     // wrecking another car: level at least this
export const CRASH_V = 140;                           // u/s into a house / rail, in a cop's sight
export const OFFENSE_GAP = 3;                         // s between level rises (one crash is one offense)
export const COPS_PER_LEVEL = [0, 1, 2, 3];           // pursuit cars per level
export const COP_SPAWN_MIN = 1000, COP_SPAWN_MAX = 1800;   // spawn ring, out of sight (the screen's half-height is ~700)
export const COP_SPAWN_GAP = 3;                       // s between spawns while the pursuit is short of cars
export const COP_SPEED = 245;                         // u/s cruising in pursuit (~55 mph); +COP_SPEED_STAR per level
export const COP_SPEED_STAR = 10;
export const CHASE_REPLAN = 1.8;                      // s between road re-routes
export const CHASE_DIRECT = 380;                      // within this and in sight: aim straight at you (Palm City stepPolice d < 420)
export const CHASE_HOLD = 80;                         // closer than this and you are slow: the cop stops beside you
export const PATROL_JOIN = 900;                       // a patrol cruiser this close joins the pursuit the moment you are wanted
export const PATROL_GAP = [40, 80];                   // s between patrol spawns (one cruiser at a time)
export const PATROL_MAX = 1;
export const COOL_NEAR = 450, COOL_SIGHT = 900;       // a chaser inside COOL_NEAR, or in sight inside COOL_SIGHT, keeps the heat on
export const COOL_TIME = 11;                          // s unseen and away: the level drops by one
export const BUST_SPEED = 45, BUST_R = 105, BUST_TIME = 2.5;   // pinned = slower than this with a chaser inside BUST_R; fills BUST_TIME, drains 3x
export const BUST_HOLD = 2.6;                         // s of the BUSTED beat (your input is held), then control comes back
export const STUCK_UNSTICK = 3.5;                     // s a chaser sits still before sim.unstick lifts it back onto the road
export const GLOW_R = 95;                              // siren pool radius (Palm City draws 70 on its light layer; this one is drawn pre-grade, so a little wider)
export const STAR_R = 11, STAR_GAP = 26;              // the HUD stars

const TAU = Math.PI * 2, wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const rngOf = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---- the light bar + siren glow (Palm City render.js drawSiren, ported: same phase, colours and 70-unit pools) ----
export function drawSirenGlow(g, c, time) {
  const ph = Math.floor(time * 6) % 2, col = ph ? 'rgba(255,40,60,1)' : 'rgba(60,110,255,1)', mid = ph ? 'rgba(255,40,60,0.35)' : 'rgba(60,110,255,0.35)';
  const ox = Math.cos(c.h + Math.PI / 2) * (ph ? -4 : 4), oy = Math.sin(c.h + Math.PI / 2) * (ph ? -4 : 4);
  const rg = g.createRadialGradient(c.x + ox, c.y + oy, 1, c.x + ox, c.y + oy, GLOW_R);
  rg.addColorStop(0, col); rg.addColorStop(0.25, mid); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.9; g.fillStyle = rg; g.fillRect(c.x - GLOW_R, c.y - GLOW_R, GLOW_R * 2, GLOW_R * 2); g.restore();
}
export function drawLightBar(g, c, time) {            // the roof bar on top of the cruiser sprite: two lamps, one lit at a time
  const ph = Math.floor(time * 6) % 2, L = c.len || 48, Wd = c.wid || 20;
  g.save(); g.translate(c.x + Math.cos(c.h) * L * 0.04, c.y + Math.sin(c.h) * L * 0.04); g.rotate(c.h);
  g.fillStyle = '#16121c'; g.fillRect(-3.2, -Wd * 0.46, 6.4, Wd * 0.92);
  g.fillStyle = ph ? '#ff2a3c' : '#6a1018'; g.fillRect(-2.8, -Wd * 0.44, 5.6, Wd * 0.44);
  g.fillStyle = ph ? '#101a50' : '#3a7aff'; g.fillRect(-2.8, 0, 5.6, Wd * 0.44);
  g.restore();
}
// Palm City hud.js star(): same shape and colours
function star(g, x, y, r, fill) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = fill ? '#ffd45c' : 'rgba(30,20,50,0.35)'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = fill ? '#7a3a1a' : 'rgba(255,240,220,0.35)'; g.stroke();
}
// Palm City audio.js siren: triangle 760 Hz swept +-180 Hz by a 0.9 Hz LFO, band-passed at 900 Hz. Started lazily (iOS: after a touch).
export class SirenVoice {
  constructor() { this.ctx = null; this.on = false; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) return;
    try {
      const c = this.ctx = new AC(); if (c.state === 'suspended') c.resume();
      this.g = c.createGain(); this.g.gain.value = 0; const so = c.createOscillator(); so.type = 'triangle'; so.frequency.value = 760;
      const sl = c.createOscillator(); sl.frequency.value = 0.9; const slg = c.createGain(); slg.gain.value = 180; sl.connect(slg).connect(so.frequency); sl.start(); so.start();
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7; so.connect(bp).connect(this.g).connect(c.destination); this.on = true;
    } catch (e) { this.ctx = null; }
  }
  update(near) { if (!this.on) return; this.g.gain.setTargetAtTime(near < 1200 ? 0.05 * (1 - near / 1300) : 0, this.ctx.currentTime, 0.2); }   // Palm City's falloff
  stop() { if (this.on) this.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); }
}

export class Cops {
  constructor(S, W, T, opts = {}) {
    this.S = S; this.W = W; this.T = T; this.opts = { noPatrol: false, noSpawn: false, ...opts }; this.rnd = rngOf(opts.seed || 4242);
    this.level = 0; this.chasers = []; this.log = []; this.msg = null; this.busted = null; this.hold = false;
    this.stats = { spawns: [], busts: 0 }; this.lostT = 0; this.bustT = 0; this.speedT = 0; this.lastOffense = -99; this.nextCop = 0; this.nextPatrol = 25 + this.rnd() * 30;
    this.evi = S.events.length; this.hitSeen = new Map(); this.voice = new SirenVoice(); this.t = 0; this.sightT = 0; this.lastSight = false;
  }
  get patrols() { return this.T.cars.filter(c => c.kind === 'patrol'); }
  say(text, t = 2.2) { this.msg = { text, t, dur: t }; }

  // line of sight between two points: 8 samples, blocked by a house footprint (Palm City stepPolice's 8-sample test)
  los(a, b) {
    for (let i = 1; i < 8; i++) { const x = a.x + (b.x - a.x) * i / 8, y = a.y + (b.y - a.y) * i / 8; if (this.S.nearBuilding(x, y, -3)) return false; }
    return true;
  }
  sees(cop, P) { return dist(cop, P) < COP_SIGHT_R && this.los(cop, P); }

  // ---- the level ----
  offense(kind, stars = 1) {
    const S = this.S; if (this.busted) return;
    if (kind !== 'wreck' && S.time - this.lastOffense < OFFENSE_GAP && this.level > 0) return;
    const before = this.level; this.level = Math.min(MAX_STARS, Math.max(this.level + stars, kind === 'wreck' ? HIT_WRECK_STARS : 0));
    this.lastOffense = S.time; this.lostT = 0; this.log.push({ t: S.time, kind, level: this.level });
    if (this.level > before) this.say(kind === 'speeding' ? 'SPEEDING!' : kind === 'wreck' ? 'WRECKED A CAR!' : kind === 'collision' ? 'HIT AND RUN!' : 'WANTED', 1.8);
  }
  spawnPatrol(x, y, h) {                                 // a cruiser placed by hand (tests / scripted scenes)
    const c = this.T.spawnAt(x, y, h, { model: this.model(), kind: 'patrol' }); this.decorate(c); return c;
  }
  model() { return this.S.fleet.cavalier_black ? 'cavalier_black' : Object.keys(this.S.fleet)[0]; }   // the black Cavalier body: no new bake; the light bar makes it a cruiser
  decorate(c) { c.cop = true; c.copMode = 'patrol'; c.siren = false; return c; }

  // ---- per tick ----
  step(dt, play = {}) {
    const S = this.S, P = S.player; this.t += dt; if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
    if (!P) return;
    const inCar = play.inCar !== false;
    for (let i = this.chasers.length - 1; i >= 0; i--) if (S.cars.indexOf(this.chasers[i]) < 0) this.chasers.splice(i, 1);
    // BUSTED beat
    if (this.busted) { this.busted.t += dt; P.v *= Math.pow(0.02, dt); if (this.busted.t > BUST_HOLD) { this.busted = null; this.hold = false; } this.voiceStep(P); return; }
    // patrol cruiser: one at a time, out of sight, drives the roads like traffic; the officer who sees you speed
    if (!this.opts.noPatrol && this.level === 0 && this.patrols.length < PATROL_MAX && this.T.t >= this.nextPatrol && !this.T.quiet) {
      this.nextPatrol = this.T.t + PATROL_GAP[0] + this.rnd() * (PATROL_GAP[1] - PATROL_GAP[0]);
      const c = this.T.spawn('patrol', this.model()); if (c) this.decorate(c);
    }
    if (inCar) this.watch(dt, P);
    this.pursue(dt, P);
    this.cool(dt, P);
    if (inCar) this.bust(dt, P);
    this.voiceStep(P);
  }

  // what the player does that a cop would care about
  watch(dt, P) {
    const S = this.S, cops = [...this.patrols, ...this.chasers];
    // SPEEDING, in a cop's sight (only the first star: a speeder is stopped, a wrecker is hunted)
    const r = this.W.roadInfo(P.x, P.y, P.layer), mph = Math.abs(P.v) / MPH, limit = r.e && r.d < r.hw + 20 ? limitMph(r.e) : 99;
    const seen = P.z === 0 && cops.some(c => this.sees(c, P));
    if (mph > limit + SPEED_OVER_MPH && seen && this.level < 1) this.speedT += dt; else this.speedT = Math.max(0, this.speedT - dt * 2);
    if (this.speedT > SPEED_TIME) { this.speedT = 0; this.offense('speeding', 1); }
    // hard hits on other cars: any ambient car dented/wrecked right next to you
    for (const c of this.T.ambient) {
      const prev = this.hitSeen.get(c) || { t: -9, wreck: false };
      if (c.hitT <= prev.t) continue;
      this.hitSeen.set(c, { t: c.hitT, wreck: c.wreck });
      if (Math.abs(P.v) < 40 && !c.wreck || dist(c, P) > (c.len + P.len) / 2 + 30) continue;     // it was not you
      if (c.wreck && !prev.wreck) this.offense('wreck', 1); else this.offense('collision', 1);
    }
    if (this.hitSeen.size > 40) for (const k of this.hitSeen.keys()) if (S.cars.indexOf(k) < 0) this.hitSeen.delete(k);
    // a hard crash into a house or guardrail where a cop can see it
    for (; this.evi < S.events.length; this.evi++) {
      const e = S.events[this.evi];
      if ((e.kind === 'house' || e.kind === 'rail') && e.v >= CRASH_V && cops.some(c => this.sees(c, P)) && S.time - e.t < 1) this.offense('crash', 1);
    }
  }

  // the pursuit: spawn out of sight, join, drive, stand down
  pursue(dt, P) {
    const S = this.S, T = this.T, want = COPS_PER_LEVEL[this.level];
    if (this.level > 0) {
      for (const c of this.patrols.slice()) if (this.chasers.length < want && dist(c, P) < PATROL_JOIN) this.recruit(c);      // a cruiser close by joins the chase
      if (this.chasers.length < want && !this.opts.noSpawn && (this.nextCop -= dt) <= 0) {
        this.nextCop = COP_SPAWN_GAP; const q = T.pickVertex(P, COP_SPAWN_MIN, COP_SPAWN_MAX);
        if (q) {
          const path = T.route(q.x, q.y, P.x, P.y);
          if (path && path.length > 8) {
            let k = 1; while (k < path.length - 1 && Math.hypot(path[k][0] - path[0][0], path[k][1] - path[0][1]) < 24) k++;
            const c = S.addCar(this.model(), q.x, q.y, Math.atan2(path[k][1] - path[0][1], path[k][0] - path[0][0]), { kind: 'chaser' });
            this.decorate(c); c.v = 90; c.tr = { pts: path, pi: 0, replanT: 0, stuckT: 0, los: false, losT: 0 }; this.stats.spawns.push({ t: S.time, d: dist(c, P) });
            this.makeChaser(c);
          }
        }
      }
    }
    while (this.chasers.length > want) this.standDown(this.chasers[this.chasers.length - 1]);          // the level fell: the extra cars go home
  }
  recruit(c) { this.T.forget(c); c.tr = { pts: null, pi: 0, replanT: 0, stuckT: 0, los: false, losT: 0 }; this.makeChaser(c); }
  makeChaser(c) { c.cop = true; c.copMode = 'chase'; c.kind = 'chaser'; c.ambient = false; c.siren = true; c.driveFn = (car, dt) => this.chase(car, dt); this.chasers.push(c); }
  standDown(c) {                                          // siren off, back to ordinary driving (Palm City: driver 'police' -> 'ai')
    const i = this.chasers.indexOf(c); if (i >= 0) this.chasers.splice(i, 1);
    c.siren = false; c.copMode = 'patrol'; c.kind = 'patrol'; c.driveFn = (car, dt) => this.T.drive(car, dt); c.tr = { pts: null, pi: 0, goal: null, stuckT: 0, offT: 0, yieldT: 0, wedgeT: 0 };
    this.T.cars.push(c); c.cruise = 150;
  }
  chase(c, dt) {
    const S = this.S, T = this.T, P = S.player, st = c.tr; if (!P || c.wreck) return;
    const d = dist(c, P); st.losT -= dt;
    if (st.losT <= 0) { st.losT = 0.25; st.los = this.los(c, P); }
    let cruise = COP_SPEED + COP_SPEED_STAR * this.level, brake = false;
    if (st.los && d < CHASE_DIRECT) {                    // close and in sight: straight at you, a little ahead of you (Palm City stepPolice)
      const lead = P.v * 0.4, tx = P.x + Math.cos(P.h) * lead, ty = P.y + Math.sin(P.h) * lead;
      st.pts = [[c.x, c.y], [tx, ty]]; st.pi = 0; st.replanT = 0;
      if (d < 220) cruise = Math.max(35, Math.abs(P.v) * 1.1 + (d - 90) * 1.4);
      if (d < CHASE_HOLD && Math.abs(P.v) < BUST_SPEED * 1.4) brake = true;
    } else if ((st.replanT -= dt) <= 0 || !st.pts || st.pts.length < 3) {
      st.replanT = CHASE_REPLAN * (0.8 + this.rnd() * 0.4); st.pts = dense(roadPath(this.W, S, c.x, c.y, P.x, P.y)); st.pi = 0;
    }
    const want = T.follow(c, st, dt, cruise, brake);
    st.stuckT = want > 30 && Math.abs(c.v) < 8 ? st.stuckT + dt : 0;
    if (st.stuckT > STUCK_UNSTICK) { S.unstick(c); st.stuckT = 0; st.replanT = 0; T.stats.unsticks++; }
  }

  // cooling: out of sight AND away from every chaser for COOL_TIME -> a star drops
  cool(dt, P) {
    if (this.level === 0) { this.lostT = 0; return; }
    const keeps = this.chasers.some(c => { const d = dist(c, P); return d < COOL_NEAR || (d < COOL_SIGHT && this.los(c, P)); });
    if (keeps) this.lostT = 0; else this.lostT += dt;
    if (this.lostT > COOL_TIME) { this.lostT = 0; this.level--; this.lastOffense = this.S.time; this.say(this.level ? 'LEVEL DOWN' : 'LOST THEM', 2.4); if (this.level === 0) for (const c of this.chasers.slice()) this.standDown(c); }
  }

  // busted: only while PINNED — slow, a chaser right on you — for BUST_TIME; drains 3x while you move (Palm City's 7C rule)
  bust(dt, P) {
    if (this.level === 0 || P.z > 0) { this.bustT = 0; return; }
    const pinned = Math.abs(P.v) < BUST_SPEED && this.chasers.some(c => dist(c, P) < BUST_R);
    this.bustT = pinned ? this.bustT + dt : Math.max(0, this.bustT - dt * 3);
    if (this.bustT > BUST_TIME) {
      this.bustT = 0; this.busted = { t: 0 }; this.hold = true; this.stats.busts++; this.log.push({ t: this.S.time, kind: 'busted', level: this.level });
      this.level = 0; this.lostT = 0; this.say('BUSTED', BUST_HOLD + 0.4); this.speedT = 0;
      for (const c of this.chasers.slice()) this.standDown(c);                                          // the pursuit stops: no penalty, the cops drive off
    }
  }

  // ---- the siren (Palm City's falloff on the nearest siren) ----
  voiceStep(P) {
    let near = 1e9; for (const c of this.chasers) near = Math.min(near, dist(c, P));
    if (this.chasers.length && !this.voice.ctx) this.voice.start();
    this.voice.update(near);
  }

  // ---- HUD: icons only. The stars sit under the MAP pill, top right; a banner for BUSTED / LOST THEM. ----
  hudBox(vw = 420) { const n = MAX_STARS; return { x: vw - 14 - n * STAR_GAP, y: 45, w: n * STAR_GAP, h: STAR_R * 2 + 6 }; }
  drawHud(g, vw = 420, vh = 860) {
    const t = performance.now ? performance.now() / 1000 : this.t, b = this.hudBox(vw);
    if (this.level > 0 || this.busted) {
      const flash = this.chasers.length && Math.floor(t * 3) % 2 === 0;
      g.save(); g.fillStyle = 'rgba(27,20,48,0.55)'; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 11); g.fill();
      for (let i = 0; i < MAX_STARS; i++) star(g, b.x + STAR_GAP / 2 + i * STAR_GAP, b.y + b.h / 2, (i < this.level && flash) ? STAR_R + 1.5 : STAR_R, i < this.level);
      g.restore();
    }
    if (this.msg) {                                        // Palm City hud.js: big red BUSTED, otherwise the quiet message pill
      const m = this.msg, big = m.text === 'BUSTED', a = Math.max(0, Math.min(1, m.t / 0.4, (m.dur - m.t) / 0.15 + 0.2));
      g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.font = `900 ${big ? 54 : 22}px system-ui`; g.lineJoin = 'round';
      const y = big ? vh * 0.4 : vh * 0.3; g.lineWidth = big ? 9 : 5; g.strokeStyle = big ? 'rgba(40,0,20,0.75)' : 'rgba(40,20,60,0.6)'; g.strokeText(m.text, vw / 2, y);
      g.fillStyle = big ? '#ff4a5c' : '#ffe9b0'; g.fillText(m.text, vw / 2, y); g.restore();
    }
  }
}
