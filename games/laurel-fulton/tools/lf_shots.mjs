// lf_shots.mjs — THE BAR evidence for the L1 sample (spec B5): phone-size captures (420x860 @2x) of the real
// page. 'drive' boots at Ledo Pizza and holds the real keyboard (ArrowUp, then steering) for a few seconds —
// real input, not a teleport — then captures; the route spots use the static camera; the Palm City opening
// is captured the same way for the side-by-side. Serves games/ so ../palm-city/ modules resolve as on Pages.
//   CHROME=<chromium> node tools/lf_shots.mjs        (from games/laurel-fulton/)   -> shots/l1-*.png
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/graph.json'))), A = G.anchors;
const mlb = G.edges.find(e => e.name === 'Maple Lawn Boulevard');
const shots = [
  ['l1-drive-from-ledo', `/laurel-fulton/index.html`, 'drive'],
  ['l1-maple-lawn-blvd', `/laurel-fulton/index.html?cam=${mlb.pts[0][0]},${mlb.pts[0][1]}`],
  ['l1-interchange', `/laurel-fulton/index.html?cam=-27307,34575,0.6`],
  ['l1-brads-street', `/laurel-fulton/index.html?cam=${A.brad.x},${A.brad.y}`],
  ['l1-bar-palm-opening', `/palm-city/index.html?cam=1240,1240&t=0.1&nostart`],
];
for (const [name, url, mode] of shots) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(base + url);
  await page.waitForFunction(() => window.__lf || window.__palm, null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  if (mode === 'drive') {
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2600);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(1800);
    const st = await page.evaluate(() => { const c = window.__lf.sim.player; return { x: Math.round(c.x), y: Math.round(c.y), mph: Math.round(Math.abs(c.v) / 10 * 2.237), surface: c.surface }; });
    console.log(name, 'after real keyboard input:', JSON.stringify(st));
  } else await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(ROOT, 'shots', name + '.png') });
  console.log('wrote shots/' + name + '.png', errs.length ? errs.slice(0, 2) : '');
  await page.close();
}
await browser.close(); server.close();
