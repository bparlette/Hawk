// int_shots.mjs — fast acceptance shots of the interior renderer via tools/int_harness.html
// (the full page boot is minutes on this VM; the harness loads only the interior kit).
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await p.goto(`http://localhost:${web.address().port}/laurel-fulton/tools/int_harness.html`);
await p.waitForFunction(() => window.__h, null, { timeout: 60000 });
await p.waitForTimeout(1200);
const st = () => p.evaluate(() => { const I = window.__h.I, h = I.hero; return { floor: h.floor, x: +h.x.toFixed(2), say: I.teter ? +I.teter.sayT.toFixed(2) : -1, room: I.roomOf(h) }; });
const setInp = (o) => p.evaluate((o) => window.__h.setInp(o), o);
const until = async (fn, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn(await st())) return true; await p.waitForTimeout(60); } return false; };
await p.screenshot({ path: path.join(ROOT, 'shots/int-a-landing.png') }); console.log('A', JSON.stringify(await st()));
await setInp({ jx: 1, jy: -1, jm: 1 }); await until(s => s.floor === 'main'); await setInp({});
await setInp({ jx: 1, jm: 1 }); await until(s => s.x > 7.6); await setInp({});
await p.waitForTimeout(700);
await p.screenshot({ path: path.join(ROOT, 'shots/int-b-upstairs.png') }); console.log('B', JSON.stringify(await st()));
await setInp({ jx: -1, jm: 1 }); await until(s => s.floor === 'landing'); await setInp({ jx: 1, jy: 1, jm: 1 }); await until(s => s.floor === 'lower'); await setInp({});
await setInp({ jx: 1, jm: 1 }); await until(s => s.x > 7.9); await setInp({});
await p.waitForTimeout(700);
await p.screenshot({ path: path.join(ROOT, 'shots/int-c-fireplace.png') }); console.log('C', JSON.stringify(await st()));
console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close(); web.close();
