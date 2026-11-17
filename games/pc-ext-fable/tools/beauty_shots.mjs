// beauty_shots.mjs — paired OFF/ON phone-size stills for the six BEAUTY WINNERS (src/fx.js),
// so the owner can judge each effect side by side. Same camera, same pinned time of day, same
// staged scene; the only difference is the ?fx= flag (for edge bleed the pair is the untreated
// district vs the treated district in the same build, per the sample's design). Since the
// winners became the default look, OFF pairs shoot ?fx=none and ON pairs shoot
// ?fx=none,<name>, so each pair isolates exactly one effect. (Rim light was cut by the
// owner's verdict and its scenario is gone with its code.)
//   node tools/beauty_shots.mjs [item ...]     (no args = all six; CHROME=/path optional)
// Fails (exit 1) on any page error.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// The headless shell occasionally refuses to launch on this VM; retry a few times.
let browser = null;
for (let i = 0; i < 6 && !browser; i++) {
  try {
    browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'] });
  } catch (e) { console.log('launch attempt', i + 1, 'failed; retrying'); await new Promise(r => setTimeout(r, 15000)); }
}
if (!browser) { console.error('could not launch a browser'); process.exit(1); }

const errors = [];
fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });

// Seat the player in the mint convertible at a spot (the activity_shots trick).
const SEAT = ([x, y, h]) => {
  const s = window.__palm.sim, P = s.player;
  const c = s.cars.find(k => k.model === 'conv_mint') || s.cars.find(k => !k.job && !k.wreck && !k.driver);
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; c.fixed = false; P.ped.hidden = true;
  c.x = x; c.y = y; c.h = h; c.v = 0; P.ped.x = x; P.ped.y = y;
};
// Hold the car's speed after every step; freeze the sim dead when it reaches yStop, so the
// screenshot catches the exact staged moment (ripples / petal trail hang in the air).
const DRIVE_FREEZE = ([speed, yStop]) => {
  const s = window.__palm.sim, step = s.step.bind(s);
  s.step = (dt, inp) => {
    step(dt, inp);
    const c = s.player.car;
    if (!c) return;
    if (c.y > yStop) c.v = speed;
    else { s.step = () => {}; window.__frozen = true; }
  };
};

async function shot(name, query, stage, wait) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.goto(`http://localhost:${PORT}/index.html?${query}`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 90000 });
  if (stage) await page.evaluate(stage[0], stage[1]);
  if (wait === 'frozen') {
    await page.waitForFunction(() => window.__frozen, null, { timeout: 90000 });
  } else if (wait === 'swaypeak') {
    await page.waitForFunction(() => window.__palm.sim.time >= 2, null, { timeout: 90000 });
    await page.waitForFunction(() => {
      const o = window.__palm.renderer.swayOffset(1, window.__palm.sim.time);
      return Math.abs(o[0]) > 2.1;
    }, null, { timeout: 60000 });
  } else {
    await page.waitForFunction(() => window.__palm.sim.time >= 3, null, { timeout: 90000 });
  }
  await page.waitForTimeout(1200);                       // last chunks + HUD settle
  await page.screenshot({ path: path.join(ROOT, 'shots', name) });
  console.log('wrote shots/' + name);
  await page.close();
}

const NORTH = -Math.PI / 2;
const ALL = {
  // 1. roof parallax: the hotel/shops/diner cluster over the plaza
  roof: async () => {
    await shot('beauty-roof-off.png', 'cam=700,480&t=0.25&fx=none');
    await shot('beauty-roof-on.png', 'cam=700,480&t=0.25&fx=none,roof');
  },
  // 2. palm shadow sway: the villa-strip palms at x=300 (palm index 1 = [300,520])
  sway: async () => {
    await shot('beauty-sway-off.png', 'cam=300,560&t=0.25&fx=none');
    await shot('beauty-sway-on.png', 'cam=300,560&t=0.25&fx=none,sway', null, 'swaypeak');
  },
  // 3. causeway water depth: mid-MacArthur over the bay
  causeway: async () => {
    await shot('beauty-causeway-off.png', 'cam=-1900,950&t=0.3&fx=none');
    await shot('beauty-causeway-on.png', 'cam=-1900,950&t=0.3&fx=none,causeway');
  },
  // 4. gouache edge bleed: treated = the plaza block; untreated = the police/houses blocks
  bleed: async () => {
    await shot('beauty-bleed-off.png', 'cam=520,1750&t=0.3&fx=none,bleed');
    await shot('beauty-bleed-on.png', 'cam=880,480&t=0.3&fx=none,bleed');
  },
  // 5. slipstream petals: 300 u/s down Ocean Drive, frozen with the wake behind
  petals: async () => {
    await shotDrive('beauty-petals-off.png', 'cam=1200,1300&t=0.3&fx=none', 300, 1330, [1200, 1560, NORTH]);
    await shotDrive('beauty-petals-on.png', 'cam=1200,1300&t=0.3&fx=none,petals', 300, 1330, [1200, 1560, NORTH]);
  },
};

async function shotDrive(name, query, speed, yStop, seatAt = [1196, 1075, NORTH]) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.goto(`http://localhost:${PORT}/index.html?${query}`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 90000 });
  await page.evaluate(SEAT, seatAt);
  await page.evaluate(DRIVE_FREEZE, [speed, yStop]);
  await page.waitForFunction(() => window.__frozen, null, { timeout: 90000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(ROOT, 'shots', name) });
  console.log('wrote shots/' + name, JSON.stringify(await page.evaluate(() => { const c = window.__palm.sim.player.car; return { x: Math.round(c.x), y: Math.round(c.y), v: Math.round(c.v) }; })));
  await page.close();
}

const want = process.argv.slice(2);
const items = want.length ? want : Object.keys(ALL);
for (const k of items) await ALL[k]();
await browser.close();
server.close();
if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 6).join(' | ')); process.exit(1); }
console.log('BEAUTY SHOTS OK');
