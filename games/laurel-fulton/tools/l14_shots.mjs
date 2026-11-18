// l14_shots.mjs — task L14 evidence on the REAL page, in the 540x960 portrait frame the viral-short audit used:
// Kosack's house (PICK Kosack -> you start inside): the three bark lines, then down to the basement (arcade, bar, the hole);
// and the door staging inside a real piloted rally (?pilot, stick only): the Lazaris boots beat and Grant's mom.
//   CHROME=... node tools/l14_shots.mjs        (from games/laurel-fulton/)   -> shots/l14-*.png
import { chromium } from 'playwright-core'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const base = `http://localhost:${web.address().port}/laurel-fulton/play.html`, errs = [];
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const open = async (q) => { const p = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 }); p.on('pageerror', e => errs.push(String(e).slice(0, 200))); await p.goto(base + q); await p.waitForFunction(() => window.__lf, null, { timeout: 180000 }); return p; };
const shot = (p, n) => p.screenshot({ path: path.join(ROOT, `shots/l14-${n}.png`) });
let p = await open('?player=kosack&nointro');
await p.waitForTimeout(1500);
// walk Jason into Kosack's house: GO IN is for whoever is on foot at a crew house with a kit — use the page's own entry
await p.waitForFunction(() => window.__lf.inside(), null, { timeout: 60000 });
for (const [t, n] of [[1.6, '1-chinese-food-is-here'], [3.9, '2-watch-wang-wash-wang'], [6.0, '3-shut-up']]) {
  await p.waitForFunction((t) => window.__lf.inside().time >= t, t, { timeout: 60000, polling: 30 }); await shot(p, n);
}
const L = await p.evaluate(() => window.__lf.inside().K.links.find(l => l.id === 'down').ax);
await p.keyboard.down('ArrowRight'); await p.waitForFunction((x) => Math.abs(window.__lf.inside().hero.x - x) < 0.25, L, { timeout: 20000, polling: 20 }); await p.keyboard.up('ArrowRight');
await p.keyboard.down('ArrowDown'); await p.waitForFunction(() => window.__lf.inside().hero.floor === 'lower', null, { timeout: 20000, polling: 20 }); await p.keyboard.up('ArrowDown');
await p.waitForTimeout(800); await shot(p, '4-basement-arcade-bar-hole');
await p.keyboard.down('ArrowRight'); await p.waitForTimeout(1600); await p.keyboard.up('ArrowRight'); await p.waitForTimeout(600); await shot(p, '5-basement-the-bar');
await p.close();
for (const [who, house, n] of [['rigg', 'jimmy', '6-lazaris-boots'], ['brad', 'grant', '7-grant-move-your-car']]) {
  p = await open(`?pilot&player=${who}&speed=16`);
  await p.waitForFunction((h) => { const M = window.__lf.mission(); return M && M.beat && M.beat.stage && M.beat.stop.people.some(q => q.id === h); }, house, { timeout: 1500000, polling: 20 });
  await p.evaluate(() => window.__lf.setSpeed(1));
  await p.waitForFunction(() => { const B = window.__lf.mission().beat; return !B || B.say; }, null, { timeout: 20000, polling: 20 });
  await shot(p, n + '-a'); await p.waitForTimeout(1900); await shot(p, n + '-b'); await p.close();
}
console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close(); web.close();
