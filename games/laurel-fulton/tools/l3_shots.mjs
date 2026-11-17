// l3_shots.mjs — task L3 evidence on the REAL page, phone size: the same bump crossed FAST (real keyboard: hold Up
// -> captured at the top of the arc, shadow left on the ground) and SLOW (real keyboard: a short tap, roll in ->
// captured on the jolt), then the CONVOY catching air in sequence (play.html?pilot, stick input only).
//   CHROME=<chromium> node tools/l3_shots.mjs        (from games/laurel-fulton/)   -> shots/l3-*.png
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const base = `http://localhost:${server.address().port}/laurel-fulton/play.html`;
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/bumps.json'))).bumps, b = B.find(q => q.x === -34084 && q.y === 28121) || B[0];
const h = Math.atan2(b.dy, b.dx), sp = `${Math.round(b.x - b.dx * 900)},${Math.round(b.y - b.dy * 900)},${h.toFixed(4)}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const open = async (q) => { const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); await p.goto(base + q); await p.waitForFunction(() => window.__lf, null, { timeout: 120000 }); await p.waitForTimeout(2500); return p; };
// FAST
let p = await open(`?free&spawn=${sp}`);
await p.keyboard.down('ArrowUp');
await p.waitForFunction(() => { const c = window.__lf.sim.player; return c.z > 0 && c.vz < 20; }, null, { timeout: 30000, polling: 10 });
const fastState = await p.evaluate(() => { const c = window.__lf.sim.player; return { mph: Math.round(c.v / 4.47), heightM: +(c.z / 10).toFixed(1) }; });
await p.screenshot({ path: path.join(ROOT, 'shots/l3-bump-fast-airborne.png') });
console.log('fast (top of the arc):', JSON.stringify(fastState));
await p.close();
// SLOW
p = await open(`?free&spawn=${sp}`);
for (let k = 0; k < 400 && !(await p.evaluate(() => window.__lf.sim.player.jolt > 0.05)); k++) {   // feather the throttle: creep up at ~20 mph
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(120); await p.keyboard.up('ArrowUp'); await p.waitForTimeout(200);
}
await p.screenshot({ path: path.join(ROOT, 'shots/l3-bump-slow-jolt.png') });
console.log('slow:', JSON.stringify(await p.evaluate(() => { const c = window.__lf.sim.player; return { mph: Math.round(c.v / 4.47), airborne: c.z > 0 }; })));
await p.close();
// CONVOY in the air: a piloted rally, captured when a follower is airborne right behind you
p = await open(`?pilot&player=jason&speed=2`);
await p.waitForFunction(() => { const M = window.__lf.mission(), P = window.__lf.sim.player; return M && M.convoy.length >= 2 && M.convoy.some(f => f.car.z > 8 && Math.hypot(f.car.x - P.x, f.car.y - P.y) < 300); }, null, { timeout: 900000, polling: 16 });
await p.screenshot({ path: path.join(ROOT, 'shots/l3-convoy-airborne.png') });
console.log('convoy:', JSON.stringify(await p.evaluate(() => window.__lf.mission().convoy.map(f => [f.person.name, +(f.car.z / 10).toFixed(1)]))));
await browser.close(); server.close();
