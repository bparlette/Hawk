// build_store_art.mjs — stitch golden-hour NOVA panorama from live game and export 5 store capsules
// Usage: CHROME=/path/to/chrome node tools/build_store_art.mjs
// Outputs: shots/store-art/{crazygames-cover-1920x1080,crazygames-thumb-800x450,crazygames-portrait-1080x1440,itch-cover-630x500,itch-header-banner-1600x400}.png
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'shots', 'store-art');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
  });
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox'] });
const tiles = [];
for (const camX of [640, 1035, 1430]) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/index.html?t=0.1&dpr=2&cam=${camX},1220`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(4800);
  await page.evaluate(() => {
    const s = window.__palm.sim;
    s.stars = 5;
    // Stage golden-hour NOVA chase & chopper searchlight cone if not active
    s.chopper = { x: 1120, y: 1105, aimX: 1020, aimY: 1245, t: 0 };
    s.player.ped.hidden = true;
    const pcar = s.addCar(955, 1295, -0.18, 'conv_rose', 'player'); pcar.v = 110;
    s.player.mode = 'car'; s.player.car = pcar;
    s.addCar(1140, 1215, Math.PI * 0.85, 'police', 'police');
    s.addCar(1210, 1260, -Math.PI * 0.72, 'police', 'police');
  });
  await page.waitForTimeout(900);
  const pngBuf = await page.locator('#game').screenshot({ type: 'png' });
  tiles.push('data:image/png;base64,' + pngBuf.toString('base64'));
  await ctx.close();
}

const page = await browser.newPage({ viewport: { width: 1920, height: 1440 } });
await page.setContent(`<body style="margin:0;background:#1a0d26;"><canvas id="pano" width="2420" height="1720"></canvas><canvas id="out" width="1920" height="1080"></canvas><script>
window.exportStoreArt = async (tilesB64) => {
  const imgs = [];
  for (const s of tilesB64) { const im = new Image(); im.src = s; await new Promise(r => im.onload = r); imgs.push(im); }
  const pano = document.getElementById('pano'), pg = pano.getContext('2d');
  pg.drawImage(imgs[0], 0, 0);
  const stepX = 790;
  for (let i = 1; i < imgs.length; i++) {
    const [tc, tg] = [document.createElement('canvas'), null];
    tc.width = imgs[i].width; tc.height = imgs[i].height;
    const g = tc.getContext('2d'); g.drawImage(imgs[i], 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const mask = g.createLinearGradient(0, 0, imgs[i].width, 0);
    mask.addColorStop(0, 'rgba(0,0,0,0)'); mask.addColorStop(42 / imgs[i].width, 'rgba(0,0,0,1)'); mask.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = mask; g.fillRect(0, 0, imgs[i].width, imgs[i].height);
    pg.drawImage(tc, i * stepX, 0);
  }
  const drawWordmark = (g, cx, cy, fs, showSub) => {
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 ' + fs + 'px "Arial Black", Impact, sans-serif';
    g.shadowColor = 'rgba(22,8,34,0.86)'; g.shadowBlur = 18; g.shadowOffsetY = 5;
    g.lineWidth = Math.max(8, Math.round(fs * 0.16)); g.strokeStyle = '#210f2e'; g.lineJoin = 'round';
    g.strokeText('PALM CITY', cx, cy);
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    const wg = g.createLinearGradient(0, cy - fs * 0.45, 0, cy + fs * 0.45);
    wg.addColorStop(0.0, '#fff7cf'); wg.addColorStop(0.45, '#ffc459'); wg.addColorStop(1.0, '#ff5e82');
    g.fillStyle = wg; g.fillText('PALM CITY', cx, cy);
    if (showSub) {
      g.font = '800 ' + Math.round(fs * 0.26) + 'px "Helvetica Neue", Arial, sans-serif';
      g.lineWidth = 4; g.strokeStyle = '#1b0b28'; g.strokeText('OPEN-CITY CRIME • SKATE • CHAOS', cx, cy + fs * 0.65);
      g.fillStyle = '#fff3d2'; g.fillText('OPEN-CITY CRIME • SKATE • CHAOS', cx, cy + fs * 0.65);
    }
    g.restore();
  };
  const exports = {};
  const jobs = [
    ['crazygames-cover-1920x1080.png', 1920, 1080, 320, 190, 2100, 1181, 470, 175, 112, true],
    ['crazygames-thumb-800x450.png',   800,  450,  560, 270, 1840, 1035, 225, 82,  58,  false],
    ['crazygames-portrait-1080x1440.png', 1080, 1440, 740, 20, 1680, 1680, 540, 205, 96, true],
    ['itch-cover-630x500.png',         630,  500,  580, 200, 1800, 1428, 195, 95,  50,  true],
    ['itch-header-banner-1600x400.png', 1600, 400, 140, 740, 2240, 560, 360, 165, 102, true],
  ];
  const oc = document.getElementById('out');
  for (const [name, w, h, sx, sy, sw, sh, tx, ty, fs, sub] of jobs) {
    oc.width = w; oc.height = h;
    const og = oc.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
    og.drawImage(pano, sx, sy, sw, sh, 0, 0, w, h);
    drawWordmark(og, tx, ty, fs, sub);
    exports[name] = oc.toDataURL('image/png');
  }
  return exports;
};
</script></body>`);

const exportsMap = await page.evaluate((t) => window.exportStoreArt(t), tiles);
for (const [name, dataUrl] of Object.entries(exportsMap)) {
  fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
}
await browser.close();
server.close();
console.log('Exported 5 store-art capsules to', OUT);
