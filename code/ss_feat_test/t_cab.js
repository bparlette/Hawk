const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [w, h, n] of [[390, 844, 'cab_portrait'], [844, 390, 'cab_landscape']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    pg.on('pageerror', e => console.log('PAGEERROR', e.message));
    await pg.goto('file:///workspace/work/ss_feat/index.html'); await pg.waitForTimeout(1500);
    await pg.screenshot({ path: n + '.png' }); console.log(n);
    await pg.close();
  }
  await b.close();
})();
