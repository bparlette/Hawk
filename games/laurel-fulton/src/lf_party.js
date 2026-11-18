// lf_party.js — M-C 100-Guest Night Party (per DESIGN-G18-NIGHT-PARTY.md).
// Activates when tod >= 0.72 at Kosack's House (Derby Dr — basement + backyard pool) or
// The Floyds' House (Hughes Ave — paired split-foyer + lawns), streaming placement + sprites
// from shots/g18-night-party/ without blocking boot. Zero house numbers.
const TAU = Math.PI * 2;

export class NightParty {
  constructor() {
    this.data = null;
    this.imgs = {};
    this.venueKey = 'kosack';
    this.active = false;
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

  setVenue(key) {
    if (key === 'kosack' || key === 'floyds') this.venueKey = key;
  }

  venue() {
    if (!this.data || !this.data.venues) return null;
    return this.data.venues[this.venueKey] || this.data.venues.kosack;
  }

  step(tod) {
    const min = this.data?.trigger?.todMin ?? 0.72;
    this.active = tod >= min;
  }

  count() {
    const v = this.venue();
    return v && v.slots ? v.slots.length : 100;
  }

  banner() {
    if (!this.active) return null;
    const host = this.venueKey === 'floyds' ? 'FLOYDS' : 'KOSACK';
    return `NIGHT PARTY · ${this.count()} GUESTS (${host})`;
  }

  indoorGuests(houseId) {
    if (!this.active) return [];
    const match = (this.venueKey === 'kosack' && houseId === 'kosack') ||
                  (this.venueKey === 'floyds' && (houseId === 'clayton' || houseId === 'zack' || houseId === 'floyds'));
    if (!match) return [];
    const v = this.venue(); if (!v || !v.slots) return [];
    return v.slots.filter(s => s.layer === 'indoor');
  }

  drawWorld(g, time, vis) {
    if (!this.active) return;
    const v = this.venue(); if (!v || !v.world) return;
    const [wx, wy] = v.world;
    if (!vis(wx, wy, 1100)) return;
    const topIm = this.imgs.top, propIm = this.imgs.props;

    // Draw backyard party props (beer-pong table, keg, boombox)
    if (propIm && propIm.complete && propIm.naturalWidth) {
      const pw = propIm.width / 3, ph = propIm.height / 2;
      const props = this.venueKey === 'kosack'
        ? [[1, wx - 42, wy - 28, 30, 20], [2, wx + 46, wy - 34, 20, 20], [3, wx - 6, wy - 18, 22, 16]]
        : [[1, wx + 32, wy + 26, 30, 20], [2, wx - 38, wy + 24, 20, 20], [3, wx + 8, wy - 16, 22, 16]];
      for (const [idx, px, py, dw, dh] of props) {
        const col = idx % 3, row = Math.floor(idx / 3);
        g.drawImage(propIm, col * pw, row * ph, pw, ph, px - dw / 2, py - dh / 2, dw, dh);
      }
    }

    // Draw outdoor partygoers from party_crowd_topdown.webp (8x4 grid, 80x80 cells)
    for (let i = 0; i < v.slots.length; i++) {
      const s = v.slots[i];
      if (s.layer !== 'outdoor') continue;
      const sx = wx + s.u, sy = wy + s.v;
      if (!vis(sx, sy, 60)) continue;
      const bob = Math.sin(time * 6.2 + (s.bobPhase || i)) * 1.6;
      const sc = 20 * (s.scale || 1);
      g.save();
      g.translate(sx, sy + bob);
      g.rotate(s.facing || 0);
      if (topIm && topIm.complete && topIm.naturalWidth) {
        const idx = (s.sheetIdx || i) % 32, col = idx % 8, row = Math.floor(idx / 8);
        const cw = topIm.width / 8, ch = topIm.height / 4;
        g.drawImage(topIm, col * cw, row * ch, cw, ch, -sc / 2, -sc / 2, sc, sc);
      } else {
        g.fillStyle = s.zone === 'pool_water' ? '#4de2ff' : '#ff8a5c';
        g.strokeStyle = '#210f2e'; g.lineWidth = 1.6;
        g.beginPath(); g.arc(0, 0, 5.5, 0, TAU); g.fill(); g.stroke();
      }
      g.restore();
    }
  }

  drawLights(g, tod, time, vis) {
    if (!this.active) return;
    const v = this.venue(); if (!v || !v.world) return;
    const [wx, wy] = v.world;
    if (!vis(wx, wy, 1100)) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    // 1. Aquamarine backyard pool glow at Kosack's
    if (this.venueKey === 'kosack') {
      const pg = g.createRadialGradient(wx - 4, wy - 92, 6, wx - 4, wy - 92, 78);
      pg.addColorStop(0, 'rgba(60,210,255,0.44)'); pg.addColorStop(1, 'rgba(60,210,255,0)');
      g.fillStyle = pg; g.beginPath(); g.arc(wx - 4, wy - 92, 78, 0, TAU); g.fill();
    }
    // 2. Warm amber string-light festoon spill
    for (const [ox, oy] of [[-46, -24], [46, -24], [0, 32]]) {
      const fg = g.createRadialGradient(wx + ox, wy + oy, 4, wx + ox, wy + oy, 64);
      fg.addColorStop(0, 'rgba(255,214,120,0.40)'); fg.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = fg; g.beginPath(); g.arc(wx + ox, wy + oy, 64, 0, TAU); g.fill();
    }
    // 3. 120 BPM bass throb rings
    const beat = (time * 2) % 1, r = 48 + beat * 76;
    g.strokeStyle = `rgba(110,226,255,${((1 - beat) * 0.42).toFixed(3)})`;
    g.lineWidth = 3.5; g.beginPath(); g.arc(wx, wy, r, 0, TAU); g.stroke();
    g.restore();
  }
}
