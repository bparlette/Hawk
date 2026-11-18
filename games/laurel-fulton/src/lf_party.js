// lf_party.js — M-C 100-Guest Night Party (per DESIGN-G18-NIGHT-PARTY.md).
// Activates when tod >= 0.72 at Kosack's House (Derby Dr — basement + backyard pool) or
// The Floyds' House (Hughes Ave — paired split-foyer + lawns), streaming placement + sprites
// from shots/g18-night-party/ without blocking boot. Zero house numbers.
import { drawPedAt, PED_OUTFITS } from './lf_fx.js';
const TAU = Math.PI * 2;

export class NightParty {
  constructor() {
    this.data = null;
    this.imgs = {};
    this.venueKey = 'kosack';
    this.active = false; this.forced = false; this.tod = 0;
    this.crowd = new Party({ venue: 'both' });
    this._load();
  }

  _load() {
    if (typeof fetch !== 'function') return;
    fetch('shots/g18-night-party/placement.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => { this.data = d; })
      .catch(() => {});
    if (typeof Image === 'function') {
      for (const [k, f] of [
        ['top', 'shots/g18-night-party/sprites/party_crowd_topdown.webp'],
        ['cut', 'shots/g18-night-party/sprites/party_crowd_cutaway.webp'],
        ['props', 'shots/g18-night-party/sprites/party_props_sheet.webp'],
      ]) {
        const im = new Image(); im.src = f;
        im.onload = () => { this.imgs[k] = im; };
      }
    }
  }

  setVenue(key) {                                        // ?party=kosack|floyds -> that venue is the featured one (HELP jump, banner); 'both' = nearest to you
    if (key === 'floyd') key = 'floyds';
    if (key === 'kosack' || key === 'floyds') { this.venueKey = key; this.forced = true; }
    else if (key === 'both') this.forced = false;
  }

  venue() {
    if (!this.data || !this.data.venues) return null;
    return this.data.venues[this.venueKey] || this.data.venues.kosack;
  }

  // L17: the whole outdoor night party is Party (below): ~100 Palm City peds per venue (both venues, always), pool + patio, music rings.
  build(S, areas) { return this.crowd.build(S, areas); }
  step(tod, focus) {
    const min = this.data?.trigger?.todMin ?? 0.72;
    this.tod = tod; this.active = tod >= min;
    if (!this.forced && focus && this.crowd.built) {          // the featured venue is the one you are nearer to (the banner + the HELP jump follow it)
      let best = null, bd = 1e18; for (const s of this.crowd.sites) { const d = Math.hypot(s.cx - focus.x, s.cy - focus.y); if (d < bd) { bd = d; best = s; } }
      if (best) this.venueKey = best.id === 'floyd' ? 'floyds' : best.id;
    }
  }

  count() { return this.crowd.count(this.tod || 0); }

  banner() {
    const n = this.count(); if (!n) return null;
    const host = this.venueKey === 'floyds' ? 'FLOYDS' : 'KOSACK';
    return `NIGHT PARTY · ${n} GUESTS (${host})`;
  }

  indoorGuests(houseId) {
    if (!this.active) return [];
    const key = houseId === 'kosack' ? 'kosack' : (houseId === 'clayton' || houseId === 'zack' || houseId === 'floyds') ? 'floyds' : null;
    if (!key || !this.data || !this.data.venues) return [];
    const v = this.data.venues[key]; if (!v || !v.slots) return [];
    return v.slots.filter(s => s.layer === 'indoor');
  }

  drawWorld(g, time, vis) { this.crowd.under(g, null, null, time, { vis, tod: this.tod || 0 }); }          // pool + patio: real at the house, day and night

  drawLights(g, tod, time, vis) { this.crowd.post(g, null, null, time, { vis, tod }); }                         // the crowd, the lights and the music rings (world space, after the grade)
}

// ================= L17: THE NIGHT PARTY CROWD (ported from the alt's lf_party.js, onto Palm City's ped sprites) =================
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rngOf = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const PARTY = { total: 100, from: 0.56, full: 0.82, venues: { kosack: { who: 'Kosack', pool: true, basement: true, split: false }, floyd: { who: 'The Floyds', pool: false, basement: true, split: true } } };

const inPoly = (f, x, y) => { let ins = false; for (let k = 0; k < f.length; k += 2) { const ax = f[k], ay = f[k + 1], ex = f[(k + 2) % f.length], ey = f[(k + 3) % f.length]; if ((ay > y) !== (ey > y) && x < (ex - ax) * (y - ay) / (ey - ay) + ax) ins = !ins; } return ins; };

export class Party {
  constructor(o = {}) {
    this.which = (o.venue === 'off' ? '' : (o.venue || 'kosack')).split(',').flatMap(v => v === 'both' ? ['kosack', 'floyd'] : [v]).filter(v => PARTY.venues[v]);
    this.sites = []; this.built = false;
    this.drawUnder = (g, S, cam, time, v) => this.under(g, S, cam, time, v);
    this.drawOver = (g, S, cam, time, v) => this.over(g, S, cam, time, v);
    this.drawPost = (g, S, cam, time, v) => this.post(g, S, cam, time, v);
  }
  // how much of the crowd has arrived at time of day t (0 = golden hour .. 1 = blue dusk)
  amount(t) { return smooth(PARTY.from, PARTY.full, t); }
  count(t) { return Math.round(this.amount(t) * PARTY.total); }

