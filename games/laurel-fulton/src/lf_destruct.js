// lf_destruct.js — Easy win ported from Palm City (destruct.js): curbside breakable props + combo.
// Deterministic hash-scattered mailboxes, cones, trash cans & hydrants along roads; smashing them
// triggers flying debris, brief hit-stop punch, and a combo streak without cluttering memory.
const TAU = Math.PI * 2;
const KINDS = ['mailbox', 'cone', 'trash', 'hydrant'];
const COL = { mailbox: '#3a78c8', cone: '#ff7a2e', trash: '#7c8694', hydrant: '#e03e3e' };

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export class CurbDestruct {
  constructor(W) {
    this.W = W;
    this.broken = new Map();   // id -> respawnAt sim.time
    this.debris = [];
    this.combo = 0; this.comboT = 0; this.score = 0;
    this.toast = null;
    this._seen = new Set();
    this._buf = [];
  }

  _propsIn(vx0, vy0, vx1, vy1) {
    const out = this._buf, seen = this._seen;
    out.length = 0; seen.clear();
    if ((vx1 - vx0) > 2200) return out;   // skip far-zoom overview
    const cx0 = Math.floor(vx0 / 256), cx1 = Math.floor(vx1 / 256), cy0 = Math.floor(vy0 / 256), cy1 = Math.floor(vy1 / 256);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      for (const si of this.W.grid[0].get(cx * 100003 + cy) || []) {
        const s = this.W.seg[si], e = s.e;
        if (seen.has(si) || e.hw === 'service' || e.len < 55) continue;
        seen.add(si);
        const r = hash2(Math.round(s.ax), Math.round(s.ay));
        if (r > 0.34) continue;
        const dx = s.bx - s.ax, dy = s.by - s.ay, L = Math.hypot(dx, dy) || 1;
        const side = r < 0.17 ? 1 : -1;
        const off = (e.hw ? e.w * 0.5 : 18) + 8;
        const px = (s.ax + s.bx) * 0.5 - (dy / L) * off * side;
        const py = (s.ay + s.by) * 0.5 + (dx / L) * off * side;
        out.push({ id: si, x: px, y: py, kind: KINDS[Math.floor(r * 100) % KINDS.length] });
      }
    }
    return out;
  }

  step(sim, dt) {
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.toast && (this.toast.t -= dt) <= 0) this.toast = null;
    for (const [id, until] of this.broken) if (sim.time >= until) this.broken.delete(id);
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]; d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vrot * dt;
      if (d.t >= d.life) this.debris.splice(i, 1);
    }
    const P = sim.player; if (!P || Math.abs(P.v) < 35) return;
    const near = this._propsIn(P.x - 80, P.y - 80, P.x + 80, P.y + 80);
    for (const pr of near) {
      if (this.broken.has(pr.id)) continue;
      if (Math.hypot(P.x - pr.x, P.y - pr.y) < 22) {
        this.broken.set(pr.id, sim.time + 25);
        this.combo++; this.comboT = 4.0;
        const pts = 50 * Math.min(8, this.combo); this.score += pts;
        this.toast = { text: `${pr.kind.toUpperCase()} SMASH +${pts}${this.combo > 1 ? ` ×${this.combo}` : ''}`, t: 1.6 };
        const vx = Math.cos(P.h) * Math.abs(P.v) * 0.9, vy = Math.sin(P.h) * Math.abs(P.v) * 0.9;
        for (let k = 0; k < 3; k++) {
          this.debris.push({ x: pr.x, y: pr.y, vx: vx + (Math.random() - 0.5) * 90, vy: vy + (Math.random() - 0.5) * 90, rot: Math.random() * 6, vrot: (k - 1) * 11, col: COL[pr.kind], t: 0, life: 0.75 });
        }
      }
    }
  }

  draw(g, vx0, vy0, vx1, vy1) {
    for (const pr of this._propsIn(vx0, vy0, vx1, vy1)) {
      if (this.broken.has(pr.id)) continue;
      g.save(); g.translate(pr.x, pr.y);
      g.fillStyle = 'rgba(24,18,36,0.34)'; g.beginPath(); g.ellipse(2.5, -1.5, 5, 4, 0, 0, TAU); g.fill();
      g.fillStyle = COL[pr.kind]; g.strokeStyle = '#210f2e'; g.lineWidth = 1.6;
      if (pr.kind === 'cone') { g.beginPath(); g.arc(0, 0, 4.2, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 1.6, 0, TAU); g.fill(); }
      else if (pr.kind === 'hydrant') { g.beginPath(); g.arc(0, 0, 4.8, 0, TAU); g.fill(); g.stroke(); }
      else { g.fillRect(-4, -4, 8, 8); g.strokeRect(-4, -4, 8, 8); }
      g.restore();
    }
    for (const d of this.debris) {
      g.save(); g.globalAlpha = Math.max(0, 1 - d.t / d.life); g.translate(d.x, d.y); g.rotate(d.rot);
      g.fillStyle = d.col; g.strokeStyle = '#210f2e'; g.lineWidth = 1.4; g.fillRect(-3.5, -2.5, 7, 5); g.strokeRect(-3.5, -2.5, 7, 5);
      g.restore();
    }
  }

  drawHud(ctx, vw) {
    if (!this.toast) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 12px system-ui';
    const w = ctx.measureText(this.toast.text).width + 26, x = vw / 2 - w / 2, y = 170;
    ctx.fillStyle = 'rgba(27,20,48,0.86)'; ctx.beginPath(); ctx.roundRect(x, y, w, 24, 10); ctx.fill();
    ctx.fillStyle = '#ff9a5c'; ctx.fillText(this.toast.text, vw / 2, y + 16);
    ctx.restore();
  }
}
