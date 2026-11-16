// shot.mjs — phone-size screenshots of Palm City in real Chrome (touch-enabled, iPhone-like).
// Usage: node tools/shot.mjs <out.png> [query] [--wait ms] [--dpr n] [--seq n --every ms]
//   node tools/shot.mjs /tmp/a.png "cam=900,1100&t=0.4"
//   node tools/shot.mjs /tmp/demo.png "demo" --seq 6 --every 5000   -> demo_0.png .. demo_5.png
// Fails (exit 1) if the page reports any error — there is no fallback render path to hide behind.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const strOpt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ROOT = path.resolve(strOpt('root', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const out = args[0];
const query = args[1] && !args[1].startsWith('--') ? args[1] : '';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? Number(args[i + 1]) : d; };
const wait = opt('wait', 2500), dpr = opt('dpr', 2), seq = opt('seq', 1), every = opt('every', 1000);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  const f = p.endsWith('/') ? p + 'index.html' : p;
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(b);
  });
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${port}/index.html${query ? '?' + query : ''}`);
await page.waitForTimeout(wait);
for (let i = 0; i < seq; i++) {
  const file = seq > 1 ? out.replace(/\.png$/, `_${i}.png`) : out;
  await page.screenshot({ path: file });
  console.log('wrote', file);
  if (i < seq - 1) await page.waitForTimeout(every);
}
const shownErr = await page.$eval('#err', e => e.textContent).catch(() => '');
await browser.close();
server.close();
if (errors.length || shownErr) { console.error('PAGE ERRORS:\n' + errors.join('\n') + shownErr); process.exit(1); }
