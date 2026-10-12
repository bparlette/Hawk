const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///workspace/work/tip/site/index.html?stage=' + (process.env.ST || 2) + '&bot&mute&speed=6' + (process.env.GOD ? '&god' : ''));
  for (let i = 0; i < +(process.env.N || 10); i++) {
    await p.waitForTimeout(3000);
    console.log(JSON.stringify(await p.evaluate(() => { const st = GT.scene.st; if (!st || !st.P) return GT.sceneName; const P = st.P; return { cam: st.camX | 0, lock: st.lockX, wave: st.wave, P: [P.x | 0, P.y | 0, P.s, P.hp | 0, P.face], inp: [GT.inp.x, GT.inp.y], en: st.en.map(e => [e.kind, e.x | 0, e.y | 0, e.s, e.hp]) }; })));
  }
  await b.close();
})();
