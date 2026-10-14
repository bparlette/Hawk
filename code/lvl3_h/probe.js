const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  await pg.goto('file:///workspace/work/lvl3_test/index.html?debug&level=3&nocache');
  await pg.waitForTimeout(800); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter');
  for (let i = 0; i < 16; i++) { await pg.waitForTimeout(700); console.log(i, await pg.evaluate(() => { const S = __SS.STATE; return [S.scene, S.t, S.playT, S.cardT, S.paused, document.hidden, S.camX].join(" "); })); }
  await b.close();
})();
