// AUDIT PROBE (Opus, Nov 17): hover the stolen heli and watch the ground LRU. Needs a served tree where ../palm-city resolves (see AUDIT-REPORT.md 'How the suite was run'). CHROME path is hard-wired to the cloud box's /opt/pw-browsers/chromium — edit for a Mac.
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.ogg': 'audio/ogg' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const h of [1000]) {
  const page = await browser.newPage({ viewport: { width: 420, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://localhost:${server.address().port}/index.html?nostart&nodirector`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 90000 });
  await page.evaluate(async () => { const { jump } = await import('./src/activities.js'); const s = window.__palm.sim; jump(s, 'heli'); });
  await page.waitForTimeout(500);
  await page.evaluate(async () => { const { stealOrBoard } = await import('./src/heli.js'); const s = window.__palm.sim; stealOrBoard(s); s.heli.x = 900; s.heli.y = 1100; });
  await page.waitForTimeout(30000);   // zoom out, settle, hover in place
  const a = await page.evaluate(() => ({ ...window.__palm.ground.stats, size: window.__palm.ground.cache.size, zoom: window.__palm.cam.zoom, mode: window.__palm.sim.player.mode, x: window.__palm.sim.heli.x }));
  await page.waitForTimeout(15000);
  const b = await page.evaluate(() => ({ ...window.__palm.ground.stats, size: window.__palm.ground.cache.size, x: window.__palm.sim.heli.x }));
  console.log(`view 420x${h}: hovering 10 s at zoom ${a.zoom.toFixed(2)} (${a.mode}, x ${Math.round(a.x)}->${Math.round(b.x)}): chunks painted +${b.sliced - a.sliced} sliced / +${b.sync - a.sync} sync, evicted +${b.evicted - a.evicted}, cache ${b.size}`, errs.slice(0, 2));
  await page.close();
}
await browser.close(); server.close();
