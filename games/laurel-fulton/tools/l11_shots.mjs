// l11_shots.mjs — task L11 proof: each hero home / POI at chase zoom on the REAL page (420x860 @2x) -> shots/l11-<id>.png
//   NODE_PATH=$(npm root -g) CHROME=... node tools/l11_shots.mjs [id ...] [--zoom=0.62] [--night]
import { chromium } from 'playwright-core'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const web = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => web.listen(0, r));
const args = process.argv.slice(2), zoom = +(args.find(a => a.startsWith('--zoom='))?.slice(7) || 0.62), tq = args.find(a => a.startsWith('--t=')) ? '&t=' + args.find(a => a.startsWith('--t=')).slice(4) : '', sfx = tq ? '-night' : '', only = args.filter(a => !a.startsWith('--'));
const H = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/heroes.json'))), A = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/areas.json')));
const spots = [];
for (const h of A.heroes) {
  const sp = H.heroes[h.b]; if (!sp) continue; const f = A.buildings[h.b]; let x = 0, y = 0; for (let k = 0; k < f.length; k += 2) { x += f[k]; y += f[k + 1]; } x /= f.length / 2; y /= f.length / 2;
  spots.push({ id: sp.id, x, y, z: sp.kind === 'poi' ? zoom * 0.55 : zoom, zd: sp.kind === 'poi' ? 0.7 : 1.3 });
}
const D = H.district; spots.push({ id: 'maple-lawn', x: D.center[0], y: D.center[1], z: 0.32, zd: 0.32 });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
for (const s of spots) {
  if (only.length && !only.includes(s.id)) continue;
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 }); p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  // the car spawns 900 units away so it never hides the house; ?cam sets the camera; the detail shot is the same page zoomed in
  const sx = Math.round(s.x) + 900, sy = Math.round(s.y);
  await p.goto(`http://localhost:${web.address().port}/laurel-fulton/play.html?free&cam=${Math.round(s.x)},${Math.round(s.y)},${s.z}&spawn=${sx},${sy},0${tq}`);
  await p.waitForFunction(() => window.__lf, null, { timeout: 180000 }); await p.waitForTimeout(6000);
  await p.screenshot({ path: path.join(ROOT, `shots/l11-${s.id}${sfx}.png`), timeout: 120000 }); console.log('shot', s.id);
  if (s.zd !== s.z) { await p.goto(`http://localhost:${web.address().port}/laurel-fulton/play.html?free&cam=${Math.round(s.x)},${Math.round(s.y)},${s.zd}&spawn=${sx},${sy},0${tq}`); await p.waitForFunction(() => window.__lf, null, { timeout: 180000 }); await p.waitForTimeout(6000); await p.screenshot({ path: path.join(ROOT, `shots/l11-${s.id}${sfx}-close.png`) }); }
  await p.close();
}
await browser.close(); web.close();
