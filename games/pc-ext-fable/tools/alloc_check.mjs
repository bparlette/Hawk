// alloc_check.mjs — what allocates per frame, in real Chrome: samples the JS heap (CDP sampling heap
// profiler, 512-byte interval, GC'd objects included) over N seconds of the ?demo route and prints
// bytes per frame by function, top first, plus the total.
// Usage: CHROME=/path/to/chrome node tools/alloc_check.mjs [seconds=8] [query]
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const secs = Number(process.argv[2] || 8), extra = process.argv[3] || 'dpr=1';
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.goto(`http://localhost:${server.address().port}/index.html?demo&${extra}`);
await page.waitForFunction(() => window.__palm && window.__palm.sim);
await page.waitForTimeout(6000);
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');
await page.evaluate(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
await page.waitForTimeout(secs * 1000);
const { profile } = await cdp.send('HeapProfiler.stopSampling');
const frames = await page.evaluate(() => window.__frames);
await browser.close(); server.close();
const by = new Map(); let total = 0;
const walk = (n) => {
  const self = n.selfSize || 0;
  if (self) { const cf = n.callFrame, k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`; by.set(k, (by.get(k) || 0) + self); total += self; }
  for (const c of n.children || []) walk(c);
};
walk(profile.head);
console.log(`frames ${frames}, total ${(total / frames / 1024).toFixed(1)} KB/frame`);
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;   // e.g. ONLY='render|hud|main'
const rows = [...by].filter(([k]) => !only || only.test(k)).sort((a, b) => b[1] - a[1]);
if (only) console.log(`matching /${process.env.ONLY}/: ${(rows.reduce((a, r) => a + r[1], 0) / frames / 1024).toFixed(1)} KB/frame`);
for (const [k, v] of rows.slice(0, 18)) console.log(`${(v / frames / 1024).toFixed(2).padStart(7)} KB/frame  ${k}`);
