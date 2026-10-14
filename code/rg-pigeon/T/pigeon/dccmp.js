// node T/pigeon/dccmp.js <portA> <portB> <w> <h>: city draw calls at fixed spots, A B A B; thugs hidden + sim paused while measuring
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [pa, pb, w = '390', h = '844'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const one = async (port) => { const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&tod=0.1`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
    const r = await p.evaluate(async () => { const C = __cel, R = C.renderer, out = []; const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const [x, z, y] of [[-45, -32.6, Math.PI / 2], [-12, -33, 0], [-12, -33, Math.PI], [19, -33, Math.PI / 2], [-70, 0, 0]]) { C.pause = false; C.hero.pos.set(x, C.groundY(x, z), z); C.partner.pos.set(x - 1, C.groundY(x, z), z - 1.5); C.CAM.yaw = -y;
        await new Promise((r) => setTimeout(r, 3000)); C.pause = true; for (const e of C.enemies) e.root.visible = false; await raf();
        R.info.autoReset = false; R.info.reset(); await raf(); out.push(R.info.render.calls); R.info.autoReset = true; R.info.reset(); }
      C.pause = false; return out; });
    await p.close(); return { port, r, sum: r.reduce((a, b) => a + b, 0), errs: errs.length }; };
  for (const port of [pa, pb, pa, pb]) console.log(JSON.stringify(await one(port)));
  await b.close();
})();
