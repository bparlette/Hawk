// build_map_redo.mjs — Queue 4 Task 1: CITY MAP REDO bake-off (before/ vs after/).
// Audits and preserves Fable's shipped CityMap (before/) and bakes the full 1800x2200 Palm City
// world directly through the game's own GroundPainter + Renderer at overview scale (900x1100,
// 0.5 px/wu) for both golden hour (t=0.25) and blue dusk (t=0.90), then renders phone-size
// (420x860 @2x) candidate views with painted signage/plaque POIs and side-by-side bake-off sheets.
// Usage: node tools/build_map_redo.mjs
import { chromium } from 'playwright-core';
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

// Copy Fable's existing reference captures untouched into before/
for (const f of ['map-spawn.png', 'map-motel.png']) {
  const src = path.join(ROOT, 'shots', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(BEFORE, f));
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
  });
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });

function encodeWebp(pngPath, webpPath, q = 92) {
  execFileSync('cwebp', ['-q', String(q), pngPath, '-o', webpPath], { stdio: 'ignore' });
}

async function openPhone(tod) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await page.goto(`http://localhost:${port}/index.html?t=${tod}&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim && window.__palm.renderer && window.__palm.ground);
  await page.waitForTimeout(3500);
  // Open map via real touch on MAP button
  const btn = await page.evaluate(() => {
    const m = window.__palm.input.mapBtn(), r = document.querySelector('canvas').getBoundingClientRect(), k = r.width / 420;
    return { x: r.left + (m.x + m.w / 2) * k, y: r.top + (m.y + m.h / 2) * k };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x, y: btn.y, id: 5 }] });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(500);
  return page;
}

// 1. Capture BEFORE phone shots (Fable's shipped CityMap) at golden (t=0.25) and dusk (t=0.90)
for (const [label, tod] of [['golden', 0.25], ['dusk', 0.90]]) {
  const page = await openPhone(tod);
  await page.screenshot({ path: path.join(BEFORE, `map-before-${label}.png`) });
  await page.close();
}

// 2. Bake the full 1800x2200 painted world overview at 900x1100 (0.5 px/wu) through the game's OWN Renderer
const baker = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });
await baker.goto(`http://localhost:${port}/index.html?t=0.25&dpr=1`);
await baker.waitForFunction(() => window.__palm && window.__palm.sim && window.__palm.renderer && window.__palm.ground);
await baker.waitForTimeout(3500);

const bases = {};
for (const [label, tod] of [['golden', 0.25], ['dusk', 0.90]]) {
  const dataUrl = await baker.evaluate(async (t) => {
    const { Renderer } = await import('/src/render.js');
    const { world, ground, M, sim } = window.__palm;
    const W = world.L.world.w, H = world.L.world.h; // 1800 x 2200
    const outW = 900, outH = 1100;
    const cv = document.createElement('canvas');
    cv.width = outW; cv.height = outH;
    const ctx = cv.getContext('2d');
    const r = new Renderer(ctx, world, ground, M);
    r.chaseOK = false;
    r.drawActivityMarkers = () => {};
    r.resize(outW, outH, 1);

    // Static world snapshot: no traffic cars, no peds, no active beacons/jobs/chopper/heli
    const cleanSim = {
      ...sim,
      cars: [],
      peds: [],
      board: null,
      chopper: null,
      heli: null,
      watercraft: [],
      boats: [],
      job: null,
      event: null,
      eventSites: [],
      fx: [],
      stars: 0,
      busted: null,
      siege: null,
      chase: null,
      focus: () => ({ x: W / 2, y: H / 2 }),
      player: { mode: 'foot', ped: { x: -9999, y: -9999, h: 0, hidden: true } },
    };
    r.draw(cleanSim, { x: W / 2, y: H / 2, zoom: outW / W, kick: 1, roll: 0 }, t, 1.5);
    return cv.toDataURL('image/png');
  }, tod);

  const tmpPng = path.join('/tmp', `map_base_${label}.png`);
  fs.writeFileSync(tmpPng, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const webpPath = path.join(AFTER, `map_base_${label}.webp`);
  encodeWebp(tmpPng, webpPath, 92);
  fs.unlinkSync(tmpPng);
  bases[label] = dataUrl;
}
await baker.close();

// 3. Render AFTER phone-size views (420x860 @2x): live game frame + baked painted map + painted plaque POIs
for (const [label, tod] of [['golden', 0.25], ['dusk', 0.90]]) {
  const page = await openPhone(tod);
  const b64 = bases[label];
  await page.evaluate(async ({ baseUrl, todVal }) => {
    // Stop main.js rAF loop so our candidate render stays on canvas for the screenshot
    window.requestAnimationFrame = () => 0;
    const { mapFrame, mapPOIs, playerMarker, toMap } = await import('/src/map.js');
    const { world, sim } = window.__palm;
    const INK = '#210f2e';

    // Load baked overview image
    const img = new Image();
    img.src = baseUrl;
    await new Promise(res => { img.onload = res; });

    const cv = document.querySelector('canvas');
    const g = cv.getContext('2d');
    const vw = 420, vh = 860, dpr = 2;
    const F = mapFrame(vw, vh, world);
    const time = 1.5;

    // Snapshot top HUD (0..96) & bottom controls (710..860) from live canvas
    const snap = document.createElement('canvas');
    snap.width = cv.width; snap.height = cv.height;
    snap.getContext('2d').drawImage(cv, 0, 0);

    // Draw the map overlay in the exact mapFrame geometry, replacing Fable's flat CityMap.draw
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(24,12,40,0.88)';
    g.fillRect(0, 0, vw, vh);

    // Restore live top HUD & bottom controls untouched
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(snap, 0, 0, cv.width, 96 * dpr, 0, 0, cv.width, 96 * dpr);
    g.drawImage(snap, 0, 710 * dpr, cv.width, (vh - 710) * dpr, 0, 710 * dpr, cv.width, (vh - 710) * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Painted parchment / sunset bezel matching HUD plaques
    g.save();
    g.shadowColor = 'rgba(16,8,28,0.65)';
    g.shadowBlur = 18;
    g.shadowOffsetY = 6;
    g.fillStyle = '#f6e6c4';
    g.beginPath(); g.roundRect(F.x - 6, F.y - 6, F.w + 12, F.h + 12, 10); g.fill();
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.roundRect(F.x - 6, F.y - 6, F.w + 12, F.h + 12, 10); g.stroke();

    // Clip to rounded inner frame and draw baked painted world
    g.save();
    g.beginPath(); g.roundRect(F.x, F.y, F.w, F.h, 5); g.clip();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, F.x, F.y, F.w, F.h);
    // Subtle warm/ink inner vignette so the map sits like a printed aerial plate
    g.strokeStyle = 'rgba(33,15,46,0.35)';
    g.lineWidth = 2;
    g.strokeRect(F.x + 1, F.y + 1, F.w - 2, F.h - 2);
    g.restore();

    // Header plaque: PALM CITY
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 20px "Avenir Next", Futura, system-ui, sans-serif';
    g.lineWidth = 5; g.strokeStyle = 'rgba(33,15,46,0.85)'; g.strokeText('PALM CITY', vw / 2, F.y - 24);
    g.fillStyle = '#ffd45c'; g.fillText('PALM CITY', vw / 2, F.y - 24);

    // Smart non-overlapping POI offsets (map-space px delta [dx, dy] for close neighbours)
    const OFFSETS = {
      'WRECK IT!': [-6, -15],
      'SKATE PARK': [-10, 14],
      'SPOTLIGHT RAVE': [0, -13],
      'HELICOPTER': [-8, -16],
      'HOSPITAL': [-6, 13],
      'BOARD CHASE': [-2, -26],
      'PIER': [6, -12],
      'BOATS': [12, 13],
      'GETAWAY': [-22, -14],
      'TOW': [-10, 12],
      'TAXI': [10, -14],
      'BUS': [28, 12],
      'POLICE': [-4, -4],
      'VALET — PARK IT!': [18, 15],
      'GARAGE': [6, 8],
    };

    const drawPlaque = (text, px, py, kind) => {
      const palette = {
        place: { bg: 'rgba(252,238,210,0.92)', fg: '#210f2e', bd: '#210f2e', fs: 8.5 },
        area:  { bg: 'rgba(246,220,174,0.90)', fg: '#3b1c4a', bd: '#210f2e', fs: 8.5 },
        door:  { bg: '#ff5c9a', fg: '#fff8ec', bd: '#210f2e', fs: 9 },
        job:   { bg: 'rgba(28,22,48,0.92)', fg: '#6ee2ff', bd: '#6ee2ff', fs: 8 },
        target:{ bg: '#ffd45c', fg: '#210f2e', bd: '#210f2e', fs: 9 },
      }[kind] || { bg: 'rgba(252,238,210,0.92)', fg: '#210f2e', bd: '#210f2e', fs: 8.5 };

      g.font = `900 ${palette.fs}px "Avenir Next", Futura, system-ui, sans-serif`;
      const tw = g.measureText(text).width;
      const pw = tw + 9, ph = 14, r = 4.5;
      const bx = Math.max(F.x + 3, Math.min(F.x + F.w - pw - 3, px - pw / 2));
      const by = Math.max(F.y + 3, Math.min(F.y + F.h - ph - 3, py - ph / 2));

      g.save();
      g.shadowColor = 'rgba(20,10,32,0.55)'; g.shadowBlur = 4; g.shadowOffsetY = 1.5;
      g.fillStyle = palette.bg;
      g.beginPath(); g.roundRect(bx, by, pw, ph, r); g.fill();
      g.restore();
      g.lineWidth = 1.4; g.strokeStyle = palette.bd;
      g.beginPath(); g.roundRect(bx, by, pw, ph, r); g.stroke();
      g.fillStyle = palette.fg;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, bx + pw / 2, by + ph / 2 + 0.5);
    };

    const pois = mapPOIs(world, sim);
    for (const q of pois) {
      const [x, y] = toMap(F, q.p[0], q.p[1]);
      if (q.kind === 'door' || q.kind === 'job' || q.kind === 'target') {
        const col = q.kind === 'door' ? '#ff5c9a' : q.kind === 'target' ? '#ffd45c' : '#6ee2ff';
        const rad = q.kind === 'target' ? 6 : 4;
        g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 1.6;
        g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.stroke();
      }
    }
    for (const q of pois) {
      const [ax, ay] = toMap(F, q.p[0], q.p[1]);
      const off = OFFSETS[q.name] || [0, (q.kind === 'door' || q.kind === 'job' || q.kind === 'target') ? -13 : 0];
      const lx = ax + off[0], ly = ay + off[1];
      if (Math.hypot(off[0], off[1]) > 15) {
        g.strokeStyle = 'rgba(255,244,214,0.85)'; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(lx, ly); g.stroke();
      }
      const label = q.name === 'VALET — PARK IT!' ? 'VALET' : q.name === 'SPOTLIGHT RAVE' ? 'RAVE' : q.name;
      drawPlaque(label, lx, ly, q.kind);
    }

    // Live player marker
    const m = playerMarker(F, sim);
    g.save(); g.translate(m.x, m.y);
    g.fillStyle = 'rgba(255,212,92,0.35)'; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill();
    g.rotate(m.h);
    g.fillStyle = '#ffd45c'; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(10, 0); g.lineTo(-7, -7); g.lineTo(-3, 0); g.lineTo(-7, 7); g.closePath(); g.fill(); g.stroke();
    g.restore();
    drawPlaque('YOU', m.x, m.y + 18, 'target');

    void todVal; void time;
  }, { baseUrl: b64, todVal: tod });

  await page.screenshot({ path: path.join(AFTER, `map-after-${label}.png`) });
  await page.close();
}

// 4. Composite phone-size side-by-side bake-off sheets (before vs after) at golden and dusk
const comp = await browser.newPage({ viewport: { width: 920, height: 940 }, deviceScaleFactor: 1 });
for (const label of ['golden', 'dusk']) {
  const bUrl = 'data:image/png;base64,' + fs.readFileSync(path.join(BEFORE, `map-before-${label}.png`)).toString('base64');
  const aUrl = 'data:image/png;base64,' + fs.readFileSync(path.join(AFTER, `map-after-${label}.png`)).toString('base64');
  await comp.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;display:flex;flex-direction:column;align-items:center;padding:14px;">
      <div style="font-weight:900;font-size:18px;letter-spacing:1px;margin-bottom:10px;color:#ffd45c;">
        PALM CITY MAP REDO BAKE-OFF — ${label.toUpperCase()} (420×860 PHONE)
      </div>
      <div style="display:flex;gap:20px;align-items:flex-start;">
        <div style="text-align:center;">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;color:#ff9a8a;">BEFORE — Fable Shipped Diagram</div>
          <img src="${bUrl}" style="width:420px;height:860px;border:2px solid #523a68;border-radius:12px;display:block;"/>
        </div>
        <div style="text-align:center;">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;color:#7dffa8;">AFTER — Painted World Overview + Signage Plaques</div>
          <img src="${aUrl}" style="width:420px;height:860px;border:2px solid #ffd45c;border-radius:12px;display:block;"/>
        </div>
      </div>
    </body></html>
  `);
  await comp.waitForTimeout(300);
  await comp.screenshot({ path: path.join(OUT, `bakeoff-${label}-phone.png`), fullPage: true });
}
await comp.close();
await browser.close();
server.close();
console.log('MAP REDO BAKE-OFF BUILT:', OUT);
