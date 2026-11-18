// lf_help.js — Easy win ported from Palm City (help.js): '?' HELP & JUMP quick-teleporter.
// Tap '?' top-left to jump straight to any hero house, POI, parking challenge, KOTH, or Night Party.
export const HELP_BTN = { x: 12, y: 14, w: 34, h: 30 };

export class LFHelp {
  constructor() { this.open = false; }

  items(sim, roster, PL, party) {
    const a = sim.W.G.anchors || {};
    const ledo = a.ledo ? sim.W.verts[a.ledo.v] : { x: 1450, y: 1340 };
    const person = (id) => roster.people.find(p => p.id === id);
    const weis = PL?.places?.find(p => p.id === 'weis' || /weis/i.test(p.name || ''));
    const gring = PL?.places?.find(p => p.id === 'gringada' || /gringada/i.test(p.name || ''));
    const meet = roster.meetup?.pos || [5653, -19763];
    const list = [
      { id: 'ledo', name: 'LEDO PIZZA · PARK IT', col: '#6ee2ff', pos: [ledo.x, ledo.y] },
      { id: 'brad', name: "BRAD'S HOUSE", col: '#ffd25c', pos: person('brad')?.house },
      { id: 'kosack', name: "KOSACK · FAKE COP + POOL", col: '#ff5a7a', pos: person('kosack')?.house, carModel: 'cavalier_kosack' },
      { id: 'rigg', name: "RIGG'S + SCOOBY VAN", col: '#7fd4ff', pos: person('rigg')?.house },
      { id: 'floyds', name: "THE FLOYDS' SPLIT-FOYER", col: '#9fe08a', pos: person('clayton')?.house },
      { id: 'weis', name: 'WEIS MARKET · PARK IT', col: '#6ee2ff', pos: weis?.pos || [13800, 19620] },
      { id: 'gringada', name: 'GRINGADA (1998)', col: '#ff9a5c', pos: gring?.pos || [10500, -14500] },
      { id: 'atholton', name: 'ATHOLTON HS · ROOF + LOT', col: '#ffd25c', pos: meet },
      { id: 'party', name: 'NIGHT PARTY (100 GUESTS)', col: '#d48aff', pos: party?.venue()?.world || person('kosack')?.house, night: true },
    ];
    return list.filter(it => Array.isArray(it.pos));
  }

  layout(vh, count) {
    const pw = 364, tileW = pw - 28, tileH = 44, gap = 7;
    const ph = 72 + count * (tileH + gap), px = (420 - pw) / 2, py = Math.max(20, (vh - ph) / 2);
    const rows = [];
    for (let i = 0; i < count; i++) rows.push({ x: px + 14, y: py + 52 + i * (tileH + gap), w: tileW, h: tileH });
    return { px, py, pw, ph, rows };
  }

  tap(x, y, vh, items) {
    if (!this.open) {
      if (x >= HELP_BTN.x && x <= HELP_BTN.x + HELP_BTN.w && y >= HELP_BTN.y && y <= HELP_BTN.y + HELP_BTN.h) {
        this.open = true; return { type: 'open' };
      }
      return null;
    }
    const L = this.layout(vh, items.length);
    for (let i = 0; i < items.length; i++) {
      const r = L.rows[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        this.open = false; return { type: 'jump', item: items[i] };
      }
    }
    this.open = false; return { type: 'close' };
  }

  draw(ctx, vh, items) {
    ctx.save();
    ctx.fillStyle = 'rgba(27,20,48,0.78)'; ctx.strokeStyle = '#ffd25c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(HELP_BTN.x, HELP_BTN.y, HELP_BTN.w, HELP_BTN.h, 11); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = '900 16px system-ui'; ctx.fillStyle = '#ffd25c';
    ctx.fillText('?', HELP_BTN.x + HELP_BTN.w / 2, HELP_BTN.y + 21);

    if (!this.open) { ctx.restore(); return; }
    const L = this.layout(vh, items.length);
    ctx.fillStyle = 'rgba(18,12,30,0.84)'; ctx.fillRect(0, 0, 420, vh);
    ctx.fillStyle = '#1b1430'; ctx.strokeStyle = '#ffd25c'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(L.px, L.py, L.pw, L.ph, 16); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = '900 16px system-ui'; ctx.fillStyle = '#ffd25c';
    ctx.fillText('JUMP ANYWHERE · TAP TO GO', 210, L.py + 30);

    for (let i = 0; i < items.length; i++) {
      const it = items[i], r = L.rows[i];
      ctx.fillStyle = 'rgba(255,241,216,0.95)'; ctx.strokeStyle = '#210f2e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = it.col; ctx.fillRect(r.x + 6, r.y + 7, 6, r.h - 14);
      ctx.textAlign = 'left'; ctx.font = '900 13px system-ui'; ctx.fillStyle = '#210f2e';
      ctx.fillText(it.name, r.x + 20, r.y + 27);
      ctx.textAlign = 'right'; ctx.font = '800 11px system-ui'; ctx.fillStyle = '#6a3875';
      ctx.fillText('JUMP →', r.x + r.w - 14, r.y + 26);
    }
    ctx.restore();
  }
}
