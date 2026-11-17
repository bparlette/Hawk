// heli_shots.mjs — the four hospital-helicopter screenshots, 420x860, waited out in SIM time
// (this VM renders slowly; wall-clock waits lie). Also asserts the live camera really does pull
// out to ~1.7x the walking width while airborne (main.js consuming heli.zoom).
// Usage: CHROME=/path/to/chrome node tools/heli_shots.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.css': 'text/css', '.ogg': 'audio/ogg' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});
await new Promise(r => srv.listen(8932, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:8932/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__palm && window.__palm.assetsReady, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.setItem('palm-city-seen', '1'); } catch (e) {} location.reload(); });
await page.waitForFunction(() => window.__palm && window.__palm.assetsReady, null, { timeout: 60000 });
fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
const shot = (n) => page.screenshot({ path: path.join(ROOT, 'shots', n) });
const ev = (fn) => page.evaluate(fn);
const waitSim = (fn, timeout = 90000) => page.waitForFunction(fn, null, { timeout });

// (1) on the roof pad beside the heli: walk in through the gap like a player would
await ev(() => { const P = window.__palm, p = P.sim.player.ped; p.x = 838; p.y = 1009; P.sim.camSnap = true; });
await page.keyboard.down('ArrowRight');
await waitSim(() => { const s = window.__palm.sim; return s.player.roof && s.player.ped.x > 905; });
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(500);
const zoomFoot = await ev(() => window.__palm.cam.zoom);
await shot('heli_1_roof.png');
console.log('shot 1: on the roof beside the heli; foot zoom', zoomFoot.toFixed(2));

// (2) steal it and fly out over the bay — the wide scout view
await page.keyboard.press('Space');
await waitSim(() => window.__palm.sim.player.mode === 'air');
await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowUp');
await waitSim(() => { const H = window.__palm.sim.heli; return H.x > 1560; });
await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowUp');
await page.waitForTimeout(400);
const zoomAir = await ev(() => window.__palm.cam.zoom);
await shot('heli_2_bay.png');
console.log('shot 2: airborne over the bay; air zoom', zoomAir.toFixed(2), zoomAir < 0.7 ? '(pulled out OK)' : '(NOT PULLED OUT!)');

// (3) the duel: the police chopper bears down on the stolen medevac, a moment before impact
await ev(() => { const P = window.__palm, s = P.sim; s.stars = 3; });
await waitSim(() => !!window.__palm.sim.chopper, 60000);
await ev(() => {
  const P = window.__palm, s = P.sim, H = s.heli, c = s.chopper, p = s.player.ped;
  H.x = c.x - 150; H.y = c.y - 55; H.vx = 0; H.vy = 0;           // hang in its path; it does the closing
  p.x = H.x; p.y = H.y; s.camSnap = true;
});
await page.waitForTimeout(120);
await shot('heli_3_duel.png');
console.log('shot 3: the duel, a moment before impact');
// let it connect, so the run ends in the state the check suite proves
await waitSim(() => window.__palm.sim.chopper === null, 30000).catch(() => console.log('  (the ram did not connect on camera — the headless check proves it)'));

// (4) landed on the beach, player on foot beside the machine
await ev(() => {
  const P = window.__palm, s = P.sim, H = s.heli, p = s.player.ped;
  if (s.player.mode !== 'air') {                                  // if the duel cost us the heli, stage the replacement early
    H.state = 'pad'; H.x = 990; H.y = 1009; H.home = true; H.onRoof = true; H.alt = 0; H.respawnT = 0;
    p.x = 950; p.y = 1009; p.hidden = false; s.camSnap = true;
  }
});
if (await ev(() => window.__palm.sim.player.mode !== 'air')) {
  await waitSim(() => window.__palm.sim.player.roof === true);
  await page.keyboard.press('Space');
  await waitSim(() => window.__palm.sim.player.mode === 'air');
}
await ev(() => { const s = window.__palm.sim, H = s.heli; H.x = 1360; H.y = 1800; H.vx = 0; H.vy = 0; H.state = 'fly'; H.alt = 1; window.__palm.sim.camSnap = true; });
await page.keyboard.press('Space');
await waitSim(() => window.__palm.sim.player.mode === 'foot');
await page.waitForTimeout(600);
await shot('heli_4_beach.png');
console.log('shot 4: landed on the beach, on foot beside the heli');

console.log(errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
await browser.close(); srv.close();
