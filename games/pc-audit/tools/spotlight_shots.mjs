// spotlight_shots.mjs — SPOTLIGHT RAVE captures at phone size (420x860 @2x) in the real page.
//   spotlight-rave.png : mid-rave — donuts inside the beam pool at the plaza fountain, the
//                        crowd bouncing on the verges, the HYPE card up
//   spotlight-tier3.png: tier 3 — five stars, cruisers closing in, the beam leading the car
// Waits are in SIM time (this VM's headless shell renders slowly): a step hook watches the
// sim and freezes it on the exact step wanted, the chase_shots.mjs pattern. The beam is
// glued to the car until its first lock so the staged donut starts inside the light; after
// that the real pressure system owns it. Tier 3 is staged by setting the hype over the
// tier line (the tier-up, backup cruisers and beam lead then happen for real).
// Usage: CHROME=/path/to/chrome node tools/spotlight_shots.mjs
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://localhost:${server.address().port}/index.html?t=0.62&dpr=2`);
await page.waitForFunction(() => window.__palm && window.__palm.sim);
await page.waitForTimeout(4000);
const cdp = await page.context().newCDPSession(page);
const st = () => page.evaluate(() => { const s = window.__palm.sim, e = s.event; return { mode: s.player.mode, stars: s.stars, event: e && e.kind, hype: e && Math.round(e.hype), tier: e && e.tier, inBeam: e && e.inBeam, cops: s.cars.filter(c => c.driver === 'police').length, crowd: s.peds.filter(p => p.crowd).length }; });
await page.evaluate(() => { window.__ui.jump = 'spot'; });                 // what the JUMP row does
await page.waitForFunction(() => window.__palm.sim.player.mode === 'car', null, { timeout: 8000 });
await page.waitForTimeout(1200);
// the freeze-on-condition step wrapper (kept on window so phase 2 can re-arm it)
await page.evaluate(() => { const s = window.__palm.sim, orig = s.step.bind(s);
  window.__phase = 1;
  window.__wrap = (dt, inp) => { const c = s.player.car, e = s.event;
    if (e && s.chopper && !s.chopper.lock) { s.chopper.bx = c.x; s.chopper.by = c.y; }   // staged: first lock only
    orig(dt, inp);
    if (!e) return;
    if (window.__phase === 1 && e.count <= 0 && e.hype > 18 && e.inBeam) { window.__frozen = 1; s.step = () => {}; }
    else if (window.__phase === 2 && e.tier === 3 && e.inBeam && s.cars.some(k => k.driver === 'police' && Math.hypot(k.x - c.x, k.y - c.y) < 320)) { window.__frozen = 2; s.step = () => {}; }
  };
  s.step = window.__wrap;
});
const a = await page.evaluate(() => ({ x: 420 - 164, y: innerHeight - 82 }));   // the A (fight) button
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 4 }] });
await page.waitForTimeout(80);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForFunction(() => window.__palm.sim.event && window.__palm.sim.event.kind === 'spot', null, { timeout: 8000 });
await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowLeft');
await page.waitForFunction(() => window.__frozen === 1, null, { timeout: 120000 });
await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(ROOT, 'shots', 'spotlight-rave.png') });
console.log('wrote shots/spotlight-rave.png', JSON.stringify(await st()));
// phase 2: hype over the tier-3 line, re-arm the wrapper, keep donuting until a cruiser closes in
await page.evaluate(() => { const s = window.__palm.sim; s.event.hype = 80; window.__phase = 2; s.step = window.__wrap; });
await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowLeft');
await page.waitForFunction(() => window.__frozen === 2, null, { timeout: 120000 });
await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(ROOT, 'shots', 'spotlight-tier3.png') });
console.log('wrote shots/spotlight-tier3.png', JSON.stringify(await st()));
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
