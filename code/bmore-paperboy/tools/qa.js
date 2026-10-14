// node tools/qa.js <port> <w> <h> <plan> : headless QA for Toad City Paperboy (SwiftShader). plan: smoke | week | lose | god
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const [port = '8793', w = '1280', h = '720', plan = 'smoke'] = process.argv.slice(2);
const out = __dirname + '/../qa/shots'; fs.mkdirSync(out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), `${w}x${h}`, plan, ...a);
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 900;
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|ReadPixels/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 300) + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  const q = plan === 'god' ? '?god=1' : '';
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/index.html${q}`);
  await p.waitForFunction(() => window.__pb && __pb.ready && __pb.frames > 3, null, { timeout: 120000 }).catch(() => errs.push('boot timeout'));
  log('boot ms', Date.now() - t0);
  const S = () => p.evaluate(() => __pb.stats());
  const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${w}x${h}-${plan}-${n}.png` }); };
  const fps = async (ms) => { await p.evaluate(() => { __pb.f0 = __pb.frames; __pb.t0 = performance.now(); }); await p.waitForTimeout(ms); return p.evaluate(() => +((__pb.frames - __pb.f0) / ((performance.now() - __pb.t0) / 1000)).toFixed(1)); };
  try {
    await p.waitForTimeout(1500); await shot('01-title'); log('title fps', await fps(3000), JSON.stringify(await S()));
    // start through the real button, then the day card's button
    if (mob) await p.tap('#startB'); else await p.click('#startB');
    await p.waitForTimeout(800); await shot('02-daycard'); log('daycard', JSON.stringify(await S()));
    await p.waitForTimeout(500); if (mob) await p.tap('#cardBtn'); else await p.click('#cardBtn');
    await p.waitForTimeout(300); log('riding', JSON.stringify(await S()));
    await p.evaluate((pl) => __pb.setBot(pl === 'lose' ? 'lose' : '1'), plan);
    await p.waitForTimeout(2500); await shot('03-ride'); log('ride fps (real render)', await fps(4000), JSON.stringify(await S()));
    if (plan === 'smoke') { await p.evaluate(() => __pb.advance(9)); await shot('04-ride-mid'); log('mid', JSON.stringify(await S())); }
    if (plan === 'week' || plan === 'god' || plan === 'smoke') {
      let lastDay = -1, n = 0, seen = new Set();
      while (n++ < 400) {
        const st = await p.evaluate(() => { for (let i = 0; i < 6; i++) { __pb.advance(1); const s = __pb.S; if (document.getElementById('card').classList.contains('on')) break; } return __pb.stats(); });
        const key = st.mode + ':' + st.day + ':' + (st.card || '');
        if (st.card && !seen.has(key)) { seen.add(key); log('card', st.card.slice(0, 60), JSON.stringify({ day: st.day, score: st.score, lives: st.lives, subs: st.subs, st: st.st })); if (seen.size <= 6 || /OVER|COMPLETE|GAME/.test(st.card)) await shot('05-card-' + seen.size); }
        if (st.mode === 'bonus' && !seen.has('bshot' + st.day) && st.x > 0) { seen.add('bshot' + st.day); if (st.day === 0) await shot('06-bonus'); }
        if (st.mode === 'ride' && st.day !== lastDay) { lastDay = st.day; if (st.day === 3 || st.day === 6) { await p.evaluate(() => __pb.advance(12)); await shot('07-day' + st.day); } }
        if (st.mode === 'over' && st.card) break;
        if (plan === 'smoke' && st.day >= 1) break;
      }
      log('end', JSON.stringify(await S()));
    }
    if (plan === 'lose') {
      let st; for (let i = 0; i < 60; i++) { st = await p.evaluate(() => { __pb.advance(1); return __pb.stats(); }); if (st.mode === 'over') break; }
      await shot('08-gameover'); log('gameover', JSON.stringify(st));
      await p.waitForTimeout(700); if (mob) await p.tap('#cardBtn'); else await p.click('#cardBtn');
      await p.waitForTimeout(600); const r = await S(); await shot('09-retry'); log('after retry', JSON.stringify(r), r.day === 0 && r.lives === 3 && r.score === 0 && /MONDAY/.test(r.card || '') ? 'RETRY_OK' : 'RETRY_FAIL');
    }
    const dom = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
    log('dom', JSON.stringify(dom)); log('events', JSON.stringify(await p.evaluate(() => __pb.log.filter((l) => /crash|gameover|win|tally|bonus:/.test(l)))));
  } catch (e) { errs.push('qa: ' + e.message); }
  log('ERRORS', errs.length, errs.slice(0, 12).join('\n'));
  await b.close();
})();
