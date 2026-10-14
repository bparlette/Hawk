// node qa/smoke.js <tag> : attract + menu + one event start at 390x844 and 1280x720
const { chromium } = require('/workspace/work/trailer_v2/node_modules/playwright');
const tag = process.argv[2] || 's';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
  const out = {};
  for (const [w, h] of [[390, 844], [1280, 720]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: w < 600, isMobile: w < 600 });
    const errs = []; p.on('pageerror', e => errs.push('PE ' + String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
    await p.goto('http://127.0.0.1:8817/index.html?nc=' + Date.now(), { waitUntil: 'load' });
    await p.waitForTimeout(4500);
    await p.screenshot({ path: `qa/${tag}_${w}_attract.png` });
    await p.keyboard.press('KeyQ'); await p.waitForTimeout(400);
    await p.screenshot({ path: `qa/${tag}_${w}_menu.png` });
    await p.click('#mAll'); await p.waitForTimeout(300); await p.click('#pGo'); await p.waitForTimeout(1200);
    await p.screenshot({ path: `qa/${tag}_${w}_ready.png` });
    await p.keyboard.press('Space'); await p.waitForTimeout(600);
    for (let i = 0; i < 14; i++) { await p.keyboard.down('ArrowDown'); await p.waitForTimeout(250); await p.keyboard.up('ArrowDown'); await p.keyboard.down('ArrowUp'); await p.waitForTimeout(250); await p.keyboard.up('ArrowUp'); }
    await p.screenshot({ path: `qa/${tag}_${w}_play.png` });
    out[w] = { errs, st: await p.evaluate(() => ({ s: __cg.Game.state, score: __cg.R.score, falls: __cg.R.falls, fr: __cg.frames() })) };
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
