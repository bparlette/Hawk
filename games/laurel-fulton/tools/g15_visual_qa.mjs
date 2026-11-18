// g15_visual_qa.mjs — Task G15 (L11 Hero Homes, POIs, Car Lights, MD-216 Sign, Day/Night Parity, Brad Cutaway)
// Captures phone-resolution (420x860 @2x) live evidence sheets in shots/g15-qa/.
import { chromium } from '/Users/braidpairlette/Games/Hawk/games/palm-city/tools/node_modules/playwright-core/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.resolve(ROOT, '..');
const OUT = path.join(ROOT, 'shots', 'g15-qa');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ONLY_CUTAWAY = process.argv.includes('--cutaway');

const web = http.createServer((q, r) => {
  const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'public, max-age=3600' }); r.end(b); }
  });
});
await new Promise(r => web.listen(0, r));
const PORT = web.address().port;
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const errs = [];

async function waitChunksAndHeroes(p, cx, cy, z) {
  await p.waitForFunction(() => window.__lf && window.__lf.sim && window.__lf.areas && window.__lf.areas.heroes && window.__lf.areas.heroes.length >= 10, null, { timeout: 180000 });
  await p.waitForFunction(({ cx, cy, z }) => {
    const g = window.__lf.ground, CH = 256, hw = 210 / z, hh = 430 / z;
    for (let gy = Math.floor((cy - hh) / CH); gy <= Math.floor((cy + hh) / CH); gy++)
      for (let gx = Math.floor((cx - hw) / CH); gx <= Math.floor((cx + hw) / CH); gx++) {
        const c = g.cache.get(gx + ',' + gy);
        if (!c) return false;
        const st = g.painted ? g.paintedState(gx, gy) : null;
        if (st === 'loading') return false;
        if (st === 'ok' && !c._pt) return false;
      }
    return true;
  }, { cx, cy, z }, { timeout: 180000 });
  await p.waitForTimeout(450);
}

const b64 = (name) => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, name)).toString('base64');

// 1. All 7 Hero Homes + 3 Mapped POIs at golden hour (t=0.22)
const HERO_SPOTS = [
  ['brad', 'Brad (Stansfield Rd)', 11994, 18068, 0.62],
  ['kosack', 'Kosack (Derby Dr)', 12576, -1474, 0.62],
  ['lazaris', 'Lazaris — Jimmy & Billy', -462, 5667, 0.62],
  ['jason', 'Jason (Susini Dr)', 9129, 12881, 0.62],
  ['floyds', 'The Floyds (Hughes Ave)', 15744, 20573, 0.62],
  ['rigg', 'Rigg (Mossy Stone Ct)', 3460, 2675, 0.62],
  ['grant', 'Grant (Early Bud Way)', -672, 8560, 0.62],
  ['ledo', 'Ledo Pizza (POI)', -12941, 697, 0.62],
  ['atholton', 'Atholton HS (POI + Roof)', 5654, -19763, 0.38],
  ['reservoir', 'Reservoir HS (POI)', -8340, 929, 0.38],
];

if (!ONLY_CUTAWAY) {
{
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push('heroes: ' + e));
  for (const [slug, label, cx, cy, z] of HERO_SPOTS) {
    await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html?cam=${cx},${cy},${z}&t=0.22`);
    await waitChunksAndHeroes(p, cx, cy, z);
    await p.screenshot({ path: path.join(OUT, `hero-${slug}.png`) });
    console.log('hero:', slug);
  }
  await p.close();
}

{
  const comp = await browser.newPage({ viewport: { width: 1460, height: 1220 }, deviceScaleFactor: 1 });
  await comp.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:18px;">
      <div style="text-align:center;font-weight:900;font-size:20px;color:#ffd45c;margin-bottom:14px;">
        TASK G15 — LIVE HERO HOMES & POIs (420×860 PHONE CAPTURES, t=0.22)
      </div>
      <div style="display:grid;grid-template-columns:repeat(5, 270px);gap:14px;justify-content:center;">
        ${HERO_SPOTS.map(([slug, label, cx, cy, z]) => `
          <div style="text-align:center;">
            <div style="font-size:12px;font-weight:800;color:#6ee2ff;margin-bottom:4px;">${label}</div>
            <img src="${b64(`hero-${slug}.png`)}" style="width:270px;height:553px;border:2px solid #523a68;border-radius:10px;display:block;object-fit:cover;"/>
            <div style="font-size:10px;color:#c9b8d8;margin-top:3px;">zoom=${z}</div>
          </div>
        `).join('')}
      </div>
    </body></html>
  `);
  await comp.waitForTimeout(300);
  await comp.screenshot({ path: path.join(OUT, 'g15-heroes-grid.png'), fullPage: true });
  await comp.close();
}

