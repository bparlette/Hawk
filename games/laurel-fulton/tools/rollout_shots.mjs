// rollout_shots.mjs — before/after stills for the GTA6-look roll-out.
//   node rollout_shots.mjs <gamesRoot> <label> <outDir>
// Serves <gamesRoot> (the dir containing laurel-fulton/ + palm-city/), shoots the Weis lot,
// a hero house (Brad), Atholton High School and Ledo Pizza at blue-hour (t=0.82), same recipe
// as the sample's gta6_shots.mjs. Waits for the roof bakes to land where a gta6 pass exists.
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const GAMES = path.resolve(process.argv[2]), LABEL = process.argv[3] || 'x', OUT = path.resolve(process.argv[4] || 'rollout-shots');
fs.mkdirSync(OUT, { recursive: true });
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => srv.listen(0, r));
const base = `http://localhost:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell' });
const errs = [];
async function shot(name, camQ, cx, cy, parkWeisCar = false) {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push(name + ': ' + String(e)));
  await p.goto(`${base}/laurel-fulton/play.html?cam=${camQ}&t=0.82&nointro`, { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__lf && window.__lf.sim, null, { timeout: 240000 });
  await p.waitForFunction(() => window.__lf.areas && window.__lf.areas.heroes && window.__lf.areas.heroes.length > 0, null, { timeout: 240000 });
  // warm the painter around the shot centre
  await p.evaluate(([x, y]) => {
    try {
      const list = []; const ccx = Math.floor(x / 256), ccy = Math.floor(y / 256);
      for (let i = -6; i <= 6; i++) for (let j = -8; j <= 8; j++) list.push([ccx + i, ccy + j]);
      window.__lf.ground.request(list.slice(0, 60));
    } catch (e) {}
  }, [cx, cy]);
  // wait for the painted tile under the Weis + the gta6 roof bakes (whichever exist)
  await p.waitForFunction(() => {
    try {
      const g6 = window.__lf.renderer && window.__lf.renderer.gta6;
      if (g6 && g6.sites) return g6.sites.every(s => !s.roof.started || s.roof.cv);
      return true;
    } catch (e) { return true; }
  }, null, { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(3500);
  if (parkWeisCar) {
    await p.evaluate(() => {
      const h = window.__lf.areas.heroes.find(x => x.who === 'Weis');
      const p = window.__lf.sim.player, n = { x: h.door.nx, y: h.door.ny }, t = { x: -n.y, y: n.x };
      const u = -150, v = 385;
      p.x = h.cx + t.x * u + n.x * v; p.y = h.cy + t.y * u + n.y * v;
      p.h = Math.atan2(n.y, n.x); p.v = 0;
    });
    await p.waitForTimeout(450);
  }
  const st = await p.evaluate(() => {
    const g6 = window.__lf.renderer && window.__lf.renderer.gta6;
    return { tod: +window.__lf.tod().toFixed(3), poles: g6 ? g6.poles.length : -1, sites: g6 ? g6.sites.map(s => s.h.who + ':' + (s.roof.cv ? 'baked' : s.roof.started ? 'baking' : 'idle')).join(' | ') : 'none' };
  });
  await p.screenshot({ path: path.join(OUT, name + '.png'), timeout: 120000 });
  console.log(name, JSON.stringify(st));
  await p.close();
}
await shot(`weis-${LABEL}`, '18150,18460,0.30', 18150, 18460, true);
await shot(`weis-close-${LABEL}`, '18120,18560,0.62', 18120, 18560, true);
await shot(`brad-${LABEL}`, '11994,18068,0.62', 11994, 18068);
await shot(`atholton-${LABEL}`, '5750,-19650,0.16', 5750, -19650);
await shot(`ledo-${LABEL}`, '-12941,697,0.45', -12941, 697);
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none');
await browser.close(); srv.close();