  // is (x, y) free yard: not inside a building (other than this venue's own footprint, which is a keep-out of its own) and not on a road
  freeAt(S, x, y, own, margin = 0) {
    const W = S.W, r = W.roadInfo(x, y, 0); if (r.e && r.d < r.hw + margin + 6) return false;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const hi of S.houseGrid.get((Math.floor(x / 256) + i) * 100003 + Math.floor(y / 256) + j) || []) {
      const bb = S.houseBox[hi]; if (x < bb[0] - margin || x > bb[2] + margin || y < bb[1] - margin || y > bb[3] + margin) continue;
      if (inPoly(S.houses[hi], x, y) || margin > 0) return false;
    }
    if (own && inPoly(own.big, x, y)) return false;
    return true;
  }
  build(S, areas) {
    if (!areas || !S.houses.length) return false;
    this.sites = [];
    for (const id of this.which) {
      const V = PARTY.venues[id], h = areas.heroes.find(q => q.who === V.who); if (!h) continue;
      const rnd = rngOf(id === 'kosack' ? 1996 : 1998), cx = h.cx, cy = h.cy;
      // the hero house is drawn 1.35x about its centroid (lf_render): the party works around THAT outline
      const big = []; for (let k = 0; k < h.f.length; k += 2) big.push(cx + (h.f[k] - cx) * 1.35, cy + (h.f[k + 1] - cy) * 1.35);
      const own = { big }; let R = 0; for (let k = 0; k < big.length; k += 2) R = Math.max(R, Math.hypot(big[k] - cx, big[k + 1] - cy));
      const r = S.W.roadInfo(cx, cy, 0), kerb = r.e ? S.nearPt(cx, cy, r) : { x: cx + 100, y: cy };
      let fa = Math.atan2(kerb.y - cy, kerb.x - cx);                          // FRONT = toward the street; BACK = away from it
      // the back yard: try the straight-back direction first, then swing; keep the one with the most free ground behind the house
      let best = null;
      for (const sw of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05]) for (const dist of [R + 150, R + 120, R + 100]) {
        const a = fa + Math.PI + sw, bx = cx + Math.cos(a) * dist, by = cy + Math.sin(a) * dist; let free = 0, n = 0;
        for (let u = -110; u <= 110; u += 22) for (let w = -90; w <= 90; w += 22) { n++; if (this.freeAt(S, bx + Math.cos(a) * w - Math.sin(a) * u, by + Math.sin(a) * w + Math.cos(a) * u, own, 4)) free++; }
        const score = free / n - Math.abs(sw) * 0.05; if (!best || score > best.score) best = { score, a, bx, by, free: free / n };
      }
      const back = { x: best.bx, y: best.by, a: best.a, free: best.free }, ba = back.a, ux = Math.cos(ba), uy = Math.sin(ba), vx = -uy, vy = ux;   // u = away from the house, v = across
      const P = (u, v) => ({ x: back.x + ux * u + vx * v, y: back.y + uy * u + vy * v });
      const pool = V.pool ? { cx: back.x, cy: back.y, a: ba, w: 112, h: 62 } : null;                   // 11 x 6 m, long axis across the back of the house
      const patio = { ...P(-92, 0), a: ba, w: 150, h: 42 };                                              // the basement walk-out slab, flush with the back wall
      const door = { ...P(-112, 0), a: ba };                                                              // the walk-out door + window wells sit on the back wall
      const front = { x: cx + Math.cos(fa) * (R + 70), y: cy + Math.sin(fa) * (R + 70), a: fa };
      const people = []; const outfits = PED_OUTFITS; const total = PARTY.total;
      const add = (x, y, kind, phase) => people.push({ x, y, kind, ph: rnd() * TAU, h: rnd() * TAU, o: outfits[Math.floor(rnd() * outfits.length)], walk: kind === 'yard' && rnd() < 0.12, sp: 0.5 + rnd() * 0.6, ox: x, oy: y, order: people.length });
      const tryAdd = (fn, kind, n) => { let made = 0, guard = 0; while (made < n && guard++ < n * 80) { const q = fn(); if (this.freeAt(S, q.x, q.y, own, 3) && !(pool && this.inRect(pool, q.x, q.y, 6) && kind !== 'pool') && !people.some(p => Math.hypot(p.x - q.x, p.y - q.y) < 11)) { add(q.x, q.y, kind); made++; } } return made; };
      const rect = (c, w, h, a) => () => { const du = (rnd() - 0.5) * w, dv = (rnd() - 0.5) * h; return { x: c.x + Math.cos(a) * du - Math.sin(a) * dv, y: c.y + Math.sin(a) * du + Math.cos(a) * dv }; };
      const nPool = pool ? 12 : 0, nDeck = pool ? 22 : 0, nPatio = 22, nFront = 20, nPorch = 6;
      if (pool) {
        // in the water
        let made = 0, guard = 0; while (made < nPool && guard++ < 400) { const q = rect(pool, pool.w - 18, pool.h - 16, pool.a)(); if (!people.some(p => Math.hypot(p.x - q.x, p.y - q.y) < 13)) { add(q.x, q.y, 'pool'); made++; } }
        // on the deck: a ring just outside the water
        made = 0; guard = 0; while (made < nDeck && guard++ < 600) { const t = rnd() * TAU, rx = pool.w / 2 + 10 + rnd() * 18, ry = pool.h / 2 + 8 + rnd() * 16, lx = Math.cos(t) * rx, ly = Math.sin(t) * ry, q = { x: pool.cx + Math.cos(pool.a) * lx - Math.sin(pool.a) * ly, y: pool.cy + Math.sin(pool.a) * lx + Math.cos(pool.a) * ly }; if (this.freeAt(S, q.x, q.y, own, 3) && !people.some(p => Math.hypot(p.x - q.x, p.y - q.y) < 12)) { add(q.x, q.y, 'deck'); made++; } }
      }
      tryAdd(rect(patio, patio.w - 10, patio.h - 8, ba), 'patio', nPatio);                                // the basement walk-out
      tryAdd(rect(P(40, 0), 190, 150, ba), 'yard', total - people.length - nFront - nPorch);              // the back-yard lawn (fills to the total)
      tryAdd(rect(front, 120, 90, fa), 'front', nFront);                                                  // driveway + front yard
      tryAdd(rect({ x: cx + Math.cos(fa) * (R + 18), y: cy + Math.sin(fa) * (R + 18) }, 70, 24, fa), 'porch', nPorch);   // the front steps
      let fill = 0; while (people.length < total && fill++ < 4000) { const q = rect(P(60, 0), 260, 210, ba)(); if (this.freeAt(S, q.x, q.y, own, 3) && !(pool && this.inRect(pool, q.x, q.y, 6)) && !people.some(p => Math.hypot(p.x - q.x, p.y - q.y) < 9)) add(q.x, q.y, 'yard'); }
      people.forEach((p, i) => { p.i = i; });
      // arrival order = shuffled, so the crowd builds up all over the place rather than filling one corner first
      const order = people.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } people.forEach((p, i) => { p.arrive = order[i]; });
      this.sites.push({ id, V, h, cx, cy, fa, R, back, pool, patio, door, front, big, people, split: V.split, hue: id === 'kosack' ? 0 : 0.5 });
    }
    this.built = this.sites.length > 0; return this.built;
  }
  inRect(r, x, y, m = 0) { const dx = x - r.cx, dy = y - r.cy, c = Math.cos(-r.a), s = Math.sin(-r.a), lx = dx * c - dy * s, ly = dx * s + dy * c; return Math.abs(lx) < r.w / 2 + m && Math.abs(ly) < r.h / 2 + m; }
  // how many heads are actually shown at time of day t, per site
  shown(site, t) { const n = this.count(t); return site.people.filter(p => p.arrive < n); }

  // ---- drawing ----
  // UNDER (day and night): the pool + its deck, the patio slab. Real, at the house, whatever the hour.
  under(g, S, cam, time, v) {
    if (!this.built) return;
    for (const st of this.sites) {
      if (!v.vis(st.back.x, st.back.y, 300)) continue;
      const pa = st.patio; g.save(); g.translate(pa.x, pa.y); g.rotate(pa.a);
      g.fillStyle = '#b9b0a2'; g.beginPath(); g.roundRect(-pa.w / 2, -pa.h / 2, pa.w, pa.h, 4); g.fill(); g.strokeStyle = 'rgba(60,50,60,0.5)'; g.lineWidth = 1.2; g.stroke();
      g.restore();
      if (st.pool) {
        const p = st.pool; g.save(); g.translate(p.cx, p.cy); g.rotate(p.a);
        g.fillStyle = '#cfc6b4'; g.beginPath(); g.roundRect(-p.w / 2 - 15, -p.h / 2 - 15, p.w + 30, p.h + 30, 12); g.fill(); g.strokeStyle = 'rgba(60,50,60,0.45)'; g.lineWidth = 1.5; g.stroke();   // the deck
        const wg = g.createLinearGradient(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2); wg.addColorStop(0, '#3fb6d6'); wg.addColorStop(1, '#1f86b8');
        g.fillStyle = wg; g.beginPath(); g.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 9); g.fill(); g.strokeStyle = '#e9f6f8'; g.lineWidth = 2.4; g.stroke();                                           // the water + the coping
        g.globalAlpha = 0.35; g.strokeStyle = '#d6f4fb'; g.lineWidth = 1; for (let k = 0; k < 5; k++) { const y = -p.h / 2 + 9 + k * 11 + Math.sin(time * 1.3 + k) * 1.5; g.beginPath(); g.moveTo(-p.w / 2 + 10, y); g.bezierCurveTo(-p.w / 4, y - 3, p.w / 4, y + 3, p.w / 2 - 10, y); g.stroke(); }
        g.restore();
      }
    }
  }
  // THE CROWD (Palm City peds), y-sorted — drawn from post() so it is LIT (party lights + string lights) instead of grade-darkened to navy shapes. Dancers bob (the dap bob), some wander; the swimmers are drawn half under a water veil.
  over() { /* the crowd is drawn in post() — lit, not graded */ }
  crowd(g, S, cam, time, v) {
    if (!this.built) return;
    for (const st of this.sites) {
      const n = this.count(v.tod); if (n <= 0 || !v.vis(st.cx, st.cy, 560)) continue;
      const list = []; for (const p of st.people) { if (p.arrive >= n) continue; const t = time * p.sp; let x = p.ox, y = p.oy; if (p.walk) { x += Math.sin(t * 0.6 + p.ph) * 26; y += Math.cos(t * 0.5 + p.ph * 1.3) * 18; } else { x += Math.sin(t * 1.7 + p.ph) * 1.6; y += Math.cos(t * 1.3 + p.ph) * 1.2; } if (!v.vis(x, y, 40)) continue; list.push([p, x, y]); }
      list.sort((a, b) => a[2] - b[2]);
      for (const [p, x, y] of list) {
        const moving = p.walk, ang = p.h + Math.sin(time * 0.7 + p.ph) * 0.5;   // (a walker's heading is read from its own steps by drawPed)
        const bob = p.kind === 'pool' ? 0.25 : 0.75 + 0.25 * Math.sin(time * 4 + p.ph);       // dancing: the dap bob, on the 126 bpm kick
        const f = { who: { id: 'x' }, outfit: p.o, x, y, h: ang, px: moving ? p.px ?? x : x, py: moving ? p.py ?? y : y, dap: p.kind === 'porch' ? 0 : Math.sin(time * 8.4 + p.ph) * bob, noShadow: p.kind === 'pool' };
        p.px = x; p.py = y;
        if (p.kind === 'pool') { g.save(); g.beginPath(); g.rect(x - 24, y - 40, 48, 40 + 3); g.clip(); drawPedAt(g, f, time); g.restore(); g.fillStyle = 'rgba(62,170,214,0.55)'; g.beginPath(); g.ellipse(x, y + 1, 9, 4.5, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(235,250,255,0.7)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y + 1, 9 + Math.sin(time * 3 + p.ph), 4.6, 0, 0, TAU); g.stroke(); }
        else drawPedAt(g, f, time);
      }
    }
  }
  // POST (after the grade, so it blazes at night): pool light, basement window wells + the walk-out door, disco spots on the lawn, warm pools on the crowd,
  // MUSIC RINGS off the house. World space (lf_render postLights).
  post(g, S, cam, time, v) {
    if (!this.built) return;
    const a = this.amount(v.tod); if (a <= 0.01) return;
    const z = 1, sx = (x) => x, sy = (y) => y;   // L17: drawn from lf_render's postLights hook, which is already in WORLD space after the grade
    this.crowd(g, S, cam, time, v);   // the heads: world space ON TOP of the grade, so they are lit by the party instead of graded to navy shapes
    for (const st of this.sites) {
      if (!v.vis(st.cx, st.cy, 700)) continue;
      g.save(); g.globalCompositeOperation = 'lighter';
      const kick = Math.max(0, Math.sin(time * TAU * 2.1)) ** 6;                                      // ~126 bpm
      // pool light: turquoise bloom out of the water
      if (st.pool) { const p = st.pool, px = sx(p.cx), py = sy(p.cy), r = (p.w * 0.95) * z; const gr = g.createRadialGradient(px, py, 2, px, py, r); gr.addColorStop(0, `rgba(60,200,245,${0.30 * a})`); gr.addColorStop(0.5, `rgba(40,160,225,${0.16 * a})`); gr.addColorStop(1, 'rgba(30,120,220,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, r, r * 0.8, p.a, 0, TAU); g.fill(); }
      // the basement: lit window wells + the walk-out door, throbbing with the kick, colours rolling
      const d = st.door, ca = Math.cos(d.a), sa = Math.sin(d.a);
      for (let k = -2; k <= 2; k++) {
        const wx = sx(d.x - sa * k * 26), wy = sy(d.y + ca * k * 26), hue = (time * 40 + k * 55 + st.hue * 360) % 360, r = (22 + 10 * kick) * z * (k === 0 ? 1.4 : 1);
        const gr = g.createRadialGradient(wx, wy, 1, wx, wy, r); gr.addColorStop(0, `hsla(${hue},95%,60%,${(0.38 + 0.3 * kick) * a})`); gr.addColorStop(1, `hsla(${hue},95%,55%,0)`); g.fillStyle = gr; g.beginPath(); g.arc(wx, wy, r, 0, TAU); g.fill();
        g.fillStyle = `hsla(${hue},95%,70%,${0.9 * a})`; g.save(); g.translate(wx, wy); g.rotate(d.a); g.fillRect(-3 * z, -9 * z, 6 * z, 18 * z); g.restore();           // the window well itself
      }
      // disco spots sweeping the lawn
      for (let k = 0; k < 4; k++) { const ang = time * 0.5 + k * TAU / 4, ru = (50 + 34 * Math.sin(time * 0.9 + k * 1.7)), bx = st.back.x + Math.cos(st.back.a) * ru * 1.3 + Math.cos(ang) * 60, by = st.back.y + Math.sin(st.back.a) * ru * 1.3 + Math.sin(ang) * 60, hue = (time * 55 + k * 90 + st.hue * 360) % 360, px = sx(bx), py = sy(by), r = 62 * z;
        const gr = g.createRadialGradient(px, py, 1, px, py, r); gr.addColorStop(0, `hsla(${hue},95%,60%,${0.30 * a})`); gr.addColorStop(1, `hsla(${hue},95%,55%,0)`); g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill(); }
      // warm light pools over the crowd clusters (string lights, house light): without them the crowd would be navy shapes
      const n = this.count(v.tod); for (const k of ['front', 'patio', 'yard', 'deck']) { let mx = 0, my = 0, c = 0; for (const p of st.people) if (p.kind === k && p.arrive < n) { mx += p.ox; my += p.oy; c++; } if (!c) continue; mx /= c; my /= c; const px = sx(mx), py = sy(my), r = (k === 'yard' ? 130 : 80) * z; const gr = g.createRadialGradient(px, py, 2, px, py, r); gr.addColorStop(0, `rgba(255,190,120,${0.34 * a})`); gr.addColorStop(1, 'rgba(255,170,100,0)'); g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill(); }
      // music rings off the house (the same kick-synced rings a bass car throws, bigger)
      for (let k = 0; k < 3; k++) { const u = ((time * 2.1 / 2 + k / 3) % 1), r = (40 + u * 260) * z, hue = (time * 30 + k * 110 + st.hue * 360) % 360; g.globalAlpha = (1 - u) * 0.6 * a; g.strokeStyle = `hsl(${hue},95%,70%)`; g.lineWidth = (3.4 * (1 - u) + 0.8) * Math.max(0.6, z * 1.6); g.beginPath(); g.ellipse(sx(st.cx), sy(st.cy), r, r * 0.9, 0, 0, TAU); g.stroke(); }
      g.restore();
    }
  }
}
