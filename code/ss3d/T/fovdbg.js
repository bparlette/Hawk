const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [w, h, fill] of [[390, 844, 0], [390, 844, 1], [1280, 720, 0], [844, 390, 1]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < h || w > 2 * h, hasTouch: w < h || w > 2 * h });
    const p = await c.newPage();
    await p.goto('http://127.0.0.1:8833/?shot=street&nolock');
    await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage', null, { timeout: 60000 });
    if (fill) await p.evaluate(() => { document.documentElement.classList.add('fill'); dispatchEvent(new Event('resize')); });
    await p.waitForTimeout(2500);
    console.log(w, h, fill, await p.evaluate(() => { const c = __ss.cam; return { fov: c.fov, efov: c.__efov, a: c.aspect, vf: 2 * Math.atan(1 / c.projectionMatrix.elements[5]) * 180 / Math.PI, hf: 2 * Math.atan(1 / c.projectionMatrix.elements[0]) * 180 / Math.PI }; }));
    await c.close();
  }
  await b.close();
})();
