const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => { const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const u of process.argv.slice(2)) { const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await c.newPage(); await p.goto(u); await p.waitForTimeout(4000);
    const r = await p.evaluate(() => { const o = []; for (const e of document.querySelectorAll('body *')) { const R = e.getBoundingClientRect(); if (R.right > 391 && R.width > 0) o.push(e.tagName + '#' + e.id + '.' + e.className + ' ' + Math.round(R.left) + '-' + Math.round(R.right)); } return { o: o.slice(0, 8), sx: (scrollTo(200, 0), scrollX), bw: document.body.scrollWidth }; });
    console.log(u, JSON.stringify(r)); await c.close(); } await b.close(); })();
