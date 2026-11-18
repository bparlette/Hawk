// koth_shots.mjs — evidence for the Nov 17 features on the REAL page (420x860 @2x): a donut's
// skid-mark circle in a parking lot, a King of the Hill round in a real cul-de-sac with the
// whole crew in the ring, and the winner's crown.
//   CHROME=<chromium> node tools/koth_shots.mjs     -> shots/koth-*.png
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(`http://localhost:${web.address().port}/laurel-fulton/play.html?player=jason&nointro`);
await p.waitForFunction(() => window.__lf && window.__lf.sim.player && !window.__lf.picking(), null, { timeout: 180000 });
await p.evaluate(() => window.__lf.setSpeed(6));   // this VM runs the page at ~1/7 speed — 6x game time so the captures see real seconds
// 1) the donut: teleport to the biggest parking lot on the map, full lock, shoot MID-donut
await p.waitForFunction(() => window.__lf.areas.A.parking.length > 100, null, { timeout: 120000 });
await p.evaluate(() => {
  const L = window.__lf, P = L.sim.player;
  let best = null, ba = 0;
  for (const f of L.areas.A.parking) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let k = 0; k < f.length; k += 2) { x0 = Math.min(x0, f[k]); x1 = Math.max(x1, f[k]); y0 = Math.min(y0, f[k + 1]); y1 = Math.max(y1, f[k + 1]); } const a = (x1 - x0) * (y1 - y0); if (a > ba) { ba = a; best = [(x0 + x1) / 2, (y0 + y1) / 2]; } }
  P.x = best[0]; P.y = best[1]; P.v = 0; P.h = 0; P.dirx = 1; P.diry = 0;
});
await p.waitForTimeout(1500);
await p.keyboard.down('ArrowUp'); await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(4300);
const skidW = await p.evaluate(() => window.__lf.sim.skid.w);
await p.screenshot({ path: path.join(ROOT, 'shots/koth-1-donut-marks.png') });
await p.keyboard.up('ArrowLeft'); await p.keyboard.up('ArrowUp');
console.log('1 donut mid-circle, skid segments on the page sim:', skidW);
// 2) King of the Hill: the WHOLE crew staged in one real cul-de-sac (rally frozen for the shot)
await p.waitForFunction(() => window.__lf.koth(), null, { timeout: 60000 });
const sacName = await p.evaluate(() => {
  const L = window.__lf, S = L.sim, K = L.koth(), sac = K.sacs.find(s => s.name === 'Dulaney Place') || K.sacs[0];
  S.cars.forEach((c, i) => { c.parked = false; c.driveFn = null; c.wreck = false; c.dmg = 0; c.x = sac.x + (i % 3 - 1) * 52; c.y = sac.y + (Math.floor(i / 3) - 1) * 52; c.v = 0; });
  S.player.x = sac.x; S.player.y = sac.y; S.player.v = 0;   // the camera follows the player: centre-frame the ring
  return sac.name;
});
// the BUTTON shot: crew sitting in the ring, crown button on screen, no round yet
await p.evaluate(() => { const lf = window.__lf, cam = lf.cam, K = lf.koth(), sac = K.sacs.find(s => s.name === 'Dulaney Place') || K.sacs[0]; cam.x = sac.x; cam.y = sac.y; cam.zoom = 0.62; });
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(ROOT, 'shots/koth-0-button.png') });
console.log('0 button shot, state:', await p.evaluate(() => window.__lf.koth().state));
await p.evaluate(() => { const lf = window.__lf; lf.koth().tryStart(lf.sim); });
await p.waitForFunction(() => window.__lf.koth().state === 'round', null, { timeout: 90000 });
await p.evaluate(() => { const K = window.__lf.koth(); window.__lf.cam.x = K.sac.x; window.__lf.cam.y = K.sac.y; });   // snap the camera onto the ring (on this starved VM its flight takes ~a minute of wall time)
await p.waitForTimeout(2600);   // let the camera finish its flight to the ring before the shot
await p.screenshot({ path: path.join(ROOT, 'shots/koth-2-ring.png') });
console.log('2 ring:', sacName, '— round live');
// 3) everyone else out: the crown
await p.evaluate(() => { const S = window.__lf.sim, K = window.__lf.koth(); S.cars.forEach(c => { if (c !== S.player) { c.x = K.sac.x + 700; c.y = K.sac.y + 300; c.v = 0; } }); });
await p.waitForFunction(() => window.__lf.koth().state === 'done', null, { timeout: 60000 });
await p.waitForTimeout(700);
const end = await p.evaluate(() => { const K = window.__lf.koth(); return { state: K.state, banner: K.banner() }; });
await p.screenshot({ path: path.join(ROOT, 'shots/koth-3-crown.png') });
console.log('3 crown:', JSON.stringify(end));
console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close(); web.close();
