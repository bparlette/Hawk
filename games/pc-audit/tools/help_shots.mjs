// help_shots.mjs — 7G in the real page at phone size (420x860 @2x), every step a real CDP touch:
//   1. the START PAGE is up on load and the game is paused under it        -> shots/help-start-page.png
//   2. PLAY starts the game; the "?" button opens HELP and pauses it        -> shots/help-panel.png
//   3. the TOW row's JUMP button seats you in the tow truck, START armed    -> shots/help-jump-tow.png
// Exits 1 if any of that is not true.   Usage: CHROME=/path/to/chrome node tools/help_shots.mjs
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { helpLayout } from '../src/help.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
await page.goto(`http://localhost:${server.address().port}/index.html?dpr=2`);
await page.waitForFunction(() => window.__palm && window.__palm.sim);
await page.waitForTimeout(3000);
const cdp = await page.context().newCDPSession(page);
const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 7 }] }); await page.waitForTimeout(70); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(250); };
const st = () => page.evaluate(() => { const s = window.__palm.sim, P = s.player; return { t: s.time, mode: P.mode, car: P.car ? P.car.job || P.car.model : null, start: window.__ui.start, help: window.__palm.input.helpOpen, rows: s.activities.filter(a => a.group !== 'hub').length }; });
const vh = await page.evaluate(() => innerHeight);
const shot = async (n) => { await page.screenshot({ path: path.join(ROOT, 'shots', n) }); console.log('wrote shots/' + n); };

// 1. start page, paused
let a = await st(); await page.waitForTimeout(700); let b = await st();
check(a.start && b.t === a.t, 'the start page is up on load and the game is paused under it', `sim time ${a.t.toFixed(2)} → ${b.t.toFixed(2)}`);
await shot('help-start-page.png');
const LS = helpLayout(420, vh, a.rows, 'start', 0);
await tap(LS.btn.x + LS.btn.w / 2, LS.btn.y + LS.btn.h / 2);
a = await st(); await page.waitForTimeout(700); b = await st();
check(!a.start && b.t > a.t, 'PLAY (touch) starts the game', `sim time ${a.t.toFixed(2)} → ${b.t.toFixed(2)}`);
// 2. HELP, paused
await tap(12 + 17, 62 + 14);
a = await st(); await page.waitForTimeout(700); b = await st();
check(a.help && b.t === a.t, 'the ? button (touch) opens HELP and pauses the game', `sim time ${a.t.toFixed(2)} → ${b.t.toFixed(2)}`);
await shot('help-panel.png');
// 3. JUMP to the tow truck
const LH = helpLayout(420, vh, a.rows, 'help', 0), tow = LH.rows[2].jump;
await tap(tow.x + tow.w / 2, tow.y + tow.h / 2);
await page.waitForTimeout(1200);
b = await st();
const label = await page.evaluate(async () => { const { buttonA } = await import('./src/controls.js'); const A = buttonA(window.__palm.sim); return A && A.label; });
check(!b.help && b.mode === 'car' && b.car === 'tow' && label === 'START TOW', 'JUMP on the TOW row (touch): panel closes, you are in the tow truck, A reads START TOW', `${b.mode} ${b.car} A=${label}`);
await shot('help-jump-tow.png');
check(errors.length === 0, 'no page errors', errors.join(' | '));
await browser.close(); server.close();
console.log(fails ? `HELP SHOTS FAIL (${fails})` : 'HELP SHOTS OK'); process.exit(fails ? 1 : 0);
