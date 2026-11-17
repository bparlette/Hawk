// chase_shots.mjs — 7H captures at phone size (420x860 @2x) in the real page.
//   chase-start.png : on the board at the pier marker (JUMP row used to get there), A reads START BOARD CHASE
//   chase-mid.png   : started with a real touch on A, riding for PLAZA with the HUD card, meter and arrow up
// Usage: CHROME=/path/to/chrome node tools/chase_shots.mjs
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://localhost:${server.address().port}/index.html?t=0.3&dpr=2`);
await page.waitForFunction(() => window.__palm && window.__palm.sim);
await page.waitForTimeout(5000);
const cdp = await page.context().newCDPSession(page);
const st = () => page.evaluate(() => { const s = window.__palm.sim, e = s.event; return { mode: s.player.mode, stars: s.stars, event: e && e.kind, next: e && e.next, x: Math.round(s.board.x), y: Math.round(s.board.y) }; });
await page.evaluate(() => { window.__ui.jump = 'chase'; });                 // what the JUMP row does
await page.waitForFunction(() => window.__palm.sim.player.mode === 'board', null, { timeout: 8000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(ROOT, 'shots', 'chase-start.png') });
console.log('wrote shots/chase-start.png', JSON.stringify(await st()));
const a = await page.evaluate(() => ({ x: 420 - 164, y: innerHeight - 82 }));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 4 }] });
await page.waitForTimeout(80);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForFunction(() => window.__palm.sim.event && window.__palm.sim.event.kind === 'chase', null, { timeout: 8000 });
// cut north-west off the promenade onto the ocean road, then north for PLAZA; freeze the sim mid-run
// (on the step the board passes y = 900, or after 6 s of chase if something got in the way)
await page.evaluate(() => { const s = window.__palm.sim, step = s.step.bind(s), I = window.__palm.input;
  s.step = (dt, inp) => { I.keys.left = s.board.x > 1225; step(dt, inp); if (s.board.y < 900 || s.event.t > 6) { s.step = () => {}; window.__frozen = true; } }; });
await page.keyboard.down('ArrowUp');
await page.waitForFunction(() => window.__frozen, null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(ROOT, 'shots', 'chase-mid.png') });
console.log('wrote shots/chase-mid.png', JSON.stringify(await st()));
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
