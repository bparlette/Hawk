// build_map_redo.mjs — Queue 4 Task 1: CITY MAP REDO
// Renders the full 1800x2200 Palm City world overview directly through the live engine's
// GroundPainter + Renderer (zero flat vector fills, zero halftone dots) at Golden Hour (t=0.18)
// and Blue Dusk (t=0.90), layers painted POI/job signage plaques without overlap, keeps Fable's
// untouched captures in before/, outputs candidates in after/, and generates 420x860 phone
// side-by-side bake-off sheets in games/palm-city/shots/map-redo/.
import { chromium } from '/Users/braidpairlette/Games/Hawk/games/palm-city/tools/node_modules/playwright-core/index.mjs';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'shots', 'map-redo');
const BEFORE = path.join(OUT, 'before');
const AFTER = path.join(OUT, 'after');
fs.mkdirSync(BEFORE, { recursive: true });
fs.mkdirSync(AFTER, { recursive: true });

// Preserve Fable's untouched captures in before/
for (const f of ['map-spawn.png', 'map-motel.png']) {
  const src = path.join(ROOT, 'shots', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(BEFORE, f));
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CWEBP = fs.existsSync('/opt/homebrew/bin/cwebp') ? '/opt/homebrew/bin/cwebp' : 'cwebp';

const web = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
  });
});
await new Promise(r => web.listen(0, r));
const PORT = web.address().port;
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'],
});

async function bakeOverview(tod, label) {
  const p = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });
  await p.goto(`http://localhost:${PORT}/index.html?nostart&t=${tod}&nodirector`);
  await p.waitForFunction(() => window.__palm && window.__palm.renderer && window.__palm.sim, null, { timeout: 60000 });
  const dataUrl = await p.evaluate(async (todVal) => {
    const P = window.__palm, R = P.renderer, G = P.ground;
    // Paint every 256-wu chunk covering the 1800x2200 world
    for (let cy = 0; cy <= 9; cy++) for (let cx = 0; cx <= 7; cx++) G.get(cx, cy);
    const cv = document.createElement('canvas');
    cv.width = 900; cv.height = 1100;
    const origCtx = R.ctx;
    R.ctx = cv.getContext('2d');
    R.resize(900, 1100, 1);
    R.draw(P.sim, { x: 900, y: 1100, zoom: 0.5 }, todVal, 2.4);
    R.ctx = origCtx;
    R.resize(420, 860, P.dpr());
    return cv.toDataURL('image/png');
  }, tod);
  await p.close();
  const pngPath = path.join(AFTER, `palm-map-${label}-clean.png`);
  const webpPath = path.join(AFTER, `palm-map-${label}-clean.webp`);
  fs.writeFileSync(pngPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  execFileSync(CWEBP, ['-quiet', '-q', '92', pngPath, '-o', webpPath]);
  return dataUrl;
}

// Capture 420x860 @2x live opening backdrop (for authentic phone chrome backdrop)
async function captureBackdrop(tod, name) {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await p.goto(`http://localhost:${PORT}/index.html?nostart&t=${tod}&nodirector`);
  await p.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 60000 });
  await p.waitForTimeout(900);
  const pathOut = path.join(AFTER, `backdrop-${name}.png`);
  await p.screenshot({ path: pathOut });
  await p.close();
  return 'data:image/png;base64,' + fs.readFileSync(pathOut).toString('base64');
}

const goldenMapUrl = await bakeOverview(0.18, 'golden');
const duskMapUrl = await bakeOverview(0.90, 'dusk');
const goldenBgUrl = await captureBackdrop(0.18, 'golden');
const duskBgUrl = await captureBackdrop(0.90, 'dusk');

