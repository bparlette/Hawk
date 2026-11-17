// uitest_shots.mjs — phone-size captures for the Nov 17 UI rules, framed like the
// owner's beach screenshot: standing on the promenade south of the pier, the BOATS
// sign and the moored jetski in frame, water filling the right two-thirds.
//   uitest_controls_early.png  first seconds of play: movement hint circle visible
//   uitest_controls_late.png   after the fade: circle gone, chips + buttons remain
//   uitest_corner.png          full frame for the REC/NEWS corner comparison
//   uitest_corner_clip.png     the top-right corner, clipped
// Run it in a pristine tree as well to get the "before" frames. Waits poll sim.time
// (this VM renders slowly; wall-clock waits lie). Real flow: the start page is
// dismissed with a real touch on PLAY, exactly as a player does it.
// Usage: node tools/uitest_shots.mjs [out-prefix]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = process.argv[2] || '';
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
async function waitSimUntil(t, capMs = 180000) {
  const end = Date.now() + capMs;
  while (Date.now() < end) { if (await simTime() >= t) return true; await page.waitForTimeout(300); }
  return false;
}

await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 30000 });
await page.waitForTimeout(1200);
{ // dismiss the start page with a real touch on PLAY
  const { helpLayout } = await import('../src/help.js');
  const n = await page.evaluate(() => window.__palm.sim.activities.filter(a => a.group !== 'hub').length);
  const L = helpLayout(420, await page.evaluate(() => innerHeight), n, 'start', 0);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: L.btn.x + L.btn.w / 2, y: L.btn.y + L.btn.h / 2, id: 8 }] });
  await page.waitForTimeout(80);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
}
// to the promenade south of the pier: ped + camera placed together, the sim runs on
await page.evaluate(() => {
  const s = window.__palm.sim;
  s.player.ped.x = 1470; s.player.ped.y = 1180;
  window.__palm.cam.x = 1470; window.__palm.cam.y = 1180;
});
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, prefix + 'uitest_controls_early.png') });
await page.screenshot({ path: path.join(OUT, prefix + 'uitest_corner.png') });
await page.screenshot({ path: path.join(OUT, prefix + 'uitest_corner_clip.png'), clip: { x: 150, y: 0, width: 270, height: 210 } });
await waitSimUntil(6.5);
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, prefix + 'uitest_controls_late.png') });
console.log('shots done ->', OUT, prefix);
await browser.close();
server.close();
