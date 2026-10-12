const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///workspace/work/tip/site/index.html?stage=4&bot&god&mute&speed=6');
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(2500);
    console.log(JSON.stringify(await p.evaluate(() => { const st = GT.scene.st, P = st.P; return { x: P.x | 0, y: P.y | 0, on: P.on && [P.on.x, P.on.y, P.on.w, P.on.kind, P.on.row], face: P.face, inp: [GT.inp.x, GT.inp.jumpP], lvl: st.en.filter(e=>!e.dead && Math.abs(e.y-P.y)<40).map(e=>[e.x|0,e.y|0,e.hp]), plats: st.L.plats.filter(q => q.y < P.y + 5 && q.y > P.y - 60).map(q => [q.x, q.y, q.w, q.kind, !!q.main]) }; })));
  }
  await b.close();
})();
