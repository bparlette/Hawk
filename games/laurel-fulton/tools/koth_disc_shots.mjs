// koth_disc_shots.mjs — evidence for the KOTH circle road (owner, Nov 17) on the REAL page
// (420x860 @2x): (a) the candidate cul-de-sac's disc painted as real pavement with the KING
// button up, (b) a donut inside the disc laying BLACK marks on the asphalt (not brown dirt),
// (c) the player leaving: the disc clears and the grass repaints. Plus boot-to-pick timing.
//   CHROME=<chromium> node tools/koth_disc_shots.mjs     -> shots/koth-disc-*.png
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const errs = [];

// (c) boot timing: plain page, no params — navigation to the PICK YOUR PLAYER screen
{
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push(String(e)));
  const t0 = Date.now();
  await p.goto(`http://localhost:${web.address().port}/laurel-fulton/play.html`);
  await p.waitForFunction(() => window.__lf && window.__lf.picking(), null, { timeout: 180000 });
  console.log(`boot: pick screen up in ${((Date.now() - t0) / 1000).toFixed(1)} s (this GPU-less VM)`);
  await p.close();
}

const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
p.on('pageerror', e => errs.push(String(e)));
await p.goto(`http://localhost:${web.address().port}/laurel-fulton/play.html?player=jason&nointro`);
await p.waitForFunction(() => window.__lf && window.__lf.sim.player && !window.__lf.picking(), null, { timeout: 180000 });
await p.evaluate(() => window.__lf.setSpeed(6));   // this VM runs the page at ~1/7 speed — 6x game time so the captures see real seconds
await p.waitForFunction(() => window.__lf.koth(), null, { timeout: 60000 });

// pick the grassiest sac (same sampling as tools/spec_koth_disc.mjs) and stage the crew in it
const stage = await p.evaluate(() => {
  const L = window.__lf, W = L.W, K = L.koth(), S = L.sim;
  let sac = null, grassPt = null, best = 0;
  for (const s of K.sacs) {
    let grass = 0, pt = null;
    for (let k = 0; k < 16; k++) for (const rr of [0.45, 0.65, 0.85]) {
      const x = s.x + Math.cos(k / 16 * Math.PI * 2) * s.r * rr, y = s.y + Math.sin(k / 16 * Math.PI * 2) * s.r * rr;
      if (W.surfaceAt(x, y, 0) === 'ground') { grass++; if (rr <= 0.65 && !pt) pt = { x, y }; }
    }
    if (pt && grass > best) { best = grass; sac = s; grassPt = pt; }
  }
  S.cars.forEach((c, i) => { c.parked = false; c.driveFn = null; c.wreck = false; c.dmg = 0; c.x = sac.x + (i % 3 - 1) * 52; c.y = sac.y + (Math.floor(i / 3) - 1) * 52; c.v = 0; });
  S.player.x = sac.x; S.player.y = sac.y; S.player.v = 0;
  L.cam.x = sac.x; L.cam.y = sac.y; L.cam.zoom = 0.62;
  return { name: sac.name, x: sac.x, y: sac.y, r: sac.r, grassPt, grassSamples: best };
});
console.log('staged in', stage.name, '— grass samples in disc:', stage.grassSamples);
// wait until every chunk the disc touches is painted (they repaint through the queue, sliced)
await p.waitForFunction(({ x, y, r }) => {
  const g = window.__lf.ground, CH = 256;
  for (let cy = Math.floor((y - r - 10) / CH); cy <= Math.floor((y + r + 10) / CH); cy++)
    for (let cx = Math.floor((x - r - 10) / CH); cx <= Math.floor((x + r + 10) / CH); cx++) {
      const nx = Math.max(cx * CH, Math.min(x, cx * CH + CH)), ny = Math.max(cy * CH, Math.min(y, cy * CH + CH));
      if (Math.hypot(nx - x, ny - y) <= r + 10 && !g.has(cx, cy)) return false;
    }
  return true;
}, stage, { timeout: 120000 });
await p.waitForTimeout(1200);
const paveOn = await p.evaluate(() => { const W = window.__lf.W; return { pave: !!W.pave, atGrassPt: W.surfaceAt(window.__lf.W.pave.x, window.__lf.W.pave.y, 0) }; });
console.log('disc live:', JSON.stringify(paveOn));
await p.screenshot({ path: path.join(ROOT, 'shots/koth-disc-a-paved.png') });
console.log('a paved-disc candidate shot taken');

