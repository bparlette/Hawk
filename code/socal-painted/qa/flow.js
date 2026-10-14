// node qa/flow.js : full competition (1 human + CPU) with the bot at 4x, awards after each event, champion; restart x10; attract handover
const { chromium } = require('/workspace/work/trailer_v2/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('PE ' + String(e.stack || e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|GL Driver/.test(m.text()))) errs.push(m.type() + ' ' + m.text().slice(0, 200)); });
  await p.goto('http://127.0.0.1:8817/index.html?nc=' + Date.now(), { waitUntil: 'load' }); await p.waitForTimeout(2500);
  // attract → handover: bot inputs must not leak
  const before = await p.evaluate(() => ({ st: __cg.Game.state, botHeld: Object.values(__cg.bot.held).some(Boolean) }));
  await p.keyboard.press('KeyQ'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ st: __cg.Game.state, inHeld: Object.values(__cg.In.held).some(Boolean), botHeld: Object.values(__cg.bot.held).some(Boolean) }));
  console.log('HANDOVER', JSON.stringify({ before, after }));
  await p.click('#mAll'); await p.waitForTimeout(200); await p.click('#pGo'); await p.waitForTimeout(500);
  // restart x10 via pause menu
  for (let i = 0; i < 10; i++) { await p.keyboard.press('KeyP'); await p.waitForTimeout(120); await p.click('#psRetry'); await p.waitForTimeout(150); }
  console.log('RESTART10', JSON.stringify(await p.evaluate(() => ({ st: __cg.Game.state, sc: __cg.R.score, f: __cg.R.falls, q: 0 }))));
  await p.evaluate(() => { __cg.QA.bot = true; __cg.QA.speed = 5; });
  for (let ev = 0; ev < 6; ev++) {
    let st; for (let k = 0; k < 80; k++) { st = await p.evaluate(() => __cg.Game.state); if (st === 'awards' || st === 'champ') break; await p.waitForTimeout(1000); }
    await p.waitForTimeout(800); await p.screenshot({ path: `qa/flow_awards_${ev}.png` });
    console.log('AWARDS', ev, st, JSON.stringify(await p.evaluate(() => __cg.Comp.players.map(p => p.name + ':' + p.scores.join('/') + ' pts' + p.points))));
    if (ev < 5) await p.click('#awNext'); else { await p.click('#awNext'); await p.waitForTimeout(1500); await p.screenshot({ path: 'qa/flow_champ.png' }); console.log('CHAMP', await p.evaluate(() => __cg.Game.state + ' ' + document.getElementById('chT').textContent)); }
  }
  console.log('ERRS', JSON.stringify(errs.slice(0, 10)));
  await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
