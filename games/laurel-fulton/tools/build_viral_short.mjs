// build_viral_short.mjs — Generates a 1080x1920 vertical YouTube Short / highlight reel
// showcasing all Scaggsville (games/laurel-fulton/) features, house cutaways & sayings,
// dap scenes, Weis ("Fuck Scott"), Gringada ("Clayton it"), 108 Astro, Kosack Fake-Cop,
// 100-Guest Night Party, Park It! + KOTH mini-games, convoy mischief, Lamar's burning Mustang,
// and Atholton HS Roof Lookout.
//
// Usage: node tools/build_viral_short.mjs
// Output: games/laurel-fulton/shots/scaggsville-viral-short.mp4
import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFileSync } from 'child_process';
import { chromium } from '../../palm-city/tools/node_modules/playwright-core/index.mjs';

const ROOT = path.resolve('..');
const LF = path.join(ROOT, 'laurel-fulton');
const FRAMES = path.join(LF, 'shots', '_short_frames');
const OUT_MP4 = path.join(LF, 'shots', 'scaggsville-viral-short.mp4');
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.css': 'text/css',
};
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
  });
});
await new Promise(r => srv.listen(0, r));
const PORT = srv.address().port;

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});

let frameIdx = 0;
async function shoot(page, caption, count, delayMs = 85, onTick = null) {
  await page.evaluate((cap) => {
    let el = document.getElementById('__short_cap');
    if (!el) {
      el = document.createElement('div');
      el.id = '__short_cap';
      el.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:rgba(27,20,48,0.92);color:#ffd25c;border:2.5px solid #ffd25c;border-radius:14px;padding:7px 16px;font:900 15px system-ui,sans-serif;letter-spacing:0.4px;white-space:nowrap;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,0.5);';
      document.body.appendChild(el);
    }
    el.textContent = cap;
    el.style.display = cap ? 'block' : 'none';
  }, caption);

  for (let i = 0; i < count; i++) {
    if (onTick) await onTick(i);
    await page.waitForTimeout(delayMs);
    const out = path.join(FRAMES, `frame_${String(frameIdx++).padStart(5, '0')}.png`);
    await page.screenshot({ path: out });
  }
}

