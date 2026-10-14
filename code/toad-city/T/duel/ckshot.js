// node T/duel/ckshot.js <port> <w> <h> <outprefix> [moments=hit,special:mallet,ko]: plays the Chip Kid with the win bot and freezes (DUELS.hold) at each moment for a screenshot
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, w, h, pre, ms = 'hit,special:mallet,ko'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&duel=chipkid&duelbot=win&sim=2`);
  await p.waitForFunction(() => window.__duels && __duels.cur, null, { timeout: 90000 });
  for (const m of ms.split(',')) {
    await p.evaluate((m) => { window.__ckShot = m; __duels.hold = false; }, m);
    try { await p.waitForFunction(() => __duels.hold === true, null, { timeout: 400000, polling: 200 }); } catch (e) { console.log('MISS', m); continue; }
    await p.waitForTimeout(400); const at = await p.evaluate(() => window.__ckShotAt);
    await p.screenshot({ path: pre + '_' + m.replace(':', '_') + '.png' }); console.log('SHOT', m, at);
  }
  await p.evaluate(() => { __duels.hold = false; }); console.log('ERR', errs.length, errs.slice(0, 5).join(' | ')); await b.close();
})();
