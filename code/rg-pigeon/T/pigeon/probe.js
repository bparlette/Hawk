const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => { const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
 const p = await (await b.newContext({ viewport: { width: 400, height: 400 } })).newPage();
 await p.goto('http://127.0.0.1:8791/?nointro=1'); await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 90000 });
 const r = await p.evaluate(() => { const o = []; for (const [x, z] of [[-12,-30.5],[-12,-31.5],[-12,-14.2],[-12,-13],[-3.2,-22.5],[-20.8,-22.5],[-4,-28],[-20,-28]]) o.push([x, z, __cel.isWater(x, z), +__cel.groundY(x, z).toFixed(2), __cel.COLL.some(c=>c.r&&Math.hypot(c.x-x,c.z-z)<c.r+0.4)]); return o; });
 console.log(JSON.stringify(r)); await b.close(); })();
