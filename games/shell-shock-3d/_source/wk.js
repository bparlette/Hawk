const pw = require('/workspace/work/freeze_test/node_modules/playwright');
(async () => {
  const b = await pw.webkit.launch();
  for (const [w, h, q] of [[390, 844, ''], [390, 844, '?shot=lobby&nolock'], [844, 390, '?shot=fire&nolock']]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await c.newPage(); const errs = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('PE ' + e.message));
    await p.goto('http://127.0.0.1:8833/' + q); await p.waitForTimeout(7000);
    console.log(w, h, q, JSON.stringify(await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sc: __ss.STATE.scene, fe: window.__frameErrors.n }))), 'errors', errs.length);
    await c.close();
  }
  await b.close();
})();
