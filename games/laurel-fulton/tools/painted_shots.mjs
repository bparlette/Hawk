// painted_shots.mjs — evidence for the painted-ground wiring (task: tile + lazy-load
// assets/ground-painted.webp under GroundPainter). Run BEFORE the wiring for the
// procedural-baseline shots and AFTER for the painted ones; same URLs both times.
//   CHROME=<chromium> node tools/painted_shots.mjs <tag>     -> shots/painted-<tag>-*.png
// (a) Ledo Pizza at playing height (fields/dirt/lawns in the painting),
// (b) Brad's suburb at playing height, (c) the whole-map opening frame,
// plus boot-to-pick timing x3 (must not regress).
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const BLOCK = process.env.BLOCK_PAINTED === '1';   // baseline mode: the tiles 404, so the wired code renders pure procedural (identical to pre-wiring)
const web = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (BLOCK && u.includes('ground-tiles')) { r.writeHead(404); r.end(); return; } const f = path.join(GAMES, u); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const tag = process.argv[2] || 'after', errs = [];
const PORT = web.address().port;

// boot timing x3: navigation -> PICK YOUR PLAYER
for (let i = 0; i < 3; i++) {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push(String(e)));
  const t0 = Date.now();
  await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html`);
  await p.waitForFunction(() => window.__lf && window.__lf.picking(), null, { timeout: 180000 });
  console.log(`boot run ${i + 1}: pick screen in ${((Date.now() - t0) / 1000).toFixed(2)} s`);
  await p.close();
}

async function shot(name, query, cx, cy) {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html?${query}`);
  await p.waitForFunction(() => window.__lf && window.__lf.sim, null, { timeout: 180000 });
  // wait until every chunk in the view is painted — and, when the painted layer is
  // wired, until each view chunk's canvas actually carries it (cv._pt stamp)
  await p.waitForFunction(({ cx, cy }) => {
    const g = window.__lf.ground, CH = 256, hw = 210 / 0.62 + 20, hh = 430 / 0.62 + 20;
    for (let gy = Math.floor((cy - hh) / CH); gy <= Math.floor((cy + hh) / CH); gy++)
      for (let gx = Math.floor((cx - hw) / CH); gx <= Math.floor((cx + hw) / CH); gx++) {
        const c = g.cache.get(gx + ',' + gy);
        if (!c) return false;
        if (g.painted && g.paintedState(gx, gy) === 'ok' && !c._pt) return false;
      }
    return true;
  }, { cx, cy }, { timeout: 180000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(ROOT, `shots/painted-${tag}-${name}.png`) });
  console.log(`shot ${name} taken`);
  await p.close();
}

await shot('ledo', 'cam=-12953,708,0.62', -12953, 708);
await shot('brad', 'cam=11998,18074,0.62', 11998, 18074);

// the whole-map opening frame (far zoom: must stay roads-over-flat, no stall)
{
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push(String(e)));
  const t0 = Date.now();
  await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html`);
  await p.waitForFunction(() => window.__lf && window.__lf.picking(), null, { timeout: 180000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(ROOT, `shots/painted-${tag}-opening.png`) });
  console.log(`opening frame taken (pick at ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await p.close();
}
console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close(); web.close();
