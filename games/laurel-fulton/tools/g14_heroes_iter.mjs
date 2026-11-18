// g14_heroes_iter.mjs — Task G14 (L8 Heroes Pop) before/after phone capture & bake-off sheet.
// Usage:
//   node tools/g14_heroes_iter.mjs before
//   node tools/g14_heroes_iter.mjs after
import { chromium } from '/Users/braidpairlette/Games/Hawk/games/palm-city/tools/node_modules/playwright-core/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.resolve(ROOT, '..');
const OUT = path.join(ROOT, 'shots', 'g14-heroes-pop');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const phase = process.argv[2] || 'before';

const web = http.createServer((q, r) => {
  const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
  });
});
await new Promise(r => web.listen(0, r));
const PORT = web.address().port;
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const errs = [];

const SCENES = [
  ['brad', 11994, 18068, 0.22],
  ['lazaris', -462, 5667, 0.55],
  ['ledo', -12941, 697, 0.22],
];

for (const [name, cx, cy, tod] of SCENES) {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push(`${phase}-${name}: ${e}`));
  await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html?cam=${cx},${cy},0.62&t=${tod}`);
  await p.waitForFunction(() => window.__lf && window.__lf.sim, null, { timeout: 180000 });
  await p.waitForFunction(({ cx, cy }) => {
    const g = window.__lf.ground, CH = 256, hw = 210 / 0.62, hh = 430 / 0.62;
    for (let gy = Math.floor((cy - hh) / CH); gy <= Math.floor((cy + hh) / CH); gy++)
      for (let gx = Math.floor((cx - hw) / CH); gx <= Math.floor((cx + hw) / CH); gx++) {
        const c = g.cache.get(gx + ',' + gy);
        if (!c) return false;
        if (g.painted && g.paintedState(gx, gy) === 'ok' && !c._pt) return false;
      }
    return true;
  }, { cx, cy }, { timeout: 180000 });
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, `${phase}-${name}.png`) });
  await p.close();
}

if (phase === 'after') {
  const b64 = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, n)).toString('base64');
  const comp = await browser.newPage({ viewport: { width: 920, height: 2780 }, deviceScaleFactor: 1 });
  await comp.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:18px;">
      <div style="text-align:center;font-weight:900;font-size:20px;color:#ffd45c;margin-bottom:14px;">
        TASK G14 — L8 HEROES POP vs BACKGROUND FADE (420×860 PHONE)
      </div>
      ${SCENES.map(([loc]) => `
        <div style="font-weight:900;font-size:14px;color:#6ee2ff;margin:8px 0 4px;">${loc.toUpperCase()}</div>
        <div style="display:flex;gap:16px;margin-bottom:16px;">
          <div style="text-align:center;">
            <div style="font-size:12px;font-weight:800;color:#ff9a8a;margin-bottom:4px;">BEFORE</div>
            <img src="${b64(`before-${loc}.png`)}" style="width:420px;height:860px;border:2px solid #523a68;border-radius:10px;display:block;"/>
          </div>
          <div style="text-align:center;">
            <div style="font-size:12px;font-weight:800;color:#7dffa8;margin-bottom:4px;">AFTER — Hero Palette + Eave Trim + Faded Background</div>
            <img src="${b64(`after-${loc}.png`)}" style="width:420px;height:860px;border:2px solid #ffd45c;border-radius:10px;display:block;"/>
          </div>
        </div>
      `).join('')}
    </body></html>
  `);
  await comp.waitForTimeout(400);
  await comp.screenshot({ path: path.join(OUT, 'g14-bakeoff-phone.png'), fullPage: true });
  await comp.close();
}

await browser.close();
web.close();
if (errs.length) { console.error('ERRORS:', errs); process.exit(1); }
console.log('G14 PHASE COMPLETE:', phase);
