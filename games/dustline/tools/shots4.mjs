// DUSTLINE v4 authored-landform screenshots: same seeded race moments as verify.mjs,
// saved to shots4/ so the v1 set in shots/ stays available for comparison.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/hatch/workspace/dustline';
const SHOTS = path.join(ROOT, 'shots4');
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.md': 'text/markdown' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(8934, r));

const pw = await import('/home/hatch/workspace/hoa-warfare/node_modules/playwright/index.mjs');
const chromium = pw.chromium || pw.default.chromium;
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => {
    let s = 987654321;
    Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://localhost:8934/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dust, null, { timeout: 15000 });
  await page.waitForTimeout(350);
  return { page, errors };
}
const ev = (page, fn) => page.evaluate(fn);
async function shot(page, file) {
  await ev(page, () => { __dust.freeze(true); __dust.renderOnce(); });
  await page.screenshot({ path: file, timeout: 60000 });
  await ev(page, () => __dust.freeze(false));
}

const { page, errors } = await newPage(1280, 720);
await shot(page, path.join(SHOTS, 'menu-1280.png'));

// clean base (no trucks/props) in look A — the scene itself, for the gate
await ev(page, () => {
  const st = __dust.state;
  window.__saved = { trucks: st.trucks, pickups: st.pickups, stacks: st.stacks, debris: st.debris, particles: st.particles };
  st.trucks = []; st.pickups = []; st.stacks = []; st.debris = []; st.particles = [];
  __dust.setLook('A');
});
await shot(page, path.join(SHOTS, 'base-lookA-clean.png'));
await ev(page, () => { Object.assign(__dust.state, window.__saved); });

for (const look of ['A', 'B', 'C']) {
  await page.evaluate((look) => { __dust.startRace('race'); __dust.skipCount(); __dust.auto(true); __dust.step(560); __dust.setLook(look); }, look);
  await shot(page, path.join(SHOTS, `race-look${look}-1280.png`));
}
await ev(page, () => { __dust.startRace('race'); __dust.skipCount(); __dust.setLook('A'); __dust.teleport(0, 24, 17, 0); __dust.setSpeed(0, 17, 0); __dust.auto(true); __dust.step(46); });
await shot(page, path.join(SHOTS, 'water-crossing-1280.png'));
console.log('page errors:', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
await page.close();

const p2 = await newPage(420, 860);
await ev(p2.page, () => { __dust.startRace('race'); __dust.skipCount(); __dust.auto(true); __dust.step(400); __dust.setLook('B'); });
await shot(p2.page, path.join(SHOTS, 'race-portrait-420.png'));
console.log('portrait errors:', p2.errors.length ? p2.errors.slice(0, 3).join(' | ') : 'none');
await p2.page.close();

await browser.close();
server.close();
console.log('shots4 done');
