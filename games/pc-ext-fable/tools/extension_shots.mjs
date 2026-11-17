// extension_shots.mjs — phone-size (420x860) captures of the wired extension shell:
//   1. mid-causeway over the bay, looking along the MacArthur diagonal
//   2. arriving downtown at the MacArthur west end
//   3. Port Boulevard over the port island
//   4. the seam crossing: core grass strip -> connector -> landfall
// Fixed cameras (?cam=x,y) at golden hour (?t=0.3). Fails (exit 1) on any page error.
// Usage: node tools/extension_shots.mjs   (CHROME=/path/to/chrome optional)
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const SHOTS = [
  ['extension_1_causeway.png', 'cam=-1900,1000'],
  ['extension_2_downtown.png', 'cam=-4030,640'],
  ['extension_3_port.png', 'cam=-2050,1180'],
  ['extension_4_seam.png', 'cam=-60,1275'],
];
fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
for (const [name, cam] of SHOTS) {
  await page.goto(`http://localhost:${PORT}/index.html?${cam}&t=0.3`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(ROOT, 'shots', name) });
  console.log('wrote shots/' + name);
}
await browser.close();
server.close();
if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 4).join(' | ')); process.exit(1); }
console.log('EXTENSION SHOTS OK');
