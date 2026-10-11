// tools/shoot.mjs — headless self-test + preview renderer for viewer.html.
// Usage: node tools/shoot.mjs <out.png> "<viewer query>" [width height dpr]
//    or: node tools/shoot.mjs --batch <jobs.json>   (jobs: [{ out, q, w, h, dpr }])
// Needs playwright-core (or playwright) and three@0.160.0 resolvable from NODE_PATH; three is routed locally so no network.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const THREE_FILE = process.env.THREE_FILE || path.join(path.dirname(require.resolve('three')), 'three.module.js');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
let jobs;
if (process.argv[2] === '--batch') jobs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
else jobs = [{ out: process.argv[2], q: process.argv[3] || '', w: +(process.argv[4] || 1280), h: +(process.argv[5] || 720), dpr: +(process.argv[6] || 1) }];
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = []; let errors = 0;
for (const j of jobs) {
  const ctx = await browser.newContext({ viewport: { width: j.w || 1280, height: j.h || 720 }, deviceScaleFactor: j.dpr || 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.route('https://unpkg.com/three@0.160.0/build/three.module.js', (r) => r.fulfill({ path: THREE_FILE, contentType: 'text/javascript' }));
  await page.goto(`http://127.0.0.1:${port}/viewer.html?${j.q}`);
  try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }); } catch (e) { errs.push('timeout waiting for __ready'); }
  await page.waitForTimeout(150);
  const report = await page.evaluate(() => window.__report || null);
  if (j.out) { fs.mkdirSync(path.dirname(path.resolve(j.out)), { recursive: true }); await page.screenshot({ path: j.out }); }
  results.push({ out: j.out, q: j.q, errors: errs, report });
  if (errs.length) errors++;
  console.log(`${j.out || '(no shot)'}  ${j.q}  ${errs.length ? 'ERRORS:\n  ' + errs.join('\n  ') : 'ok'}`);
  await ctx.close();
}
await browser.close(); server.close();
if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify(results, null, 1));
process.exit(errors ? 1 : 0);
