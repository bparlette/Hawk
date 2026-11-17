// l2_shots.mjs — task L2 evidence on the REAL page: the PICK YOUR PLAYER screen, a real touch TAP on a player,
// then the stick autopilot (play.html?pilot — stick input only) runs the rally; captures at the arrival beat
// (camera pushed in, crew out, dap), the convoy rolling, and the finish at Atholton. Phone size, 420x860 @2x.
//   CHROME=<chromium> node tools/l2_shots.mjs [player=jason]      (from games/laurel-fulton/) -> shots/l2-*.png
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const WHO = process.argv[2] || 'jason';
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://localhost:${server.address().port}/laurel-fulton/play.html?pilot&speed=6`);
await page.waitForFunction(() => window.__lf && window.__lf.picking(), null, { timeout: 120000 });
await page.waitForTimeout(1500);
const shot = async (n) => { await page.screenshot({ path: path.join(ROOT, 'shots', n + '.png') }); console.log('wrote shots/' + n + '.png'); };
await shot('l2-pick-your-player');
const idx = await page.evaluate((w) => window.__lf.sim && [...document.querySelectorAll('x')].length + 0, WHO);
const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roster.json'))).people.filter(p => p.active && p.car && p.car.sprite && !p.at && p.house);
const i = rows.findIndex(p => p.id === WHO);
await page.touchscreen.tap(210, 150 + i * 62 + 27);                       // a real touch on that player's row
await page.waitForFunction(() => window.__lf.mission(), null, { timeout: 10000 });
console.log('picked by touch:', await page.evaluate(() => window.__lf.mission().me.name));
await page.waitForFunction(() => { const M = window.__lf.mission(); return M.beat && M.beat.phase === 'dap'; }, null, { timeout: 300000, polling: 50 });
await shot('l2-arrival-beat-dap');
await page.waitForFunction(() => { const M = window.__lf.mission(); return M.convoy.length >= 3 && !M.beat && Math.abs(window.__lf.sim.player.v) > 200; }, null, { timeout: 400000, polling: 100 });
await page.waitForTimeout(400);
await shot('l2-convoy-rolling');
await page.waitForFunction(() => window.__lf.mission().complete, null, { timeout: 900000, polling: 200 });
await page.waitForTimeout(1200);
await shot('l2-crew-assembled-atholton');
const st = await page.evaluate(() => { const M = window.__lf.mission(); return { convoy: M.convoy.length, minutes: +(M.time / 60).toFixed(1) }; });
console.log('finish:', JSON.stringify(st), errs.length ? errs.slice(0, 2) : 'no page errors');
await browser.close(); server.close();
