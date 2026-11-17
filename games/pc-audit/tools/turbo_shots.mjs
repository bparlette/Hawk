// turbo_shots.mjs — 7D proof pair at phone size (420x860 @2x, touch): the A button on foot (PUNCH)
// and in a car (TURBO, held with a real touch while the up key drives — streaks, glow, burn ring).
// Usage: CHROME=/path/to/chrome node tools/turbo_shots.mjs  -> shots/turbo-foot-punch.png, shots/turbo-car-turbo.png
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const errors = [];
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://localhost:${server.address().port}/index.html?t=0.2&dpr=2`);
await page.waitForFunction(() => window.__palm && window.__palm.sim);
await page.waitForTimeout(6000);
const cdp = await page.context().newCDPSession(page);
const state = () => page.evaluate(() => { const s = window.__palm.sim, c = s.player.car; return { mode: s.player.mode, v: c ? Math.round(c.v) : 0, turbo: c ? +(c.turbo || 0).toFixed(2) : 0 }; });
await page.screenshot({ path: path.join(ROOT, 'shots', 'turbo-foot-punch.png') });
console.log('wrote shots/turbo-foot-punch.png', JSON.stringify(await state()));
// seat the player on the top road heading east, then drive with the keyboard and hold A with a touch
await page.evaluate(() => { const s = window.__palm.sim, P = s.player, c = s.cars.find(k => k.model === 'conv_mint');
  s.addStars = () => {}; P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true; c.x = 520; c.y = 203; c.h = 0; c.v = 0; });
await page.keyboard.down('ArrowUp');
await page.waitForFunction(() => window.__palm.sim.player.car.v > 200, null, { timeout: 20000, polling: 'raf' });
const a = await page.evaluate(() => ({ x: 420 - 164, y: innerHeight - 82 }));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 4 }] });
await page.waitForFunction(() => { const c = window.__palm.sim.player.car; return c.turbo > 0.95 && c.v > 330; }, null, { timeout: 20000, polling: 'raf' });
await page.screenshot({ path: path.join(ROOT, 'shots', 'turbo-car-turbo.png') });
console.log('wrote shots/turbo-car-turbo.png', JSON.stringify(await state()));
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