// (b) the donut: player ALONE at the sac centre (the crew is parked far away so rally followers
// can't shove the player out of the ring mid-donut — that cleared the disc in the first run).
// The donut's circle stays well inside the disc, on ground that was grass before it was paved.
await p.evaluate(({ x, y }) => {
  const S = window.__lf.sim, P = S.player;
  for (const c of S.cars) if (c !== P) { c.x = x + 6000; c.y = y + 6000; c.v = 0; c.parked = true; }
  P.x = x; P.y = y; P.v = 0; P.h = 0; P.dirx = 1; P.diry = 0;
  window.__lf.cam.x = x; window.__lf.cam.y = y;
}, stage);
await p.waitForTimeout(800);
// Deterministic donut: freeze the page's own stepping (setSpeed(0)) and step the sim by hand,
// exactly like tools/spec_koth_disc.mjs — keyboard driving at 6x speed roams out of the disc.
const donutCheck = await p.evaluate(() => {
  const L = window.__lf, S = L.sim, P = S.player, w0 = S.skid.w;
  L.setSpeed(0);
  const DONUT = { jx: 0, jy: 0, jm: 0, keys: { up: true, left: true }, action: false, punch: false, turbo: false };
  for (let i = 0; i < 64; i++) S.step(1 / 60, DONUT);   // ~1 game-s: the donut's sweep peaks ~120 units out — inside the 125 rim (measured in Node)
  L.setSpeed(6);
  const K = S.skid, flags = { black: 0, brown: 0 };
  for (let n = w0; n < K.w; n++) { const f = K.buf[(n % 2048) * 7 + 6]; if (f === 2) flags.brown++; else flags.black++; }
  const sac = L.koth().candidate(S);
  return { pave: !!L.W.pave, candidate: sac ? sac.name : null, distFromCentre: L.W.pave ? Math.round(Math.hypot(P.x - L.W.pave.x, P.y - L.W.pave.y)) : -1, ...flags };
});
console.log('b donut check:', JSON.stringify(donutCheck));
await p.evaluate(({ x, y }) => { window.__lf.cam.x = x; window.__lf.cam.y = y; window.__lf.cam.zoom = 0.62; }, stage);
await p.waitForTimeout(600);
await p.screenshot({ path: path.join(ROOT, 'shots/koth-disc-b-donut.png') });
console.log('b donut shot taken');

// (c2) leave: park the player just outside the sac — the disc clears, the grass repaints
await p.evaluate(({ x, y, r }) => { const L = window.__lf, P = L.sim.player; P.x = x + r * 1.7; P.y = y; P.v = 0; L.cam.x = x; L.cam.y = y; L.cam.zoom = 0.62; }, stage);
await p.waitForFunction(() => !window.__lf.W.pave, null, { timeout: 60000 });
await p.waitForFunction(({ x, y, r }) => {
  const g = window.__lf.ground, CH = 256;
  for (let cy = Math.floor((y - r - 10) / CH); cy <= Math.floor((y + r + 10) / CH); cy++)
    for (let cx = Math.floor((x - r - 10) / CH); cx <= Math.floor((x + r + 10) / CH); cx++) {
      const nx = Math.max(cx * CH, Math.min(x, cx * CH + CH)), ny = Math.max(cy * CH, Math.min(y, cy * CH + CH));
      if (Math.hypot(nx - x, ny - y) <= r + 10 && !g.has(cx, cy)) return false;
    }
  return true;
}, stage, { timeout: 120000 });
await p.evaluate(({ x, y }) => { window.__lf.cam.x = x; window.__lf.cam.y = y; window.__lf.cam.zoom = 0.62; }, stage);
await p.waitForTimeout(900);
await p.screenshot({ path: path.join(ROOT, 'shots/koth-disc-c-cleared.png') });
console.log('c cleared shot taken — disc gone, grass repainted');
console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close(); web.close();
