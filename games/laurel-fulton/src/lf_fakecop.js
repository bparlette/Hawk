// lf_fakecop.js — M-B Kosack's Fake-Cop Pull-Over Minigame (per DESIGN-G17-FAKE-COP.md).
// Spawns ambient local traffic cars on layer-0 roads and lets Kosack's Cavalier (`cavalier_kosack`)
// run lights + siren (620-980 Hz WebAudio) to bluff drivers into pulling over. Zero wanted stars.
import { SirenBus, Civilians } from './lf_copgame.js';
const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

const KOSACK_LINES = [
  "Pull it over, buddy! ...Nah, I'm messing with ya!",
  "Step out the vehicle — wait, got any ones?",
  "Sir, you were doing forty in a Cavalier zone.",
  "Relax, I'm not a cop. Cool car though.",
  "Don't tell nobody, I'm late to Atholton anyway.",
];
const DRIVER_PULL_LINES = [
  "Wait... you're seventeen in a red Cavalier?!",
  "Man, I hid my stash for THAT?!",
  "Officer—hold up, I went to school with you!",
];
const DRIVER_PEEL_LINES = [
  "Bro, that's a RadioShack visor light! Later!",
  "Nice try, Kosack! See you at Ledo!",
];

export class FakeCop {
  constructor(sim, W) {
    this.sim = sim; this.W = W;
    this.traffic = []; this.score = 0; this.streak = 0; this.streakT = 0;
    this.sirenOn = false; this.sirenHold = 0; this.toast = null; this.barks = [];
    this.bus = new SirenBus(); this.civ = new Civilians();
    this.lock = null; this.stops = 0; this.bluffs = 0;
    this.models = Object.keys(sim.fleet).filter(k => !k.includes('lamar') && !k.includes('kosack'));
  }

  _audio(active, urgent) {   // L17: Palm City's own siren bus (lf_copgame.js SirenBus -> palm-city audio.js sirG), not a parallel oscillator
    const P = this.sim.player; if (!P) return;
    for (const c of this.sim.cars) if (c.fcSiren) c.fcSiren = false;
    if (active) P.fcSiren = true;
    this.bus.update(this.sim.cars, P, urgent);
  }

