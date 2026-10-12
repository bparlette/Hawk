// node fshot.js <port> <out.png> <query> [w h dpr] -> close-up fight beat, screenshot of the game screen
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, q, w = '1280', h = '720', dpr = '1'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 1000;
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('response', (r) => { if (r.status() >= 400) errs.push('http' + r.status() + ': ' + r.url()); });
  await p.goto('https://shellshock-free16-city.surge.sh/' + q);
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 40000 });
  await p.evaluate(() => { __ss.STATE.banner = null; });
  await p.evaluate(() => { const S = __ss.STATE, P = S.player; const es = S.enemies.slice().sort((a, b) => Math.abs(a.x - P.x) + Math.abs(a.y - P.y) - Math.abs(b.x - P.x) - Math.abs(b.y - P.y));
    es.slice(0, 2).forEach((e, i) => { e.x = P.x + (i ? -44 : 40); e.y = P.y + (i ? 6 : -2); e.idle = false; e.home = false; e.post = { x: e.x, y: e.y }; }); });
  await p.waitForTimeout(1500);
  let ok = false; const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    await p.keyboard.press('j'); await p.waitForTimeout(90);
    ok = await p.evaluate(() => { const S = __ss.STATE, P = S.player; const near = S.enemies.filter((e) => !e.idle && Math.hypot(e.x - P.x, (e.y - P.y) * 3) < 75); const up = near.filter((e) => ['walk', 'hurt', 'attack', 'grab'].includes(e.state)); return up.length >= 1 && !P.grabbedBy && P.attackT > 3 && P.attackT < 16 && up.some((e) => e.state === 'hurt'); });
    if (ok) break;
  }
  const el = await p.$('#screen'); await el.screenshot({ path: out });
  const info = await p.evaluate(() => ({ gl: [document.getElementById('gl').width, document.getElementById('gl').height, document.getElementById('gl').style.width, document.getElementById('gl').style.height], sw: document.documentElement.scrollWidth, iw: innerWidth, fe: window.__frameErrors && __frameErrors.n }));
  console.log(out, ok, JSON.stringify(info), 'ERRORS', errs.length, errs.slice(0, 5).join(' | '));
  await b.close();
})();
