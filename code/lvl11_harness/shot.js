// node shot.js "<query>" "<js to eval after stage start>" out.png [waitMs]
const { chromium } = require('playwright');
(async () => {
  const [q, js, out, wait] = process.argv.slice(2);
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  pg.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await pg.goto('file:///workspace/work/lvl11_test/index.html?debug' + (q || ''));
  await pg.waitForTimeout(800);
  if (js !== 'title') {
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
    await pg.keyboard.press("Enter"); await pg.waitForTimeout(+(process.env.W8 || 3600));
  }
  if (js && js !== 'title') await pg.evaluate(js);
  await pg.waitForTimeout(+(wait || 600));
  await (await pg.$('#game')).screenshot({ path: out });
  console.log('shot', out);
  await b.close();
})();