// Painted signage plaque renderer at exact 420x860 @2x phone scale matching mapFrame(420, 860, world)
const PHONE_RENDER_JS = `
window.renderPhoneMap = async (mapUrl, bgUrl, isDusk, playerPos, playerH) => {
  const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = s; });
  const [mapImg, bgImg] = await Promise.all([load(mapUrl), load(bgUrl)]);
  const cv = document.createElement('canvas'); cv.width = 840; cv.height = 1720; // @2x 420x860
  const g = cv.getContext('2d');
  g.scale(2, 2);
  const vw = 420, vh = 860, INK = '#210f2e';

  // Live world backdrop + frosted dark-plum map veil
  g.drawImage(bgImg, 0, 0, vw, vh);
  g.fillStyle = isDusk ? 'rgba(16,10,34,0.88)' : 'rgba(26,14,44,0.84)';
  g.fillRect(0, 0, vw, vh);

  // Top HUD bar matching game chrome
  g.fillStyle = '#fff1d8'; g.font = '800 13px "Avenir Next", system-ui'; g.textAlign = 'left';
  g.fillText(isDusk ? '7:42 PM' : '6:56 PM', 18, 28);
  g.fillStyle = 'rgba(27,20,48,0.86)'; g.strokeStyle = '#ffd45c'; g.lineWidth = 2;
  g.beginPath(); g.roundRect(12, 46, 36, 32, 10); g.fill(); g.stroke();
  g.fillStyle = '#ffd45c'; g.font = '900 16px system-ui'; g.textAlign = 'center'; g.fillText('?', 30, 67);
  g.fillStyle = '#ffd45c'; g.beginPath(); g.roundRect(vw - 74, 46, 62, 32, 10); g.fill();
  g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK; g.font = '900 12px "Avenir Next", system-ui'; g.fillText('× MAP', vw - 43, 66);

  // mapFrame(420, 860, {w:1800, h:2200}) exact geometry
  const top = 96, bottom = 150, pad = 12;
  const k = Math.min((vw - pad * 2) / 1800, (vh - top - bottom) / 2200);
  const w = 1800 * k, h = 2200 * k, fx = (vw - w) / 2, fy = top + (vh - top - bottom - h) / 2;

  g.fillStyle = '#ffd45c'; g.font = '900 20px "Avenir Next", Futura, system-ui';
  g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round';
  g.strokeText('PALM CITY', vw / 2, fy - 24);
  g.fillText('PALM CITY', vw / 2, fy - 24);

  // Warm painted map frame card
  g.fillStyle = '#f6e6c4'; g.strokeStyle = INK; g.lineWidth = 2.6;
  g.beginPath(); g.roundRect(fx - 5, fy - 5, w + 10, h + 10, 9); g.fill(); g.stroke();
  g.save(); g.beginPath(); g.roundRect(fx, fy, w, h, 5); g.clip();
  g.drawImage(mapImg, fx, fy, w, h);
  g.restore();
  g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.roundRect(fx, fy, w, h, 5); g.stroke();

  const toM = (wx, wy) => [fx + wx * k, fy + wy * k];

  // Hand-deconflicted painted signage plaques (buildings, areas, jobs, motel, events)
  // Layout uses exact world coords (wx, wy) + clean plaque offsets (ox, oy) where markers cluster.
  const POIS = [
    // Places (warm cream/coral painted signage plates matching in-game building signs)
    { name: 'SOLANA',     kind: 'place', wx: 575,  wy: 410,  ox: 0,   oy: 0 },
    { name: 'TACOS',      kind: 'place', wx: 960,  wy: 320,  ox: 0,   oy: 0 },
    { name: 'DINER',      kind: 'place', wx: 575,  wy: 635,  ox: 0,   oy: 0 },
    { name: 'NOVA',       kind: 'place', wx: 1005, wy: 1200, ox: 0,   oy: 0 },
    { name: 'POLICE',     kind: 'place', wx: 590,  wy: 1620, ox: -16, oy: -8 },
    { name: 'GARAGE',     kind: 'place', wx: 980,  wy: 1615, ox: 8,   oy: -8 },
    { name: 'MOTEL',      kind: 'door',  wx: 706,  wy: 1310, ox: -18, oy: -18 },
    // Areas
    { name: 'SKATE PARK', kind: 'area',  wx: 1330, wy: 650,  ox: 14,  oy: 10 },
    { name: 'BEACH',      kind: 'area',  wx: 1440, wy: 840,  ox: 22,  oy: 0 },
    { name: 'PIER',       kind: 'area',  wx: 1615, wy: 1085, ox: 10,  oy: 0 },
    // Jobs & Events (with crisp pin + leader line when offset so zero text collides)
    { name: 'WRECK IT!',  kind: 'event', wx: 1185, wy: 455,  ox: 0,   oy: -16 },
    { name: 'GETAWAY',    kind: 'job',   wx: 640,  wy: 790,  ox: 0,   oy: -14 },
    { name: 'TAXI',       kind: 'job',   wx: 810,  wy: 965,  ox: -12, oy: -14 },
    { name: 'BOARD CHASE',kind: 'event', wx: 1295, wy: 1085, ox: 0,   oy: -15 },
    { name: 'TOW',        kind: 'job',   wx: 855,  wy: 1455, ox: 0,   oy: -12 },
    { name: 'BUS',        kind: 'job',   wx: 1005, wy: 1455, ox: 18,  oy: -12 },
    { name: 'VALET',      kind: 'event', wx: 760,  wy: 1755, ox: 0,   oy: 16 },
    { name: 'OPEN ROAD',  kind: 'event', wx: 372,  wy: 1275, ox: -32, oy: -16 },
  ];

  for (const q of POIS) {
    const [ax, ay] = toM(q.wx, q.wy);
    const px = Math.max(fx + 26, Math.min(fx + w - 26, ax + q.ox));
    const py = Math.max(fy + 14, Math.min(fy + h - 14, ay + q.oy));

    if (q.kind === 'door' || q.kind === 'job' || q.kind === 'event') {
      g.strokeStyle = 'rgba(33,15,46,0.75)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(px, py); g.stroke();
      g.fillStyle = q.kind === 'door' ? '#ff5c9a' : q.kind === 'event' ? '#ffb02e' : '#58d8ff';
      g.strokeStyle = INK; g.lineWidth = 1.6;
      g.beginPath(); g.arc(ax, ay, q.kind === 'door' ? 4.4 : 3.6, 0, Math.PI * 2); g.fill(); g.stroke();
    }

    // Painted signage plaque
    g.font = q.kind === 'place' ? '900 8.5px "Avenir Next", system-ui' : '800 7.5px "Avenir Next", system-ui';
    const tw = g.measureText(q.name).width + 9, th = q.kind === 'place' ? 13 : 11.5;
    const bg = q.kind === 'door' ? '#ff5c9a' : q.kind === 'event' ? '#ffd45c' : q.kind === 'job' ? '#6ee2ff' : q.kind === 'area' ? 'rgba(33,15,46,0.68)' : '#fff3dc';
    const fg = q.kind === 'door' || q.kind === 'area' ? '#fff7eb' : INK;
    g.fillStyle = bg; g.strokeStyle = INK; g.lineWidth = 1.4;
    g.beginPath(); g.roundRect(px - tw / 2, py - th / 2, tw, th, 4); g.fill();
    if (q.kind !== 'area') g.stroke();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(q.name, px, py + 0.5);
  }

  // Player live beacon
  const [mx, my] = toM(playerPos[0], playerPos[1]);
  g.save(); g.translate(mx, my);
  g.fillStyle = 'rgba(255,212,92,0.34)'; g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
  g.rotate(playerH);
  g.fillStyle = '#ffd45c'; g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -6); g.lineTo(-2.5, 0); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
  g.restore();
  g.font = '900 8.5px "Avenir Next", system-ui'; g.textAlign = 'center';
  g.strokeStyle = INK; g.lineWidth = 3; g.strokeText('YOU', mx, my + 14);
  g.fillStyle = '#ffd45c'; g.fillText('YOU', mx, my + 14);
  return cv.toDataURL('image/png');
};
`;

