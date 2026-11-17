// polish_shots.mjs — before/after pairs for the polish bundle.
//   node tools/polish_shots.mjs before   (serves ../palm-city-record — the live base)
//   node tools/polish_shots.mjs after    (serves this tree)
// Pairs: (a) dusk chase — tinted smoke, (b) spikes — instant limp (before)
// vs ON RIMS with sparks (after), (c) the highlight playing — clean (before) vs Channel 7
// frame (after). Identical staging in both trees; only the build differs. 420x860 frames.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const { chromium } = await import('playwright-core');
const http = (await import('node:http')).default;
const MODE = process.argv[2] || 'after';
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = MODE === 'before' ? path.resolve(HERE, '../palm-city-record') : HERE;
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'] });
async function newPage(query) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  page.on('pageerror', e => console.log('PAGE ERROR', String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/index.html${query}`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 60000 });
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) }).then(() => console.log('saved', name));

// (a) dusk chase on Ocean Drive: player car at speed, a lit cruiser right behind, burnout smoke
{
  const page = await newPage('?t=0.85');
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const s = window.__palm.sim, W = s.world;
    const { puff } = await import('./src/destruct.js');
    s.stars = 2;
    const q = W.loopAt(1500, -14), h = Math.atan2(q.ty, q.tx);
    const c = s.addCar(q.x, q.y, h, 'sedan_coral', 'player');
    s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true; c.v = 130;
    const cop = s.addCar(q.x - Math.cos(h) * 95, q.y - Math.sin(h) * 95, h, 'police', null, { parked: true });
    cop.siren = true;
    for (let i = 0; i < 7; i++) puff(s, c.x - Math.cos(h) * (26 + i * 7) + (i % 3 - 1) * 9, c.y - Math.sin(h) * (26 + i * 7), 1, 1.15);
    puff(s, cop.x + 20, cop.y + 6, 0, 1.2);
  });
  await page.waitForTimeout(1600);
  await shot(page, `polish_a_dusk_${MODE}.png`);
  await page.close();
}
// (b) the spike strip on the east leg
{
  const page = await newPage('?t=0.5');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const s = window.__palm.sim, W = s.world;
    const q = W.loopAt(1500, -10), h = Math.atan2(q.ty, q.tx);
    s.spikes.push({ x: q.x + Math.cos(h) * 55, y: q.y + Math.sin(h) * 55, a: h + Math.PI / 2 });
    const c = s.addCar(q.x, q.y, h, 'conv_sun', 'player');
    s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true; c.v = 210;
    window.__shotCar = c;
  });
  if (MODE === 'after') await page.waitForFunction(() => (window.__shotCar.rims || 0) > 0, null, { timeout: 30000 }).catch(() => console.log('rim wait timed out'));
  else await page.waitForFunction(() => !!window.__shotCar.spiked, null, { timeout: 30000 }).catch(() => console.log('spike wait timed out'));
  await page.waitForTimeout(900);
  await shot(page, `polish_b_rims_${MODE}.png`);
  await page.close();
}
// (c) the highlight playing
{
  const page = await newPage('?demo&highlight');
  await page.waitForFunction(() => !!window.__palm.director.play, null, { timeout: 240000 });
  await page.waitForFunction(() => window.__palm.director.play && window.__palm.director.play.ready, null, { timeout: 120000 });
  await page.waitForTimeout(2600);
  await shot(page, `polish_c_news_${MODE}.png`);
  await page.close();
}
await browser.close(); server.close();
console.log('POLISH SHOTS DONE', MODE);
