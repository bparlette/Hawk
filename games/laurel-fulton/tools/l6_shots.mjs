// l6_shots.mjs — task L6 evidence: the REAL server + two REAL phone-size browsers (two friends), real taps and keys.
//   CHROME=<chromium> node tools/l6_shots.mjs        (from games/laurel-fulton/; server deps installed)  -> shots/l6-*.png
// Friend A takes over Clayton, Friend B takes over Zack (same house: they start on each other's screens), A drives off
// on the keyboard while B watches, A closes the tab mid-drive and Clayton carries on as CPU on B's screen.
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const { start } = await import('../server/server.js');
const srv = await start({ port: 0, friends: new Map([['demo-a', 'Friend A'], ['demo-b', 'Friend B']]) });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const errs = [];
const open = async (key) => {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push(key + ': ' + e));
  await p.goto(`http://localhost:${web.address().port}/laurel-fulton/play.html?server=ws://localhost:${srv.port}&key=${key}`);
  await p.waitForFunction(() => window.__lf, null, { timeout: 120000 }); await p.waitForTimeout(1500); return p;
};
const row = (ROSTER, id) => { const list = ROSTER.people.filter(p => p.active && p.car && p.car.sprite && !p.at && p.house); return 150 + list.findIndex(p => p.id === id) * 62 + 27; };
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roster.json')));
const A = await open('demo-a');
await A.screenshot({ path: path.join(ROOT, 'shots/l6-1-pick-all-cpu.png') });
await A.touchscreen.tap(200, row(ROSTER, 'clayton')); await A.waitForTimeout(1200);
const B = await open('demo-b');
await B.waitForTimeout(500); await B.screenshot({ path: path.join(ROOT, 'shots/l6-2-pick-clayton-taken.png') });
await B.touchscreen.tap(200, row(ROSTER, 'clayton')); await B.waitForTimeout(500);            // taken: nothing happens
const stillPicking = await B.evaluate(() => window.__lf.picking());
await B.touchscreen.tap(200, row(ROSTER, 'zack')); await B.waitForTimeout(2500);
await A.screenshot({ path: path.join(ROOT, 'shots/l6-3-A-sees-B.png') });
await A.keyboard.down('ArrowUp'); await A.waitForTimeout(1600);
await B.screenshot({ path: path.join(ROOT, 'shots/l6-4-B-watches-A-drive.png') });
const aCar = await A.evaluate(() => { const c = window.__lf.sim.player; return { x: Math.round(c.x), y: Math.round(c.y), v: Math.round(c.v) }; });
const seen = await B.evaluate(() => { const c = window.__lf.sim.cars.find(c => c.owner === 'clayton'); return { x: Math.round(c.x), y: Math.round(c.y), human: c.human }; });
await A.close();                                           // Friend A closes the tab mid-drive
await B.waitForTimeout(2500);
await B.screenshot({ path: path.join(ROOT, 'shots/l6-5-A-left-clayton-is-CPU.png') });
const after = await B.evaluate(() => { const c = window.__lf.sim.cars.find(c => c.owner === 'clayton'); return { x: Math.round(c.x), y: Math.round(c.y), human: c.human, v: c.v }; });
console.log(JSON.stringify({ stillPickingAfterTakenTap: stillPicking, aCar, bSawClayton: seen, claytonAfterALeft: after, errors: errs }));
await browser.close(); await srv.close(); web.close();
