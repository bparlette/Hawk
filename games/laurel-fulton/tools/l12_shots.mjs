// l12_shots.mjs — tasks L12/L13 evidence on the REAL page (420x860 @2x): the Weis exterior + cutaway (security desk, pizza counter, the
// firing scene), Scott's house, Gringada (memory) exterior + cutaway (the steal), the 108 Astro lit and robbed.
//   CHROME=/usr/bin/google-chrome NODE_PATH=$(npm root -g) node tools/l12_shots.mjs     (from games/laurel-fulton/)   -> shots/l12-*.png, shots/l13-*.png
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const PJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/places.json')));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errs = []; const base = `http://localhost:${web.address().port}/laurel-fulton/play.html`;
const open = async (qs, ready) => { const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); await p.goto(base + '?' + qs); await p.waitForFunction(ready, null, { timeout: 240000 }); return p; };
const shot = async (p, name, note) => { await p.screenshot({ path: path.join(ROOT, 'shots', name + '.png') }); console.log(name, note || ''); };
const waitFor = async (p, fn, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn)) return true; await p.waitForTimeout(40); } return false; };
const places = (p) => p.waitForFunction(() => window.__lf && window.__lf.places() && window.__lf.areas.heroes.length > 8 && window.__lf.sim.cars.some(c => c.set === 'astro108'), null, { timeout: 240000 });
// ---- exteriors: a static camera over each hero (the hero tier at golden hour)
for (const [id, name, z] of [['weis', 'l12-1-weis-exterior', 0.5], ['gringada', 'l13-1-gringada-memory-exterior', 1.05]]) {
  const pl = PJ.places.find(q => q.id === id), p = await open(`cam=${Math.round(pl.cx)},${Math.round(pl.cy)},${z}&nointro`, () => window.__lf && window.__lf.areas.heroes.length > 8);
  await p.waitForTimeout(6000); await shot(p, name, id); await p.close();
}
{ const sc = PJ.npcs[0], p = await open(`cam=${Math.round(sc.house[0])},${Math.round(sc.house[1])},2.2&nointro`, () => window.__lf && window.__lf.sim.cars.length > 12); await p.waitForTimeout(500);
  await p.evaluate(() => window.__lf.places() || 0); await p.waitForTimeout(5000); await shot(p, 'l12-2-scotts-house-civic', 'Scott\'s house (tag, no number) + his Civic'); await p.close(); }
