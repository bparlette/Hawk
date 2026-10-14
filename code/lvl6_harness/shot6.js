// node shot6.js out.png "<setup js>" waitMs ["<boss js>"]
const { chromium } = require('playwright');
(async () => {
  const [out, js, wait, bossjs] = process.argv.slice(2);
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  pg.on('console', m => { if (m.type() === 'error' || m.type()==='warning') console.log('CONSOLE', m.text()); });
  await pg.goto('file:///workspace/work/lvl6_test/index.html?debug&level=6&nocache');
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => window.__SS && __SS.STATE.scene === 'stage' && __SS.STATE.player && !(__SS.STATE.cardT > 0), null, { timeout: 20000 });
  await pg.waitForTimeout(+(process.env.PRE||500));
  if (bossjs) { // fast-forward to the boss arena
    for (let i = 0; i < 400; i++) {
      const r = await pg.evaluate(() => { const S = __SS.STATE, p = S.player; p.hp = 16;
        if (S.sec === 0) { S.enemies.forEach(e => { e.hp = 0; e.state = 'dying'; e.t = 89; }); S.queue = []; p.x = Math.min(p.x + 30, S.camX + 370); p.y = 190; }
        return S.sec + ':' + S.phase + ':' + (S.enemies.find(e => e.boss) || {}).state; });
      if (/^1:boss:walk/.test(r)) break;
      await pg.waitForTimeout(100);
    }
    await pg.evaluate(bossjs);
  }
  if (js) await pg.evaluate(js);
  await pg.waitForTimeout(+(wait || 300));
  console.log(await pg.evaluate(() => { const S = __SS.STATE; return 'sec=' + S.sec + ' phase=' + S.phase + ' wave=' + S.wave; }));
  await (await pg.$('#game')).screenshot({ path: out });
  console.log('shot', out); console.log(await pg.evaluate(()=>JSON.stringify(window.__log||[])));
  await b.close();
})();