// 2. Pick Screen (MD-216 Sign Logo) + Car Headlight Beams & Blue Underglow at dusk (t=0.85)
{
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push('pick: ' + e));
  await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html`);
  await p.waitForFunction(() => window.__lf && window.__lf.picking && window.__lf.picking(), null, { timeout: 180000 });
  await p.waitForTimeout(900);
  const pickText = await p.evaluate(() => window.__lf && window.__lf.areas ? '' : '');
  await p.screenshot({ path: path.join(OUT, 'logo-pick.png') });
  await p.close();
}

const LIGHT_SPOTS = [
  ['rigg-blue', 'Rigg — BLUE Beams', 3460, 2675],
  ['brad-yellow', 'Brad — YELLOW Beams', 11994, 18068],
  ['jimmy-neon', 'Jimmy — BLUE NEON Underglow', -462, 5667],
  ['kosack-cavalier', 'Kosack — Red Cavalier (No Cop Lights Yet)', 12576, -1474],
];

{
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push('lights: ' + e));
  for (const [slug, label, cx, cy] of LIGHT_SPOTS) {
    await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html?cam=${cx},${cy},0.78&t=0.85`);
    await waitChunksAndHeroes(p, cx, cy, 0.78);
    await p.screenshot({ path: path.join(OUT, `light-${slug}.png`) });
    console.log('light:', slug);
  }
  await p.close();
}

{
  const cards = [
    ['logo-pick.png', 'Pick Screen — MD-216 Sign Logo'],
    ...LIGHT_SPOTS.map(([slug, label]) => [`light-${slug}.png`, label]),
  ];
  const comp = await browser.newPage({ viewport: { width: 1460, height: 660 }, deviceScaleFactor: 1 });
  await comp.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:18px;">
      <div style="text-align:center;font-weight:900;font-size:20px;color:#ffd45c;margin-bottom:14px;">
        TASK G15 — MD-216 LOGO SCREEN + CAR LIGHTS / UNDERGLOW AUDIT (t=0.85, 420×860 PHONE)
      </div>
      <div style="display:flex;gap:14px;justify-content:center;">
        ${cards.map(([file, label]) => `
          <div style="text-align:center;width:270px;">
            <div style="font-size:12px;font-weight:800;color:#6ee2ff;margin-bottom:4px;min-height:30px;">${label}</div>
            <img src="${b64(file)}" style="width:270px;height:553px;border:2px solid #ffd45c;border-radius:10px;display:block;object-fit:cover;"/>
          </div>
        `).join('')}
      </div>
    </body></html>
  `);
  await comp.waitForTimeout(300);
  await comp.screenshot({ path: path.join(OUT, 'g15-car-lights-and-logo.png'), fullPage: true });
  await comp.close();
}

// 3. Day/Night Parity: Scaggsville vs Palm City at t=0, t=0.55, t=0.97 + live curve check
const TODS = [
  ['0', 't=0.00 (Golden Hour)'],
  ['0.55', 't=0.55 (Warm Sunset + Lights Ramp)'],
  ['0.97', 't=0.97 (Blue Dusk + Neon/Headlights)'],
];
for (const [tv] of TODS) {
  {
    const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    p.on('pageerror', e => errs.push(`lf-t${tv}: ` + e));
    await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html?cam=11998,18074,0.62&t=${tv}`);
    await waitChunksAndHeroes(p, 11998, 18074, 0.62);
    await p.screenshot({ path: path.join(OUT, `parity-lf-${tv}.png`) });
    await p.close();
  }
  {
    const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    p.on('pageerror', e => errs.push(`pc-t${tv}: ` + e));
    await p.goto(`http://localhost:${PORT}/palm-city/index.html?cam=780,1040&t=${tv}&nodirector`);
    await p.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 120000 });
    await p.waitForTimeout(2000);
    await p.screenshot({ path: path.join(OUT, `parity-pc-${tv}.png`) });
    console.log('parity-pc:', tv);
    await p.close();
  }
}

