// node hfight.js <w> <h> <dsf> <prefix> <n>  - runs the bot, grabs screenshots mid-fight (a foe within 3 m, blows flying)
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w = '932', h = '430', dsf = '2', pre = 'T/f', n = '6', q = '?bot&turbo=1'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 1000; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver Message/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8871/' + q);
  const t0 = Date.now(); let k = 0;
  while (k < +n && Date.now() - t0 < 400000) {
    await p.waitForTimeout(500);
    const s = await p.evaluate(() => { const S = __ss.STATE, P = S.player; if (!P || S.scene !== 'stage') return { ok: false }; const near = S.enemies.filter((e) => !e.idle && !e.home && Math.hypot((e.x - P.x) * 0.028, (e.y - P.y) * 0.09) < 3.2).length; return { ok: near > 0 && (P.attackT > 0 || S.fx.length > 2), done: window.__ssDone, kills: S.kills }; }).catch(() => ({}));
    if (s.done) break;
    if (s.ok) { const bb = await p.locator('#gl').boundingBox(); await p.screenshot({ path: `${pre}${k++}.png`, clip: bb }); await p.waitForTimeout(2500); }
  }
  console.log('shots', k, 'ERRORS', errs.length, errs.slice(0, 8).join('\n'));
  await b.close();
})();