const mp = await browser.newPage();
await mp.setContent('<html><body></body></html>');
await mp.addScriptTag({ content: PHONE_RENDER_JS });

const shotsToMake = [
  ['golden-spawn', goldenMapUrl, goldenBgUrl, false, [1265, 1140], Math.PI],
  ['golden-motel', goldenMapUrl, goldenBgUrl, false, [706, 1340], -Math.PI / 2],
  ['dusk-spawn', duskMapUrl, duskBgUrl, true, [1265, 1140], Math.PI],
  ['dusk-motel', duskMapUrl, duskBgUrl, true, [706, 1340], -Math.PI / 2],
];
for (const [slug, mUrl, bUrl, dusk, pos, h] of shotsToMake) {
  const url = await mp.evaluate(({ mUrl, bUrl, dusk, pos, h }) => window.renderPhoneMap(mUrl, bUrl, dusk, pos, h), { mUrl, bUrl, dusk, pos, h });
  fs.writeFileSync(path.join(AFTER, `map-${slug}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
await mp.close();

// Side-by-side 420x860 bake-off sheets (Golden & Dusk)
const b64File = (dir, name) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, name)).toString('base64');
async function makeBakeoffSheet(beforeFile, afterFile, title, outName) {
  const comp = await browser.newPage({ viewport: { width: 920, height: 960 }, deviceScaleFactor: 1 });
  await comp.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:18px;">
      <div style="text-align:center;font-weight:900;font-size:19px;color:#ffd45c;margin-bottom:6px;">${title}</div>
      <div style="text-align:center;font-size:12px;color:#6ee2ff;margin-bottom:14px;">
        Real Painted GroundPainter + Baked Roofs/Shadows/Night Bloom + Painted Signage Plaques (Zero Halftone / Zero Flat Rectangles)
      </div>
      <div style="display:flex;gap:16px;justify-content:center;">
        <div style="text-align:center;">
          <div style="font-size:12px;font-weight:800;color:#ff9a8a;margin-bottom:6px;">BEFORE — Fable Shipped Diagram (Halftone + Overlapping Labels)</div>
          <img src="${b64File(BEFORE, beforeFile)}" style="width:420px;height:860px;border:2px solid #523a68;border-radius:10px;display:block;"/>
        </div>
        <div style="text-align:center;">
          <div style="font-size:12px;font-weight:800;color:#7dffa8;margin-bottom:6px;">AFTER — Live Engine Painted World Overview + Plaques</div>
          <img src="${b64File(AFTER, afterFile)}" style="width:420px;height:860px;border:2px solid #ffd45c;border-radius:10px;display:block;"/>
        </div>
      </div>
    </body></html>
  `);
  await comp.waitForTimeout(300);
  await comp.screenshot({ path: path.join(OUT, outName), fullPage: true });
  await comp.close();
}

await makeBakeoffSheet('map-spawn.png', 'map-golden-spawn.png', 'QUEUE 4 TASK 1 — CITY MAP REDO (GOLDEN HOUR · 420×860 PHONE)', 'bakeoff-map-golden-phone.png');
await makeBakeoffSheet('map-motel.png', 'map-dusk-motel.png', 'QUEUE 4 TASK 1 — CITY MAP REDO (BLUE DUSK · 420×860 PHONE)', 'bakeoff-map-dusk-phone.png');

await browser.close();
web.close();
console.log('MAP REDO COMPLETE: before/, after/, bakeoff-map-golden-phone.png, bakeoff-map-dusk-phone.png');
