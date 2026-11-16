// touch_check.mjs — verifies the controls with real touch events (CDP Input.dispatchTouchEvent),
// not mouse clicks: drag the floating joystick to walk to the parked convertible, tap the round
// action button to jack it, drive with the stick, tap again to get out. First of all: tap the
// fight button and see a punch thrown.
// Usage: node tools/touch_check.mjs [shots-prefix]
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = process.argv[2] || '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
});
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://localhost:${server.address().port}/index.html`);
await page.waitForFunction(() => window.__palm && window.__palm.sim);
await page.waitForTimeout(1500);
const cdp = await page.context().newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });
const state = () => page.evaluate(() => { const s = window.__palm.sim, f = s.focus(); return { mode: s.player.mode, x: f.x, y: f.y, v: f.v || 0, stars: s.stars }; });
const fail = (m) => { console.error('TOUCH FAIL:', m); process.exitCode = 1; };

// fight button (left of the action button): one tap = one punch
const fb = await page.evaluate(() => ({ x: 420 - 164, y: innerHeight - 82 }));
await touch('touchStart', [[fb.x, fb.y, 9]]);
await page.waitForTimeout(80);
await touch('touchEnd', []);
await page.waitForTimeout(600);
const punches = await page.evaluate(() => window.__palm.sim.player.punchN || 0);
console.log('after fight tap: punches', punches);
if (punches !== 1) fail('fight button did not throw a punch');
const s0 = await state();
console.log('start', s0);
// joystick: press left half, drag toward the convertible (parked at 1302,1300 — south-east of spawn)
const target = await page.evaluate(() => { const c = window.__palm.sim.cars.find(c => c.model === 'conv_mint'); return { x: c.x, y: c.y }; });
let cur = await state();
await touch('touchStart', [[100, 640, 1]]);
for (let i = 0; i < 160; i++) {
  cur = await state();
  const dx = target.x - cur.x, dy = target.y - cur.y, d = Math.hypot(dx, dy);
  if (d < 30) break;
  await touch('touchMove', [[100 + dx / d * 50, 640 + dy / d * 50, 1]]);
  await page.waitForTimeout(50);
}
await touch('touchEnd', []);
const s1 = await state();
console.log('after joystick walk', s1);
if (Math.hypot(s1.x - s0.x, s1.y - s0.y) < 30) fail('joystick did not move the player');
if (prefix) await page.screenshot({ path: prefix + '_1_walk.png' });
// action button (bottom-right circle)
const btn = await page.evaluate(() => ({ x: 420 - 72, y: innerHeight - 120 }));
await touch('touchStart', [[btn.x, btn.y, 2]]);
await page.waitForTimeout(80);
await touch('touchEnd', []);
await page.waitForTimeout(300);
const s2 = await state();
console.log('after button tap', s2);
if (s2.mode !== 'car') fail('action button did not jack the car');
// drive north with the stick
await touch('touchStart', [[100, 640, 3]]);
await touch('touchMove', [[100, 590, 3]]);
await page.waitForTimeout(1500);
const s3 = await state();
await touch('touchEnd', []);
console.log('after driving', s3);
if (Math.hypot(s3.x - s2.x, s3.y - s2.y) < 60) fail('stick did not drive the car');
if (prefix) await page.screenshot({ path: prefix + '_2_drive.png' });
// let it roll down to exit speed (a slow machine runs the sim slower than real time, so wait on the speed, not the clock)
for (let i = 0; i < 80 && Math.abs((await state()).v) > 40; i++) await page.waitForTimeout(150);
await touch('touchStart', [[btn.x, btn.y, 4]]);
await page.waitForTimeout(80);
await touch('touchEnd', []);
await page.waitForTimeout(300);
const s4 = await state();
console.log('after exit tap', s4);
if (s4.mode !== 'foot') fail('action button did not exit the car');
if (errors.length) fail(errors.join('\n'));
await browser.close();
server.close();
if (!process.exitCode) console.log('TOUCH OK');
