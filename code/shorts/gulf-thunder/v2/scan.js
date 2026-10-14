// node scan.js STAGE SEED MAXSTEPS -> per-30-step timeline
const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
const [STG, SEED, MAX] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 270, height: 480 } })).newPage();
  await p.goto(`file:///workspace/work/shorts/gulf-thunder/game/index.html?capture&mute&god&bot&stage=${STG}&seed=${SEED}`);
  await p.waitForFunction(() => window.__cap && window.GT && GT.scene);
  const rows = [];
  for (let s = 0; s < +MAX; s += 30) {
    const r = await p.evaluate(() => { __cap.step(30); const st = GT.scene.st || {}; const f = __cap.sfx();
      return { st: __steps, sc: GT.sceneName, t: st.t && +st.t.toFixed(1), ph: st.phase || st.ph, bn: st.bannerT > 0 ? st.banner : '', en: (st.en || []).length,
        boss: st.boss ? (st.boss.name + ':' + Math.round(st.boss.hp) + (st.boss.dead ? 'D' : '')) : '', mode: st.p ? st.p.mode : (st.P ? st.P.s : ''), sfx: f.map(e => e[1]).join(',') }; });
    rows.push(r);
    if (!/^stage/.test(r.sc)) break;
  }
  for (const r of rows) console.log(r.st, r.sc, r.t, r.ph, r.en, r.boss, r.mode, r.bn ? '[' + r.bn + ']' : '', r.sfx);
  await b.close();
})();
