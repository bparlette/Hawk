// lf_valet.js — Easy win ported from Palm City (events.js VALET): PARK IT!
// Precision parking bays at Ledo Pizza, Weis Market (Whiskey Bottom), and Atholton HS parking lots.
// Score = base 500 * cleanliness * speed, with a 5x J-TURN bonus if you spun >= 120 deg into the bay!
const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export class ValetLots {
  constructor(W, roster) {
    const a = W.G.anchors || {};
    const ledo = a.ledo ? W.verts[a.ledo.v] : { x: 1450, y: 1340 };
    const meet = roster.meetup ? { x: roster.meetup.pos[0], y: roster.meetup.pos[1] } : { x: 5653, y: -19763 };
    // Bays positioned right in the real parking lots (heading aligned to lot axis)
    this.bays = [
      { id: 'ledo', name: 'LEDO LOT', x: ledo.x + 28, y: ledo.y - 12, h: 0, w: 54, d: 28, best: 0 },
      { id: 'weis', name: 'WEIS PARKING', x: 13840, y: 19680, h: Math.PI * 0.5, w: 54, d: 28, best: 0 },
      { id: 'atholton', name: 'ATHOLTON LOT', x: meet.x - 45, y: meet.y + 42, h: 0, w: 54, d: 28, best: 0 },
    ];
    this.active = null;   // { bay, t, startH, maxSpin, doneT, result }
    this.toast = null;
    this.total = 0;
  }

  attachPlaces(PL) {
    if (!PL || !PL.places) return;
    const weis = PL.places.find(p => p.id === 'weis' || /weis/i.test(p.name || ''));
    if (weis && weis.pos) {
      const b = this.bays.find(q => q.id === 'weis');
      if (b) { b.x = weis.pos[0] + 64; b.y = weis.pos[1] + 54; }
    }
  }

  step(sim, dt) {
    const P = sim.player; if (!P) return;
    if (this.toast && (this.toast.t -= dt) <= 0) this.toast = null;

    if (!this.active) {
      for (const b of this.bays) {
        if (b._cd > 0) { b._cd -= dt; continue; }
        if (Math.hypot(P.x - b.x, P.y - b.y) < 110 && Math.abs(P.v) > 35) {
          this.active = { bay: b, t: 0, lastH: P.h, spin: 0 };
          break;
        }
      }
      return;
    }

    const A = this.active, b = A.bay;
    A.t += dt;
    A.spin += Math.abs(wrap(P.h - A.lastH));
    A.lastH = P.h;

    const d = Math.hypot(P.x - b.x, P.y - b.y);
    if (d > 240 || A.t > 20) { this.active = null; return; }

    if (d < 22 && Math.abs(P.v) < 16) {
      const angErr = Math.min(Math.abs(wrap(P.h - b.h)), Math.abs(wrap(P.h - b.h + Math.PI)));
      const clean = Math.max(0.4, 1 - angErr / 0.8);
      const speedMult = Math.max(0.8, 2.2 - A.t * 0.12);
      const jTurn = A.spin >= 2.0 ? 5 : 1;
      const pts = Math.round(500 * clean * speedMult * jTurn);
      this.total += pts;
      b.best = Math.max(b.best, pts);
      b._cd = 6;
      this.toast = {
        text: `${b.name}: +${pts}${jTurn === 5 ? ' · J-TURN 5×!' : ' · PARKED!'}`,
        t: 3.2,
      };
      this.active = null;
    }
  }

  drawWorld(g, time) {
    const p = 0.55 + 0.45 * Math.sin(time * 4);
    for (const b of this.bays) {
      g.save(); g.translate(b.x, b.y); g.rotate(b.h);
      const isAct = this.active && this.active.bay === b;
      g.strokeStyle = isAct ? `rgba(110,226,255,${(0.65 + 0.35 * p).toFixed(2)})` : 'rgba(110,226,255,0.55)';
      g.lineWidth = isAct ? 3.5 : 2.2;
      g.strokeRect(-b.w / 2, -b.d / 2, b.w, b.d);
      g.fillStyle = isAct ? 'rgba(110,226,255,0.16)' : 'rgba(110,226,255,0.06)';
      g.fillRect(-b.w / 2, -b.d / 2, b.w, b.d);
      g.font = '800 9px system-ui'; g.textAlign = 'center'; g.fillStyle = '#6ee2ff';
      g.fillText('PARK IT', 0, -b.d / 2 - 6);
      g.restore();
    }
  }

  drawHud(ctx, vw) {
    if (!this.toast) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 13px system-ui';
    const w = ctx.measureText(this.toast.text).width + 30, x = vw / 2 - w / 2, y = 138;
    ctx.fillStyle = 'rgba(27,20,48,0.9)'; ctx.strokeStyle = '#6ee2ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, 26, 11); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6ee2ff'; ctx.fillText(this.toast.text, vw / 2, y + 17);
    ctx.restore();
  }
}
