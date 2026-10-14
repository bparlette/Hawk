const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--allow-file-access-from-files'] }); const pg = await b.newPage();
  pg.on('pageerror', e => console.log('PE', e.message));
  await pg.goto('file:///workspace/work/props_9_13/test/index.html?debug&level=11&nocache');
  for (let i = 0; i < 12; i++) { await pg.waitForTimeout(1000); if (i == 1 || i == 2) await pg.keyboard.press('Enter'); console.log(i, await pg.evaluate(() => window.__SS ? [__SS.STATE.scene, __SS.STATE.level, !!__SS.STATE.player, __SS.STATE.menu && JSON.stringify(__SS.STATE.menu).slice(0,80)].join('|') : 'noSS')); }
  await b.close(); })();
