// watershadow_shots.mjs — phone-size before/after captures for the watercraft rider shadow
// (owner, Nov 17): the jetski and the cigarette boat under way on open water. Run it in a
// pristine tree with WS_TAG=before and in the fixed tree with WS_TAG=after; same staging,
// same recipe as watercraft_shots.mjs (waits measured in SIM time).
// Usage: WS_TAG=after node tools/watershadow_shots.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAG = process.env.WS_TAG || 'after';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
page.on('pageerror', e => console.log('PAGE ERROR', String(e).slice(0, 200)));
const OUT = path.join(ROOT, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const simTime = () => page.evaluate(() => window.__palm.sim.time);
async function waitSim(secs, capMs = 180000) {
  const t0 = await simTime(), end = Date.now() + capMs;
  while (Date.now() < end) { if (await simTime() - t0 >= secs) return true; await page.waitForTimeout(400); }
  return false;
}
const load = async () => {
  await page.goto(`http://127.0.0.1:${port}/index.html?t=0.2&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 30000 });
  await waitSim(3.4);
};
const stage = (kind, x, y, h, spd) => page.evaluate(([kind, x, y, h, spd]) => {
  const s = window.__palm.sim;
  const cr = s.water.craft.find(c => c.kind === kind);
  s.player.mode = 'water'; s.water.ride = cr; cr.ridden = true;
  cr.x = x; cr.y = y; cr.h = h; cr.vx = Math.cos(h) * spd; cr.vy = Math.sin(h) * spd;
  s.player.ped.x = x; s.player.ped.y = y;
  window.__palm.cam.x = x; window.__palm.cam.y = y;
}, [kind, x, y, h, spd]);

// Slow staging on purpose: at speed the camera eases out and the craft shrinks to a speck —
// at a coast the walking zoom holds and the shadow under the hull is legible at phone size.
await load();
await stage('jetski', 1750, 1500, -Math.PI / 2, 55);
await waitSim(0.9);
await page.screenshot({ path: path.join(OUT, `water-shadow-jetski-${TAG}.png`) });
console.log(`shot water-shadow-jetski-${TAG}.png`);

await load();
await stage('boat', 1750, 1900, -Math.PI / 2, 70);
await waitSim(0.9);
await page.screenshot({ path: path.join(OUT, `water-shadow-boat-${TAG}.png`) });
console.log(`shot water-shadow-boat-${TAG}.png`);

await browser.close();
server.close();
console.log('WATERSHADOW SHOTS DONE');
