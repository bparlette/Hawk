// Bot run that saves milestone screenshots (phone landscape, 2x) when each moment comes up.
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [q = '?bot&turbo=3', maxS = '110', dir = '/tmp/cap', w = '844', h = '390'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto('http://127.0.0.1:8833/' + q);
  const want = {
    title: 'S.scene==="title"', select: 'S.scene==="select"',
    fight: 'S.zone&&S.zone.id==="block1"&&S.locked&&S.lock===S.zone.locks[0]&&S.enemies.filter(e=>e.entered).length>=3',
    fire: 'S.zone&&S.zone.id==="block1"&&S.locked&&S.lock===S.zone.locks[1]&&S.enemies.some(e=>e.mid&&e.state!=="enter")',
    sewer: 'S.zone&&S.zone.id==="sewerA"&&S.enemies.filter(e=>e.entered).length>=2', lair: 'S.zone&&S.zone.id==="lair"&&P.gz>5',
    zaps: 'S.enemies.filter(e=>e.type==="zap"&&e.entered).length>=1', roof: 'S.zone&&S.zone.id==="roofs"&&S.enemies.filter(e=>e.entered).length>=2',
    roof2: 'S.zone&&S.zone.id==="roofs"&&P.gx>118', climb: 'P&&P.climb&&P.climb.it.kind==="climb"&&P.gy>7',
    boss: 'S.enemies.some(e=>e.type==="ramrod"&&!e.mid&&e.state!=="dying")&&S.enemies.find(e=>e.type==="ramrod").hp<S.enemies.find(e=>e.type==="ramrod").maxHp*0.8',
    elev: 'S.elev&&S.elev.k>0.45', lobby: 'S.zone&&S.zone.id==="lobby"&&!P.climb', manup: 'P&&P.climb&&P.climb.it.kind==="up"&&P.climb.t>58&&P.climb.t<84',
    win: 'S.scene==="win"&&S.winT>70',
  };
  const seen = {}; const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < +maxS) {
    await p.waitForTimeout(350);
    const r = await p.evaluate((W) => { const S = __ss.STATE, P = S.player, o = {}; for (const k in W) { try { o[k] = !!eval(W[k]); } catch (e) { o[k] = false; } } o._sc = S.scene; return o; }, want).catch(() => ({}));
    for (const k in want) if (r[k] && !seen[k]) { seen[k] = (seen[k] || 0); seen[k + '_n'] = (seen[k + '_n'] || 0) + 1; if (seen[k + '_n'] >= (['win', 'title', 'select', 'elev', 'manup'].includes(k) ? 1 : 3)) { seen[k] = 1; await p.screenshot({ path: `${dir}-${k}.png` }); console.log('shot', k, ((Date.now() - t0) / 1000 | 0) + 's'); } }
    if (r.win && seen.win) break;
  }
  const info = await p.evaluate(() => ({ s: __ss.STATE.scene, done: window.__ssDone, fe: window.__frameErrors, log: __ss.BOTR.log })).catch((e) => e.message);
  console.log(JSON.stringify(info)); console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})();
