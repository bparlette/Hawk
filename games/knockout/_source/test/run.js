// usage: node run.js <url> <mode desktop|mobile> <outPrefix> [maxSec]
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [url, mode = 'desktop', pre = '/tmp/ko_', maxS = '150'] = process.argv.slice(2);
  const mob = mode === 'mobile';
  const b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext(mob ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto(url); await p.waitForTimeout(800);
  if (mob) await p.evaluate(() => { window.__botMobile = true; });
  await p.evaluate(fs.readFileSync(__dirname + '/bot_inpage.js', 'utf8'));
  const t0 = Date.now(); let lastLog = 0;
  while ((Date.now() - t0) / 1000 < +maxS) {
    await p.waitForTimeout(60);
    const s = await p.evaluate(() => { const S = __ko.S; return { sc: S.scene, ph: S.phase, hold: S.holdFor, hf: __bot.holdFor, done: __bot.done, o: S.opp && (S.opp.state + '/' + S.opp.atk + ' hp' + S.opp.hp + ' kd' + S.opp.kd), h: S.hero && (S.hero.state + ' hp' + S.hero.hp + ' ht' + S.hero.hearts + ' st' + S.hero.stars + (S.hero.tired ? ' TIRED' : '')), clock: S.clock && S.clock.toFixed(0), res: S.result, cnt: __bot.counters, fe: __frameErrors.n, fel: __frameErrors.last.slice(0, 300) }; });
    if (s.hf) {
      await p.waitForTimeout(120);
      const name = { intro: 'shot-intro', fight: 'shot-fight', ko: 'shot-ko' }[s.hf];
      await p.locator('#screen').screenshot({ path: pre + name + '.png' }); console.log('SHOT', name, s.o);
      await p.screenshot({ path: pre + name + '-page.png' });
      await p.evaluate((n) => { __bot.taken[n] = true; __bot.holdFor = null; __ko.S.hold = false; }, s.hf);
    }
    if (Date.now() - lastLog > 3000) { lastLog = Date.now(); console.log(((Date.now() - t0) / 1000 | 0) + 's', JSON.stringify(s)); }
    if (s.done) { await p.waitForTimeout(1500); await p.locator('#screen').screenshot({ path: pre + 'shot-end.png' }); await p.screenshot({ path: pre + 'end-page.png' }); console.log('RESULT', JSON.stringify(s.res), JSON.stringify(s.cnt)); break; }
  }
  const lay = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, canvas: (() => { const r = document.querySelector('#screen').getBoundingClientRect(); return [r.width, r.height, document.querySelector('#screen').width]; })(), pad: getComputedStyle(document.querySelector('#pad')).display, fe: __frameErrors }));
  console.log('LAYOUT', JSON.stringify(lay));
  console.log('ERRORS', errs.length); console.log(errs.slice(0, 20).join('\n'));
  await b.close();
})();
