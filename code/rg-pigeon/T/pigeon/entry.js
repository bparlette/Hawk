// node T/pigeon/entry.js <port> <w> <h> <shot.png>: city -> WTC base ring -> ACT label -> ACT -> climb starts -> LEAVE -> back on the street, WTC intact
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, w = '390', h = '844', shot = '-'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob })).newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&tod=0.1`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
  await p.evaluate(() => { const C = __cel; C.hero.pos.set(-12, C.groundY(-12, -31.2), -31.2); C.hero.yaw = Math.PI; C.CAM.yaw = 0; });
  await p.waitForTimeout(2500);
  const a = await p.evaluate(() => { const c = __cel.actContext(); return { label: c && c.label, kind: c && c.kind, hero: [__cel.hero.pos.x.toFixed(1), __cel.hero.pos.z.toFixed(1)], btn: (document.getElementById('albl-c') || {}).textContent, aact: (document.getElementById('aact') || {}).textContent }; });
  console.log('AT RING', JSON.stringify(a));
  if (shot !== '-') await p.screenshot({ path: shot });
  await p.keyboard.press('e'); await p.waitForTimeout(2500);
  const s = await p.evaluate(() => ({ cur: __duels.cur && __duels.cur.id, body: document.body.className, part: __pigeon.st && __pigeon.st.part }));
  console.log('AFTER ACT', JSON.stringify(s));
  await p.evaluate(() => __duels.exit('leave')); await p.waitForTimeout(1500);
  const e = await p.evaluate(() => { const L = __cel.scene.children.length; const wtc = __cel.LANDMARKS.find((l) => l.id === 'wtc'); return { cur: !!__duels.cur, hero: [__cel.hero.pos.x.toFixed(1), __cel.hero.pos.z.toFixed(1)], body: document.body.className, act: (__cel.actContext() || {}).label, wtcCleared: !!(wtc.boss && wtc.boss.cleared) }; });
  console.log('AFTER LEAVE', JSON.stringify(e));
  console.log('ERRORS', errs.length, errs.slice(0, 8).join('\n')); await b.close();
})();
