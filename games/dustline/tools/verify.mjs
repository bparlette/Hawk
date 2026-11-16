// DUSTLINE verification: serves the game, drives it with the autopilot bot,
// asserts gameplay facts, and captures the bake-off screenshots.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/hatch/workspace/dustline';
const SHOTS = path.join(ROOT, 'shots');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.md': 'text/markdown' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(8931, r));

const pw = await import('/home/hatch/workspace/hoa-warfare/node_modules/playwright/index.mjs');
const chromium = pw.chromium || pw.default.chromium;
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
}

async function newPage(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  // deterministic Math.random so every look screenshot is the same race moment
  await page.addInitScript(() => {
    let s = 987654321;
    Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://localhost:8931/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dust, null, { timeout: 15000 });
  await page.waitForTimeout(350);
  return { page, errors };
}
const ev = (page, fn) => page.evaluate(fn);
// Freeze the rAF loop and render one deterministic frame before each screenshot
// (headless SwiftShader starves rAF; components are measured fast, the loop is the artifact).
async function shot(page, file) {
  await ev(page, () => { __dust.freeze(true); __dust.renderOnce(); });
  await page.screenshot({ path: file, timeout: 60000 });
  await ev(page, () => __dust.freeze(false));
}

// ---------- main page: menu + functional tests ----------
const { page, errors } = await newPage(1280, 720);
await shot(page, path.join(SHOTS, 'menu-1280.png'));

// --- nitro pickup test (fresh race, teleport onto the spot) ---
await ev(page, () => { __dust.startRace('race'); __dust.skipCount(); });
const nitroBefore = await ev(page, () => __dust.state.trucks[0].nitro);
await ev(page, () => { __dust.teleport(0, 76, 15.5, 0); __dust.step(4); });
const nitroAfter = await ev(page, () => __dust.state.trucks[0].nitro);
check('nitro pickup works', nitroAfter === nitroBefore + 2, `nitro ${nitroBefore} -> ${nitroAfter}`);

// --- water vs dirt speed test ---
async function speedRun(x, y, ang, vx, vy) {
  await ev(page, () => { __dust.startRace('race'); __dust.skipCount(); });
  await page.evaluate(([x, y, ang, vx, vy]) => { __dust.teleport(0, x, y, ang); __dust.setSpeed(0, vx, vy); __dust.auto(false); }, [x, y, ang, vx, vy]);
  // hold full throttle east/west manually: use auto=false + keyboard is not available headless;
  // instead give the truck speed and let drag act with no throttle by stepping the sim directly.
  await ev(page, () => __dust.step(30));
  return ev(page, () => { const t = __dust.state.trucks[0]; return Math.hypot(t.vx, t.vy); });
}
// no-throttle coast-down: water drag 2.3 vs dirt drag 0.25 over 0.5 s
const vWater = await speedRun(26, 17, 0, 22, 0);
const vDirt = await speedRun(60, 65, Math.PI, -22, 0);
check('water slows truck vs dirt', vWater < vDirt * 0.72, `coast 0.5s from 22 m/s: water ${vWater.toFixed(1)} vs dirt ${vDirt.toFixed(1)}`);

// --- full autopilot run: laps, positions, tire tracks ---
await ev(page, () => { __dust.startRace('race'); __dust.skipCount(); __dust.auto(true); });
const dark0 = await ev(page, () => __dust.trackDark());
let lap = 1, steps = 0;
const orderEarly = await ev(page, () => __dust.order().join(','));
while (steps < 60 * 110 && lap < 2) {
  await ev(page, () => __dust.step(300));
  steps += 300;
  lap = await ev(page, () => __dust.state.trucks[0].lap);
}
check('bot completes lap 1 (lap increments)', lap >= 2, `lap=${lap} after ${(steps / 60).toFixed(0)} game-sec`);
const dark1 = await ev(page, () => __dust.trackDark());
check('tire tracks accumulate', dark1 > dark0 + 120, `dark samples ${dark0} -> ${dark1}`);
const ot = await ev(page, () => __dust.state.overtakeEvents);
const orderLate = await ev(page, () => __dust.order().join(','));
check('positions change (overtakes)', ot > 0 || orderEarly !== orderLate, `overtakeEvents=${ot}, order ${orderEarly} -> ${orderLate}`);
const dmg = await ev(page, () => __dust.state.trucks.map(t => Math.round(t.damage)).join('/'));

// --- three looks, same race moment (seeded) ---
for (const look of ['A', 'B', 'C']) {
  await page.evaluate((look) => { __dust.startRace('race'); __dust.skipCount(); __dust.auto(true); __dust.step(560); __dust.setLook(look); }, look);
  await shot(page, path.join(SHOTS, `race-look${look}-1280.png`));
}
check('three look screenshots captured', true, 'see shots/race-look{A,B,C}-1280.png');

// --- water crossing splash shot (look A) ---
await ev(page, () => { __dust.startRace('race'); __dust.skipCount(); __dust.setLook('A'); __dust.teleport(0, 24, 17, 0); __dust.setSpeed(0, 17, 0); __dust.auto(true); __dust.step(46); });
await shot(page, path.join(SHOTS, 'water-crossing-1280.png'));
check('water crossing shot captured', true, 'shots/water-crossing-1280.png');

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');
console.log('truck damage after run (player/ai):', dmg);
await page.close();

// ---------- portrait ----------
const p2 = await newPage(420, 860);
await shot(p2.page, path.join(SHOTS, 'menu-portrait-420.png'));
await ev(p2.page, () => { __dust.startRace('race'); __dust.skipCount(); __dust.auto(true); __dust.step(400); __dust.setLook('B'); });
await shot(p2.page, path.join(SHOTS, 'race-portrait-420.png'));
check('portrait shots captured', true, 'menu + race at 420x860');
check('no page errors (portrait)', p2.errors.length === 0, p2.errors.slice(0, 2).join(' | ') || 'clean');
await p2.page.close();

await browser.close();
server.close();
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
process.exit(fails.length ? 1 : 0);
