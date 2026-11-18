// boot_time.mjs — load-time check (Nov 18): time from navigation to the PICK YOUR PLAYER screen, on a throttled phone-like
// link (gzip on like GitHub Pages; 150 ms RTT, ~10 Mbps down; fresh cache), plus bytes and request count.
//   CHROME=<chromium> node tools/boot_time.mjs [page=play.html] [runs=2]      (from games/laurel-fulton/)
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => {
  if (e) { r.writeHead(404); r.end(); return; } const ty = T[path.extname(f)] || 'application/octet-stream', gz = /json|javascript|html/.test(ty);
  r.writeHead(200, { 'content-type': ty, ...(gz ? { 'content-encoding': 'gzip' } : {}) }); r.end(gz ? zlib.gzipSync(b) : b); }); });
await new Promise(r => web.listen(0, r));
const page = process.argv[2] || 'play.html', runs = Number(process.argv[3]) || 2;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
for (let i = 0; i < runs; i++) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } }), p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 10e6 / 8, uploadThroughput: 2e6 / 8 });
  // the network side of boot (what this pass changes): when the LAST boot-critical byte lands — every module, the roads,
  // crew, cars, bumps and every car sprite the first frame draws. (The page's own first paint is CPU-bound and on a GPU-less
  // VM takes minutes; on a phone it is the network that you wait on.)
  let bytes = 0, n = 0, last = 0; const t0 = Date.now(), crit = /\.js$|graph(\.min)?\.json|roster|fleet|bumps|cars\//;
  cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; n++; });
  p.on('requestfinished', q => { if (crit.test(q.url())) last = Date.now() - t0; });
  await p.goto(`http://localhost:${web.address().port}/laurel-fulton/${page}`, { waitUntil: 'commit' });
  await new Promise(r => setTimeout(r, 25000));
  console.log(`${page}: boot-critical downloads done at ${(last / 1000).toFixed(2)} s — ${n} requests, ${(bytes / 1024).toFixed(0)} KB over the wire in 25 s`);
  await ctx.close();
}
await browser.close(); web.close();
