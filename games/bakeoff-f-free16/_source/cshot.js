// node cshot.js <port> <prefix> <w> <h> <dpr> : screenshots of the game screen at each corner (?shot=ne/nw/se/sw) + sizes + errors
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, pre, w = '1280', h = '720', dpr = '2'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 1000; let errs = [];
  for (const c of ['ne', 'nw', 'se', 'sw']) {
    const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, isMobile: mob, hasTouch: mob });
    const p = await ctx.newPage();
    p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver/.test(m.text())) errs.push(c + ' ' + m.text()); });
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    p.on('response', (r) => { if (r.status() >= 400) errs.push('http' + r.status() + ': ' + r.url()); });
    await p.goto('http://127.0.0.1:' + port + '/?shot=' + c);
    await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 40000 });
    await p.evaluate(() => { __ss.STATE.banner = null; }); await p.waitForTimeout(2500);
    const el = await p.$('#screen'); await el.screenshot({ path: `${pre}_${c}.png` });
    if (c === 'ne') await p.screenshot({ path: `${pre}_page.png` });
    const info = await p.evaluate(() => ({ gl: [document.getElementById('gl').width, document.getElementById('gl').height], sw: document.documentElement.scrollWidth, iw: innerWidth, fe: window.__frameErrors && __frameErrors.n }));
    console.log(c, JSON.stringify(info));
    await ctx.close();
  }
  console.log('ERRORS', errs.length, errs.slice(0, 8).join(' | '));
  await b.close();
})();
