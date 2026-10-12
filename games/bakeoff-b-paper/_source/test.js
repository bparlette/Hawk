// node test.js <port> <outPrefix> <w> <h> <query> <maxSec>
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, pre, w = '844', h = '390', q = '?shot=c', maxS = '20'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 1000; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver Message/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  p.on('response', (r) => { if (r.status() >= 400) errs.push('http' + r.status() + ': ' + r.url()); });
  await p.goto('http://127.0.0.1:' + port + '/' + q);
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 40000 });
  const t0 = Date.now(); let k = 0;
  while (Date.now() - t0 < +maxS * 1000) {
    await p.waitForTimeout(+(process.env.IV || 2500));
    await p.screenshot({ path: `${pre}${String(k++).padStart(2, '0')}.png` });
    const done = await p.evaluate(() => window.__ssDone);
    if (done) break;
  }
  const info = await p.evaluate(() => { const S = __ss.STATE, P = S.player; return { scene: S.scene, gx: +P.gx.toFixed(1), gz: +P.gz.toFixed(1), hp: P.hp, lives: S.lives, kills: S.kills, enemies: S.enemies.length, botI: __ss.BOTR.i, log: __ss.BOTR.log.join(' '), done: window.__ssDone, fe: __frameErrors.n, last: __frameErrors.last && __frameErrors.last.slice(0, 300), fps: __ss.FPS.v, sw: document.documentElement.scrollWidth, iw: innerWidth, frame: S.zone.frame, corners: __ss.BOTR.corner, reframes: S.reframes || 0, left: S.enemies.map((e) => e.type + '@' + toG(e)).join(' ') }; function toG(e) { const g = __ss.STATE.zone; const P = e.post || e; const l = g.O[0] + g.u[0] * P.x * 0.028 + g.v[0] * (P.y - 215) * 0.09, m = g.O[1] + g.u[1] * P.x * 0.028 + g.v[1] * (P.y - 215) * 0.09; return l.toFixed(0) + ',' + m.toFixed(0); } });
  console.log(JSON.stringify(info)); console.log('ERRORS', errs.length, errs.slice(0, 12).join('\n'));
  await b.close();
})();
