// director_shots.mjs — capture the auto-director's highlight in the real page: runs the ?demo route
// (jack, chase, BUSTED) with ?highlight, waits for the replay, and grabs a frame of a normal shot
// and one in slow motion at the peak.
// Usage: CHROME=/path/to/chrome node tools/director_shots.mjs  -> shots/director-{cut,slowmo}.png
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
await page.goto(`http://localhost:${server.address().port}/index.html?demo&highlight&dpr=1`);
await page.waitForFunction(() => window.__palm && window.__palm.sim);
await page.waitForFunction(() => { const p = window.__palm.director.play; return p && p.ready && p.t > 1.5; }, null, { timeout: 240000, polling: 200 });
await page.screenshot({ path: path.join(ROOT, 'shots', 'director-cut.png') });
await page.waitForFunction(() => { const p = window.__palm.director.play; return p && p.slow; }, null, { timeout: 120000, polling: 'raf' });
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(ROOT, 'shots', 'director-slowmo.png') });
console.log(JSON.stringify(await page.evaluate(() => { const p = window.__palm.director.play; return p && { win: p.win, step: p.i, slow: p.slow, shot: p.shot }; })));
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
