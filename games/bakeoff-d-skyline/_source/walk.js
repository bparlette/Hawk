// walk test: node walk.js <shotName> <outPrefix> <keys e.g. "arrowright:1.5,arrowup:1"> [camJSON] [zoneId]
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const KEYN = (k) => ({ arrowright: 'ArrowRight', arrowleft: 'ArrowLeft', arrowup: 'ArrowUp', arrowdown: 'ArrowDown' })[k] || k;
(async () => {
  const [shot, pre, keys, cam = '', zid = '', w = '844', h = '390', extra = ''] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(process.env.DSF || 1), isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8833/?shot=' + shot + '&nolock' + extra);
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 30000 });
  if (cam) await p.evaluate(([cam, zid]) => { Object.assign(__ss.zoneById(zid).cam, JSON.parse(cam)); }, [cam, zid]);
  await p.waitForTimeout(2500); let k = 0;
  const bb = await p.locator('#gl').boundingBox(); const SS = (o) => p.screenshot({ ...o, ...(process.env.FULL ? {} : { clip: bb }) });
  await SS({ path: `${pre}${k++}.png` });
  for (const kv of keys.split(',').filter(Boolean)) {
    const [key, sec] = kv.split(':'); if (key !== 'wait') await p.keyboard.down(KEYN(key));
    const n = Math.max(1, Math.round(+sec / 0.6));
    for (let i = 0; i < n; i++) { await p.waitForTimeout(600); await SS({ path: `${pre}${k++}.png` }); }
    if (key !== 'wait') await p.keyboard.up(KEYN(key));
  }
  const s = await p.evaluate(() => { const P = __ss.STATE.player; return { z: __ss.STATE.zone.id, gx: P.gx, gz: P.gz, gy: P.gy, cam: __ss.cam.position.toArray(), fe: __frameErrors.n, en: __ss.STATE.enemies.map((e) => e.type + ':' + e.state + (e.idle ? 'I' : '') + (e.home ? 'H' : '')).join(' ') }; });
  console.log(JSON.stringify(s), 'ERRORS', errs.length, errs.slice(0, 5).join('\n'));
  await b.close();
})();