// ---- the Weis, on foot, then inside as Kosack (so Jason + Brad + Rigg are all NPCs)
{
  const p = await open('player=kosack&nointro', () => window.__lf && window.__lf.places() && window.__lf.foot()); await places(p);
  const wp = PJ.places.find(q => q.id === 'weis');
  await p.evaluate((wp) => { const L = window.__lf, f = L.foot(), S = 1.12, d = wp.door; f.active = true; f.z = 0; f.x = wp.cx + (d.wall[0] - wp.cx) * S + d.nx * 40; f.y = wp.cy + (d.wall[1] - wp.cy) * S + d.ny * 40; f.px = f.x; f.py = f.y; f.h = Math.atan2(-d.ny, -d.nx); L.cam.x = f.x; L.cam.y = f.y; }, wp);
  await p.waitForTimeout(2500); await shot(p, 'l12-3-weis-door-GO-IN', 'on foot at the door: ACTION says GO IN');
  await p.keyboard.press('Space'); await waitFor(p, () => window.__lf.inside() && window.__lf.inside().place === 'weis'); await p.waitForTimeout(1800);
  await shot(p, 'l12-4-inside-front-end', 'inside: front end — checkouts, security');
  const st = () => p.evaluate(() => { const I = window.__lf.inside(); return I ? { x: I.hero.x, said: I.said.length, beat: !!I.beat } : null; });
  const walkTo = async (x, stop) => { const dir = (await st()).x < x ? 'ArrowRight' : 'ArrowLeft'; await p.keyboard.down(dir); const t0 = Date.now(); while (Date.now() - t0 < 20000) { const s = await st(); if (!s || Math.abs(s.x - x) < 0.3 || s.beat) break; await p.waitForTimeout(25); } await p.keyboard.up(dir); };
  await walkTo(4.6); await p.waitForTimeout(500); await shot(p, 'l12-5-security-desk-jason', 'Jason at the security desk');
  await walkTo(14.5); await p.waitForTimeout(400); await shot(p, 'l12-6-produce-aisles', 'produce + the aisle signs');
  await walkTo(23.5);                                         // walking up on Rigg plays THE FIRING
  await waitFor(p, () => window.__lf.inside().events.some(e => e.kind === 'soda_open'), 30000); await p.waitForTimeout(700); await shot(p, 'l12-7-soda-opens', 'Rigg opens the soda');
  await waitFor(p, () => window.__lf.inside().said.some(s => s.text === 'You’re fired.'), 30000); await p.waitForTimeout(500); await shot(p, 'l12-8-youre-fired', 'Scott: you\'re fired');
  await waitFor(p, () => window.__lf.inside().said.some(s => s.text === 'Fuck Scott.'), 30000); await p.waitForTimeout(500); await shot(p, 'l12-9-fuck-scott', 'Rigg: Fuck Scott.');
  await waitFor(p, () => !window.__lf.inside().beat, 40000); await p.waitForTimeout(300);
  await walkTo(39.5); await p.waitForTimeout(500); await p.keyboard.press('Space'); await p.waitForTimeout(300); await shot(p, 'l12-10-pizza-counter-brad', 'Brad at the pizza counter, slice in hand');
  await p.keyboard.press('Space'); await p.waitForTimeout(600); await shot(p, 'l12-11-eating-the-slice', 'eating');
  await p.close();
}
// ---- Gringada (memory) as Kosack
{
  const p = await open('player=kosack&nointro', () => window.__lf && window.__lf.places() && window.__lf.foot()); await places(p);
  const gp = PJ.places.find(q => q.id === 'gringada');
  await p.evaluate((wp) => { const L = window.__lf, f = L.foot(), S = 1.12, d = wp.door; f.active = true; f.z = 0; f.x = wp.cx + (d.wall[0] - wp.cx) * S + d.nx * 40; f.y = wp.cy + (d.wall[1] - wp.cy) * S + d.ny * 40; f.px = f.x; f.py = f.y; f.h = 0; L.cam.x = f.x; L.cam.y = f.y; }, gp);
  await p.waitForTimeout(2500); await shot(p, 'l13-2-gringada-door-GO-IN', 'on foot at the memory build\'s door');
  await p.keyboard.press('Space'); await waitFor(p, () => window.__lf.inside() && window.__lf.inside().place === 'gringada'); await p.waitForTimeout(1500);
  await shot(p, 'l13-3-inside-dining-room', 'inside Gringada: dining room (memory treatment)');
  const st = () => p.evaluate(() => { const I = window.__lf.inside(); return I ? { x: I.hero.x, beat: !!I.beat } : null; });
  await p.keyboard.down('ArrowRight'); await waitFor(p, async () => true); const t0 = Date.now(); while (Date.now() - t0 < 12000) { const s = await st(); if (!s || s.x > 8 || s.beat) break; await p.waitForTimeout(25); } await p.keyboard.up('ArrowRight');
  await waitFor(p, () => window.__lf.inside().events.some(e => e.kind === 'steal'), 30000); await p.waitForTimeout(500); await shot(p, 'l13-4-jimmy-steals', 'Jimmy swipes a burrito');
  await waitFor(p, () => window.__lf.inside().said.some(s => s.who === 'zack'), 30000); await p.waitForTimeout(600); await shot(p, 'l13-5-zack-why-are-you-going-to-clayton-it', 'Zack\'s line');
  await waitFor(p, () => window.__lf.inside().events.some(e => e.kind === 'eat_fast'), 30000); await p.waitForTimeout(300); await shot(p, 'l13-6-jimmy-eats-it-fast', 'Jimmy eating it super fast');
  await waitFor(p, () => window.__lf.inside().said.some(s => s.text === 'HEY!'), 30000); await p.waitForTimeout(400); await shot(p, 'l13-7-brad-hey', 'Brad: HEY!');
  await p.close();
}
// ---- the 108 Astro: lit, then robbed by Jason
{
  const p = await open('player=jason&nointro', () => window.__lf && window.__lf.places() && window.__lf.foot()); await places(p);
  await p.evaluate(() => { const L = window.__lf, f = L.foot(), a = L.places().astro(L.sim); f.active = true; f.z = 0; f.x = a.x + 34; f.y = a.y + 30; f.px = f.x; f.py = f.y; f.h = Math.PI; L.cam.x = f.x; L.cam.y = f.y; });
  await p.waitForTimeout(2500); await shot(p, 'l13-8-astro-parking-lights-lit', 'the parked Astro, lights on; ACTION says ROB LIGHTS');
  await p.keyboard.press('Space'); await p.waitForTimeout(700); await shot(p, 'l13-9-astro-lights-robbed', 'Jason robbed the parking lights');
  await p.close();
}
console.log(errs.length ? 'PAGE ERRORS: ' + [...new Set(errs)].join(' | ') : 'no page errors');
await browser.close(); web.close();
