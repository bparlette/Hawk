// usage: node bot.js <query> <maxSec> [shotPrefix] [shotEverySec]
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [q = '?bot&turbo=4', maxS = '100', pre = '', every = '0', w = '844', h = '390'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto(q.startsWith('http') ? q : 'http://127.0.0.1:8833/' + q);
  const t0 = Date.now(); let k = 0, lastShot = 0;
  while ((Date.now() - t0) / 1000 < +maxS) {
    await p.waitForTimeout(2000);
    const s = await p.evaluate(() => { const S = __ss.STATE, P = S.player; return { sc: S.scene, z: S.zone && S.zone.id, l: P && P.layer, x: P && +P.gx.toFixed(1), zz: P && +P.gz.toFixed(1), hp: P && P.hp, lives: S.lives, en: S.enemies.length, lk: S.locked, bi: __ss.BOTR.i, log: __ss.BOTR.log.join(' '), done: window.__ssDone, score: S.score, kills: S.kills, sec: S.secrets, fe: window.__frameErrors.n, fl: window.__frameErrors.last && window.__frameErrors.last.slice(0, 300), fps: __ss.FPS.v,
      ens: S.enemies.map((e) => e.type + '/' + e.state + '/' + (e.x | 0) + ',' + (e.y | 0) + (e.entered ? 'E' : '')).join(' ') + ' P' + (P ? (P.x | 0) + ',' + (P.y | 0) + ' cam' + S.camX : ''), locks: __ss.WORLD.zones.map((z) => z.id + ':' + z.locks.map((L) => L.done ? 1 : 0).join('')).join(' ') }; }).catch((e) => ({ e: e.message }));
    console.log(((Date.now() - t0) / 1000 | 0) + 's ' + JSON.stringify(s));
    if (pre && +every && (Date.now() - lastShot) / 1000 >= +every) { lastShot = Date.now(); await p.screenshot({ path: `${pre}${String(k++).padStart(2, '0')}.png` }); }
    if (s.sc === 'win' || s.sc === 'over' || s.done || (s.log && / end/.test(s.log))) { await p.waitForTimeout(1500); if (pre) await p.screenshot({ path: `${pre}end.png` }); break; }
  }
  console.log('ERRORS:', errs.length); console.log(errs.slice(0, 15).join('\n'));
  await b.close();
})();
