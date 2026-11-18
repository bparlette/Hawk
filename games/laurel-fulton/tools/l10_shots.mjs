// l10_shots.mjs — task L10/L8 orientation evidence on the REAL page (420x860 @2x): street names written along the roads and the
// "corner of X & Y" pill, at the default chase zoom, at Brad's and at the school.   CHROME=... node tools/l10_shots.mjs
import { chromium } from 'playwright-core'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const R = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roster.json'))), brad = R.people.find(p => p.id === 'brad').house, sch = R.meetup.pos;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
for (const [n, [x, y], z] of [['brad', brad, 0.62], ['school', sch, 0.45]]) {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 }); p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  await p.goto(`http://localhost:${web.address().port}/laurel-fulton/play.html?free&cam=${Math.round(x)},${Math.round(y)},${z}&spawn=${Math.round(x)},${Math.round(y)},0`);
  await p.waitForFunction(() => window.__lf, null, { timeout: 120000 }); await p.waitForTimeout(6000);
  await p.screenshot({ path: path.join(ROOT, `shots/l10-labels-${n}.png`) }); await p.close();
}
await browser.close(); web.close();
