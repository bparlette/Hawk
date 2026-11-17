// ext_perf.mjs — perf proof for the world extension (task 11): a scripted turbo drive down the whole
// OPEN ROAD course (core seam -> MacArthur Causeway -> downtown), the car carried along the route at
// 400 u/s so every run streams the same chunks. Reports frame
// times over the drive only (rAF intervals; seg = median per 500 units of course), ground-chunk LRU stats (painted sliced / painted in-frame = hitch / evicted)
// and peak cache size.
//   CHROME=<chromium> node tools/geo/ext_perf.mjs [game-folder ...]   (default: ../pc-ext-fable ../palm-city)
// Run from games/pc-ext-fable/. Appends one JSON line per build to shots/ext-perf.jsonl.
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), GAMES = path.resolve(HERE, '../../..');
const builds = process.argv.slice(2).length ? process.argv.slice(2) : ['pc-ext-fable', 'palm-city'];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.ogg': 'audio/ogg' };
const server = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
for (const b of builds) {
  const name = path.basename(b);
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://localhost:${server.address().port}/${name}/index.html?nostart&nodirector&dpr=1`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 120000 });
  await page.waitForTimeout(3000);
  const res = await page.evaluate(async () => {
    const P = window.__palm, { jump } = await import('./src/activities.js'), OR = await import('./src/openroad.js');
    const s = P.sim; jump(s, 'taxi');
    const R = OR.route(), st0 = { ...P.ground.stats };
    const frames = []; let peak = 0, last = performance.now(), t0 = last, d = 0;
    await new Promise(done => {
      const tick = (now) => {
        const dt = (now - last) / 1000; last = now; frames.push(dt * 1000); (window.__seg = window.__seg || []).push([Math.min(R.len, d) | 0, dt * 1000, s.cars.length]);
        peak = Math.max(peak, P.ground.cache.size);
        const c = s.player.car;
        if (c && d < R.len) {                       // carried along the course at turbo speed
          d += 400 * Math.min(dt, 0.1);
          const a = OR.routeAt(R, d, 0); c.x = a.x; c.y = a.y; c.h = Math.atan2(a.ty, a.tx); c.v = 400;
        }
        if (d < R.len && now - t0 < 120000) requestAnimationFrame(tick); else done();   // the drive only: the run ends at the finish line
      };
      requestAnimationFrame(tick);
    });
    const st = P.ground.stats;
    const seg = {}; for (const [dd, ms, n] of window.__seg) { const k = dd >= R.len ? 'after' : String(Math.floor(dd / 500) * 500); (seg[k] = seg[k] || []).push(ms); }
    for (const k in seg) { const a = seg[k].sort((x, y) => x - y); seg[k] = a[a.length >> 1].toFixed(0) + 'ms/' + a.length; }
    return { seg, frames: frames.slice(30), drove: Math.round(d), routeLen: Math.round(R.len), sliced: st.sliced - st0.sliced, sync: st.sync - st0.sync, evicted: (st.evicted || 0) - (st0.evicted || 0), peak };
  });
  const f = res.frames.sort((a, b) => a - b);
  const out = { build: name, when: new Date().toISOString(), drove: res.drove, of: res.routeLen, frames: f.length, p50: +pct(f, 0.5).toFixed(1), p95: +pct(f, 0.95).toFixed(1), p99: +pct(f, 0.99).toFixed(1), max: +f[f.length - 1].toFixed(1),
    seg: res.seg, chunksPaintedSliced: res.sliced, chunksPaintedInFrame: res.sync, evicted: res.evicted, peakCache: res.peak, errors: errs.slice(0, 3) };
  console.log(JSON.stringify(out));
  fs.mkdirSync(path.resolve(HERE, '../../shots'), { recursive: true });
  fs.appendFileSync(path.resolve(HERE, '../../shots/ext-perf.jsonl'), JSON.stringify(out) + '\n');
  await page.close();
}
await browser.close(); server.close();
