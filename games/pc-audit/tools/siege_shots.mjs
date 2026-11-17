// siege_shots.mjs — phone-size captures of the Motel Siege in the real page. Every scene starts the
// same way a player does: on foot at the motel door with stars, a real TOUCH on the action button
// (it reads ENTER) — then the scene is driven by touch (fight button, action button) and keys
// (arrows = the joystick's axes), and captured mid-action.
// Usage: CHROME=/path/to/chrome node tools/siege_shots.mjs [scene ...]   -> shots/siege-<scene>.png
//   scenes: door, lobby, vend, tv, ac, roof, escape, busted
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const want = process.argv.slice(2);
const errors = [];

async function scene(name, tod, setup, drive) {
  if (want.length && !want.includes(name)) return;
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + e));
  await page.goto(`http://localhost:${server.address().port}/index.html?t=${tod}&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(5000);                                   // title card
  const cdp = await page.context().newCDPSession(page);
  const touch = async (pt) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y, id: 3 }] }); await page.waitForTimeout(70); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const btn = await page.evaluate(() => ({ x: 420 - 72, y: innerHeight - 120 }));
  const fist = await page.evaluate(() => ({ x: 420 - 164, y: innerHeight - 82 }));
  const api = {
    page, touch, act: () => touch(btn), punch: () => touch(fist),
    sg: (fn) => page.evaluate(fn),
    hold: async (key, until, ms = 12000) => { await page.keyboard.down(key); await page.waitForFunction(until, null, { timeout: ms, polling: 'raf' }); await page.keyboard.up(key); },
    wait: (fn, ms = 20000) => page.waitForFunction(`(() => { try { return (${fn})(); } catch (e) { return false; } })()`, null, { timeout: ms, polling: 'raf' }),
    freeze: () => page.evaluate(() => { window.__palm.sim.step = () => {}; }),
  };
  // walk up to the motel door with heat on you, and ENTER by touch
  await page.evaluate(() => { const s = window.__palm.sim, p = s.player.ped, d = s.W.L.motelDoor; p.x = d[0]; p.y = d[1] - 6; s.stars = 2; s.addStars = (n) => { s.stars = Math.min(5, s.stars + n); }; });
  await page.waitForTimeout(900);
  if (name === 'door') { await drive(api); } else {
    await api.act();
    await api.wait(() => window.__palm.sim.player.mode === 'siege');
    await page.waitForTimeout(500);
    if (setup) await page.evaluate(setup);
    // staging only: hold the arrest meter at zero so a scene can wait for its moment (the arrest
    // itself is covered by tools/siege_check.mjs)
    if (name !== 'lobby') await page.evaluate(() => setInterval(() => { const g = window.__palm.sim.siege; if (g) g.hero.arrest = 0; }, 10));
    await drive(api);
  }
  const file = path.join(ROOT, 'shots', `siege-${name}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', file, JSON.stringify(await page.evaluate(() => { const s = window.__palm.sim, g = s.siege; return { mode: s.player.mode, stars: s.stars, score: s.score || 0, wave: g && g.wave, cops: g && g.cops.length, hero: g && [g.hero.surf, +g.hero.x.toFixed(1)] }; })));
  await page.close();
}

// door: the ENTER prompt at the motel door (top-down, before the cut)
await scene('door', 0.3, null, async ({ page }) => { await page.waitForTimeout(300); });
// lobby: shove the desk and stand your ground as the first two cops come in (golden hour)
await scene('lobby', 0.25, null, async ({ act, wait, page, freeze }) => {
  await page.waitForTimeout(300); await act();
  await wait(() => window.__palm.sim.siege.cops.some(c => c.blockedBy));
  await page.waitForTimeout(500); await freeze(); await page.waitForTimeout(300);
});
// vend: tip the vending machine onto the cops who broke through the desk
await scene('vend', 0.35, null, async ({ hold, punch, wait, page, freeze }) => {
  const vx = await page.evaluate(() => window.__palm.sim.siege.traps[0].x);
  await hold('ArrowRight', `window.__palm.sim.siege.hero.x > ${vx + 0.7}`);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(40); await page.keyboard.up('ArrowLeft');
  await wait(() => { const g = window.__palm.sim.siege, v = g.traps[0]; return g.cops.some(c => c.surf === 'F0' && c.x > v.x - 2.0 && c.x < v.x - 0.4 && c.st === 'walk'); }, 30000);
  await punch();
  await wait(() => window.__palm.sim.siege.traps[0].state === 'down');
  await page.waitForTimeout(150); await freeze(); await page.waitForTimeout(300);
});
// tv: up the stairs, punch the CRT off the dresser at the cop on the landing (dusk)
await scene('tv', 0.6, () => { const g = window.__palm.sim.siege, h = g.hero; h.surf = 'F1'; h.z = g.geo.S.floors[1]; h.x = -3.7; h.face = 1; g.t = 15; },
  async ({ punch, wait, page, freeze }) => {
    await wait(() => { const g = window.__palm.sim.siege, tv = g.traps[1]; return g.cops.some(c => c.surf === 'F1' && c.x > tv.x + 1.2 && c.x < tv.x + 3.4); }, 40000);
    await punch();
    await wait(() => window.__palm.sim.siege.traps[1].state !== 'ready');
    await page.waitForTimeout(160); await freeze(); await page.waitForTimeout(300);
  });
// ac: drop the window AC three storeys onto the cruiser / cops at the pool doors (dusk)
await scene('ac', 0.75, () => { const g = window.__palm.sim.siege, h = g.hero; h.surf = 'F2'; h.z = g.geo.S.floors[2]; h.x = 5.2; h.face = 1; g.t = 17.5; },
  async ({ punch, wait, page, freeze }) => {
    await wait(() => window.__palm.sim.siege.breaches.pool && window.__palm.sim.siege.cops.some(c => c.surf === 'F0' && c.x > 6.8), 20000);
    await punch();
    await wait(() => window.__palm.sim.siege.traps[4].state === 'dropped', 5000);
    await page.waitForTimeout(250); await freeze(); await page.waitForTimeout(300);
  });
// roof: pry the hatch, climb out under the chopper as SWAT rappel in (night)
await scene('roof', 0.95, () => { const g = window.__palm.sim.siege, h = g.hero; h.surf = 'F2'; h.z = g.geo.S.floors[2]; h.x = g.geo.S.ladder.x; g.t = 52.5; g.wave = 2; },
  async ({ punch, act, wait, page, freeze }) => {
    await punch(); await page.waitForTimeout(400); await punch();
    await wait(() => window.__palm.sim.siege.hatch.open);
    await page.waitForTimeout(200); await act();
    await wait(() => window.__palm.sim.siege.hero.surf === 'R');
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(400); await freeze(); await page.waitForTimeout(300);
  });
// escape: off the balcony rail onto the board, mid-leap
await scene('escape', 0.85, () => { const g = window.__palm.sim.siege, h = g.hero; h.surf = 'F1'; h.z = g.geo.S.floors[1]; h.x = 7.6; h.face = 1; g.t = 31; },
  async ({ hold, act, wait, page, freeze }) => {
    await hold('ArrowRight', 'window.__palm.sim.siege.hero.x > window.__palm.sim.siege.geo.S.fireEscape.x1 - 0.5');
    await act();
    await wait(() => { const g = window.__palm.sim.siege; return g && g.hero.air && g.hero.z < 1.8; });
    await freeze(); await page.waitForTimeout(300);
  });

await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
