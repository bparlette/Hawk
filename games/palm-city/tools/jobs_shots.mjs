// jobs_shots.mjs — phone-size captures of the four jobs in the real page. Each scene seats the
// player in the job vehicle, starts the job with a real TOUCH on the job button, then stages the
// moment (vehicle placed; throttle is the real keyboard) and captures.
// Usage: CHROME=/path/to/chrome node tools/jobs_shots.mjs [scene ...] -> shots/jobs-<scene>.png
//   scenes: taxi-pickup, taxi-fed, tow-swing, bus-stop, getaway-decoy
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const want = process.argv.slice(2), errors = [];
async function scene(name, tod, job, stage) {
  if (want.length && !want.includes(name)) return;
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + e));
  await page.goto(`http://localhost:${server.address().port}/index.html?t=${tod}&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(5000);
  const cdp = await page.context().newCDPSession(page);
  const fist = await page.evaluate(() => ({ x: 420 - 164, y: innerHeight - 82 }));
  const jobBtn = async () => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fist.x, y: fist.y, id: 4 }] }); await page.waitForTimeout(70); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(120); };
  await page.evaluate((job) => { const s = window.__palm.sim, P = s.player, c = s.cars.find(k => k.job === job);
    P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true; s.addStars = () => {}; }, job);
  await page.waitForTimeout(700);
  await jobBtn();                                            // START <JOB>
  await page.waitForFunction(() => !!window.__palm.sim.job, null, { timeout: 5000 });
  await stage(page, jobBtn);
  const file = path.join(ROOT, 'shots', `jobs-${name}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', file, JSON.stringify(await page.evaluate(() => { const s = window.__palm.sim, j = s.job; return { job: j && j.kind, phase: j && j.phase, score: s.score || 0, stars: s.stars }; })));
  await page.close();
}
const freeze = (page) => page.evaluate(() => { window.__palm.sim.step = () => {}; });
// taxi: pulling up to the waiting fare in its halo
await scene('taxi-pickup', 0.25, 'taxi', async (page) => {
  await page.evaluate(() => { const s = window.__palm.sim, j = s.job, c = j.car; c.x = j.spot[0] - 150; c.y = j.spot[1] + 4; c.h = 0; c.v = 60; });
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => { const s = window.__palm.sim, j = s.job, c = j.car; if (c.x > j.spot[0] - 62) { s.step = () => {}; return true; } return false; }, null, { timeout: 15000, polling: 'raf' });
  await page.keyboard.up('ArrowUp'); await page.waitForTimeout(500);
});
// taxi at 3 stars: the fare was a fed — cover blown, sign strobing, wheel fighting
await scene('taxi-fed', 0.9, 'taxi', async (page) => {
  await page.evaluate(() => { const s = window.__palm.sim, j = s.job, c = j.car; s.stars = 3; c.x = j.spot[0]; c.y = j.spot[1]; c.v = 0; });
  await page.waitForFunction(() => window.__palm.sim.job.fare, null, { timeout: 5000 });
  await page.evaluate(() => { const s = window.__palm.sim, j = s.job, c = j.car; j.fare.fed = true; j.fare.revealAt = 0.8; j.timer = 60; c.x = 500; c.y = 824; c.h = 0; });
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => { const f = window.__palm.sim.job && window.__palm.sim.job.fare; return f && f.revealed && f.t > f.revealAt + 0.5; }, null, { timeout: 15000, polling: 'raf' });
  await freeze(page); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(400);
});
// tow: hooked, payload swung into a cruiser
await scene('tow-swing', 0.3, 'tow', async (page, jobBtn) => {
  await page.evaluate(() => { const s = window.__palm.sim, j = s.job, c = j.car, t = j.target; c.x = 470; c.y = 1444; c.h = 0; c.v = 0; t.x = 410; t.y = 1444; t.h = 0; });
  await page.waitForTimeout(300); await jobBtn();          // HOOK
  await page.evaluate(() => { const s = window.__palm.sim; const cop = s.addCar(640, 1410, Math.PI, 'police', null, { parked: true, siren: true }); window.__cop = cop; });
  await page.keyboard.down('ArrowUp');
  // swing wide round the cruiser so the payload whips into it
  await page.evaluate(() => { const s = window.__palm.sim, c = s.job.car; window.__st = setInterval(() => { if (c.x > 560 && c.x < 700) c.h = 0.5; else if (c.x >= 700) c.h = -0.2; }, 16); });
  try { await page.waitForFunction(() => { const s = window.__palm.sim; if (window.__cop.dmg > 0.15) { window.__n = (window.__n || 0) + 1; if (window.__n > 6) { s.step = () => {}; return true; } } return false; }, null, { timeout: 15000, polling: 'raf' }); } catch (e) { await freeze(page); }
  await page.keyboard.up('ArrowUp'); await page.waitForTimeout(400);
});
// bus: riders jogging aboard at the stop, dwell bar filling
await scene('bus-stop', 0.25, 'bus', async (page) => {
  await page.evaluate(() => { const s = window.__palm.sim, j = s.job, c = j.car; c.x = j.spot[0] + 6; c.y = j.spot[1] + 30; c.h = Math.PI / 2; c.v = 0; });
  await page.waitForFunction(() => { const s = window.__palm.sim; if (s.job.dwell > 0.9) { s.step = () => {}; return true; } return false; }, null, { timeout: 15000, polling: 'raf' });
  await page.waitForTimeout(500);
});
// getaway: crew aboard, cops on the bumper, a decoy stack thrown
await scene('getaway-decoy', 0.9, 'getaway', async (page, jobBtn) => {
  await page.evaluate(() => { const s = window.__palm.sim, j = s.job, c = j.car; c.x = j.spot[0]; c.y = j.spot[1]; c.v = 0; });
  await page.waitForFunction(() => window.__palm.sim.job.phase === 'run', null, { timeout: 8000 });
  await page.evaluate(() => { const s = window.__palm.sim, c = s.job.car; c.x = 500; c.y = 824; c.h = 0; c.v = 150;
    for (const dx of [-90, -150]) { const k = s.addCar(c.x + dx, 824 + (dx < -100 ? -20 : 4), 0, 'police', 'police', { s: s.W.loopNearest(c.x, c.y), dir: 1 }); k.v = 170; k.siren = true; } });
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500);
  await jobBtn();                                           // DECOY
  await page.waitForTimeout(350); await freeze(page); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(400);
});
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
