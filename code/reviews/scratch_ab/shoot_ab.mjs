// headless renders of the delivered viewer (and the unzipped dists). node shoot_ab.mjs jobs.json
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const THREE_FILE = process.env.THREE_FILE, PKG = '/workspace/work/ss3d/npm/package';
const ROOT = '/workspace/work/reviews';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0);
const port = server.address().port; const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const results = [];
for (const j of jobs) {
  const ctx = await browser.newContext({ viewport: { width: j.w || 390, height: j.h || 844 }, deviceScaleFactor: 1 }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.route(/unpkg\.com\/three@0\.160\.0\/(.*)/, (r) => { const rel = new URL(r.request().url()).pathname.replace('/three@0.160.0/', ''); const f = rel === 'build/three.module.js' ? THREE_FILE : path.join(PKG, rel); r.fulfill({ path: f, contentType: 'text/javascript' }); });
  await page.goto(`http://127.0.0.1:${port}/${j.page || 'hawk-ab/viewer.html'}?${j.q}`);
  try { await page.waitForFunction(() => window.__ready === true, null, { timeout: j.timeout || 120000 }); } catch (e) { errs.push('timeout waiting for __ready'); }
  if (j.steps) await page.evaluate((n) => window.__api.step(n), j.steps);
  await page.waitForTimeout(300);
  let extra = null; if (j.eval) extra = await page.evaluate(j.eval);
  const verr = await page.evaluate(() => (window.__errors || []).slice());
  const stats = await page.evaluate(() => window.__api && window.__api.stats ? window.__api.stats() : null);
  if (j.out) await page.screenshot({ path: j.out });
  results.push({ out: j.out, q: j.q, page: j.page, errs, verr, stats, extra }); console.log(j.out, j.q, 'errs', errs.length, 'viewerErrs', verr.length, JSON.stringify(stats), extra ? JSON.stringify(extra).slice(0, 300) : '');
  await ctx.close();
}
await browser.close(); server.close(); fs.writeFileSync(process.env.REPORT || 'shoot_report.json', JSON.stringify(results, null, 1));
