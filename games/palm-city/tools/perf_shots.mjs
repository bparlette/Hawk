// perf_shots.mjs — same frame at a pinned DPR (and any extra query), for perf-pass before/after looks.
// Usage: CHROME=/path/to/chrome node tools/perf_shots.mjs <name> [query]   -> shots/perf-<name>.png
// e.g. node tools/perf_shots.mjs dpr2 "dpr=2"; node tools/perf_shots.mjs dpr1 "dpr=1"
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const name = process.argv[2] || 'shot', extra = process.argv[3] || '';
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://localhost:${server.address().port}/index.html?t=0.8&cam=1290,1150,1.15${extra ? '&' + extra : ''}`);
await page.waitForFunction(() => window.__palm && window.__palm.sim);
await page.waitForTimeout(6000);
const file = path.join(ROOT, 'shots', `perf-${name}.png`);
await page.screenshot({ path: file });
console.log('wrote', file, 'dpr', await page.evaluate(() => window.__palm.dpr()));
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
