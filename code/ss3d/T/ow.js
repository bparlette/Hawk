const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => { const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8833/?shot=platform'); await p.waitForTimeout(6000);
  console.log(JSON.stringify(await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: innerWidth }))), 'errs', errs.length);
  await p.screenshot({ path: '/workspace/work/ss3d/T/mob_plat.png' }); await b.close(); })();
