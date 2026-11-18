// daynight_shots.mjs — evidence for the DAY/NIGHT PARITY port (owner, Nov 18):
// Scaggsville must show the SAME day-to-night cycle + lighting transitions as Palm City.
//   CHROME=<chromium> node tools/daynight_shots.mjs   -> shots/daynight-*.png + tod samples
// (a) the same frame (Brad's house, playing height) pinned at ?t=0 / 0.55 / 0.97 via Palm City's
// own ?t pin, (b) the live curve sampled off __lf.tod() at speed x16: must start ~0.18,
// climb, and hold at 0.97 — Palm City's timeOfDay() numbers, not lookalikes.
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(GAMES, u); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const PORT = web.address().port, errs = [];

async function shot(name, query, cx, cy) {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html?${query}`);
  await p.waitForFunction(() => window.__lf && window.__lf.sim, null, { timeout: 180000 });
  await p.waitForFunction(({ cx, cy }) => {
    const g = window.__lf.ground, CH = 256, hw = 210 / 0.62, hh = 430 / 0.62;
    for (let gy = Math.floor((cy - hh) / CH); gy <= Math.floor((cy + hh) / CH); gy++)
      for (let gx = Math.floor((cx - hw) / CH); gx <= Math.floor((cx + hw) / CH); gx++)
        if (!g.cache.get(gx + ',' + gy)) return false;
    return true;
  }, { cx, cy }, { timeout: 180000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(ROOT, `shots/daynight-${name}.png`) });
  console.log(`shot ${name} taken`);
  await p.close();
}

await shot('t000-golden', 'cam=11998,18074,0.62&t=0', 11998, 18074);
await shot('t055-sunset', 'cam=11998,18074,0.62&t=0.55', 11998, 18074);
await shot('t097-dusk', 'cam=11998,18074,0.62&t=0.97', 11998, 18074);

// the live curve: pick Brad, nointro, speed x16 — sample tod as sim time accrues
{
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html?player=brad&nointro&speed=16`);
  await p.waitForFunction(() => window.__lf && window.__lf.sim && !window.__lf.picking(), null, { timeout: 180000 });
  const s0 = await p.evaluate(() => window.__lf.tod());
  await p.waitForTimeout(3000);
  const s1 = await p.evaluate(() => window.__lf.tod());
  await p.waitForTimeout(9000);
  const s2 = await p.evaluate(() => window.__lf.tod());
  await p.waitForTimeout(6000);
  const s3 = await p.evaluate(() => window.__lf.tod());
  console.log(`tod curve: start ${s0.toFixed(3)} -> +3s ${s1.toFixed(3)} -> +12s ${s2.toFixed(3)} -> +18s ${s3.toFixed(3)}`);
  const ok = s0 >= 0.17 && s0 <= 0.30 && s1 > s0 && s2 > s1 && s2 <= 0.97 && s3 <= 0.97 && s3 >= s2 - 0.001;
  console.log(ok ? 'CURVE OK (Palm City: 0.18 + simTime/200, capped 0.97)' : 'CURVE FAIL');
  await p.close();
}
console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close(); web.close();
