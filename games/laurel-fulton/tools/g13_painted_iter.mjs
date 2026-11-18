// g13_painted_iter.mjs — Task G13 (L10 Painted World) before/after phone-size capture & bake-off sheet.
// Usage:
//   node tools/g13_painted_iter.mjs before
//   node tools/g13_painted_iter.mjs after
import { chromium } from '/Users/braidpairlette/Games/Hawk/games/palm-city/tools/node_modules/playwright-core/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.resolve(ROOT, '..');
const OUT = path.join(ROOT, 'shots', 'g13-painted-world');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const phase = process.argv[2] || 'before';

let blockPainted = false;
const web = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (blockPainted && u.includes('ground-tiles')) { r.writeHead(404); r.end(); return; }
  const f = path.join(GAMES, u);
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
  });
});
await new Promise(r => web.listen(0, r));
const PORT = web.address().port;
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const errs = [];

async function capture(prefix, block = false) {
  blockPainted = block;
  const shot = async (name, query, cx, cy) => {
    const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    p.on('pageerror', e => errs.push(`${prefix}-${name}: ${e}`));
    await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html?${query}`);
    await p.waitForFunction(() => window.__lf && window.__lf.sim, null, { timeout: 180000 });
    await p.waitForFunction(({ cx, cy, expectPainted }) => {
      const g = window.__lf.ground, CH = 256, hw = 210 / 0.62, hh = 430 / 0.62;
      for (let gy = Math.floor((cy - hh) / CH); gy <= Math.floor((cy + hh) / CH); gy++)
        for (let gx = Math.floor((cx - hw) / CH); gx <= Math.floor((cx + hw) / CH); gx++) {
          const c = g.cache.get(gx + ',' + gy);
          if (!c) return false;
          if (expectPainted && g.painted && g.paintedState(gx, gy) === 'ok' && !c._pt) return false;
        }
      return true;
    }, { cx, cy, expectPainted: !block }, { timeout: 180000 });
    await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(OUT, `${prefix}-${name}.png`) });
    await p.close();
  };

  await shot('ledo', 'cam=-12953,708,0.62&t=0.18', -12953, 708);
  await shot('brad', 'cam=11998,18074,0.62&t=0.18', 11998, 18074);

  const mp = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  mp.on('pageerror', e => errs.push(`${prefix}-map: ${e}`));
  await mp.goto(`http://localhost:${PORT}/laurel-fulton/play.html?t=0.18`);
  await mp.waitForFunction(() => window.__lf && window.__lf.picking(), null, { timeout: 180000 });
  await mp.waitForTimeout(2000);
  await mp.screenshot({ path: path.join(OUT, `${prefix}-map.png`) });
  await mp.close();
}

if (phase === 'before') {
  await capture('proc', true);
  await capture('before', false);
} else {
  await capture('after', false);
  // Build side-by-side bake-off comparison sheet (Procedural vs Shipped Painted vs Iterated Painted)
  const b64 = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, n)).toString('base64');
  const comp = await browser.newPage({ viewport: { width: 1340, height: 1800 }, deviceScaleFactor: 1 });
  await comp.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:20px;">
      <div style="text-align:center;font-weight:900;font-size:20px;color:#ffd45c;margin-bottom:14px;">
        TASK G13 — LAUREL/FULTON PAINTED WORLD ITERATION (420×860 PHONE)
      </div>
      ${['brad', 'ledo'].map(loc => `
        <div style="font-weight:900;font-size:15px;color:#6ee2ff;margin:10px 0 6px;">LOCATION: ${loc.toUpperCase()}</div>
        <div style="display:flex;gap:14px;margin-bottom:16px;">
          <div style="text-align:center;">
            <div style="font-size:12px;font-weight:800;color:#b8acc8;margin-bottom:4px;">PROCEDURAL BASE</div>
            <img src="${b64(`proc-${loc}.png`)}" style="width:420px;height:860px;border:2px solid #523a68;border-radius:10px;display:block;"/>
          </div>
          <div style="text-align:center;">
            <div style="font-size:12px;font-weight:800;color:#ff9a8a;margin-bottom:4px;">BEFORE — Un-iterated Satellite Underlay</div>
            <img src="${b64(`before-${loc}.png`)}" style="width:420px;height:860px;border:2px solid #523a68;border-radius:10px;display:block;"/>
          </div>
          <div style="text-align:center;">
            <div style="font-size:12px;font-weight:800;color:#7dffa8;margin-bottom:4px;">AFTER — Feathered Verge + Golden Tint + 25% Dab Weave</div>
            <img src="${b64(`after-${loc}.png`)}" style="width:420px;height:860px;border:2px solid #ffd45c;border-radius:10px;display:block;"/>
          </div>
        </div>
      `).join('')}
    </body></html>
  `);
  await comp.waitForTimeout(400);
  await comp.screenshot({ path: path.join(OUT, 'g13-bakeoff-phone.png'), fullPage: true });
  await comp.close();
}

await browser.close();
web.close();
if (errs.length) { console.error('ERRORS:', errs); process.exit(1); }
console.log('G13 PHASE COMPLETE:', phase);
