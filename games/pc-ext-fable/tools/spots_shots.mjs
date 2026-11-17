// spots_shots.mjs — reproduce the owner's Board Chase street view and bisect the brown spots.
// Usage: LABEL=before node tools/spots_shots.mjs [variant ...]   -> shots/spots-<LABEL>-<variant>.png
//   variants: board (her framing), onlypuddle (isolation), street2 (a second street)
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LABEL = process.env.LABEL || 'x';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const want = process.argv.slice(2);
const errors = [];
async function shot(name, query) {
  if (want.length && !want.includes(name)) return;
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + e));
  await page.goto(`http://localhost:${server.address().port}/index.html?${query}`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(14000);   // ground chunks paint + title card fades (slow VM: frame dt is clamped)
  const file = path.join(ROOT, 'shots', `spots-${LABEL}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', file);
  await page.close();
}
// Her framing: Board Chase ring [1296,1035] at right-centre, the N-S road (Ocean Drive,
// x 1152..1248) running down the middle, golden hour.
await shot('board',      'cam=1252,1035&t=0.3');
await shot('onlypuddle', 'cam=1252,1035&t=0.3&fx=none,puddle');
// A second core street: the loop's west leg / y-800 street area.
await shot('street2',    'cam=700,800&t=0.3');
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('SPOTS SHOTS OK');
