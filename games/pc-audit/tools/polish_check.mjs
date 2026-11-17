// polish_check.mjs — rule checks for the POLISH BUNDLE (Nov 16):
//   A. director two-angle splice: wide establishes, tight lands the slow-mo peak
//   B. rim-driving: spikes -> 8 s ON RIMS with sparks, then the limp; cop cars blow straight out
//   C. slipstream: draft charges behind traffic only, slingshot pays on the pass
//   D. (browser) Channel 7 frame pixels in the recorded picture, on/off via the NEWS toggle
//   E. (browser) smoke tint sampling: flasher-lit vs neutral
//   F. (browser) west flare / sunbeams respond to day phase and heading; the Ocean Drive
//      sheen was REMOVED by owner veto (Nov 16 23:34) — F asserts it stays gone
// Usage: node tools/polish_check.mjs   (CHROME=/path/to/chrome optional)
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';
import { DemoPilot } from '../src/demo.js';
import { Director } from '../src/director.js';
import { stepPressure } from '../src/pressure.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const DT = 1 / 60, none = { jx: 0, jy: 0, jm: 0, keys: {} };

// ---------------------------------------------------------------- A. director splice
{
  const d = new Director(7);
  const live = new Sim(world, M, 7, (n, v) => d.mark(n, v));
  const pilot = new DemoPilot(live, world);
  for (let i = 0; i < 40 * 60 && !pilot.done; i++) { const inp = pilot.input(DT); d.record(inp); live.step(DT, inp); }
  const win = d.pick();
  check(!!win, 'splice: the demo run yields a highlight window');
  if (win) {
    const p = d.begin(world, M, () => {}, win);
    let guard = 0;
    while (!p.ready && guard++ < 1000) d.step(DT, DT);
    let preSeen = false, firstSlowShot = -1, frames = 0;
    while (!d.done && frames < 20000) {
      d.step(DT, DT); frames++;
      if (p.splice === 'pre' && p.shot === 1) preSeen = true;
      if (p.slow && firstSlowShot < 0) firstSlowShot = p.shot;
    }
    check(firstSlowShot === 2, 'splice: the frame slow-mo opens, the camera is on the TIGHT lead', `shot ${firstSlowShot}`);
    check(preSeen || win.peak - win.i0 <= 210 + 24, 'splice: a WIDE establishing shot leads into the peak', preSeen ? '' : `peak only ${win.peak - win.i0} steps into the window`);
    check(p.splice === 'done', 'splice: after the peak the ordinary cut rotation resumes', `splice ${p.splice}`);
    d.end();
  }
}

// ---------------------------------------------------------------- B. rim-driving
function freshSim() {
  const sim = new Sim(world, M, 5, () => {});
  sim.cars = sim.cars.filter(c => c.parked); sim.peds = [sim.player.ped];
  sim.stars = 0; sim.addStars = () => {};
  return sim;
}
function inCar(s, x, y, h, model = 'sedan_coral') {
  const c = s.addCar(x, y, h, model, 'player');
  s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true;
  return c;
}
{
  const s = freshSim();
  const q = world.loopAt(600, 12), h = Math.atan2(q.ty, q.tx), c = inCar(s, q.x, q.y, h);
  s.spikes.push({ x: q.x + Math.cos(h) * 50, y: q.y + Math.sin(h) * 50, a: h + Math.PI / 2 });
  let rimAt = -1, spikeAt = -1, sparksSeen = 0, rimMsg = '';
  for (let i = 0; i < 12 * 60; i++) {
    if (!c.spiked) c.v = 240;
    s.step(DT, { ...none, keys: { up: true } });
    if ((c.rims || 0) > 0) { if (rimAt < 0) { rimAt = i; rimMsg = s.msg ? s.msg.text : ''; } sparksSeen = Math.max(sparksSeen, s.sparks.filter(p => p.on).length); }
    if (c.spiked && spikeAt < 0) spikeAt = i;
  }
  check(rimAt >= 0 && spikeAt > rimAt, 'rims: spikes put the player ON RIMS before any limp', rimAt >= 0 ? `rim at ${(rimAt / 60).toFixed(1)} s, blown at ${(spikeAt / 60).toFixed(1)} s` : 'never rimmed');
  check(rimMsg === 'ON RIMS!', 'rims: the ON RIMS! call goes up the moment the tyres blow', rimMsg);
  check(spikeAt > 0 && (spikeAt - rimAt) / 60 > 7 && (spikeAt - rimAt) / 60 < 9.5, 'rims: the rim run lasts ~8 s', `${((spikeAt - rimAt) / 60).toFixed(1)} s`);
  check(sparksSeen >= 8, 'rims: sparks stream off the wheels while rimming', `${sparksSeen} live sparks at peak`);
}
{ // a police car crossing the same strip blows straight to the limp — no rim run for the AI
  // (driven through stepPressure directly so the police AI can't wander off the test line)
  const s = freshSim();
  const q = world.loopAt(600, 12), h = Math.atan2(q.ty, q.tx);
  const cop = s.addCar(q.x, q.y, h, 'police', 'police', { s: 600, dir: 1 });
  s.spikes.push({ x: q.x + Math.cos(h) * 50, y: q.y + Math.sin(h) * 50, a: h + Math.PI / 2 });
  let blew = false;
  for (let i = 0; i < 3 * 60 && !blew; i++) { cop.v = 240; cop.x += Math.cos(h) * 240 * DT; cop.y += Math.sin(h) * 240 * DT; stepPressure(s, DT); blew = !!cop.spiked; }
  check(blew && !(cop.rims > 0), 'rims: a cop car on spikes is blown immediately, no rim run');
}

