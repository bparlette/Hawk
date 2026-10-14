// node shot4.js out.png "<js run once stage is live>" framesAfter [framesBefore]
const { chromium } = require('playwright');
(async () => {
  const [out, js, after, before] = process.argv.slice(2);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message)); pg.on('console', m => { if (/error|warn/.test(m.type())) console.log('CONSOLE', m.text().slice(0, 300)); });
  await pg.goto('file:///workspace/work/lvl4_test/index.html?debug&level=4&nocache'); await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => window.__SS && __SS.STATE.scene === 'stage', null, { timeout: 60000 });
  const waitF = async (n) => { const t0 = await pg.evaluate(() => __SS.STATE.t); await pg.waitForFunction((t) => __SS.STATE.t >= t, t0 + n, { timeout: 90000, polling: 50 }); };
  await waitF(+(before || 30));
  if (js) await pg.evaluate(js);
  await waitF(+(after || 20));
  await (await pg.$('#game')).screenshot({ path: out });
  console.log('shot', out, await pg.evaluate(() => JSON.stringify({ t: __SS.STATE.t, ph: __SS.STATE.phase, en: __SS.STATE.enemies.map(e => e.type + ':' + e.state) })));
  await b.close();
})();