  // DESIGN-G17 §3: the WOOP-WOOP blip — two 110 ms upward chirps (620 -> 980 Hz sawtooth
  // through an 1100 Hz bandpass). §4 gives the peel-off driver a laugh-off cue as he goes;
  // the shipped game had no peel-off sound at all (Nov 18 audit), so he gets the blip.
  // Rides the siren bus's own context (started by the siren during the pull-over); if the
  // bus has no context yet (or in node specs) it stays silent rather than spinning another.
  _woop() {
    const A = this.bus && this.bus.a, ctx = A && A.ctx;
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const t0 = ctx.currentTime;
      for (const off of [0, 0.17]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(620, t0 + off);
        o.frequency.exponentialRampToValueAtTime(980, t0 + off + 0.11);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.1;
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(0.0001, t0 + off);
        gn.gain.exponentialRampToValueAtTime(0.05, t0 + off + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.13);
        o.connect(bp); bp.connect(gn); gn.connect(ctx.destination);
        o.start(t0 + off); o.stop(t0 + off + 0.14);
      }
    } catch (e) {}
  }

  triggerSiren(on) {
    this.sirenOn = !!on;
    if (!on) this._audio(false, false);
  }

  _spawnTraffic() {   // L17: real civilian drivers (lf_copgame.js Civilians) on the street graph — the old spawner read fields GraphWorld does not have and made nothing
    const tc = this.civ.spawn(this.sim, this.models, { fcState: 'NONE', fcT: 0, fcCd: 0, fcSmoke: 0 });
    if (!tc) return;
    tc.driveFn = (c, dt) => this._driveTraffic(c, dt);
    this.traffic.push(tc);
  }

  _driveTraffic(c, dt) {
    if (c.fcCd > 0) c.fcCd = Math.max(0, c.fcCd - dt);
    if (c.fcState === 'PULL_OVER') {
      c.fcT -= dt;
      const r = this.W.roadInfo(c.x, c.y, 0);
      const kerbSteer = r.e ? Math.max(-0.6, Math.min(0.6, ((r.hw - 8) - r.d) * 0.04)) : 0;
      this.sim.driveCar(c, c.v > 4 ? -1 : 0, c.v > 8 ? kerbSteer : 0, dt, 160);
      if (c.fcT <= 0) { c.fcState = 'NONE'; c.fcCd = 25; if (this.lock === c) this.lock = null; }
      return;
    }
    if (c.fcState === 'PEEL_OFF') {
      c.fcT -= dt;
      const r = this.W.roadInfo(c.x, c.y, 0), ta = r.e ? Math.atan2(r.dy, r.dx) : c.h;
      const d1 = wrap(ta - c.h), d2 = wrap(ta + Math.PI - c.h);
      const steer = Math.max(-1, Math.min(1, (Math.abs(d1) < Math.abs(d2) ? d1 : d2) * 2.2));
      this.sim.driveCar(c, 1, steer, dt, 263);   // DESIGN-G17 §4: peel-off caps at 1.35x the 195 traffic cruise = 263 (shipped 310 = 1.59x — Nov 18 audit)
      if (c.fcT <= 0) { c.fcState = 'NONE'; c.fcCd = 25; if (this.lock === c) this.lock = null; }
      return;
    }
    this.civ.drive(this.sim, c, dt, c.fcState === 'HESITATE' ? 115 : 0, c.fcState === 'HESITATE' ? Math.sin(this.sim.time * 9) * 0.25 : 0);
  }

  _bark(car, text, dur = 2.6, delay = 0) {
    this.barks.push({ car, text, t: dur, delay });
    if (this.barks.length > 6) this.barks.shift();
  }

  step(dt, sirenPressed) {
    const P = this.sim.player; if (!P) return;
    // Prune far traffic, keep ~5-6 nearby cars on the roads
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const c = this.traffic[i];
      if (Math.hypot(c.x - P.x, c.y - P.y) > 1250 || c.wreck) {
        const si = this.sim.cars.indexOf(c); if (si >= 0) this.sim.cars.splice(si, 1);
        if (this.lock === c) this.lock = null;   // L17: a peeling-off target pruned far away used to leave the lock dangling for good (no more pull-overs)
        this.traffic.splice(i, 1);
      }
    }
    if (this.traffic.length < 6) this._spawnTraffic();
    if (this.streakT > 0) { this.streakT -= dt; if (this.streakT <= 0) this.streak = 0; }
    if (this.toast && (this.toast.t -= dt) <= 0) this.toast = null;
    for (let i = this.barks.length - 1; i >= 0; i--) {
      const b = this.barks[i];
      if (b.delay > 0) { b.delay -= dt; continue; }
      if ((b.t -= dt) <= 0) this.barks.splice(i, 1);
    }

    const isKosack = P.model === 'cavalier_kosack' && !P.wreck;
    if (!isKosack) { this._audio(false, false); this.lock = null; return; }
    const active = !!sirenPressed || this.sirenOn || (this.lock && this.lock.fcState === 'HESITATE');
    this._audio(active, !!(this.lock && this.lock.fcState === 'HESITATE'));

    // Find/update target ahead within 140 wu & +/-28 deg
    if (!this.lock || this.lock.fcState === 'NONE') {
      if (active) {
        let best = null, bd = 140;
        for (const c of this.sim.cars) {
          if (c === P || c.player || c.fcCd > 0 || c.parked || c.van) continue;
          const dx = c.x - P.x, dy = c.y - P.y, d = Math.hypot(dx, dy);
          if (d > bd || Math.abs(wrap(Math.atan2(dy, dx) - P.h)) > 0.49) continue;
          bd = d; best = c;
        }
        if (best) { this.lock = best; best.fcState = 'HESITATE'; best.fcT = 0; }
      }
    } else if (this.lock.fcState === 'HESITATE') {
      const t = this.lock, d = Math.hypot(t.x - P.x, t.y - P.y);
      if (d > 185) { t.fcState = 'NONE'; this.lock = null; }
      else {
        t.fcT += dt;
        if (t.fcT >= 1.4) {
          const pull = ((Math.floor(t.x + t.y) % 10 + 10) % 10) < 7;   // 70% pull over, 30% peel off
          if (pull) {
            t.fcState = 'PULL_OVER'; t.fcT = 5.0; this.stops++;
            this.streak = Math.min(4, this.streak + 1); this.streakT = 18;
            const pts = 250 * this.streak; this.score += pts;
            this.toast = { text: `+${pts} FAKE STOP${this.streak > 1 ? ` · STREAK ×${this.streak}` : ''}`, t: 2.8 };
            this._bark(P, KOSACK_LINES[this.stops % KOSACK_LINES.length], 2.4, 0);
            this._bark(t, DRIVER_PULL_LINES[this.stops % DRIVER_PULL_LINES.length], 2.6, 1.5);
          } else {
            t.fcState = 'PEEL_OFF'; t.fcT = 3.5; this.bluffs++; this.streak = 0; this._woop();   // DESIGN-G17 §3/§4: WOOP-WOOP as he peels off
            this.score += 100;
            this.toast = { text: `+100 BUSTED BLUFF`, t: 2.4 };
            this._bark(t, DRIVER_PEEL_LINES[this.bluffs % DRIVER_PEEL_LINES.length], 2.5, 0);
          }
        }
      }
    }
  }

  drawWorld(g, time) {
    const t = this.lock;
    if (t && t.fcState === 'HESITATE') {
      const u = Math.min(1, t.fcT / 1.4);
      g.save(); g.lineWidth = 4; g.setLineDash([8, 6]);
      g.strokeStyle = Math.floor(time * 6.4) % 2 ? '#ff2e38' : '#3882ff';
      g.beginPath(); g.arc(t.x, t.y, 34, -Math.PI / 2, -Math.PI / 2 + TAU * u); g.stroke();
      g.restore();
    }
    for (const c of this.traffic) {
      if (c.fcState === 'PULL_OVER' && Math.floor(time * 4) % 2 === 0) {
        const fx = Math.cos(c.h), fy = Math.sin(c.h), px = -fy, py = fx;
        g.fillStyle = '#ffb830';
        g.beginPath(); g.arc(c.x - fx * 20 + px * 8, c.y - fy * 20 + py * 8, 3.5, 0, TAU); g.fill();
        g.beginPath(); g.arc(c.x - fx * 20 - px * 8, c.y - fy * 20 - py * 8, 3.5, 0, TAU); g.fill();
      }
    }
    g.font = '800 10px system-ui'; g.textAlign = 'center';
    for (const b of this.barks) {
      if (b.delay > 0) continue;
      const a = Math.min(1, b.t * 2), w = g.measureText(b.text).width + 16, bx = b.car.x, by = b.car.y - 34;
      g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(255,241,216,0.95)'; g.strokeStyle = '#210f2e'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(bx - w / 2, by - 11, w, 20, 8); g.fill(); g.stroke();
      g.fillStyle = '#210f2e'; g.fillText(b.text, bx, by + 3); g.restore();
    }
  }

  drawHud(ctx, vw) {
    if (!this.toast) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 13px system-ui';
    const w = ctx.measureText(this.toast.text).width + 38, x = vw / 2 - w / 2, y = 104;
    ctx.fillStyle = 'rgba(27,20,48,0.9)'; ctx.strokeStyle = '#210f2e'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, 28, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff2e38'; ctx.fillRect(x + 6, y + 6, 5, 16);
    ctx.fillStyle = '#3882ff'; ctx.fillRect(x + w - 11, y + 6, 5, 16);
    ctx.fillStyle = '#ffd25c'; ctx.fillText(this.toast.text, vw / 2, y + 18);
    ctx.restore();
  }
}
