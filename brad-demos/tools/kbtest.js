// node tools/kbtest.js <port>: desktop keyboard goes straight into the picked game (iframe focused on pick),
// plus a landscape-phone screenshot (844x390) of a running game.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let c = await b.newContext({ viewport: { width: 1280, height: 800 } });
  let p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/`); await p.waitForSelector('.card');
  await p.click('.card[data-id="hollow-manor"]');
  await p.waitForFunction(() => (window.__demoLog || []).filter((l) => / autostart hollow-manor /.test(l)).length >= 3, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(500); await p.keyboard.up('ArrowLeft'); await p.keyboard.press('f');
  const f = p.frames().find((x) => x.url().includes('/g/hollow-manor/'));
  const kl = await f.evaluate(() => window.__demo.keylog.slice(-6));
  const focusIn = await p.evaluate(() => document.activeElement && document.activeElement.tagName);
  console.log((kl.includes('d:ArrowLeft') && kl.includes('d:KeyF') ? 'PASS' : 'FAIL') + ' desktop keyboard reaches the game', JSON.stringify({ kl, focusIn }));
  // click on the top bar (focus moves to the shell) -> keys are forwarded by the shell
  await p.click('#title'); await p.keyboard.press('ArrowRight');
  const kl2 = await f.evaluate(() => window.__demo.keylog.slice(-2));
  console.log((kl2.includes('d:ArrowRight') ? 'PASS' : 'FAIL') + ' keys forwarded when focus is on the shell', JSON.stringify(kl2));
  await c.close();
  c = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/#shell-shock-16bit`);
  await p.waitForFunction(() => (window.__demoLog || []).filter((l) => / autostart /.test(l)).length >= 5, null, { timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'T/test-landscape.png' });
  const s = await p.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, stage: document.getElementById('stage').getBoundingClientRect().height, panel: document.getElementById('panel').getBoundingClientRect().height }));
  console.log((s.sh <= s.ih && s.sw <= s.iw ? 'PASS' : 'FAIL') + ' landscape no scroll', JSON.stringify(s));
  console.log('shell pageerrors', errs.length, errs.slice(0, 3));
  await b.close();
})().catch((e) => console.log('FATAL', e.message));
