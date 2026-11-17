// frametime.mjs — frame-time p50/p95 from a phone-like touch context, in real Chrome.
// Runs the ?demo route (it drives the real input path: walk, jack, drive the loop past the ocean,
// chase, busted) in a 420x860 @2x touch/mobile viewport with the CPU throttled (default 4x, a
// mid-range phone's CPU against a desktop's), records every requestAnimationFrame interval, and
// prints p50 / p95 / p99 / worst plus the count of long frames (> 33 ms).
// Usage: CHROME=/path/to/chrome node tools/frametime.mjs [seconds=24] [cpuThrottle=4] [label]
//   -> also appends a JSON line to shots/frametime.jsonl
// Headless Chrome rasterises canvas on the CPU, so absolute numbers run high; compare before/after
// on the same machine and settings.
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const secs = Number(process.argv[2] || 24), throttle = Number(process.argv[3] || 4), label = process.argv[4] || '';
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const cdp = await page.context().newCDPSession(page);
await page.goto(`http://localhost:${server.address().port}/index.html?demo`);
await page.waitForFunction(() => window.__palm && window.__palm.sim);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
// frame intervals straight from rAF timestamps
await page.evaluate(() => { const f = window.__ft = []; let last = 0; const tick = (t) => { if (last) f.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
await page.waitForTimeout(secs * 1000);
const ft = await page.evaluate(() => window.__ft.slice(5));
const extra = await page.evaluate(() => ({ dpr: window.__palm.dpr ? window.__palm.dpr() : null, ground: window.__palm.ground.stats || null }));
await browser.close(); server.close();
const s = [...ft].sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
const res = { label, frames: ft.length, throttle, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), worst: +s[s.length - 1].toFixed(1), over33: ft.filter(x => x > 33.4).length, ...extra, at: new Date().toISOString() };
console.log(JSON.stringify(res));
fs.appendFileSync(path.join(ROOT, 'shots', 'frametime.jsonl'), JSON.stringify(res) + '\n');
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
