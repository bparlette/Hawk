// node hbot.js <query> <maxSec> <w> <h> <shotPrefix> <shotEverySec>
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [q = '?bot', maxS = '300', w = '640', h = '360', pre = '', every = '0'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 1000; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(process.env.DSF || 1), isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver Message/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  p.on('response', (r) => { if (r.status() >= 400) errs.push('http' + r.status() + ': ' + r.url()); });
  await p.goto('http://127.0.0.1:8871/' + q);
  const t0 = Date.now(); let k = 0, last = 0;
  while ((Date.now() - t0) / 1000 < +maxS) {
    await p.waitForTimeout(3000);
    const s = await p.evaluate(() => { const S = __ss.STATE, P = S.player; return { sc: S.scene, x: P && +P.gx.toFixed(1), z: P && +P.gz.toFixed(1), hp: P && P.hp, lives: S.lives, en: S.enemies.length, kills: S.kills, bi: __ss.BOTR.i, corner: __ss.BOTR.corner, log: __ss.BOTR.log.join(' '), done: window.__ssDone, fe: __frameErrors.n, fl: __frameErrors.last && __frameErrors.last.slice(0, 300), fps: __ss.FPS.v, frame: S.zone && S.zone.frame, fight: S.enemies.filter((e) => !e.idle && !e.home).length, sw: document.documentElement.scrollWidth, iw: innerWidth }; }).catch((e) => ({ e: e.message }));
    console.log(((Date.now() - t0) / 1000 | 0) + 's ' + JSON.stringify(s));
    if (pre && +every && ((Date.now() - last) / 1000 >= +every || (s.fight && (Date.now() - last) / 1000 >= +every / 3))) { last = Date.now(); const bb = await p.locator('#gl').boundingBox(); await p.screenshot({ path: `${pre}${String(k++).padStart(2, '0')}.png`, clip: bb }); }
    if (s.done || s.sc === 'win' || s.sc === 'over') break;
  }
  console.log('ERRORS', errs.length); console.log(errs.slice(0, 15).join('\n'));
  await b.close();
})();
