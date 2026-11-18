// port_shots.mjs — L17 proof shots on the REAL page (420x860 @2x): the night party at Kosack's and the Floyds' (both venues, music rings),
// the convoy racing (a pass + barks + a throw), the fake cop with Kosack's lights.   CHROME=... NODE_PATH=$(npm root -g) node tools/port_shots.mjs
import { createRequire } from 'node:module'; const rq = createRequire((process.env.NODE_PATH || '') + '/'); const { chromium } = (() => { try { return rq('playwright-core'); } catch (e) { return rq('playwright'); } })(); import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const R = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roster.json'))), H = (id) => R.people.find(p => p.id === id).house;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const base = `http://localhost:${web.address().port}/laurel-fulton/play.html`;
const open = async (qs, w = 420, h = 860) => { const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }); p.on('pageerror', e => console.log('ERR', String(e).slice(0, 300))); await p.goto(base + '?' + qs); await p.waitForFunction(() => window.__lf, null, { timeout: 120000 }); return p; };
const shot = async (p, n) => { await p.screenshot({ path: path.join(ROOT, `shots/port-${n}.png`) }); console.log('shot', n); };
const ONLY = process.env.ONLY || '';
// 1 the night party: both venues (t=0.97 blue dusk). cam looks at the back of the house.
for (const [n, id] of ONLY ? [] : [['party-kosack', 'kosack'], ['party-floyds', 'clayton']]) {
  const [x, y] = H(id); const p = await open(`free&t=0.97&cam=${Math.round(x)},${Math.round(y)},0.5&spawn=${Math.round(x)},${Math.round(y) + 400},0`);
  await p.waitForTimeout(9000); await shot(p, n); await p.close();
}
// 2 the party at golden hour (empty yard, the pool is just a pool)
if (!ONLY) { const [x, y] = H('kosack'); const p = await open(`free&t=0.1&cam=${Math.round(x)},${Math.round(y)},0.5&spawn=${Math.round(x)},${Math.round(y) + 400},0`); await p.waitForTimeout(7000); await shot(p, 'party-day-empty'); await p.close(); }
// 3 the convoy RACING: the autopilot runs the rally as Jason; shoot when a follower is mid-pass with a bark bubble up, and when a thrown one is in the air
if (!ONLY || ONLY === 'convoy') {
  const p = await open('player=jason&pilot&nointro&speed=3'); const got = {};
  for (let i = 0; i < 900 && Object.keys(got).length < 3; i++) {
    await p.waitForTimeout(400);
    const st = await p.evaluate(() => { const M = window.__lf.mission(); if (!M || !M.convoy.length) return null; const B = M.barks; return { race: M.convoy.map(f => f.race && f.race.st), bub: B ? B.bubbles.map(b => b.text) : [], parts: B ? B.parts.filter(q => q.state === 'fly').map(q => q.kind) : [], n: M.convoy.length }; });
    if (!st) continue;
    if (!got.pass && st.race.some(r => r === 'pass' || r === 'gloat')) { await shot(p, 'convoy-pass'); got.pass = 1; }
    if (!got.bark && st.bub.length && st.n >= 2) { await shot(p, 'convoy-bark'); got.bark = 1; console.log(st.bub.join(' | ')); }
    if (!got.throw && st.parts.length >= 2) { await shot(p, 'convoy-throw'); got.throw = 1; console.log(st.parts.join(',')); }
  }
  console.log('convoy', JSON.stringify(got)); await p.close();
}
// 4 the fake cop: Kosack, the siren held (H), a car held in the cone -> hesitates, then pulls over
if (!ONLY || ONLY === 'fakecop') {
  const [kx, ky] = H('kosack'); const p = await open(`free&model=cavalier_kosack&t=0.97&spawn=${Math.round(kx)},${Math.round(ky)},0`); await p.waitForTimeout(5000);
  await p.keyboard.down('KeyH');
  const got = {};
  for (let i = 0; i < 600 && Object.keys(got).length < 2; i++) {
    const st = await p.evaluate(() => { const L = window.__lf, fc = L.fakeCop(), P = L.sim.player; const t = fc.traffic.filter(c => c.fcState !== 'PEEL_OFF').sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0]; if (!t) return null;
      if (t.fcState === 'NONE' && !(t.fcCd > 0)) { const d = Math.hypot(t.x - P.x, t.y - P.y); if (d > 100) { P.x = t.x - Math.cos(t.h) * 90; P.y = t.y - Math.sin(t.h) * 90; P.h = t.h; P.v = t.v; P.layer = 0; } }
      L.cam.x = (P.x + t.x) / 2; L.cam.y = (P.y + t.y) / 2; L.cam.zoom = 1.1; return { s: t.fcState, v: Math.round(t.v), d: Math.round(Math.hypot(t.x - P.x, t.y - P.y)) }; });
    await p.waitForTimeout(250); if (!st) continue;
    if (!got.hes && st.s === 'HESITATE') { await shot(p, 'fakecop-hesitate'); got.hes = 1; }
    if (!got.pull && st.s === 'PULL_OVER' && st.v < 60) { await shot(p, 'fakecop-pulled'); got.pull = 1; }
  }
  console.log('fakecop', JSON.stringify(got)); await p.close();
}
await browser.close(); web.close();
