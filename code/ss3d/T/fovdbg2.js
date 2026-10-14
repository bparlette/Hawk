const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8833/?shot=street&nolock');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage', null, { timeout: 60000 });
  await p.evaluate(() => { document.documentElement.classList.add('fill'); dispatchEvent(new Event('resize')); });
  await p.waitForTimeout(2500);
  console.log(await p.evaluate(() => { const c = __ss.cam; const r = []; for (let i = 0; i < 3; i++) { c.fov = 55; c.updateProjectionMatrix(); r.push([c.__efov, c.fov, c.aspect, c.zoom, c.view && JSON.stringify(c.view)]); } r.push(window.__pfdbg()); { c.fov=55; const A=384/224, a=c.aspect, k=Math.pow(A/a,0.7); r.push([k, 2*Math.atan(Math.tan(55*Math.PI/360)*k)*360/Math.PI]); } r.push(__ss.STATE.scene, __ss.CAMS.mode, __ss.CAMS.chaseK); return r; }));
  await b.close();
})();
