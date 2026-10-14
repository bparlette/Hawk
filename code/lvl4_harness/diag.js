const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message)); pg.on('console', m => console.log('CONSOLE', m.type(), m.text().slice(0,200)));
  await pg.goto('file:///workspace/work/lvl4_test/index.html?debug&level=4&nocache'); await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter');
  for (let i = 0; i < 6; i++) { await pg.waitForTimeout(2000);
    console.log(await pg.evaluate(() => { const S = __SS.STATE; return JSON.stringify({ sc: S.scene, ph: S.phase, scroll: S.scroll, t: S.t, en: S.enemies.length, haz: (S.haz||[]).length, card: S.cardT, sec: S.sec, paused: S.paused, tr: S.haz && S.haz[1] && S.haz[1].st.list && S.haz[1].st.list.length }); })); }
  await b.close();
})();
