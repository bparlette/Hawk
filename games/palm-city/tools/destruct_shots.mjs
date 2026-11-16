// destruct_shots.mjs — staged phone-size action captures of the destruction pass, in the real page.
// Each scene is set up through window.__palm (the live sim), then driven by the real input path
// (touch for the fight button, the keyboard for driving), and captured mid-destruction.
// Usage: CHROME=/path/to/chrome node tools/destruct_shots.mjs <before|after> [scene ...]
//   -> shots/destruct-<before|after>-<scene>.png
//   scenes: car-punch, car-ram, palm-ram, bush-plow, bench-ram, lamp-ram
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const prefix = process.argv[2] || 'after';
const want = process.argv.slice(3);
const errors = [];

async function scene(name, setup, drive) {
  if (want.length && !want.includes(name)) return;
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + e));
  await page.goto(`http://localhost:${server.address().port}/index.html?t=0.25`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(5500);                       // let the title card fade
  await page.evaluate(setup);
  await page.waitForTimeout(1300);                       // camera settles
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });
  await drive(page, touch);
  const file = path.join(ROOT, 'shots', `destruct-${prefix}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', file, JSON.stringify(await page.evaluate(() => {
    const s = window.__palm.sim, f = s.focus();
    return { mode: s.player.mode, x: Math.round(f.x), y: Math.round(f.y), stars: s.stars, score: s.score || 0 };
  })));
  await page.close();
}

// Put the player in a fresh car at (x, y), heading h, already moving at v. Driving is then the
// real keyboard path (ArrowUp held).
const inCar = (x, y, h, v) => `(() => { const s = window.__palm.sim, P = s.player;
  for (const c of s.cars) if (c.driver === 'ai' && Math.hypot(c.x - ${x}, c.y - ${y}) < 400) { c.x = -999; c.y = -999; }
  const c = s.addCar(${x}, ${y}, ${h}, 'sedan_coral', 'player'); c.v = ${v};
  P.mode = 'car'; P.car = c; P.ped.hidden = true; P.ped.x = ${x}; P.ped.y = ${y}; })()`;
// Hold the throttle until the car has run into something (it was fast, now it's slowed hard) or
// `until` holds — waits on the sim, not the clock, since headless Chrome runs the sim at its own
// pace — then keep holding `hold` ms and capture `after` ms later.
const drive = (until, hold = 0, after = 0) => async (page) => {
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(new Function(`const s = window.__palm.sim, c = s.player.car; if (!c) return true;
    s.__vmax = Math.max(s.__vmax || 0, Math.abs(c.v)); return (s.__vmax > 120 && Math.abs(c.v) < s.__vmax * 0.6) || (${until});`), null, { timeout: 15000, polling: 16 });
  if (hold) await page.waitForTimeout(hold);
  await page.keyboard.up('ArrowUp');
  if (after) await page.waitForTimeout(after);
};
const fightButton = (page) => page.evaluate(() => ({ x: 420 - 158, y: innerHeight - 74 }));

// car-punch: stand beside a parked convertible and hammer it with the fight button until it's a
// wreck. (Staging only: wanted is held at zero so a chase doesn't cover the shot.)
await scene('car-punch', () => { const s = window.__palm.sim, p = s.player.ped; p.x = 1324; p.y = 1300; p.h = Math.PI; s.addStars = () => {}; },
  async (page, touch) => {
    const b = await fightButton(page);
    for (let i = 0; i < 10; i++) { await touch('touchStart', [[b.x, b.y, 2]]); await page.waitForTimeout(80); await touch('touchEnd', []); await page.waitForTimeout(420); }
    await page.waitForTimeout(900);
  });
// Driving scenes start from rest and accelerate on the real throttle (ArrowUp), so the impact
// speed comes from the run-up, not from the setup.
// car-ram: T-bone the parked convertible (~100 units of run-up)
await scene('car-ram', inCar(1170, 1300, 0, 0), drive('false', 0, 400));
// palm-ram: floor it into a promenade palm; captured mid-fall
await scene('palm-ram', inCar(1150, 880, 0, 0), drive('false', 0, 250));
// bush-plow: drive through a cluster of five bushes on the villa lawns
await scene('bush-plow', inCar(34, 1771, 0, 0), drive('c.x > 215', 0, 0));
// bench-ram: cross the promenade into the side of a bench
await scene('bench-ram', inCar(1150, 1420, 0, 0), drive('false', 0, 300));
// lamp-ram: run down a street lamp
await scene('lamp-ram', inCar(1230, 930, Math.PI / 2, 0), drive('c.y > 1120', 0, 300));

await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
