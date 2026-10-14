const { chromium } = require('playwright');
(async () => {
  const lvl = process.argv[2];
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  await pg.goto('file:///workspace/work/lvl14_test/index.html?debug&nocache&level=' + lvl);
  await pg.waitForTimeout(800); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter');
  for (let i = 0; i < 300; i++) { if (await pg.evaluate(() => window.__SS && __SS.STATE.scene === 'stage' && __SS.STATE.player)) break; await pg.waitForTimeout(100); }
  await pg.waitForTimeout(3000);
  let t0 = await pg.evaluate(() => __SS.STATE.t); await pg.waitForTimeout(2000); let t1 = await pg.evaluate(() => __SS.STATE.t);
  console.log('L' + lvl, 'stage fps', (t1 - t0) / 2);
  await pg.evaluate(() => { const S = __SS.STATE; S.enemies.length = 0; S.queue = []; S.fadeOut = 1; });
  for (let i = 0; i < 300; i++) { if (await pg.evaluate(() => __SS.STATE.enemies.some(e => e.boss))) break; await pg.waitForTimeout(100); }
  await pg.waitForTimeout(1500);
  t0 = await pg.evaluate(() => __SS.STATE.t); await pg.waitForTimeout(2000); t1 = await pg.evaluate(() => __SS.STATE.t);
  console.log('L' + lvl, 'boss fps', (t1 - t0) / 2);
  await b.close();
})();
