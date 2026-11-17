// smoke_city.mjs — any factory-built city, in the REAL browser page: boots <city>/play.html, a real touch TAP picks the first
// player, the stick-only autopilot (?pilot) runs the whole rally to the finish; captures the pick screen, the convoy, the finish.
//   CHROME=<chromium> node tools/factory/smoke_city.mjs <city-folder-name>      (from games/laurel-fulton/) -> <city>/shots/
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const LF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), GAMES = path.resolve(LF, '..'), CITY = process.argv[2];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const out = path.join(GAMES, CITY, 'shots'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://localhost:${server.address().port}/${CITY}/play.html?pilot&speed=6`);
await page.waitForFunction(() => window.__lf && window.__lf.picking(), null, { timeout: 120000 }); await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(out, 'factory-pick.png') });
await page.touchscreen.tap(210, 150 + 27);
await page.waitForFunction(() => window.__lf.mission(), null, { timeout: 10000 });
const who = await page.evaluate(() => window.__lf.mission().me.name);
await page.waitForFunction(() => { const M = window.__lf.mission(); return M.convoy.length >= 2 && !M.beat && Math.abs(window.__lf.sim.player.v) > 150; }, null, { timeout: 600000, polling: 100 });
await page.screenshot({ path: path.join(out, 'factory-convoy.png') });
await page.waitForFunction(() => window.__lf.mission().complete, null, { timeout: 900000, polling: 200 }); await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(out, 'factory-finish.png') });
const st = await page.evaluate(() => { const M = window.__lf.mission(); return { convoy: M.convoy.length, min: +(M.time / 60).toFixed(1), meet: M.meet.name }; });
console.log(`${CITY}: tapped ${who}; finish ${JSON.stringify(st)}; ${errs.length ? 'ERRORS ' + errs.slice(0, 2) : 'no page errors'}`);
await browser.close(); server.close(); process.exit(errs.length ? 1 : 0);
