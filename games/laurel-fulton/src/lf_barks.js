// lf_barks.js — Laurel/Fulton's BARK system + THROWN OBJECTS (owner, Nov 18: the convoy is a race with barks, not a parade).
//   - speech bubbles over cars ("Cole Trickle!", "rubbin is racing", the fake-cop target's "OFFICER?!"...) with per-car, per-line cooldowns
//   - thrown things: ONES (dollar bills) flutter out of the window at the cars; PENS and PENNIES arc between the convoy cars
// Pure logic + two draw calls (no sim edits): the world pass (particles, drawn with the cars) and the screen pass (bubbles, always
// readable at any zoom). Everything is data in this.log / this.stats so tools/spec_convoy.mjs can prove it happened.
//   const B = new Barks();  B.step(S, dt);  B.say(car, text, {key, cd, ttl});  B.throwAt('bill'|'pen'|'penny', from, to)
//   B.drawWorld(g, time);   B.drawScreen(ctx, cam, vw, vh);
const TAU = Math.PI * 2;
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;

export class Barks {
  constructor() {
    this.t = 0; this.bubbles = []; this.parts = []; this.cd = new Map(); this.log = [];
    this.stats = { says: 0, bill: 0, pen: 0, penny: 0, hits: 0 };
  }
  // a bubble over `car`. key = the line's identity for the cooldown (default: the text); cd = seconds before THIS car may say THIS key
  // again; a car never talks over itself (one bubble at a time, 0.9 s min between lines unless `urgent`).
  say(car, text, o = {}) {
    const key = (car.model || 'car') + '|' + (o.key || text), cd = o.cd ?? 8;
    if ((this.cd.get(key) || 0) > this.t) return false;
    const live = this.bubbles.find(b => b.car === car);
    if (live && !o.urgent && live.t < 0.9) return false;
    if (live) this.bubbles.splice(this.bubbles.indexOf(live), 1);
    this.cd.set(key, this.t + cd);
    this.bubbles.push({ car, text, t: 0, ttl: o.ttl ?? 1.9, col: o.col || null });
    this.log.push({ t: this.t, model: car.model, text, key: o.key || text }); if (this.log.length > 400) this.log.shift();
    this.stats.says++; this.stats[o.key || text] = (this.stats[o.key || text] || 0) + 1;
    return true;
  }
  // throw `kind` from car `from` at car `to`. Leaves from the window on the side facing the target.
  throwAt(kind, from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, L = Math.hypot(dx, dy) || 1, ca = Math.cos(from.h), sa = Math.sin(from.h);
    const side = (dx * -sa + dy * ca) >= 0 ? 1 : -1;                          // which window: the right-hand one if the target is on the right
    const ox = from.x + ca * from.len * 0.12 - sa * side * from.wid * 0.5, oy = from.y + sa * from.len * 0.12 + ca * side * from.wid * 0.5;
    const dur = kind === 'bill' ? 1.25 + 0.4 * Math.min(1, L / 500) : 0.55 + 0.25 * Math.min(1, L / 300);
    this.parts.push({ kind, ox, oy, x: ox, y: oy, z: 0, from, to, t: 0, dur, rot: Math.random() * TAU, spin: (kind === 'pen' ? 16 : 9) * (Math.random() < 0.5 ? -1 : 1),
      jx: (Math.random() - 0.5) * 18, jy: (Math.random() - 0.5) * 18, ph: Math.random() * TAU, state: 'fly', rest: 0 });
    this.stats[kind]++;
    this.log.push({ t: this.t, model: from.model, thrown: kind, at: to.model });
  }
  step(dt) {
    this.t += dt;
    for (const b of this.bubbles) b.t += dt;
    this.bubbles = this.bubbles.filter(b => b.t < b.ttl);
    for (const p of this.parts) {
      p.t += dt;
      if (p.state === 'fly') {
        const u = clamp01(p.t / p.dur), e = u * u * (3 - 2 * u), tx = p.to.x + p.jx, ty = p.to.y + p.jy;
        p.x = p.ox + (tx - p.ox) * (p.kind === 'bill' ? u : e); p.y = p.oy + (ty - p.oy) * (p.kind === 'bill' ? u : e);
        if (p.kind === 'bill') {                                                // a one FLUTTERS: sways across its path and falls slow
          const px = -(ty - p.oy), py = tx - p.ox, pl = Math.hypot(px, py) || 1, sw = Math.sin(p.t * 8 + p.ph) * 12 * Math.sin(u * Math.PI);
          p.x += px / pl * sw; p.y += py / pl * sw; p.z = 16 * Math.sin(Math.min(1, u * 1.6) * Math.PI) * 0.8 + 6 * (1 - u);
        } else p.z = 26 * 4 * u * (1 - u) + 4;                                   // pens + pennies: a quick arc
        p.rot += p.spin * dt;
        if (u >= 1) {
          if (Math.hypot(p.to.x - p.x, p.to.y - p.y) < 60) this.stats.hits++;
          p.state = 'rest'; p.rest = 0; p.z = 0; p.x += (Math.random() - 0.5) * 10; p.y += (Math.random() - 0.5) * 10;
        }
      } else { p.rest += dt; p.spin *= Math.pow(0.05, dt); p.rot += p.spin * dt; if (p.rest > (p.kind === 'bill' ? 5 : 2.5)) p.state = 'done'; }
    }
    this.parts = this.parts.filter(p => p.state !== 'done');
  }
  // world pass (inside the camera transform, drawn over the cars, under the grade)
  drawWorld(g) {
    for (const p of this.parts) {
      const a = p.state === 'rest' ? 1 - clamp01((p.rest - (p.kind === 'bill' ? 3.5 : 1.5)) / 1.5) : 1, lift = p.z * 0.9;
      g.save(); g.globalAlpha = a;
      g.fillStyle = 'rgba(20,16,30,0.35)'; g.beginPath(); g.ellipse(p.x + 2, p.y + 2, p.kind === 'bill' ? 7 : 4, 3, 0, 0, TAU); g.fill();   // its shadow stays on the road
      g.translate(p.x, p.y - lift); g.rotate(p.rot);
      if (p.kind === 'bill') {                                                  // a dollar: green, paler border, a "1"
        const flap = p.state === 'fly' ? Math.abs(Math.cos(p.t * 9 + p.ph)) * 0.7 + 0.3 : 1;
        g.scale(1, flap); g.fillStyle = '#5d9a58'; g.fillRect(-9, -4.5, 18, 9); g.strokeStyle = '#e6f2c8'; g.lineWidth = 1.1; g.strokeRect(-8, -3.6, 16, 7.2);
        g.fillStyle = '#e6f2c8'; g.beginPath(); g.arc(0, 0, 2.2, 0, TAU); g.fill(); g.fillStyle = '#3d6e3c'; g.fillRect(-0.5, -1.4, 1, 2.8);
      } else if (p.kind === 'pen') {                                            // a Bic: blue barrel, clear cap, black tip
        g.fillStyle = '#2a58c8'; g.fillRect(-7, -1.3, 11, 2.6); g.fillStyle = 'rgba(235,240,255,0.9)'; g.fillRect(4, -1.3, 4, 2.6); g.fillStyle = '#111'; g.fillRect(-9, -0.8, 2, 1.6);
      } else {                                                                  // a penny: copper disc, spinning edge-on
        g.scale(Math.max(0.25, Math.abs(Math.cos(p.t * 22 + p.ph))), 1); g.fillStyle = '#c4763c'; g.beginPath(); g.arc(0, 0, 3.6, 0, TAU); g.fill(); g.fillStyle = '#f0b074'; g.beginPath(); g.arc(-1, -1, 1.4, 0, TAU); g.fill();
      }
      g.restore();
    }
    // a hit: a little glint at the target
  }
  // screen pass: bubbles (own pixel size, whatever the camera zoom)
  drawScreen(g, cam, vw, vh) {
    g.save(); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (const b of this.bubbles) {
      const c = b.car, x = (c.x - cam.x) * cam.zoom + vw / 2, y = (c.y - cam.y) * cam.zoom + vh / 2 - 30 - (c.z || 0) * 0.5;
      if (x < -60 || x > vw + 60 || y < -30 || y > vh + 30) continue;
      const pop = clamp01(b.t / 0.12), fade = clamp01((b.ttl - b.t) / 0.3), sc = 0.6 + 0.4 * pop, a = pop * fade;
      g.font = '900 12px system-ui'; const w = g.measureText(b.text).width + 16, bx = Math.max(w / 2 + 4, Math.min(vw - w / 2 - 4, x));
      g.save(); g.globalAlpha = a; g.translate(bx, y); g.scale(sc, sc);
      g.fillStyle = b.col || 'rgba(255,252,238,0.96)'; g.strokeStyle = '#2a1430'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(-w / 2, -22, w, 22, 9); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x - bx - 5, -1); g.lineTo(x - bx, 8); g.lineTo(x - bx + 5, -1); g.closePath(); g.fillStyle = b.col || 'rgba(255,252,238,0.96)'; g.fill(); g.stroke();
      g.fillStyle = b.col ? '#fff' : '#2a1430'; g.fillText(b.text, 0, -6.5);
      g.restore();
    }
    g.restore();
  }
}
