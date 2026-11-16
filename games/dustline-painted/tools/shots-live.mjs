// Captures the LIVE round-5 game (~/workspace/dustline, served read-only)
// at the exact seeded race moment verify.mjs uses (step 560), look A —
// the BEFORE frame for the side-by-side against the candidate's look D.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/hatch/workspace/dustline';
const OUT = '/home/hatch/workspace/dustline-painted/shots/live-lookA-1280.png';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.md': 'text/markdown', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(8947, r));

const pw = await import('/home/hatch/workspace/hoa-warfare/node_modules/playwright/index.mjs');
const chromium = pw.chromium || pw.default.chromium;
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  let s = 987654321;
  Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
});
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:8947/', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__dust, null, { timeout: 15000 });
await page.waitForTimeout(350);
await page.evaluate(() => { __dust.startRace('race'); __dust.skipCount(); __dust.auto(true); __dust.step(560); __dust.setLook('A'); });
await page.evaluate(() => { __dust.freeze(true); __dust.renderOnce(); });
await page.screenshot({ path: OUT, timeout: 60000 });
console.log('live look A captured ->', OUT, '| page errors:', errors.length ? errors.join(' | ') : 'none');
await page.close();
await browser.close();
server.close();
