// lf_copgame.js — KOSACK'S COP LIGHTS + THE FAKE-COP MINI GAME (owner, Nov 18).
//   Brian Kosack's Cavalier ALWAYS has cop lights flashing (roster fx 'cop_lights' — always on, day or night, whoever drives it).
//   The mini game: you are NOT a cop — just lights and a siren. Switch the siren on (V key / the SIREN button), pull in BEHIND another
//   car and stay close: if you hold it long enough the driver slows and pulls to the kerb, stops, and says "officer?" ... "wait. Kosack?"
//   No tickets, no authority. Score = cars pulled over. Targets: a few civilian traffic cars that spawn around you the first time the
//   siren goes on (lf_pilot's road driver at ~35 mph), and any CPU crew car that is out driving (the one world).
//
//   const CG = new CopGame();   CG.toggleSiren(S);   CG.step(S, dt);        // main.js frame loop (and tools/spec_copgame.mjs)
//   renderer.hooks.post.push(CG.drawPost);   CG.drawScreen(ctx, cam, vw, vh);   // lights over the grade, bubbles + HUD in screen space
// Siren sound is Palm City's own recipe (games/palm-city/src/audio.js: a triangle swept by a 0.9 Hz LFO through a band-pass), ported here
// because Palm City's Audio class is welded to its own sim; no audio context (node specs) = silent no-op.
import { Pilot } from './lf_pilot.js';
import { Barks } from './lf_barks.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const COP = { hold: 2.8, notice: 0.9, behindMin: 14, behindMax: 230, lat: 34, minV: 50, stopT: 8, stayT: 5.5, cool: 25, traffic: 5, cruise: 165, rangeSpawn: [650, 1500], rangeKill: 2800 };
export const hasCopLights = (S, c) => !!(S.fxBy && (S.fxBy[c.model] || []).includes('cop_lights'));

// ---- the siren (Palm City audio.js, ported) ----
class Siren {
  constructor() { this.ctx = null; this.g = null; this.on = false; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) return;
    const c = this.ctx = new AC(); if (c.state === 'suspended') c.resume();
    this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
    this.g = c.createGain(); this.g.gain.value = 0;
    const so = c.createOscillator(); so.type = 'triangle'; so.frequency.value = 760;
    const sl = c.createOscillator(); sl.frequency.value = 0.9; const slg = c.createGain(); slg.gain.value = 180;
    sl.connect(slg).connect(so.frequency); sl.start(); so.start();
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
    so.connect(bp).connect(this.g).connect(this.master);
  }
  set(on) { this.on = on; if (on) this.start(); if (this.ctx && this.g) this.g.gain.setTargetAtTime(on ? 0.09 : 0, this.ctx.currentTime, 0.12); }
}

