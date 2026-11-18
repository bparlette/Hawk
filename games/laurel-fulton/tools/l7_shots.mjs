// l7_shots.mjs — task L7 evidence on the REAL page (420x860 @2x): PICK Brad -> you start inside his split-foyer house, seen
// as a side cutaway. KEYBOARD ONLY (arrows = the stick, Space = ACTION): up the half-flight (Teter greets you), beer from the
// cooler + DRINK upstairs, down the half-flight, a beer FROM THE MANTLE + drink by the fire, pat a dog, out the front door.
//   CHROME=<chromium> node tools/l7_shots.mjs        (from games/laurel-fulton/)   -> shots/l7-*.png
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const K = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/interiors/brad.json')));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(`http://localhost:${web.address().port}/laurel-fulton/play.html?player=brad`);
await p.waitForFunction(() => window.__lf && window.__lf.inside(), null, { timeout: 120000 }); await p.waitForTimeout(1500);
const st = () => p.evaluate(() => { const I = window.__lf.inside(); if (!I) return { out: true, foot: window.__lf.foot().active }; const h = I.hero; return { z: +h.z.toFixed(2), room: I.roomOf(h), floor: h.floor, x: +h.x.toFixed(2), drank: h.drank, beer: h.beer, mantle: I.mantle, prompt: I.prompt(), dogs: I.dogs.map(d => d.floor) }; });
const shot = async (n, note) => { await p.screenshot({ path: path.join(ROOT, `shots/l7-${n}.png`) }); console.log(n, note, JSON.stringify(await st())); };
const hold = async (keys, cond, ms = 8000) => { for (const k of keys) await p.keyboard.down(k); const t0 = Date.now(); while (Date.now() - t0 < ms && !(await cond(await st()))) await p.waitForTimeout(30); for (const k of keys) await p.keyboard.up(k); };
const walkTo = async (x) => { const s = await st(); await hold([x > s.x ? 'ArrowRight' : 'ArrowLeft'], s2 => Math.abs(s2.x - x) < 0.25 || s2.floor === null, 8000); };
await shot('1-inside-the-door', 'a Brad run starts inside: the landing of the split foyer');
await hold(['ArrowRight', 'ArrowUp'], s => s.floor === 'main');
await walkTo(K.props.find(q => q.kind === 'cooler').x); await p.waitForTimeout(200);
await shot('2-upstairs-teter-greets', 'up the half-flight: the upstairs living room, Teter in her chair');
await p.keyboard.press('Space'); await p.waitForTimeout(150); await p.keyboard.press('Space'); await p.waitForTimeout(900);
await shot('3-upstairs-beer', 'a beer upstairs (DRINK, mid-sip)');
await p.waitForTimeout(1800);
await hold(['ArrowLeft'], s => s.floor === 'landing');
await hold(['ArrowRight', 'ArrowDown'], s => s.floor === 'lower');
await walkTo(K.props.find(q => q.kind === 'fireplace').x); await p.waitForTimeout(1500);
await shot('4-downstairs-weights-fireplace-mantle-beers', 'downstairs: weights, the fireplace, 6 beers on the mantle');
await p.keyboard.press('Space'); await p.waitForTimeout(150); await p.keyboard.press('Space'); await p.waitForTimeout(900);
await shot('5-downstairs-beer-from-the-mantle', 'took one from the mantle (5 left), drinking it by the fire');
await p.waitForTimeout(6000);
await shot('6-dogs-roam', 'the retrievers about the house');
await hold(['ArrowLeft'], s => s.floor === 'landing', 10000); await walkTo(K.door.x);
await p.keyboard.press('Space'); await p.waitForTimeout(1200);
await shot('7-out-the-front-door', 'out the front door: on foot by the Camaro, rally on');
console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close(); web.close();