let todLog = '';
{
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push('todcurve: ' + e));
  await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html?player=brad&nointro&speed=16`);
  await p.waitForFunction(() => window.__lf && window.__lf.sim && !window.__lf.picking(), null, { timeout: 180000 });
  const s0 = await p.evaluate(() => window.__lf.tod());
  await p.waitForTimeout(2500);
  const s1 = await p.evaluate(() => window.__lf.tod());
  await p.waitForTimeout(6000);
  const s2 = await p.evaluate(() => window.__lf.tod());
  todLog = `tod: ${s0.toFixed(3)} -> +2.5s ${s1.toFixed(3)} -> +8.5s ${s2.toFixed(3)}`;
  console.log('DAY/NIGHT CURVE:', todLog);
  await p.close();
}

{
  const comp = await browser.newPage({ viewport: { width: 1020, height: 1960 }, deviceScaleFactor: 1 });
  await comp.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:18px;">
      <div style="text-align:center;font-weight:900;font-size:20px;color:#ffd45c;margin-bottom:14px;">
        TASK G15 — DAY / NIGHT PARITY: PALM CITY vs SCAGGSVILLE (420×860 PHONE)
      </div>
      ${TODS.map(([tv, label]) => `
        <div style="font-weight:900;font-size:14px;color:#6ee2ff;margin:8px 0 6px;text-align:center;">${label}</div>
        <div style="display:flex;gap:16px;justify-content:center;margin-bottom:14px;">
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:800;color:#ffd45c;margin-bottom:4px;">PALM CITY (Reference)</div>
            <img src="${b64(`parity-pc-${tv}.png`)}" style="width:300px;height:614px;border:2px solid #ffd45c;border-radius:10px;display:block;object-fit:cover;"/>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:800;color:#7dffa8;margin-bottom:4px;">SCAGGSVILLE (Laurel/Fulton)</div>
            <img src="${b64(`parity-lf-${tv}.png`)}" style="width:300px;height:614px;border:2px solid #7dffa8;border-radius:10px;display:block;object-fit:cover;"/>
          </div>
        </div>
      `).join('')}
    </body></html>
  `);
  await comp.waitForTimeout(300);
  await comp.screenshot({ path: path.join(OUT, 'g15-daynight-parity.png'), fullPage: true });
  await comp.close();
}
}

// 4. Brad's L7 Split-Foyer Cutaway check
{
  const K = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/interiors/brad.json')));
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errs.push('cutaway: ' + e));
  await p.goto(`http://localhost:${PORT}/laurel-fulton/play.html`);
  await p.waitForFunction(() => window.__lf && window.__lf.sim && window.__lf.picking && window.__lf.picking(), null, { timeout: 120000 });
  // Wait for Phase-2 KITS['brad'] to stream in, then trigger pick('brad') so goIn opens the L7 cutaway cleanly
  await p.waitForFunction(() => {
    if (window.__lf.inside()) return true;
    window.__lf.pick('brad');
    return !!window.__lf.inside();
  }, null, { polling: 300, timeout: 60000 });
  await p.waitForTimeout(800);
  const st = () => p.evaluate(() => { const I = window.__lf.inside(); return I ? { floor: I.hero.floor, x: I.hero.x, said: I.teter?.said, mantle: I.mantle } : {}; });
  const hold = async (keys, cond, ms = 6000) => {
    for (const k of keys) await p.keyboard.down(k);
    const t0 = Date.now();
    while (Date.now() - t0 < ms && !(await cond(await st()))) await p.waitForTimeout(30);
    for (const k of keys) await p.keyboard.up(k);
  };
  await p.screenshot({ path: path.join(OUT, 'cutaway-1-landing.png') });
  await hold(['ArrowRight', 'ArrowUp'], s => s.floor === 'main');
  await hold(['ArrowRight'], s => s.x > K.teter.x - 0.5);
  await p.waitForTimeout(400);
  const teterSaid = (await st()).said;
  console.log('TETER SAID:', teterSaid);
  await p.screenshot({ path: path.join(OUT, 'cutaway-2-upstairs-teter.png') });
  await hold(['ArrowLeft'], s => s.floor === 'landing');
  await hold(['ArrowRight', 'ArrowDown'], s => s.floor === 'lower');
  await hold(['ArrowRight'], s => s.x > 7.8);
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, 'cutaway-3-downstairs.png') });
  await p.close();
}

{
  const frames = [
    ['cutaway-1-landing.png', '1. Front Door Landing'],
    ['cutaway-2-upstairs-teter.png', '2. Upstairs — Teter Greeting + Cooler'],
    ['cutaway-3-downstairs.png', '3. Downstairs — Weights + Fireplace + Mantle Beers'],
  ];
  const comp = await browser.newPage({ viewport: { width: 1020, height: 700 }, deviceScaleFactor: 1 });
  await comp.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:18px;">
      <div style="text-align:center;font-weight:900;font-size:20px;color:#ffd45c;margin-bottom:14px;">
        TASK G15 — BRAD'S L7 SPLIT-FOYER CUTAWAY QA (420×860 PHONE)
      </div>
      <div style="display:flex;gap:16px;justify-content:center;">
        ${frames.map(([f, lbl]) => `
          <div style="text-align:center;width:300px;">
            <div style="font-size:12px;font-weight:800;color:#6ee2ff;margin-bottom:4px;">${lbl}</div>
            <img src="${b64(f)}" style="width:300px;height:614px;border:2px solid #ffd45c;border-radius:10px;display:block;object-fit:cover;"/>
          </div>
        `).join('')}
      </div>
    </body></html>
  `);
  await comp.waitForTimeout(300);
  await comp.screenshot({ path: path.join(OUT, 'g15-brads-cutaway.png'), fullPage: true });
  await comp.close();
}

await browser.close();
web.close();
if (errs.length) { console.error('ERRORS:', errs); process.exit(1); }
console.log('G15 QA CAPTURES COMPLETE');
