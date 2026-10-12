// node probe.js <port> <query> <ms> [w h] [shot.png] : print __celErr + state
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => { const [port, q = '', ms = '4000', w = '1280', h = '720', shot] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob }); const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 600)); }); p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto(`http://127.0.0.1:${port}/${q}`); await p.waitForTimeout(+ms);
  console.log(JSON.stringify(await p.evaluate(() => ({ err: window.__celErr, f: window.__cel && __cel.frames, t: window.__cel && __cel.S.time, fps: window.__cel && __cel.FPS.v,
    sw: document.documentElement.scrollWidth, iw: innerWidth })))); console.log(errs.join('\n'));
  if (shot) await p.screenshot({ path: shot });
  await b.close(); })();
