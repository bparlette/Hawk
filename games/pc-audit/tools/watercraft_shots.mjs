// watercraft_shots.mjs — staged phone-size captures of the watercraft sample:
// the jetski mid-spray, the cigarette boat at full speed under its rooster tail, both craft
// moored at the pier, and the police boat running the jetski down. Same recipe as skid_shots.
// Waits are measured in SIM time, not wall time: this VM renders slowly (and shares its CPUs),
// so a fixed 2 s of wall clock can be a few frames of game. Poll sim.time instead.
// Usage: node tools/watercraft_shots.mjs
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
const exe = process.env.CHROME || undefined;
// swiftshader args as in record_check.mjs: without them the headless shell crawls at ~4 fps
// and the fixed-step loop (dt clamped to 0.1 s) barely advances the sim between screenshots
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
page.on('pageerror', e => console.log('PAGE ERROR', String(e).slice(0, 200)));
const OUT = path.join(ROOT, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const simTime = () => page.evaluate(() => window.__palm.sim.time);
// Wait until the game's own clock has advanced `secs` (title card = 3.2 s of frame time).
async function waitSim(secs, capMs = 180000) {
  const t0 = await simTime(), end = Date.now() + capMs;
  while (Date.now() < end) {
    if (await simTime() - t0 >= secs) return true;
    await page.waitForTimeout(400);
  }
  return false;
}
const load = async () => {
  await page.goto(`http://127.0.0.1:${port}/index.html?t=0.2&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 30000 });
  await waitSim(3.4);                          // burn the PALM CITY title card
};
// Put the player on a craft out in the bay, moving — and put the camera on it, so no swing
// is left to chance. The sim keeps running under us.
const stage = (kind, x, y, h, spd) => page.evaluate(([kind, x, y, h, spd]) => {
  const s = window.__palm.sim;
  const cr = s.water.craft.find(c => c.kind === kind);
  s.player.mode = 'water'; s.water.ride = cr; cr.ridden = true;
  cr.x = x; cr.y = y; cr.h = h; cr.vx = Math.cos(h) * spd; cr.vy = Math.sin(h) * spd;
  s.player.ped.x = x; s.player.ped.y = y;
  window.__palm.cam.x = x; window.__palm.cam.y = y;
}, [kind, x, y, h, spd]);

// 1. both craft moored at the pier: stand on the deck and look at them
await load();
await page.evaluate(() => { const s = window.__palm.sim; s.player.ped.x = 1560; s.player.ped.y = 1030; window.__palm.cam.x = 1560; window.__palm.cam.y = 1030; });
await waitSim(0.5);
await page.screenshot({ path: path.join(OUT, 'water-moored.png') });
console.log('shot water-moored.png');

// 2. jetski mid-spray, turbo held (the F key is the A button on keys)
await load();
await stage('jetski', 1700, 1750, -Math.PI / 2, 200);
await page.keyboard.down('ArrowUp');
await page.keyboard.down('KeyF');
await waitSim(1.6);
await page.screenshot({ path: path.join(OUT, 'water-jetski.png') });
console.log('shot water-jetski.png');
await page.keyboard.up('KeyF');
await page.keyboard.up('ArrowUp');

// 3. cigarette boat wound out from the start, rooster tail up
await load();
await stage('boat', 1700, 1950, -Math.PI / 2, 390);
await page.keyboard.down('ArrowUp');
await waitSim(1.6);
await page.screenshot({ path: path.join(OUT, 'water-boat.png') });
console.log('shot water-boat.png');
await page.keyboard.up('ArrowUp');

// 4. the police boat on the jetski: 2 stars, it spawns in, drop it in behind and chase
await load();
await stage('jetski', 1700, 1450, -Math.PI / 2, 200);
await page.evaluate(() => { window.__palm.sim.stars = 2; });
{
  const end = Date.now() + 120000;             // the spawn lands on the first sim step; poll for it
  let cop = false;
  while (Date.now() < end && !cop) { cop = await page.evaluate(() => !!window.__palm.sim.water.cop); if (!cop) await page.waitForTimeout(400); }
  if (!cop) throw new Error('police boat never spawned');
}
await page.evaluate(() => {
  const s = window.__palm.sim, cr = s.water.ride, cop = s.water.cop;
  cop.x = cr.x + 20; cop.y = cr.y + 300; cop.h = -Math.PI / 2; cop.vx = 0; cop.vy = -420;
  window.__palm.cam.x = cr.x; window.__palm.cam.y = cr.y + 90;   // frame the pair
});
await page.keyboard.down('ArrowUp');
await waitSim(0.9);                            // it closes ~200 of the 300 gap; the pin needs 2.8 s, we shoot at 0.9
await page.screenshot({ path: path.join(OUT, 'water-cop.png') });
console.log('shot water-cop.png');
await page.keyboard.up('ArrowUp');

await browser.close();
server.close();
console.log('WATERCRAFT SHOTS DONE');
