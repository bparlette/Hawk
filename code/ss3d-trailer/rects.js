const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w, h] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8844/?cap&shot=street&nolock');
  await p.waitForFunction(() => window.__cap && __cap.ready(), null, { timeout: 60000 });
  await p.evaluate(()=>__cap.step(2));
  console.log(await p.evaluate(()=>{const o={};for(const id of ['cab','screen','gl','game','stick','cap-a','cap-b','cap-p','fsbtn']){const e=document.getElementById(id); if(!e) continue; const r=e.getBoundingClientRect(); o[id]=[r.x|0,r.y|0,r.width|0,r.height|0];} o.dpr=devicePixelRatio; return JSON.stringify(o);}));
  await b.close();
})();
