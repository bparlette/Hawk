// node fin.js <port> <outPrefix> <w> <h> [sim]  -- clean tag-team finisher frames (one south-arm thug left, both turtles) for bakeoff-cinema-finisher.png
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, pre, w = '1280', h = '720', sim = '2'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const wf = (fn, arg, t = 300000) => p.waitForFunction(fn, arg, { timeout: t, polling: 50 });
  const ev = (fn, a) => p.evaluate(fn, a);
  const shot = async (n) => { await ev(() => { __cel.pause = true; document.getElementById('proto').classList.remove('open'); }); await p.waitForTimeout(300); await p.screenshot({ path: pre + n + '.png', timeout: 120000 }); await ev(() => { __cel.pause = false; }); };
  await p.goto(`http://127.0.0.1:${port}/?sim=${sim}&nointro=1`);
  await wf(() => window.__cel && __cel.frames > 3);
  await ev(() => { const C = __cel; C.hero.inv = 1e9; for (const e of C.enemies) if (e.id !== 0) { e.set('dead'); e.root.visible = false; e.respawn = 1e9; }
    const H = C.hero, P = C.partner; H.pos.set(-2.8, 0, 19.6); H.yaw = Math.PI; P.pos.set(-5.0, 0, 21.0); });
  let q = null;
  for (let k = 0; k < 120 && !q; k++) {
    await ev(() => { const C = __cel, H = C.hero, e = C.enemies.find((e) => e.id === 0);
      if (e && e.alive && e.state !== 'dizzy' && Math.hypot(e.pos.x - H.pos.x, e.pos.z - H.pos.z) > 1.8) { H.pos.x = e.pos.x; H.pos.z = e.pos.z + 1.4; } C.press('j'); });
    await p.waitForTimeout(250);
    q = await ev(() => __cel.QTE && __cel.QTE.e.state === 'dizzy' && Math.hypot(__cel.partner.pos.x - __cel.QTE.e.pos.x, __cel.partner.pos.z - __cel.QTE.e.pos.z) < 8.5 && (__cel.partner.state === 'move' || __cel.partner.state === 'atk') ? { id: __cel.QTE.e.id } : null);
  }
  await p.waitForTimeout(150); await ev(() => __cel.press('e'));
  await wf(() => !!__cel.CINE.fin, null, 60000).catch(() => {});
  const tagged = await ev(() => !!(__cel.CINE.fin && __cel.CINE.fin.tag));
  await wf(() => !__cel.CINE.fin || __cel.CINE.fin.tagHit); await wf(() => !__cel.CINE.fin || __cel.CINE.fin.t > __cel.CINE.fin.tagHit + 0.04); await shot('hit');
  await wf(() => !__cel.CINE.fin || __cel.CINE.fin.t > 1.25); await shot('flip');
  await wf(() => !__cel.CINE.fin || __cel.CINE.fin.t > 1.45); await shot('flip2');
  await wf(() => !__cel.CINE.fin && __cel.hero.state === 'move');
  console.log('fin', JSON.stringify({ q, tagged, tags: await ev(() => __cel.CINE.stats.tags), finishers: await ev(() => __cel.CINE.stats.finishers) }));
  console.log('ERRORS', errs.length, errs.slice(0, 5).join('\n')); await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
