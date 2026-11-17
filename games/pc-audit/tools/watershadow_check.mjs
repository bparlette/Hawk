// watershadow_check.mjs — render-level check of the watercraft shadows (owner, Nov 17).
// Round 1: a mounted rider must cast NO walking shadow (the ped shadow cell stays out of the
// multiply shadow layer while player.mode === 'water'), and the craft must carry a soft water
// shadow. Round 2 (owner's phone shot of the live build: "Everything has a shade and long.
// But jetski has none."): the round-1 blob was a heading-rotated radial ellipse barely larger
// than the hull — a few px of faint halo, invisible at phone size, worst on the small jetski.
// So now the craft must ALSO cast a LONG directional shadow on the water, down-sun (ENE, the
// baked sprites' sun az 255° / el 30° language), for PARKED and MOUNTED craft alike. The
// directional probe samples the rendered canvas down-sun of the hull (past the hull's edge,
// inside the cast) vs the same distance up-sun (clean water): down-sun must read clearly
// darker. On the pre-round-2 tree the down-sun sample sits outside the old blob entirely,
// so B2/C2/E1/E2 fail there while A/B/C still pass.
// Usage: node tools/watershadow_check.mjs   (exit 0 = all pass)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
let pageErr = '';
page.on('pageerror', e => { pageErr = String(e).slice(0, 200); });
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) fails++; };
const simTime = () => page.evaluate(() => window.__palm.sim.time);
async function waitSim(secs, capMs = 180000) {
  const t0 = await simTime(), end = Date.now() + capMs;
  while (Date.now() < end) { if (await simTime() - t0 >= secs) return true; await page.waitForTimeout(400); }
  return false;
}
await page.goto(`http://127.0.0.1:${port}/index.html?t=0.2&dpr=2`);
await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 30000 });
await waitSim(3.4);                          // burn the title card

// Spy: count draws of the PLAYER's ped shadow sheet into the multiply shadow layer.
await page.evaluate(() => {
  const r = window.__palm.renderer, s = window.__palm.sim;
  const { m } = r.pedCell(s.player.ped);
  window.__wsSpy = { n: 0, sheet: m.shadow };
  const orig = r.drawCell;
  r.drawCell = function (g, f, ...rest) {
    if (f === window.__wsSpy.sheet && g.canvas === r.shadowCv) window.__wsSpy.n++;
    return orig.call(this, g, f, ...rest);
  };
});
const spyReset = () => page.evaluate(() => { window.__wsSpy.n = 0; });
const spyRead = () => page.evaluate(() => window.__wsSpy.n);

