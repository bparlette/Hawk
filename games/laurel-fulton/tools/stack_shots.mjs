// stack_shots.mjs — before/after proof for the sprite-stack lane.
// Two boots of the REAL game. Probe boot: project Brad's house point onto
// the Stansfield Rd centreline (W.roadInfo + sim.nearPt — the same placement
// jumpTo uses). Capture boot: the game's own FIXED camera (?cam=x,y,1.5 —
// no chase-ease, no world pulse, so framing is deterministic) + pinned
// time of day (?t=0.15), his Camaro ON the road mid-turn (road angle + 45°),
// Kosack's Cavalier and a Camry along the same road at other headings, all
// three pinned. Identical scene for both trees; only the build differs.
//   CHROME=<chromium> PWCORE=<playwright-core index.mjs> node tools/stack_shots.mjs <gamesRoot> <label>
const { chromium } = await import(process.env.PWCORE);
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const GAMES = path.resolve(process.argv[2]), LABEL = process.argv[3] || 'after';
const OUT = path.resolve('shots'); fs.mkdirSync(OUT, { recursive: true });
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => srv.listen(0, r));
const base = `http://localhost:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const mk = async () => { const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); p.on('pageerror', e => errs.push(String(e))); return p; };
const errs = [];

// probe: where is the road in front of Brad's house?
let page = await mk();
await page.goto(base + '/laurel-fulton/index.html?nointro&traffic=0');
await page.waitForFunction(() => window.__lf && window.__lf.sim, null, { timeout: 180000 });
const probe = await page.evaluate(() => {
  const L = window.__lf, W = L.W;
  const H = { x: 11998.5, y: 18074.0 };                    // Brad's house (data/roster.json)
  const r = W.roadInfo(H.x, H.y, 0), pt = L.sim.nearPt(H.x, H.y, r);
  return { x: pt.x, y: pt.y, dx: r.dx, dy: r.dy, a: Math.atan2(r.dy, r.dx) };
});
await page.close();

// capture: fixed camera on that point
page = await mk();
await page.goto(`${base}/laurel-fulton/index.html?nointro&traffic=0&t=0.15&cam=${probe.x},${probe.y},1.5`);
await page.waitForFunction(() => window.__lf && window.__lf.sim && window.__lf.sim.cars.length > 0, null, { timeout: 180000 });
await page.waitForTimeout(800);
const scene = await page.evaluate((pr) => {
  const L = window.__lf, sim = L.sim;
  L.pick('brad');
  const px = -pr.dy, py = pr.dx;                           // road perpendicular
  const P = sim.player;
  const cav = sim.addCar('cavalier_kosack', pr.x + pr.dx * 88 + px * -16, pr.y + pr.dy * 88 + py * -16, pr.a - 0.5, {});
  const cam = sim.addCar('camry_jason', pr.x - pr.dx * 88 + px * 16, pr.y - pr.dy * 88 + py * 16, pr.a + 2.6, {});
  const spots = [
    { c: P, x: pr.x, y: pr.y, h: pr.a + Math.PI / 4 },
    { c: cav, x: cav.x, y: cav.y, h: pr.a - 0.5 },
    { c: cam, x: cam.x, y: cam.y, h: pr.a + 2.6 },
  ];
  window.__freeze = setInterval(() => { for (const s of spots) { s.c.x = s.x; s.c.y = s.y; s.c.h = s.h; s.c.v = 0; } }, 90);
  return { pt: { x: Math.round(pr.x), y: Math.round(pr.y) }, roadDeg: Math.round(pr.a * 180 / Math.PI), model: P.model, cam: { x: Math.round(L.cam.x), y: Math.round(L.cam.y), zoom: L.cam.zoom }, stacks: !!(L.renderer && L.renderer.stacks), nStacks: L.renderer && L.renderer.stacks ? Object.keys(L.renderer.stacks).length : 0 };
}, probe);
console.log(LABEL, 'scene:', JSON.stringify(scene));
await page.waitForTimeout(6000);
await page.screenshot({ path: path.join(OUT, `stack-${LABEL}.png`), timeout: 120000 });
await page.evaluate(() => clearInterval(window.__freeze));
console.log(LABEL, 'page errors:', errs.length ? errs.slice(0, 3) : 'none');
await browser.close(); srv.close();
