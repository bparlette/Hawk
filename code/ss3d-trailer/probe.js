const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [q, out, w='1920', h='1080', mob='0'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob==='1', hasTouch: mob==='1' });
  const p = await c.newPage(); const errs=[];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  await p.goto('http://127.0.0.1:8844/' + q);
  await p.waitForFunction(() => window.__cap && __cap.ready(), null, { timeout: 60000 });
  let t0=Date.now();
  for (let i=0;i<20;i++) await p.evaluate(()=>__cap.step(2));
  console.log('20 steps ms', Date.now()-t0);
  t0=Date.now(); await p.screenshot({ path: out, clip:{x:0,y:800,width:1920,height:1080} }); console.log('shot ms', Date.now()-t0);
  console.log(await p.evaluate(()=>({sc:__ss.STATE.scene, layer: __ss.STATE.player && __ss.STATE.player.layer, fe: __frameErrors})));
  console.log('ERR', errs.join('\n'));
  await b.close();
})();