// ---------------------------------------------------------------- C. slipstream
{
  const s = freshSim();
  const q = world.loopAt(600, 12), h = Math.atan2(q.ty, q.tx);
  const traffic = s.addCar(q.x, q.y, h, 'sedan_teal', 'ai', { s: 600, dir: 1, cruise: 130 });
  const c = inCar(s, q.x - Math.cos(h) * 80, q.y - Math.sin(h) * 80, h);
  const pin = (gap) => {                             // hold the player `gap` behind the traffic car
    c.x = traffic.x - Math.cos(traffic.h) * (traffic.len / 2 + gap + c.len / 2);
    c.y = traffic.y - Math.sin(traffic.h) * (traffic.len / 2 + gap + c.len / 2);
    c.h = traffic.h; c.v = 150;
  };
  for (let i = 0; i < 2.5 * 60; i++) { pin(28); s.step(DT, none); }
  check(s.draft > 0.5, 'slipstream: the draft charges behind a traffic car', `draft ${s.draft.toFixed(2)}`);
  const score0 = s.score || 0;
  c.x = traffic.x + Math.cos(traffic.h) * (traffic.len / 2 + c.len / 2 + 20);   // swing past it
  c.y = traffic.y + Math.sin(traffic.h) * (traffic.len / 2 + c.len / 2 + 20);
  c.h = traffic.h; c.v = 200;
  s.step(DT, none);
  check((s.score || 0) === score0 + 50 && s.lastTrick && s.lastTrick.name === 'SLINGSHOT', 'slipstream: passing the drafted car pays SLINGSHOT +50', `score ${score0} -> ${s.score || 0}`);
}
{ // parked cars give nothing
  const s = freshSim();
  const q = world.loopAt(600, 12), h = Math.atan2(q.ty, q.tx);
  const parked = s.addCar(q.x, q.y, h, 'sedan_teal', null, { parked: true });
  const c = inCar(s, q.x - Math.cos(h) * 80, q.y - Math.sin(h) * 80, h);
  for (let i = 0; i < 2 * 60; i++) {
    c.x = parked.x - Math.cos(h) * (parked.len / 2 + 28 + c.len / 2);
    c.y = parked.y - Math.sin(h) * (parked.len / 2 + 28 + c.len / 2);
    c.h = h; c.v = 150;
    s.step(DT, none);
  }
  check(s.draft === 0, 'slipstream: no draft behind a parked car', `draft ${s.draft}`);
}

