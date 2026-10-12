const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch(); const errs = []; const c = await b.newContext({ viewport: { width: 1024, height: 768 } }); const p = await c.newPage();
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  await p.goto('http://127.0.0.1:8871/?room=library&x=40&y=180&noflicker&seed=8'); await p.waitForTimeout(500);
  await p.evaluate(() => { __hm.G.threatFirst = true; __hm.G.check = { room: 'grand', x: 128, y: 90 }; __hm.spawnThreat(200, 60); __hm.face('down'); });
  await p.keyboard.press('f'); await p.waitForTimeout(9000); const s1 = await p.evaluate(() => __hm.state()); await p.locator('#c').screenshot({ path: '/tmp/c_over.png' });
  await p.keyboard.press('e'); await p.waitForTimeout(400); const s2 = await p.evaluate(() => __hm.state());
  // repel test
  await p.evaluate(() => { __hm.G.lightUser = true; __hm.goto('library', 40, 180); __hm.spawnThreat(150, 180); __hm.face('right'); __hm.aim(0); });
  await p.waitForTimeout(1800); const s3 = await p.evaluate(() => __hm.state());
  console.log(JSON.stringify({ s1: s1.state, catches: s1.catches, s2: [s2.state, s2.room], s3threat: s3.threat, errs }));
  await b.close();
})();
