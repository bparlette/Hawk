const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
const [STG, FROM, TO] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 270, height: 480 } })).newPage();
  await p.goto(`file:///workspace/work/shorts/gulf-thunder/game/index.html?capture&mute&god&bot&stage=${STG}&seed=3`);
  await p.waitForFunction(() => window.__cap && window.GT && GT.scene);
  await p.evaluate(n => { let k = n; while (k > 0) { __cap.step(Math.min(k, 600)); k -= 600; } }, +FROM);
  const r = await p.evaluate(to => { const out = []; let last = ''; while (__steps < to) { __cap.step(1); const st = GT.scene.st || {}; const bs = st.boss;
    const s = bs ? (Math.round(bs.hp) + (bs.dead ? 'D' : '') + (bs.s ? bs.s : '')) : '-'; const fl = GT.flashT > 0 ? 'F' : '';
    const key = s + fl + (st.bannerT > 0 ? st.banner : ''); if (key !== last) { out.push(__steps + ' ' + key); last = key; } } return out; }, +TO);
  console.log(STG, r.join(' | '));
  await b.close();
})();
