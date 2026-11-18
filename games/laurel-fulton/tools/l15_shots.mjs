// l15_shots.mjs — task L15 evidence on the REAL page (420x860 @2x): an ambient car passing, a pursuit (wanted stars + a cruiser with its
// light bar and siren pools), and the cooldown (LEVEL DOWN, one star left).   CHROME=<chromium> node tools/l15_shots.mjs   -> shots/l15-*.png
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright-core');   // PLAYWRIGHT=<path to playwright/index.mjs> if playwright-core is not resolvable
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const open = async (q) => { const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  await p.goto(`http://localhost:${web.address().port}/laurel-fulton/play.html?free&nointro${q}`); await p.waitForFunction(() => window.__lf, null, { timeout: 120000 }); await p.waitForTimeout(4000); return p; };
const shot = (p, n) => p.screenshot({ path: path.join(ROOT, `shots/l15-${n}.png`) });
// 1 — an ambient car passing the parked player
{ const p = await open('&t=0.3'); await p.evaluate(() => { window.__lf.traffic.nextSpawn = 0; window.__lf.setSpeed(6); });
  await p.waitForFunction(() => { const S = window.__lf.sim, c = S.cars.find(c => c.ambient); return c && Math.hypot(c.x - S.player.x, c.y - S.player.y) < 170; }, null, { timeout: 120000, polling: 50 });
  await p.evaluate(() => window.__lf.setSpeed(1)); await p.waitForTimeout(150);
  console.log('ambient:', JSON.stringify(await p.evaluate(() => { const S = window.__lf.sim; return S.cars.filter(c => c.ambient).map(c => [c.model, Math.round(c.v / 4.47) + ' mph', Math.round(Math.hypot(c.x - S.player.x, c.y - S.player.y))]); })));
  await shot(p, 'ambient-pass'); await p.close(); }
// 2/3 — pursuit at dusk (the light bar reads), then the cooldown
{ const p = await open('&t=0.85'); await p.evaluate(() => { const L = window.__lf; L.cops.offense('speeding', 2); L.setSpeed(6); });
  await p.waitForFunction(() => { const L = window.__lf, S = L.sim, c = L.cops.chasers[0]; return c && Math.hypot(c.x - S.player.x, c.y - S.player.y) < 230; }, null, { timeout: 120000, polling: 50 });
  await p.evaluate(() => window.__lf.setSpeed(1)); await p.waitForTimeout(300);
  console.log('pursuit:', JSON.stringify(await p.evaluate(() => { const L = window.__lf; return { level: L.cops.level, chasers: L.cops.chasers.length, spawnD: L.cops.stats.spawns.map(s => Math.round(s.d)) }; })));
  await shot(p, 'pursuit');
  await p.evaluate(() => { const L = window.__lf, S = L.sim; L.cops.opts.noSpawn = true; for (const c of L.cops.chasers.slice()) { S.cars.splice(S.cars.indexOf(c), 1); } L.cops.chasers.length = 0; L.setSpeed(8); });
  await p.waitForFunction(() => window.__lf.cops.level === 1 && window.__lf.cops.msg, null, { timeout: 120000, polling: 50 });
  await p.evaluate(() => window.__lf.setSpeed(1)); await p.waitForTimeout(250); await shot(p, 'cooldown');
  console.log('cooldown:', JSON.stringify(await p.evaluate(() => ({ level: window.__lf.cops.level, msg: window.__lf.cops.msg && window.__lf.cops.msg.text }))));
  await p.close(); }
await browser.close(); web.close();
