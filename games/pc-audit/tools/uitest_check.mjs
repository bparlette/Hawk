// uitest_check.mjs — the two Nov 17 owner UI rules, proven with real touch in a
// touch-enabled context (CDP touch events + touchscreen.tap, never mouse):
//   (1) CONTROL GRAPHICS RETIRE: the stick circle + idle movement hint show for the
//       first ~4 s of PLAY (not while the start panel is up), fade, and are not drawn
//       again this run — while the stick keeps driving the player, invisibly. A
//       reload starts a fresh window. Drawing is observed by spying on ctx.arc:
//       the stick base is an arc of radius input.R (56) at the touch anchor, the
//       knob an arc of radius 24, the hint an arc of radius 56 at (90, vh-130).
//   (2) REC/NEWS PLACEMENT: the recorder chips are small, in the MAP button's row
//       at the top-right (left of MAP), z-index 1200, the topmost element at their
//       centre, and both still answer real taps (NEWS flips the Channel 7 frame,
//       REC starts and stops a recording).
// Usage: node tools/uitest_check.mjs   (CHROME=/path/to/chrome optional)
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'],
});
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true });
page.on('pageerror', e => fails.push('pageerror: ' + String(e).slice(0, 160)));
await page.addInitScript(() => {
  window.__arcs = [];
  const orig = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function (x, y, r, a, b, c) {
    if (window.__arcs.length < 60000) window.__arcs.push([x, y, r]);
    return orig.call(this, x, y, r, a, b, c);
  };
});
const drainArcs = () => page.evaluate(() => { const a = window.__arcs; window.__arcs = []; return a; });
const near = (a, x, y, r) => a.some(([ax, ay, ar]) => Math.abs(ax - x) < 3 && Math.abs(ay - y) < 3 && Math.abs(ar - r) < 0.6);
const simTime = () => page.evaluate(() => window.__palm.sim.time);
const ped = () => page.evaluate(() => { const f = window.__palm.sim.focus(); return { x: f.x, y: f.y }; });
const cdp = await page.context().newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });

async function dismissStart() {
  const { helpLayout } = await import('../src/help.js');
  const n = await page.evaluate(() => window.__palm.sim.activities.filter(a => a.group !== 'hub').length);
  const vh = await page.evaluate(() => innerHeight);
  const L = helpLayout(420, vh, n, 'start', 0);
  await touch('touchStart', [[L.btn.x + L.btn.w / 2, L.btn.y + L.btn.h / 2, 8]]);
  await page.waitForTimeout(80);
  await touch('touchEnd', []);
  await page.waitForTimeout(400);
  ok(!(await page.evaluate(() => window.__ui.start)), 'PLAY did not dismiss the start page');
}

await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForFunction(() => window.__palm && window.__palm.sim);
await page.waitForTimeout(1200);
const vh = await page.evaluate(() => document.getElementById('game').height / window.__palm.dpr());
ok(await page.evaluate(() => window.__ui.start), 'start page should be up at boot');
// sit on the start panel well past 4 s of wall clock: the intro window must NOT burn here
await page.waitForTimeout(4500);
await dismissStart();
ok((await simTime()) < 1.5, `sim clock should barely have moved under the panel (t=${(await simTime()).toFixed(2)})`);

// ---- phase A: first seconds of play — hint visible, then the live stick circle
await drainArcs();
await page.waitForTimeout(700);
let arcs = await drainArcs();
ok(near(arcs, 90, vh - 130, 56), 'phase A: movement hint circle not drawn in the first seconds of play');
const pA0 = await ped();
await touch('touchStart', [[100, 640, 1]]);
await touch('touchMove', [[130, 610, 1]]);
await page.waitForTimeout(500);
arcs = await drainArcs();
ok(near(arcs, 100, 640, 56), 'phase A: stick base circle not drawn while dragging');
ok(near(arcs, 130, 610, 24), 'phase A: stick knob not drawn while dragging');
await page.waitForTimeout(700);
const pA1 = await ped();
ok(Math.hypot(pA1.x - pA0.x, pA1.y - pA0.y) > 10, 'phase A: stick did not move the player');
await touch('touchEnd', []);

// ---- phase B: after the window — no control graphics at all, stick still drives
for (let i = 0; i < 100 && (await simTime()) < 6; i++) await page.waitForTimeout(200);
ok((await simTime()) >= 6, 'sim clock never reached 6 s');
await drainArcs();
await page.waitForTimeout(500);
arcs = await drainArcs();
ok(!near(arcs, 90, vh - 130, 56), 'phase B: movement hint still drawn after the intro window');
const pB0 = await ped();
await touch('touchStart', [[120, 620, 2]]);
await touch('touchMove', [[150, 590, 2]]);
await page.waitForTimeout(600);
await drainArcs();
await page.waitForTimeout(900);
arcs = await drainArcs();
ok(!near(arcs, 120, 620, 56), 'phase B: stick base circle still drawn after the intro window');
ok(!near(arcs, 150, 590, 24), 'phase B: stick knob still drawn after the intro window');
const pB1 = await ped();
ok(Math.hypot(pB1.x - pB0.x, pB1.y - pB0.y) > 25, `phase B: invisible stick did not drive the player (moved ${Math.hypot(pB1.x - pB0.x, pB1.y - pB0.y).toFixed(1)})`);
await touch('touchEnd', []);

