// node qa/final.js : 390x844 touch screenshots: attract, menu (after handover, leak check), ready, surf wave read x4, 16-bit, podium(awards), thumb frame at 1280
const { chromium } = require('/workspace/work/trailer_v2/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', e => errs.push('PE ' + String(e.stack || e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|GL Driver/.test(m.text()))) errs.push(m.type() + ' ' + m.text().slice(0, 200)); });
  const S = n => p.screenshot({ path: `qa/z_${n}.png` });
  await p.goto('http://127.0.0.1:8817/index.html?nc=' + Date.now(), { waitUntil: 'load' }); await p.waitForTimeout(2500);
  await S('attract');
  await p.mouse.click(195, 420); await p.waitForTimeout(500); await S('menu');
  console.log('MENU', await p.evaluate(() => __cg.Game.state));
  // human comp path, no QA bot: ready state must see clean human input
  await p.click('#mOne'); await p.waitForTimeout(200);
  await p.locator('.evb').nth(2).click(); await p.waitForTimeout(200);
  await p.click('#pGo'); await p.waitForTimeout(600);
  console.log('READY_LEAK', JSON.stringify(await p.evaluate(() => ({ st: __cg.Game.state, inHeld: Object.entries(__cg.In.held).filter(e => e[1]).map(e => e[0]), ax: __cg.In.ax, ay: __cg.In.ay, human: Object.entries(__cg.human.key).filter(e => e[1]).map(e => e[0]) }))));
  await S('ready');
  await p.evaluate(() => { __cg.QA.bot = true; __cg.QA.speed = 2; });
  for (const t of [2500, 5000, 8000, 11000]) { await p.waitForTimeout(t === 2500 ? 2500 : 3000); await S('surf' + t); }
  console.log('SURF', JSON.stringify(await p.evaluate(() => ({ st: __cg.Game.state, sc: __cg.R.score, log: __cg.QLOG.splice(0).slice(-6) }))));
  await p.keyboard.press('KeyH'); await p.waitForTimeout(1200); await S('16bit'); await p.keyboard.press('KeyH');
  await p.evaluate(() => { __cg.QA.speed = 5; });
  let st; for (let k = 0; k < 60; k++) { st = await p.evaluate(() => __cg.Game.state); if (st === 'awards') break; await p.waitForTimeout(1000); }
  await p.waitForTimeout(1500); await S('podium'); console.log('PODIUM', st);
  // thumb frame: 1280x720 half pipe gameplay
  await p.setViewportSize({ width: 1280, height: 720 }); await p.evaluate(() => { __cg.QA.speed = 1; __cg.startComp('practice', [0]); }); await p.waitForTimeout(5000); await S('thumb1280');
  console.log('ERRS', JSON.stringify(errs.slice(0, 10)));
  await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