try {
  // 540x960 @2x => 1080x1920 vertical Shorts canvas
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await page.goto(`http://localhost:${PORT}/laurel-fulton/index.html?nointro`);
  await page.waitForFunction(() => window.__lf && window.__lf.sim && window.__lf.areas && window.__lf.areas.heroes.length > 0 && window.__lf.roof(), null, { timeout: 45000 });

  // 1. MD-216 Pick Screen (1.0s = 12 frames)
  await shoot(page, 'SCAGGSVILLE · PICK YOUR CREW', 12, 70);

  // 2. Brad's House Cutaway (Teter + fireplace + cooler + dogs) (3.0s = 36 frames)
  await page.evaluate(() => window.__lf.pick('brad'));
  await page.waitForTimeout(400);
  await shoot(page, "BRAD'S HOUSE · BEER IN THE COOLER", 34, 80);

  // 3. Rigg's Scooby Van (exit Brad's house via inside.exit or jumpTo) + Rigg's Cutaway
  await page.evaluate(() => {
    const L = window.__lf;
    const rigg = L.sim.roster.people.find(p => p.id === 'rigg');
    L.jumpTo({ pos: rigg.house });
    const van = L.van();
    if (van) { L.cam.x = van.x; L.cam.y = van.y; }
  });
  await shoot(page, "RIGG'S + DAVID KLINK'S SCOOBY VAN", 22, 85);

  // Visit Rigg's interior cleanly
  const pRigg = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await pRigg.goto(`http://localhost:${PORT}/laurel-fulton/index.html?player=rigg&nointro`);
  await pRigg.waitForFunction(() => window.__lf && window.__lf.inside(), null, { timeout: 30000 });
  await shoot(pRigg, "RIGG'S HOUSE · DAD YELLS BRIAN!", 32, 85);
  await pRigg.close();

  // 4. Fresh session as Jason -> Crew Pull-Up & Dap Beat (3.0s = 36 frames)
  await page.goto(`http://localhost:${PORT}/laurel-fulton/index.html?nointro`);
  await page.waitForFunction(() => window.__lf && window.__lf.sim && window.__lf.areas && window.__lf.areas.heroes.length > 0 && window.__lf.roof(), null, { timeout: 45000 });
  await page.evaluate(() => {
    const L = window.__lf;
    L.pick('jason');
    const M = L.mission();
    const st = M.stops[0];
    L.sim.player.x = st.kx; L.sim.player.y = st.ky; L.sim.player.v = 12;
  });
  await shoot(page, 'PULL UP & DAP THE CREW', 36, 85);

  // 5. Convoy Racing + "Cole Trickle" + "Rubbin is racing" + Throwing $1 / Pens / Pennies (3.2s = 38 frames)
  await page.evaluate(() => {
    const L = window.__lf, M = L.mission(), sim = L.sim;
    M.beat = null; M.camZoom = 1;
    // Place 3 followers right behind player and trigger throws + barks
    for (let i = 0; i < Math.min(3, M.stops.length); i++) {
      const st = M.stops[i];
      if (!st.done) {
        st.done = true;
        const c = st.cars[0];
        c.x = sim.player.x - Math.cos(sim.player.h) * 65 * (i + 1);
        c.y = sim.player.y - Math.sin(sim.player.h) * 65 * (i + 1);
        c.h = sim.player.h; c.parked = false; c.follower = true;
        M.convoy.push({ car: c, person: st.people[0], joinedAt: M.time, ti: -1 });
      }
    }
    M.barks.push({ car: M.convoy[0].car, text: 'Cole Trickle!', t: 2.5, max: 2.5 });
    if (M.convoy[1]) M.barks.push({ car: M.convoy[1].car, text: 'Rubbin is racing!', t: 2.5, max: 2.5 });
    for (let k = 0; k < 12; k++) {
      const kind = ['bill', 'pen', 'penny'][k % 3];
      M.throws.push({ x: sim.player.x + (k - 6) * 8, y: sim.player.y - 10, vx: (k % 2 ? 1 : -1) * 55, vy: -30 + (k % 3) * 20, rot: k, vrot: 8, kind, t: 0, life: 2.2 });
    }
  });
  await shoot(page, 'RACING · THROWING ONES, PENS & PENNIES', 30, 80, async (i) => {
    await page.keyboard.down('ArrowUp');
    if (i === 29) await page.keyboard.up('ArrowUp');
  });

  // 6. Weis Grocery Cutaway ("Fuck Scott") (3.8s = 45 frames)
  await page.evaluate(() => {
    const L = window.__lf, PL = L.places();
    const weis = PL.place('weis');
    L.goInPlace(weis, L.foot().who);
    const ins = L.inside();
    if (ins && ins.trigger) ins.trigger('soda');
  });
  await shoot(page, 'WEIS MARKET · "FUCK SCOTT."', 42, 95);

  // 7. Gringada 1998 Cutaway ("why are you going to Clayton it") (3.8s = 45 frames)
  await page.evaluate(() => {
    const L = window.__lf, PL = L.places();
    const gring = PL.place('gringada');
    L.goInPlace(gring, L.foot().who);
    const ins = L.inside();
    if (ins && ins.trigger) ins.trigger('steal');
  });
  await shoot(page, 'GRINGADA 1998 · "CLAYTON IT"', 42, 95);

  // 8. Route 108 Astro — Rob Parking Lights (2.0s = 24 frames)
  await page.evaluate(() => {
    const L = window.__lf, PL = L.places();
    const astro = PL.astro(L.sim);
    if (astro) {
      L.jumpTo({ pos: [astro.x, astro.y] });
      L.cam.x = astro.x; L.cam.y = astro.y; L.cam.zoom = 1.1;
      PL.bark = { x: astro.x, y: astro.y - 36, t: 3.0, text: 'Parking lights. Mine now.' };
    }
  });
  await shoot(page, 'ROUTE 108 ASTRO · ROB PARKING LIGHTS', 22, 85);

  // 9. Kosack Fake-Cop Pull-Over + 100-Guest Night Party (4.0s = 48 frames)
  await page.evaluate(() => {
    const L = window.__lf;
    const items = L.help().items(L.sim, L.sim.roster, L.places(), L.party());
    const kos = items.find(i => i.id === 'kosack');
    const pty = items.find(i => i.id === 'party');
    L.jumpTo({ ...kos, night: true });
    if (pty) L.party().setVenue('kosack');
    const P = L.sim.player, fc = L.fakeCop();
    const m = fc.models[0] || Object.keys(L.sim.fleet)[0];
    const tc = L.sim.addCar(m, P.x + Math.cos(P.h) * 75, P.y + Math.sin(P.h) * 75, P.h, {
      traffic: true, fcState: 'NONE', fcT: 0, fcCd: 0, driveFn: (c, dt) => fc._driveTraffic(c, dt),
    });
    fc.traffic.push(tc);
    for (let i = 0; i < 110; i++) { L.sim.step(1 / 60, { jx: 0, jy: 0, jm: 0, keys: {} }); fc.step(1 / 60, true); }
  });
  await shoot(page, 'KOSACK FAKE-COP + 100-GUEST POOL PARTY', 36, 85);

  // 10. Mini-Games: PARK IT! (Weis/Ledo) + King of the Hill (3.5s = 42 frames)
  await page.evaluate(() => {
    const L = window.__lf, v = L.valet(), bay = v.bays[0], P = L.sim.player;
    L.jumpTo({ pos: [bay.x, bay.y] });
    P.x = bay.x - 45; P.y = bay.y; P.h = bay.h; P.v = 90; v.step(L.sim, 1 / 60);
    P.x = bay.x; P.y = bay.y; P.h = bay.h + 2.5; P.v = 5; v.step(L.sim, 1 / 60);
  });
  await shoot(page, 'MINI-GAMES · PARK IT! J-TURN 5×', 22, 85);

  await page.evaluate(() => {
    const L = window.__lf, K = L.koth();
    if (K && K.sacs && K.sacs.length) {
      const s = K.sacs[0];
      L.jumpTo({ pos: [s.x, s.y] });
      K.tryStart(L.sim);
    }
  });
  await shoot(page, 'MINI-GAMES · KING OF THE HILL', 22, 85);

  // 11. Finale: Lamar's Burning Mustang + Atholton HS Roof Lookout (3.2s = 38 frames)
  await page.evaluate(() => {
    const L = window.__lf, RF = L.roof(), lamar = L.sim.cars.find(c => c.owner === 'lamar');
    if (lamar) {
      L.jumpTo({ pos: [lamar.x, lamar.y] });
      L.cam.x = lamar.x; L.cam.y = lamar.y; L.cam.zoom = 0.95;
    }
    if (RF && L.foot()) {
      const f = L.foot();
      f.active = true; f.x = RF.cx || lamar.x - 40; f.y = RF.cy || lamar.y - 40; f.z = RF.h;
    }
  });
  await shoot(page, "ATHOLTON ROOF + LAMAR'S BURNING MUSTANG", 32, 85);

  await page.close();
} finally {
  await browser.close();
  srv.close();
}

console.log(`Captured ${frameIdx} frames -> encoding ${OUT_MP4}...`);
execFileSync('ffmpeg', [
  '-y', '-framerate', '12',
  '-i', path.join(FRAMES, 'frame_%05d.png'),
  '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-movflags', '+faststart',
  OUT_MP4,
], { stdio: 'inherit' });
fs.rmSync(FRAMES, { recursive: true, force: true });
console.log('SHORT READY:', OUT_MP4);
