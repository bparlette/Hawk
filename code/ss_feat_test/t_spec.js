const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  await pg.goto('file:///workspace/work/ss_feat/index.html?debug'); await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter'); await pg.waitForTimeout(4000);
  const t0 = await pg.evaluate(() => window.__SS.STATE.t);
  await pg.waitForTimeout(1000);
  const t1 = await pg.evaluate(() => window.__SS.STATE.t);
  console.log('fps', t1 - t0);
  await pg.keyboard.down('j'); await pg.keyboard.down('k'); await pg.waitForTimeout(50); await pg.keyboard.up('j'); await pg.keyboard.up('k');
  for (let i = 0; i < 5; i++) { console.log(await pg.evaluate(() => { const s = window.__SS.STATE; return [s.t, s.specT, s.specName, s.player.atk, s.scene].join(' '); })); await pg.waitForTimeout(80); }
  await (await pg.$('#game')).screenshot({ path: 'spec_dbg.png' }); console.log(await pg.evaluate(() => { const s = window.__SS.STATE; return [s.specT, s.player.bro.mask, typeof s.specName].join(' '); }));
  await b.close();
})();
