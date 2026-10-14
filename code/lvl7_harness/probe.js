const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 }, deviceScaleFactor: 3 });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  pg.on('console', m => { if (m.type() === 'error' || m.type()==='warning') console.log('CONSOLE', m.type(), m.text()); });
  await pg.goto('file:///workspace/work/lvl7_test/index.html?debug&level=7&nocache' + (process.argv[2]||''));
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => window.__SS && __SS.STATE.scene === 'stage' && !__SS.STATE.cardT && __SS.STATE.player, null, { timeout: 60000 });
  await pg.waitForTimeout(+(process.env.W8||500));
  const steps = JSON.parse(require('fs').readFileSync(process.argv[3] || 'steps.json','utf8'));
  for (const s of steps) {
    if (s.js) console.log('eval', JSON.stringify(await pg.evaluate(s.js)));
    if (s.wait) await pg.waitForTimeout(s.wait);
    if (s.until) await pg.waitForFunction(s.until, null, { timeout: 60000 });
    if (s.shot) { await (await pg.$('#game')).screenshot({ path: s.shot }); console.log('shot', s.shot); }
  }
  await b.close();
})();