// ---------------------------------------------------------------- D–F. browser parts
const { chromium } = await import('playwright-core');
const http = (await import('node:http')).default;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'] });
const pageErr = [];
async function newPage(query) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true });
  page.on('pageerror', e => pageErr.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/index.html${query}`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 60000 });
  return page;
}
async function tapEl(page, sel) {
  const box = await (await page.$(sel)).boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
// count broadcast-red pixels (the top rule + LIVE chip) inside a view-coords band of the canvas
async function redCount(page, y0, y1) {
  return page.evaluate(([y0, y1]) => {
    const src = document.getElementById('game');
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x2 = c.getContext('2d'); x2.drawImage(src, 0, 0);
    const dpr = src.width / 420;
    const img = x2.getImageData(Math.floor(12 * dpr), Math.floor(y0 * dpr), Math.floor(336 * dpr), Math.floor((y1 - y0) * dpr)).data;
    let n = 0;
    // the predicate targets the frame's own news-red (#e0232e: R 224, G 35, B 46). The old loose
    // line (R>150, G<85) also caught the painted world's warm boardwalk/sand tones at golden
    // hour (~1.7k px of R~168 G~84 browns in the demo opening — measured push #2, with
    // recorder.newsLive verified false), which read as a frame leak that was never there.
    for (let i = 0; i < img.length; i += 4) if (img[i] > 190 && img[i + 1] < 70 && img[i + 2] < 70) n++;
    return n;
  }, [y0, y1]);
}

{ // D. broadcast frame on the highlight (default ON), then toggled OFF
  const page = await newPage('?demo&highlight');
  await page.waitForFunction(() => !!window.__palm.director.play, null, { timeout: 240000 });
  await page.waitForFunction(() => window.__palm.director.play && window.__palm.director.play.ready, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const on = await redCount(page, 736, 802);          // lower-third band, above the letterbox
  check(on > 1500, 'broadcast: Channel 7 frame is in the highlight picture by default', `${on} red px`);
  await tapEl(page, '#pcNewsBtn');
  await page.waitForTimeout(800);
  const off = await redCount(page, 736, 802);
  check(off < 300, 'broadcast: NEWS toggle takes the frame back out (clean picture)', `${off} red px`);
  await page.close();
}
{ // D2. live REC: default OFF, toggle brings it in
  const page = await newPage('?demo');
  await page.waitForTimeout(2500);
  await tapEl(page, '#pcRecBtn');
  await page.waitForTimeout(1200);
  const off = await redCount(page, 682, 748);          // live lower-third band
  check(off < 300, 'broadcast: live REC starts clean (frame OFF by default)', `${off} red px`);
  // the NEWS button flips BOTH frame flags together (recorder's documented semantics: any on
  // -> all off; all off -> all on). The shipped default is MIXED (highlight ON, live OFF), so
  // one tap takes every frame out and the second brings the live frame in. The old one-tap
  // expectation only ever passed because the loose red predicate counted warm world tones.
  await tapEl(page, '#pcNewsBtn');
  await page.waitForTimeout(800);
  const off2 = await redCount(page, 682, 748);
  check(off2 < 300, 'broadcast: NEWS once from the mixed default takes every frame out', `${off2} red px`);
  await tapEl(page, '#pcNewsBtn');
  await page.waitForTimeout(800);
  const on = await redCount(page, 682, 748);
  check(on > 1500, 'broadcast: NEWS again brings the frame into live REC', `${on} red px`);
  await tapEl(page, '#pcRecBtn');                      // stop the recording
  await page.close();
}
{ // E. smoke tint: beside a siren vs out in the open
  const page = await newPage('?t=0.9&nostart');
  await page.waitForTimeout(1200);
  const res = await page.evaluate(async () => {
    const s = window.__palm.sim, R = window.__palm.renderer;
    const { puff } = await import('./src/destruct.js');
    const cop = s.addCar(1000, 1000, 0, 'police', null, { parked: true }); cop.siren = true;
    for (const c of s.cars) if (c !== cop) { c.x = -9999; c.y = -9999; }   // isolate the test: no other light sources
    puff(s, 1030, 1000, 1, 1);                          // 30 units from the cruiser
    puff(s, 300, 1900, 1, 1);                           // far from everything
    const lit = s.smoke.find(p => p.on && Math.hypot(p.x - 1030, p.y - 1000) < 12);
    const far = s.smoke.find(p => p.on && Math.hypot(p.x - 300, p.y - 1900) < 12);
    const G = R.gradeFor(0.9);
    return { lit: lit ? R.smokeTint(s, lit, s.time, G) : 'missing', far: far ? R.smokeTint(s, far, s.time, G) : 'missing' };
  });
  const litOk = Array.isArray(res.lit) && res.lit[3] > 0.15 && (res.lit[0] > 150 || res.lit[2] > 150);
  check(litOk, 'smoke tint: a puff beside a lit cruiser takes the flasher colour', JSON.stringify(res.lit));
  check(res.far === null, 'smoke tint: a puff in neutral light stays grey (no tint)', JSON.stringify(res.far));
  await page.close();
}
{ // F. flare / beams (sheen removed by owner veto — asserted gone below)
  const page = await newPage('?t=0.12&nostart');
  await page.waitForTimeout(1000);
  const early = await page.evaluate(() => {
    const s = window.__palm.sim, R = window.__palm.renderer;
    s.player.ped.h = Math.PI;                           // face west, into the sun
    return new Promise(res => setTimeout(() => res({ flare: R.fxFlare, beams: R.fxBeams }), 700));
  });
  check(early.flare > 0.25, 'flare: strong when facing west early in the day', `flare ${early.flare && early.flare.toFixed(2)}`);
  check(early.beams > 0.4, 'sunbeams: shafts are up in the early window', `beams ${early.beams && early.beams.toFixed(2)}`);
  const east = await page.evaluate(() => {
    const s = window.__palm.sim, R = window.__palm.renderer;
    s.player.ped.h = 0;                                 // face east, sun behind
    return new Promise(res => setTimeout(() => res(R.fxFlare), 700));
  });
  check(east < 0.05, 'flare: gone when facing east', `flare ${east && east.toFixed(2)}`);
  await page.close();
  const dusk = await newPage('?t=0.85&nostart');
  await dusk.waitForTimeout(1000);
  const beamsLate = await dusk.evaluate(() => window.__palm.renderer.fxBeams);
  check(beamsLate === 0, 'sunbeams: gone by dusk', `beams ${beamsLate}`);
  const sheenProbe = await dusk.evaluate(() => window.__palm.renderer.fxSheen);
  check(sheenProbe === undefined, 'sheen: REMOVED by owner veto (Nov 16) — no fxSheen probe on the renderer', `fxSheen ${sheenProbe}`);
  await dusk.close();
}
check(pageErr.length === 0, 'no page errors across the browser parts', pageErr.join(' | '));
await browser.close(); server.close();
console.log(fails ? `POLISH FAIL (${fails})` : 'POLISH OK');
process.exit(fails ? 1 : 0);