// ---- REC/NEWS: small chips in MAP's row, top-right, tappable
const geo = await page.evaluate(() => {
  const cv = document.getElementById('game'), r = cv.getBoundingClientRect(), sx = r.width / 420;
  const m = window.__palm.input.mapBtn();
  const box = id => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  const at = id => { const b = document.getElementById(id).getBoundingClientRect(); const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return el && el.id; };
  return {
    map: { x: r.left + m.x * sx, y: r.top + m.y * sx, w: m.w * sx, h: m.h * sx },
    rec: box('pcRecBtn'), news: box('pcNewsBtn'),
    zRec: getComputedStyle(document.getElementById('pcRecBtn')).zIndex,
    zNews: getComputedStyle(document.getElementById('pcNewsBtn')).zIndex,
    atRec: at('pcRecBtn'), atNews: at('pcNewsBtn'),
  };
});
const rowC = b => b.y + b.h / 2;
ok(Math.abs(rowC(geo.rec) - rowC(geo.map)) <= 14, `REC not in MAP's row (rec centre ${rowC(geo.rec).toFixed(0)} vs map ${rowC(geo.map).toFixed(0)})`);
ok(Math.abs(rowC(geo.news) - rowC(geo.map)) <= 14, `NEWS not in MAP's row (news centre ${rowC(geo.news).toFixed(0)} vs map ${rowC(geo.map).toFixed(0)})`);
ok(geo.rec.x + geo.rec.w <= geo.map.x + 1 && geo.news.x + geo.news.w <= geo.map.x + 1, 'REC/NEWS should sit left of MAP');
ok(geo.rec.x + geo.rec.w <= geo.news.x + 1, 'REC should sit left of NEWS without overlap');
ok(geo.rec.h <= 34 && geo.news.h <= 34, `chips too tall (rec ${geo.rec.h.toFixed(0)}px, news ${geo.news.h.toFixed(0)}px)`);
ok(geo.rec.w <= 95 && geo.news.w <= 110, `chips too wide (rec ${geo.rec.w.toFixed(0)}px, news ${geo.news.w.toFixed(0)}px)`);
ok(geo.rec.y < 160 && geo.news.y < 160, 'chips are not in the top cluster');
ok(geo.zRec === '1200' && geo.zNews === '1200', `z-index must stay 1200 (rec ${geo.zRec}, news ${geo.zNews})`);
ok(geo.atRec === 'pcRecBtn' && geo.atNews === 'pcNewsBtn', `chips not topmost at their centre (rec: ${geo.atRec}, news: ${geo.atNews})`);

const tapBox = async b => { await page.touchscreen.tap(b.x + b.w / 2, b.y + b.h / 2); };
await tapBox(geo.news);
await page.waitForTimeout(350);
const newsState = await page.evaluate(() => ({ hl: window.__palm.recorder.newsHL, live: window.__palm.recorder.newsLive, txt: document.getElementById('pcNewsBtn').textContent }));
ok(newsState.hl === false && newsState.live === false && newsState.txt.includes('✕'), `NEWS tap did not flip the Channel 7 frame off (${JSON.stringify(newsState)})`);
await tapBox(geo.news);
await page.waitForTimeout(350);
ok(await page.evaluate(() => window.__palm.recorder.newsHL === true), 'NEWS second tap did not flip the frame back on');
await tapBox(geo.rec);
await page.waitForTimeout(700);
ok(await page.evaluate(() => window.__palm.recorder.recording), 'REC tap did not start a recording');
await tapBox(geo.rec);
await page.waitForTimeout(700);
ok(!(await page.evaluate(() => window.__palm.recorder.recording)), 'REC second tap did not stop the recording');

// ---- reload: a fresh start shows the graphics again, briefly
await page.reload();
await page.waitForFunction(() => window.__palm && window.__palm.sim);
await page.waitForTimeout(1000);
await dismissStart();
await drainArcs();
await page.waitForTimeout(700);
arcs = await drainArcs();
ok(near(arcs, 90, vh - 130, 56), 'after reload: movement hint did not re-show in the first seconds');

await browser.close();
server.close();
if (fails.length) { console.log('UITEST FAIL: ' + fails.join(' | ')); process.exit(1); }
console.log('UITEST OK');
