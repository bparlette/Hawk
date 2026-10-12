// Gallery screenshots at 390x844 @3x: title + one action shot per stage (+ story card, continue, ending)
const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
const OUT = '/workspace/work/tip/shots/';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome', args: ['--use-gl=swiftshader'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const errs = [];
  const cases = [
    ['title', '?mute', null, 2500],
    ['story', '?mute', null, 0, true, async p => { await p.keyboard.press('Enter'); await p.waitForTimeout(5000); }],
    ['stage1', '?mute&stage=1&bot&god&speed=6', () => GT.scene.st.boss && GT.scene.st.boss.y > 90, 1200],
    ['stage1dock', '?mute&stage=1&bot&god&speed=6', () => GT.scene.st.phase === 'dock' && GT.scene.st.endT > 1.5, 300],
    ['stage2', '?mute&stage=2&bot&god&speed=6', () => GT.scene.st.wave === 2 && GT.scene.st.en.length >= 3, 900],
    ['stage2boss', '?mute&stage=2&bot&god&speed=6', () => GT.scene.st.wave === 4 && GT.scene.st.boss, 2500],
    ['stage3', '?mute&stage=3&bot&god&speed=6', () => GT.scene.st.boss && GT.scene.st.boss.t > 3, 800],
    ['stage3jet', '?mute&stage=3&bot&god&speed=6', () => GT.scene.st.ph === 'B' && GT.scene.st.phT > 6, 600],
    ['stage4', '?mute&stage=4&bot&god&speed=6', () => GT.scene.st.P.y < 1000, 700],
    ['stage4boss', '?mute&stage=4&bot&god&speed=6', () => GT.scene.st.boss && GT.scene.st.boss.t > 2, 600],
    ['stage5', '?mute&stage=5&bot&god&speed=6', () => GT.scene.st.wave === 1 && GT.scene.st.en.length >= 2, 900],
    ['stage5boss', '?mute&stage=5&bot&god&speed=6', () => GT.scene.st.wave === 4 && GT.scene.st.P && GT.sceneT > 0 && GT.scene.st.en !== undefined && window.__plTaxi, 300],
    ['ending', '?mute&stage=5&bot&god&speed=8', () => GT.sceneName === 'ending' && GT.sceneT > 6, 0, true],
    ['continue', '?mute&stage=1&speed=1', null, 0, false, async p => { await p.evaluate(() => { GT.state.lives = 0; GT.loseLife(); }); await p.waitForTimeout(1500); }],
  ];
  for (const [name, q, cond, settle, keepSpeed, act] of cases) {
    if (only && !only.includes(name)) continue;
    const p = await c.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('file:///workspace/work/tip/site/index.html' + q);
    await p.waitForTimeout(1500);
    if (act) await act(p);
    if (cond) {
      const t0 = Date.now(); let ok = false;
      while (Date.now() - t0 < 240000) { ok = await p.evaluate(cond).catch(() => false); if (ok) break; await p.waitForTimeout(300); }
      if (!ok) console.log(name, 'condition timeout');
      if (!keepSpeed) await p.evaluate(() => { GT.speed = 1; });
    }
    await p.waitForTimeout(settle);
    await p.screenshot({ path: OUT + name + '.png' });
    console.log('shot', name, await p.evaluate(() => GT.sceneName));
    await p.close();
  }
  console.log('ERRORS', errs.length, errs.join('\n'));
  await b.close();
})();
