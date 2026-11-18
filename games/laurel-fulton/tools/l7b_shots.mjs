// l7b_shots.mjs — L7 remainder evidence on the REAL page (420x860 @2x), keyboard only (arrows = stick, Space = ACTION):
//   Brad's basement (computer: eDonkey), his mom's greeting, CPU Brad idling in his house, RIGG's house (the dad yell + Brian down
//   the stairs, bedroom door, basement computer + CD writer), Rigg-isms, and David Klink's Scooby-Doo van with its steppable exhaust tip.
//   CHROME=/usr/bin/google-chrome node tools/l7b_shots.mjs        (from games/laurel-fulton/)   -> shots/l7b-*.png
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const base = `http://localhost:${web.address().port}/laurel-fulton/play.html`;
const errs = [];
async function page(q) {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push(String(e))); await p.goto(base + q); return p;
}
const st = (p) => p.evaluate(() => { const I = window.__lf.inside(); if (!I) { const f = window.__lf.foot(); return { out: true, foot: f && f.active, z: f && f.z }; } const h = I.hero; return { z: +h.z.toFixed(2), room: I.roomOf(h), floor: h.floor, x: +h.x.toFixed(2), prompt: I.prompt(), son: I.son && { floor: I.son.floor, x: +I.son.x.toFixed(2), state: I.son.state }, said: I.dad && I.dad.said }; });
const shot = async (p, n, note) => { await p.screenshot({ path: path.join(ROOT, `shots/l7b-${n}.png`) }); console.log(n, note, JSON.stringify(await st(p))); };
const hold = async (p, keys, cond, ms = 9000) => { for (const k of keys) await p.keyboard.down(k); const t0 = Date.now(); while (Date.now() - t0 < ms && !(await cond(await st(p)))) await p.waitForTimeout(30); for (const k of keys) await p.keyboard.up(k); };
const walkTo = async (p, x) => { const s = await st(p); await hold(p, [x > s.x ? 'ArrowRight' : 'ArrowLeft'], s2 => Math.abs(s2.x - x) < 0.25 || s2.floor === null, 9000); };
// timed holds (a stick held for `ms`), then report: the shots drive the REAL keyboard path, as a thumb would
const keys = async (p, ks, ms) => { for (const k of ks) await p.keyboard.down(k); await p.waitForTimeout(ms); for (const k of ks) await p.keyboard.up(k); };
const toX = async (p, x, tries = 40) => { for (let i = 0; i < tries; i++) { const s = await st(p); if (s.floor == null || Math.abs(s.x - x) < 0.2) { if (s.floor != null) return; await p.waitForTimeout(60); continue; } await keys(p, [x > s.x ? 'ArrowRight' : 'ArrowLeft'], Math.min(900, Math.abs(x - s.x) / 4.4 * 1000 + 30)); } };
const tap = async (p) => { await p.keyboard.down('Space'); await p.waitForTimeout(450); await p.keyboard.up('Space'); };   // ACTION held across a few frames
const tapIn = async (p) => { for (let i = 0; i < 4 && !(await p.evaluate(() => !!window.__lf.inside())); i++) { await tap(p); await p.waitForTimeout(500); } };
const atDoor = async (p, id, hp) => p.evaluate(([id, hp]) => { const L = window.__lf, f = L.foot(), c = L.sim.cars.find(c => c.owner === id), dx = hp[0] - c.x, dy = hp[1] - c.y, d = Math.hypot(dx, dy); f.active = true; f.x = hp[0] + dx / d * 38; f.y = hp[1] + dy / d * 38; f.z = 0; f.px = f.x; f.py = f.y; return Math.round(Math.hypot(f.x - c.x, f.y - c.y)); }, [id, hp]);
// ---- Brad: mom's greeting + the basement computer
let p;
const only = new Set((process.env.ONLY || 'brad,jason,rigg,van').split(','));   // ONLY=van re-shoots one part
if (only.has('brad')) {
p = await page('?player=brad');
await p.waitForFunction(() => window.__lf && window.__lf.inside(), null, { timeout: 120000 }); await p.waitForTimeout(1200);
await keys(p, ['ArrowRight', 'ArrowUp'], 1500); await p.waitForTimeout(300);
await shot(p, 'brad-mom-1', "Brad's mom: 'Hi guys, what are you getting into today?....'"); await p.waitForTimeout(3300);
await shot(p, 'brad-mom-2', "... 'You are all alcoholics.'");
await keys(p, ['ArrowLeft'], 1500); await keys(p, ['ArrowRight', 'ArrowDown'], 1500); await toX(p, 6.1); await p.waitForTimeout(800);
await shot(p, 'brad-basement-computer', "Brad's basement: the computer, screen says eDonkey");
await p.close();
}
if (only.has('jason')) {
// ---- you are Jason: Brad is home -> CPU Brad idles by the fire with a beer
p = await page('?player=jason&nointro');
await p.waitForFunction(() => window.__lf && window.__lf.foot(), null, { timeout: 120000 }); await p.waitForTimeout(1200);
console.log('jason at brad door, car dist', await atDoor(p, 'brad', [11998.5, 18074.0]));
await p.waitForTimeout(400); await tapIn(p);
console.log('->', JSON.stringify(await st(p)));
await keys(p, ['ArrowRight', 'ArrowUp'], 1500); await keys(p, ['ArrowLeft'], 1500); await keys(p, ['ArrowRight', 'ArrowDown'], 1500); await toX(p, 8.0); await p.waitForTimeout(2200);
await shot(p, 'brad-cpu-by-the-fire', 'Jason walks in on CPU Brad, by the fire with a beer');
await p.close();
}
if (only.has('rigg')) {
// ---- Rigg's house
p = await page('?player=rigg&nointro');
await p.waitForFunction(() => window.__lf && window.__lf.inside(), null, { timeout: 120000 }); await p.waitForTimeout(300);
await shot(p, 'rigg-0-door', 'you are Rigg: in the entryway'); await p.waitForTimeout(3500); await shot(p, 'rigg-0b-barks', 'the old guy yells; no second Brian (you are Brian)');
await p.close();
p = await page('?player=jason&nointro');
await p.waitForFunction(() => window.__lf && window.__lf.foot(), null, { timeout: 120000 }); await p.waitForTimeout(1200);
console.log('jason at rigg door, car dist', await atDoor(p, 'rigg', [3463.5, 2666.5]));
await p.waitForTimeout(400); await p.screenshot({ path: path.join(ROOT, 'shots/l7b-rigg-door-outside.png') });
await tapIn(p);
console.log('->', JSON.stringify(await st(p)));
await shot(p, 'rigg-2-walk-in', "Jason walks in at Rigg's: the big entryway, the stairs, the bedroom door");
await p.waitForTimeout(900); await shot(p, 'rigg-3-yell', 'the old guy yells Brrrrrriiiiiiaaaaannnn');
await p.waitForTimeout(1900); await shot(p, 'rigg-4-brian-comes', 'Brian comes walking down the stairs');
await p.waitForTimeout(2600); await shot(p, 'rigg-5-brian-here', 'Brian at the foot of the stairs');
await keys(p, ['ArrowRight', 'ArrowUp'], 3300); await p.waitForTimeout(300); await shot(p, 'rigg-6-upstairs', 'upstairs: the hall, the bedroom door');
await toX(p, 11.2); await p.waitForTimeout(500); await shot(p, 'rigg-7-bedroom', "Brian's bedroom");
await toX(p, 5.7); await keys(p, ['ArrowLeft', 'ArrowDown'], 3000); await toX(p, 12.3); await keys(p, ['ArrowDown'], 2600); await toX(p, 6.0); await p.waitForTimeout(700);
await shot(p, 'rigg-8-basement', "Brian's basement: his computer + the CD writer");
await p.close();
}
if (only.has('van')) {
// ---- the van: you are Jason on foot by Rigg's house; walk into the exhaust tip
p = await page('?player=jason&nointro');
await p.waitForFunction(() => window.__lf && window.__lf.foot() && window.__lf.van(), null, { timeout: 120000 }); await p.waitForTimeout(1500);
const ex = await p.evaluate(() => { const L = window.__lf, v = L.van(), e = v.exhaust(), f = L.foot(); f.active = true; const ux = e.x - v.car.x, uy = e.y - v.car.y, d = Math.hypot(ux, uy); f.x = e.x + ux / d * 26 + (Math.abs(uy) > Math.abs(ux) ? 0 : 0); f.y = e.y + uy / d * 26; f.px = f.x; f.py = f.y; f.z = 0; return { x: e.x, y: e.y, vx: v.car.x, vy: v.car.y, h: v.car.h, key: Math.abs(ux) > Math.abs(uy) ? (ux > 0 ? 'ArrowLeft' : 'ArrowRight') : (uy > 0 ? 'ArrowUp' : 'ArrowDown') }; });
console.log('van', JSON.stringify(ex));
const fz = () => p.evaluate(() => { const f = window.__lf.foot(); return JSON.stringify({ z: f.z, x: +f.x.toFixed(1), y: +f.y.toFixed(1), climb: !!f.climb, puffs: window.__lf.van().puffs.length, count: window.__lf.van().count || 0 }); });
await p.waitForTimeout(1500); await p.screenshot({ path: path.join(ROOT, 'shots/l7b-van-1-approach.png') }); console.log('approach', await fz());
await p.keyboard.down(ex.key); await p.waitForTimeout(330); await p.screenshot({ path: path.join(ROOT, 'shots/l7b-van-2-hop.png') }); console.log('hop', await fz());
await p.waitForTimeout(250); await p.keyboard.up(ex.key); await p.waitForTimeout(150); await p.screenshot({ path: path.join(ROOT, 'shots/l7b-van-3-puff.png') }); console.log('on the tip', await fz());
await p.waitForTimeout(1300); await p.screenshot({ path: path.join(ROOT, 'shots/l7b-van-4-chuff.png') }); console.log('chuff', await fz());
await p.close();
}
console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close(); web.close();
