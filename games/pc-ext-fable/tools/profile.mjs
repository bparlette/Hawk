// profile.mjs — CPU cost per render section (?prof) and per ground-chunk paint, in real Chrome.
// Usage: node tools/profile.mjs
// Note: headless Chrome composites canvas in software, so wall-clock frame time there is not
// representative of a phone; the CPU numbers per section are.
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${server.address().port}/index.html?demo&prof${process.env.PROFQ ? "&" + process.env.PROFQ : ""}`);
await page.waitForTimeout(9000);
const sections = await page.evaluate(() => Object.fromEntries(Object.entries(window.__prof).map(([k, v]) => [k, +v.toFixed(2)])));
const chunks = await page.evaluate(() => { const g = window.__palm.ground; return [[1, 1], [4, 3], [5, 4], [2, 6], [3, 7]].map(([cx, cy]) => { const t0 = performance.now(); g.paint(cx, cy); return +(performance.now() - t0).toFixed(1); }); });
console.log('render section CPU ms (avg, label = section that just finished):', sections);
console.log('ground chunk paint ms:', chunks);
await browser.close(); server.close();
