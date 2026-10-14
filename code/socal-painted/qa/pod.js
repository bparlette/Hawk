const { chromium } = require('/workspace/work/trailer_v2/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', e => errs.push('PE ' + String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto('http://127.0.0.1:8817/index.html?nc=' + Date.now(), { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.evaluate(() => { __cg.Game.handOver(); __cg.QA.bot = true; __cg.QA.speed = 5; __cg.startComp('one', [5]); });
  let st; for (let k = 0; k < 60; k++) { st = await p.evaluate(() => __cg.Game.state); if (st === 'awards') break; await p.waitForTimeout(1000); }
  await p.waitForTimeout(1500); await p.screenshot({ path: 'qa/z_podium2.png' }); console.log('PODIUM', st, 'ERRS', JSON.stringify(errs));
  await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