// Directional probe: mean luminance of the rendered canvas down-sun of a craft's hull vs the
// same distance up-sun. Down-sun is the world's cast direction (sun az 255° -> shadows fall
// ENE; render.js offsets its procedural shadows by (+0.8, -0.3) per unit, normalised here).
// The sample distance is half the hull length + 13: clear of the hull, inside a real cast
// shadow, outside the round-1 blob. Three patches averaged along the perpendicular to wash
// out the painted water texture.
const sunProbe = (kind) => page.evaluate((kind) => {
  const P = window.__palm, s = P.sim;
  const cr = s.water.craft.find(c => c.kind === kind);
  const cv = P.renderer.ctx.canvas, dpr = cv.width / 420;
  const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height;
  const g = t.getContext('2d', { willReadFrequently: true }); g.drawImage(cv, 0, 0);
  const zoom = P.cam.zoom, cx = (420 / 2) * dpr, cy = cv.height / 2;
  const D = { x: 0.936, y: -0.351 }, Q = { x: 0.351, y: 0.936 };      // down-sun unit, its perpendicular
  const patch = (wx, wy) => {                        // mean luminance of a 15x15 device-px patch at a world point
    let sum = 0, n = 0;
    const X = Math.round(cx + (wx - P.cam.x) * zoom * dpr), Y = Math.round(cy + (wy - P.cam.y) * zoom * dpr);
    const d = g.getImageData(X - 7, Y - 7, 15, 15).data;
    for (let i = 0; i < d.length; i += 4) { sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
    return sum / n;
  };
  const dist = cr.spec.len * 0.5 + 13;
  const avg = (sgn) => [-7, 0, 7].reduce((a, o) => a + patch(
    cr.x + D.x * dist * sgn + Q.x * o, cr.y + D.y * dist * sgn + Q.y * o), 0) / 3;
  return { down: avg(1), up: avg(-1) };
}, kind);
const sunCheck = (name, r) => check(name, r.down > 0 && r.up > 0 && r.down < r.up * 0.94 && r.down < r.up - 4,
  `(down-sun ${r.down.toFixed(1)} vs up-sun ${r.up.toFixed(1)})`);

// A. on foot on the pier deck: the walking shadow is drawn (unchanged behaviour)
await page.evaluate(() => { const s = window.__palm.sim; s.player.ped.x = 1560; s.player.ped.y = 1030; window.__palm.cam.x = 1560; window.__palm.cam.y = 1030; });
await spyReset(); await waitSim(0.6);
const footN = await spyRead();
check('on foot: player walking shadow IS drawn into the shadow layer', footN > 0, `(${footN} draws)`);

// B. mounted on the jetski, stationary on open water: no walking shadow at all
await page.evaluate(() => {
  const s = window.__palm.sim;
  const cr = s.water.craft.find(c => c.kind === 'jetski');
  s.player.mode = 'water'; s.water.ride = cr; cr.ridden = true;
  cr.x = 1750; cr.y = 1500; cr.h = -Math.PI / 2; cr.vx = 0; cr.vy = 0;
  s.player.ped.x = cr.x; s.player.ped.y = cr.y;
  window.__palm.cam.x = cr.x; window.__palm.cam.y = cr.y;
});
await spyReset(); await waitSim(0.6);
const skiN = await spyRead();
check('mounted on jetski: NO player walking shadow drawn', skiN === 0, `(${skiN} draws)`);
sunCheck('mounted jetski: LONG down-sun shadow on the water', await sunProbe('jetski'));

// C. mounted in the boat, stationary: same rules
await page.evaluate(() => {
  const s = window.__palm.sim;
  const old = s.water.ride; if (old) old.ridden = false;
  const cr = s.water.craft.find(c => c.kind === 'boat');
  s.water.ride = cr; cr.ridden = true;
  cr.x = 1850; cr.y = 1900; cr.h = -Math.PI / 2; cr.vx = 0; cr.vy = 0;
  s.player.ped.x = cr.x; s.player.ped.y = cr.y;
  window.__palm.cam.x = cr.x; window.__palm.cam.y = cr.y;
});
await spyReset(); await waitSim(0.6);
const boatN = await spyRead();
check('mounted in boat: NO player walking shadow drawn', boatN === 0, `(${boatN} draws)`);
sunCheck('mounted boat: LONG down-sun shadow on the water', await sunProbe('boat'));

// E. parked at the moorings, player on foot on the pier deck: both craft must still cast
// the long shadow (this is the owner's screenshot: the moored jetski by the BOATS sign).
await page.evaluate(() => {
  const s = window.__palm.sim;
  const old = s.water.ride; if (old) old.ridden = false;
  s.water.ride = null; s.player.mode = 'foot';
  for (const cr of s.water.craft) { cr.x = cr.home.x; cr.y = cr.home.y; cr.h = cr.home.h; cr.vx = 0; cr.vy = 0; }
  s.player.ped.x = 1592; s.player.ped.y = 1042;              // on the deck, just north of the moorings
  window.__palm.cam.x = 1592; window.__palm.cam.y = 1042;
});
await waitSim(0.9);                          // let the camera settle on the ped
sunCheck('parked jetski at its mooring: LONG down-sun shadow on the water', await sunProbe('jetski'));
sunCheck('parked boat at its mooring: LONG down-sun shadow on the water', await sunProbe('boat'));

check('no page errors', !pageErr, pageErr);

await browser.close();
server.close();
console.log(fails ? `WATERSHADOW FAIL (${fails})` : 'WATERSHADOW OK');
process.exit(fails ? 1 : 0);