export class CopGame {
  constructor() {
    this.siren = false; this.audio = new Siren(); this.barks = new Barks(); this.score = 0; this.toast = null; this.log = [];
    this.traffic = []; this.spawned = false; this.t = 0; this.chase = null; this.rnd = (() => { let s = 424242; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    this.drawPost = (g, S, cam, time, v) => this.post(g, S, cam, time, v);
  }
  eligible(S) { const P = S.player; return !!(P && hasCopLights(S, P)); }
  toggleSiren(S) { if (!this.eligible(S)) return false; this.siren = !this.siren; this.audio.set(this.siren); this.log.push({ t: this.t, ev: this.siren ? 'siren_on' : 'siren_off' }); return true; }

  // ---- traffic: civilians that wander the roads, so there is somebody to pull over ----
  spawnTraffic(S, n) {
    const W = S.W, P = S.player, models = ['cavalier_black', 'tracer_zack', 'astro_billy', 'cavalier_black', 'tracer_zack'].filter(m => S.fleet[m]);
    const cand = []; for (const [v] of W.adj) { const q = W.verts[v], d = Math.hypot(q.x - P.x, q.y - P.y); if (d > COP.rangeSpawn[0] && d < COP.rangeSpawn[1]) cand.push(v); }
    if (cand.length < n * 3) for (const [v] of W.adj) { const q = W.verts[v], d = Math.hypot(q.x - P.x, q.y - P.y); if (d > 300 && d <= COP.rangeSpawn[0] || (d >= COP.rangeSpawn[1] && d < 2400)) cand.push(v); }   // a thin neighbourhood: widen the ring
    for (let made = 0, guard = 0; made < n && cand.length && guard++ < 60;) {
      const i = made;
      const v = cand.splice(Math.floor(this.rnd() * cand.length), 1)[0], q = W.verts[v], e = (W.adj.get(v) || [])[0];
      const nb = e && W.verts[e[0]];
      let h = this.rnd() * TAU; if (nb) h = Math.atan2(nb.y - q.y, nb.x - q.x);
      if (S.cars.some(o => Math.hypot(o.x - q.x, o.y - q.y) < 90)) continue;
      this.addTraffic(S, models[i % models.length], q.x, q.y, h); made++;
    }
  }
  // one civilian driver on the roads (also how the screenshot + spec scripts put a car exactly where they want it)
  addTraffic(S, model, x, y, h) {
    const c = S.addCar(model, x, y, h, { traffic: true }); c.v = COP.cruise * 0.6;
    c.pilot = new Pilot({ player: c }, S.W, null); c.cruise = COP.cruise * (0.9 + this.rnd() * 0.2);
    c.driveFn = (car, dt) => this.drive(S, car, dt); this.traffic.push(c); return c;
  }
  newDest(S, c) {
    const W = S.W, vs = []; for (const [v] of W.adj) { const q = W.verts[v], d = Math.hypot(q.x - c.x, q.y - c.y); if (d > 500 && d < 2400) vs.push(v); }
    if (!vs.length) return; const q = W.verts[vs[Math.floor(this.rnd() * vs.length)]]; c.pilot.plan(q.x, q.y, false);
  }
  // a civilian driver: Pilot's route, a steady cruise, eases off behind any car ahead — and, when the cop game has it, pulls to the kerb
  drive(S, c, dt) {
    if (c.cop && c.cop.st !== 'notice') return this.pullOver(S, c, dt);
    if (!c.pilot.pts || (c.pilot.pts.length && Math.hypot(c.pilot.pts[c.pilot.pts.length - 1][0] - c.x, c.pilot.pts[c.pilot.pts.length - 1][1] - c.y) < 140)) this.newDest(S, c);
    if (!c.pilot.pts) return;
    const inp = c.pilot.steer(dt), ta = Math.atan2(inp.jy, inp.jx), diff = inp.jm > 0.15 ? wrap(ta - c.h) : 0;
    let want = c.cruise * (1 - Math.min(0.6, Math.abs(diff) / 2.2));
    let blocked = false;
    if (!(c.nudgeT > 0)) for (const o of S.cars) { if (o === c || o.layer !== c.layer || o.parked) continue; const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy); if (d < 120 && Math.abs(wrap(Math.atan2(dy, dx) - c.h)) < 0.45) { want = Math.min(want, Math.max(0, o.v - (d < 60 ? 40 : 0))); blocked = true; } }
    c.waitT = blocked && c.v < 4 ? (c.waitT || 0) + dt : 0;                // two cars waiting on each other: after 2 s one noses through anyway
    if (c.nudgeT > 0) c.nudgeT -= dt; else if (c.waitT > 2) { c.nudgeT = 2.5; c.waitT = 0; }
    S.driveCar(c, c.v < want - 6 ? 1 : c.v > want + 10 ? -0.6 : 0, clamp(diff * 2.4, -1, 1), dt, c.cruise * 1.1);
  }
  // THE PULL-OVER: slow, drift to the right-hand kerb, stop, wait a while, then carry on
  pullOver(S, c, dt) {
    const k = c.cop; k.t += dt;
    if (k.st === 'pull') {
      const r = S.W.roadInfo(c.x, c.y, c.layer || 0);
      let hx = Math.cos(c.h), hy = Math.sin(c.h), aimX = c.x + hx * 90, aimY = c.y + hy * 90, near = false;
      if (r.e) {                                           // the road's own direction (aligned with the way you're going), its right-hand side, the kerb-side lane line
        let dx = r.dx, dy = r.dy; if (dx * hx + dy * hy < 0) { dx = -dx; dy = -dy; }
        const rx = -dy, ry = dx, q = S.nearPt(c.x, c.y, r), lt = (c.x - q.x) * rx + (c.y - q.y) * ry, want = Math.max(10, r.hw - 15);
        aimX = q.x + rx * want + dx * 70; aimY = q.y + ry * want + dy * 70; k.lat = lt; k.want = want; near = Math.abs(lt - want) < 6;
      }
      const diff = wrap(Math.atan2(aimY - c.y, aimX - c.x) - c.h), vt = Math.max(near || k.t > 6 ? 0 : 26, k.v0 * (1 - k.t / 3.4));   // slow right down, but keep creeping until it is over at the kerb
      S.driveCar(c, c.v < vt - 6 ? 0.8 : c.v > vt + 8 ? -1 : 0, clamp(diff * 2.6, -1, 1), dt, (c.cruise || COP.cruise) * 1.1);
      if ((Math.abs(c.v) < 5 && k.t > 1.2) || k.t > COP.stopT) { k.st = 'stopped'; k.t = 0; c.v = 0; this.pulled(S, c); }
    } else {                                              // stopped at the kerb: hold the brake
      S.driveCar(c, c.v > 2 ? -1 : 0, 0, dt, 50); c.v *= 0.9;
      if (k.t > 2.0 && !k.said2) { k.said2 = true; this.barks.say(c, '...wait. KOSACK?!', { key: 'wait', cd: 0, urgent: true, ttl: 2.4 }); }
      if (k.t > COP.stayT) { c.copCool = COP.cool; c.cop = null; this.log.push({ t: this.t, ev: 'released', model: c.model }); }
    }
  }
  pulled(S, c) {
    this.score++; this.log.push({ t: this.t, ev: 'pulled_over', model: c.model, n: this.score, x: c.x, y: c.y });
    this.toast = { text: `PULLED OVER!  ${this.score} so far`, t: 3.2 };
    this.barks.say(c, 'OFFICER...?', { key: 'officer', cd: 0, urgent: true, ttl: 2.0 });
  }

  step(S, dt) {
    this.t += dt; this.barks.step(dt); if (this.toast && (this.toast.t -= dt) <= 0) this.toast = null;
    const P = S.player; if (!P) return;
    const live = this.eligible(S) && this.siren;
    if (live && !this.spawned) { this.spawned = true; this.spawnTraffic(S, COP.traffic); }
    if (this.spawned) {                                                    // keep the traffic around you: far ones are recycled near you
      for (const c of this.traffic) if (!c.cop && Math.hypot(c.x - P.x, c.y - P.y) > COP.rangeKill) { S.cars.splice(S.cars.indexOf(c), 1); c.gone = true; }
      const gone = this.traffic.filter(c => c.gone).length; this.traffic = this.traffic.filter(c => !c.gone); if (gone) this.spawnTraffic(S, gone);
    }
    // who is being chased: the cars with you BEHIND them, close, in their lane, going the same way, while the siren sounds
    const pdx = Math.cos(P.h), pdy = Math.sin(P.h); let best = null;
    for (const c of S.cars) {
      if (c === P || c.parked || c.wreck || c.remote || c.follower || c.layer !== P.layer || !c.driveFn) continue;
      if (c.copCool > 0) { c.copCool -= dt; }
      const k = c.cop;
      if (k && k.st !== 'notice') continue;                                // committed: it is pulling over / stopped
      const dx = P.x - c.x, dy = P.y - c.y, hx = Math.cos(c.h), hy = Math.sin(c.h), fwd = dx * hx + dy * hy, lat = Math.abs(-dx * hy + dy * hx);
      const on = live && !(c.copCool > 0) && fwd < -COP.behindMin && fwd > -COP.behindMax && lat < COP.lat && (hx * pdx + hy * pdy) > 0.6 && P.v > COP.minV && c.v > 20;
      c.copT = on ? (c.copT || 0) + dt : Math.max(0, (c.copT || 0) - dt * 1.5);
      if (on && c.copT > COP.notice && !k) { c.cop = { st: 'notice', t: 0 }; this.barks.say(c, 'HUH?', { key: 'huh', cd: 4, ttl: 1.2 }); this.log.push({ t: this.t, ev: 'notice', model: c.model }); }
      if (k && c.copT <= 0) c.cop = null;
      if (on && c.copT >= COP.hold) {
        if (!c.traffic && !c._d0) { c._d0 = c.driveFn; c.driveFn = (car, d) => car.cop && car.cop.st !== 'notice' ? this.pullOver(S, car, d) : car._d0(car, d); }   // a CPU crew car: its own driver, until it is pulled
        c.cop = { st: 'pull', t: 0, v0: Math.max(60, c.v) }; this.log.push({ t: this.t, ev: 'pull', model: c.model }); this.barks.say(c, '...OKAY, OKAY', { key: 'okay', cd: 0, urgent: true, ttl: 1.6 }); }
      if (on && (!best || c.copT > best.copT)) best = c;
    }
    this.chase = best ? { car: best, u: clamp(best.copT / COP.hold, 0, 1) } : null;
  }

  // ---- drawing ----
  // lights: the bar on the roof + the glow, AFTER the grade (so they blaze at night). R R B B double-flash like a real bar.
  post(g, S, cam, time, v) {
    const z = cam.zoom, N = v.tod > 0.5 ? 1 : 0.55 + v.tod * 0.6;
    for (const c of S.cars) {
      if (!hasCopLights(S, c)) continue;
      const sx = (c.x - cam.x) * z + v.vw / 2, sy = (c.y - cam.y) * z + v.vh / 2; if (sx < -120 || sx > v.vw + 120 || sy < -120 || sy > v.vh + 120) continue;
      const ph = Math.floor(time * 12) % 8, red = ph < 2 || ph === 4, blue = ph === 2 || ph === 3 || ph === 6 || ph === 7, ca = Math.cos(c.h), sa = Math.sin(c.h);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [on, side, col] of [[red, -1, '255,40,60'], [blue, 1, '70,120,255']]) {
        const ox = sx + (-sa * side * c.wid * 0.22 + ca * c.len * 0.02) * z, oy = sy + (ca * side * c.wid * 0.22 + sa * c.len * 0.02) * z, r = (on ? 92 : 26) * z * (0.8 + 0.3 * N);
        const gr = g.createRadialGradient(ox, oy, 1, ox, oy, r); gr.addColorStop(0, `rgba(${col},${(on ? 0.95 : 0.25) * N})`); gr.addColorStop(0.3, `rgba(${col},${(on ? 0.4 : 0.06) * N})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(ox, oy, r, 0, TAU); g.fill();
      }
      g.restore();
      g.save(); g.translate(sx, sy); g.rotate(c.h);                        // the light bar itself: a dark rail with a red and a blue lens
      const bl = c.wid * 0.62 * z, bw = c.len * 0.1 * z;
      g.fillStyle = '#1a1a22'; g.fillRect(-bw * 0.6, -bl, bw * 1.2, bl * 2);
      g.fillStyle = red ? '#ff4a5c' : '#6a1a24'; g.fillRect(-bw * 0.5, -bl * 0.95, bw, bl * 0.9);
      g.fillStyle = blue ? '#6fa0ff' : '#1a2a5a'; g.fillRect(-bw * 0.5, bl * 0.05, bw, bl * 0.9);
      g.restore();
    }
    const ch = this.chase;                                                   // the chase ring on whoever you're pulling: fills as you hold it
    if (ch && this.siren) {
      const c = ch.car, sx = (c.x - cam.x) * z + v.vw / 2, sy = (c.y - cam.y) * z + v.vh / 2;
      g.save(); g.lineWidth = 4; g.strokeStyle = 'rgba(20,10,30,0.55)'; g.beginPath(); g.arc(sx, sy, 28, 0, TAU); g.stroke();
      g.strokeStyle = ch.u > 0.85 ? '#ffd25c' : '#9fd0ff'; g.beginPath(); g.arc(sx, sy, 28, -Math.PI / 2, -Math.PI / 2 + TAU * ch.u); g.stroke(); g.restore();
    }
  }
  drawScreen(g, cam, vw, vh) { this.barks.drawScreen(g, cam, vw, vh); }
  // the SIREN button (above the crown, left of ACTION) + the score pill + the toast
  btn(vw, vh) { return { x: vw - 160, y: vh - 168, r: 30 }; }
  drawHud(g, S, vw, vh, time) {
    if (!this.eligible(S)) return;
    const b = this.btn(vw, vh); g.save();
    g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fillStyle = this.siren ? 'rgba(255,70,90,0.55)' : 'rgba(255,240,220,0.18)'; g.fill(); g.lineWidth = 3; g.strokeStyle = this.siren ? 'rgba(255,120,140,0.95)' : 'rgba(255,214,120,0.95)'; g.stroke();
    g.fillStyle = Math.floor(time * 6) % 2 ? '#ff5468' : '#6a9cff'; g.beginPath(); g.arc(b.x, b.y - 2, 9, Math.PI, 0); g.fill(); g.fillRect(b.x - 9, b.y - 2, 18, 6);   // a tiny beacon
    g.font = '800 12px system-ui'; g.textAlign = 'center'; g.fillStyle = '#ffe9c4'; g.fillText('SIREN', b.x, b.y - b.r - 8);
    if (this.siren || this.score) {
      g.textAlign = 'left'; g.font = '900 12px system-ui'; const t = `FAKE COP · ${this.score} PULLED OVER`, w = g.measureText(t).width + 22;
      g.fillStyle = 'rgba(27,20,48,0.72)'; g.beginPath(); g.roundRect(12, 104, w, 24, 11); g.fill(); g.fillStyle = '#ff8a98'; g.fillText(t, 23, 120);
    }
    if (this.toast) { g.textAlign = 'center'; g.font = '900 20px system-ui'; const w = g.measureText(this.toast.text).width + 28; g.fillStyle = 'rgba(27,20,48,0.74)'; g.beginPath(); g.roundRect(vw / 2 - w / 2, vh * 0.30 - 22, w, 34, 13); g.fill(); g.fillStyle = '#ffd25c'; g.fillText(this.toast.text, vw / 2, vh * 0.30 + 1); }
    g.restore();
  }
}
