const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => { const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/youtube|ytimg|google|bandcamp|Failed to load resource|GPU|swiftshader/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await p.goto('https://toad-city-chipkid.surge.sh/?nointro=1&duel=chipkid&duelbot=win&sim=2', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForFunction(() => window.__duels && __duels.cur && __duels.t > 8, null, { timeout: 240000 });
  const s = await p.evaluate(() => ({ cur: __duels.cur.id, t: __duels.t.toFixed(1), log: __duels.log.slice(-4), body: document.body.className }));
  await p.screenshot({ path: '/workspace/work/ck_tmp/preview_live_390.png' }); console.log(JSON.stringify(s)); console.log('ERRORS', errs.length, errs.slice(0, 5).join(' | ')); await b.close(); })();
