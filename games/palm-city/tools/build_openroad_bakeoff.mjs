// build_openroad_bakeoff.mjs — Task G16 (Open Road Painted Upgrade)
// Usage:
//   node tools/build_openroad_bakeoff.mjs before
//   node tools/build_openroad_bakeoff.mjs after
import { chromium } from '/Users/braidpairlette/Games/Hawk/games/palm-city/tools/node_modules/playwright-core/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'shots', 'openroad-bakeoff');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const phase = process.argv[2] || 'before';

const web = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
  });
});
await new Promise(r => web.listen(0, r));
const PORT = web.address().port;
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'],
});
const errs = [];

const SCENES = [
  ['golden', 0.18, 600, 0.0, 'Golden Hour — Causeway Landfall & CP1'],
  ['dusk', 0.90, 3680, 0.72, 'Blue Dusk — Downtown Corridor, Lamps & Turbo'],
];

for (const [name, tod, targetS, turbo] of SCENES) {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push(`${phase}-${name}: ${e}`));
  await p.goto(`http://localhost:${PORT}/index.html?nostart&t=${tod}&nodirector`);
  await p.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 60000 });
  await p.evaluate(() => {
    const s = window.__palm.sim;
    s.step(1 / 60, { jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, jump: 'openroad' });
  });
  await p.keyboard.press('KeyF');
  await p.waitForFunction(() => window.__palm.sim.event && window.__palm.sim.event.kind === 'openroad', null, { timeout: 15000 });

  // Advance cleanly along the real route polyline to the exact sample vantage point
  await p.evaluate(async ({ targetS, turbo }) => {
    const mod = await import('./src/openroad.js');
    const Rt = mod.route();
    const s = window.__palm.sim, ev = s.event, c = s.player.car;
    ev.count = 0;
    ev.timer = 24;
    let cur = 150;
    while (cur < targetS) {
      cur = Math.min(targetS, cur + 110);
      const pt = mod.routeAt(Rt, cur, 0);
      c.x = pt.x; c.y = pt.y; c.h = Math.atan2(pt.ty, pt.tx); c.v = 250;
      ev.routeS = cur;
      if (s.chase) { s.chase.blend = 1; s.chase.rot = -Math.PI / 2 - c.h; s.chase.routeS = cur; }
      await new Promise(r => requestAnimationFrame(r));
    }
    const pt = mod.routeAt(Rt, targetS, 0);
    c.x = pt.x; c.y = pt.y; c.h = Math.atan2(pt.ty, pt.tx);
    c.v = turbo > 0 ? 310 : 250;
    c.turbo = turbo;
    ev.count = 0;
    ev.timer = 24;
    if (s.chase) {
      s.chase.blend = 1;
      s.chase.rot = -Math.PI / 2 - c.h;
      s.chase.routeS = targetS;
    }
  }, { targetS, turbo });

  await p.waitForTimeout(50);
  await p.screenshot({ path: path.join(OUT, `${phase}-${name}.png`) });
  await p.close();
}

if (phase === 'after') {
  const b64 = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, n)).toString('base64');
  const comp = await browser.newPage({ viewport: { width: 920, height: 1920 }, deviceScaleFactor: 1 });
  await comp.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:18px;">
      <div style="text-align:center;font-weight:900;font-size:20px;color:#ffd45c;margin-bottom:14px;">
        TASK G16 — OPEN ROAD PAINTED UPGRADE (420×860 PHONE)
      </div>
      ${SCENES.map(([loc, , , , sub]) => `
        <div style="font-weight:900;font-size:14px;color:#6ee2ff;margin:8px 0 4px;">${sub}</div>
        <div style="display:flex;gap:16px;margin-bottom:16px;">
          <div style="text-align:center;">
            <div style="font-size:12px;font-weight:800;color:#ff9a8a;margin-bottom:4px;">BEFORE</div>
            <img src="${b64(`before-${loc}.png`)}" style="width:420px;height:860px;border:2px solid #523a68;border-radius:10px;display:block;"/>
          </div>
          <div style="text-align:center;">
            <div style="font-size:12px;font-weight:800;color:#7dffa8;margin-bottom:4px;">AFTER — #210f2e Ink + Painted Weave/Water + Hero Chrome</div>
            <img src="${b64(`after-${loc}.png`)}" style="width:420px;height:860px;border:2px solid #ffd45c;border-radius:10px;display:block;"/>
          </div>
        </div>
      `).join('')}
    </body></html>
  `);
  await comp.waitForTimeout(300);
  await comp.screenshot({ path: path.join(OUT, 'bakeoff-openroad-phone.png'), fullPage: true });
  await comp.close();
}

await browser.close();
web.close();
if (errs.length) { console.error('ERRORS:', errs); process.exit(1); }
console.log('G16 PHASE COMPLETE:', phase);
