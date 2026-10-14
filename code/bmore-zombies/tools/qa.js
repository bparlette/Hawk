// node tools/qa.js <port> <w> <h> <plan> : headless QA for Toad City: Dead Streets (SwiftShader). plan: smoke | win | lose | perf | shots
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const [port = '8796', w = '1280', h = '720', plan = 'smoke'] = process.argv.slice(2);
const out = __dirname + '/../qa/shots'; fs.mkdirSync(out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), `${w}x${h}`, plan, ...a);
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const CAP = plan === 'capture', mob = +w < 900 && !CAP;
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|ReadPixels/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 300) + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  if (CAP) { // vertical Short frames: a few scenes, sim-stepped 1/15 s per frame (headless renders far below real time)
    const cdir = __dirname + '/../shorts/frames'; fs.mkdirSync(cdir, { recursive: true }); let fi = 0;
    const cdir0 = cdir; for (const f of fs.readdirSync(cdir0)) fs.unlinkSync(cdir0 + '/' + f);
    const scenes = [['?stage=0&god=1&fast=1', 3, 16, 'title'], ['?stage=1&god=1&fast=1', 14, 24], ['?stage=3&god=1&fast=1', 22, 24], ['?stage=5&god=1&fast=1', 13, 40]];
    for (const [qs, pre, n, kind] of scenes) {
      await p.goto(`http://127.0.0.1:${port}/index.html${qs}`); await p.waitForFunction(() => window.__dz && __dz.ready && __dz.frames > 3, null, { timeout: 180000 }).catch(() => errs.push('boot timeout'));
      if (kind !== 'title') { await p.evaluate(() => { __dz.start(); __dz.setBot('1'); }); await p.evaluate((s) => __dz.advance(s), pre); }
      else await p.evaluate((s) => __dz.advance(s), pre);
      for (let i = 0; i < n; i++) { await p.evaluate(() => __dz.advance(1 / 10)); await p.screenshot({ path: `${cdir}/${String(fi++).padStart(4, '0')}.jpg`, quality: 88 });
        if (kind !== 'title' && (await p.evaluate(() => __dz.S.mode)) === 'over') break; }
      log('scene', qs, JSON.stringify(await p.evaluate(() => __dz.stats())), 'frames', fi);
    }
    log('ERRORS', errs.length, errs.slice(0, 12).join('\n')); await b.close(); return;
  }
  const q = { perf: '?stage=5&horde=520&god=1', shots: '?stage=5&god=1', wingod: '?god=1' }[plan] || '';
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/index.html${q}`);
  await p.waitForFunction(() => window.__dz && __dz.ready && __dz.frames > 3, null, { timeout: 180000 }).catch(() => errs.push('boot timeout'));
  log('boot ms', Date.now() - t0);
  const S = () => p.evaluate(() => __dz.stats());
  const shot = async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${w}x${h}-${plan}-${n}.png` }); };
  const fps = async (ms) => { await p.evaluate(() => { __dz.f0 = __dz.frames; __dz.t0 = performance.now(); }); await p.waitForTimeout(ms); return p.evaluate(() => +((__dz.frames - __dz.f0) / ((performance.now() - __dz.t0) / 1000)).toFixed(1)); };
  const tapBtn = async (sel) => { if (mob) await p.tap(sel); else await p.click(sel); };
  try {
    await p.waitForTimeout(1500); await shot('01-title'); log('title (attract) fps', await fps(3000), JSON.stringify(await S()));
    await tapBtn('#startB'); await p.waitForTimeout(700);
    if (await p.evaluate(() => document.getElementById('card').classList.contains('on'))) { await shot('02-intro'); await p.waitForTimeout(500); await tapBtn('#cardBtn'); }
    await p.waitForTimeout(400); log('playing', JSON.stringify(await S()));
    if (plan === 'perf') {
      const sim0 = await p.evaluate(() => { const a = __dz.stats().alive, t = performance.now(); __dz.advance(1); return [a, (performance.now() - t) / 60, __dz.stats().alive]; }); log('sim ms/step (no bot, all alive)', JSON.stringify(sim0), 'zTris', JSON.stringify(await p.evaluate(() => __dz.zTris)));
      await p.evaluate(() => __dz.setBot('1')); await p.evaluate(() => __dz.advance(2)); await p.waitForTimeout(1500);
      log('perf real-render fps', await fps(5000), JSON.stringify(await S())); await shot('03-horde');
      await p.evaluate(() => __dz.advance(6)); log('perf after 6s sim', await fps(4000), JSON.stringify(await S())); await shot('04-horde2');
      const simMs = await p.evaluate(() => { const t = performance.now(); __dz.advance(5); return (performance.now() - t) / 300; }); log('sim ms/step @', JSON.stringify(await S()), simMs.toFixed(2));
    }
    if (plan === 'shots') { await p.evaluate(() => __dz.setBot('1')); for (let i = 0; i < 6; i++) { await p.evaluate(() => __dz.advance(4)); await shot('f' + i); log('shot', i, JSON.stringify(await S())); } }
    if (plan === 'smoke') {
      // a few seconds of real play through the real input: keys + mouse
      if (!mob) { await p.mouse.move(+w * 0.75, +h * 0.4); await p.keyboard.down('d'); await p.mouse.down(); await p.waitForTimeout(2500); await p.mouse.up(); await p.keyboard.up('d'); }
      else { const jl = await p.$('#joyR'); const bb = await jl.boundingBox(); await p.touchscreen.tap(bb.x + bb.width * 0.8, bb.y + bb.height / 2); }
      await shot('03-play'); log('after input', JSON.stringify(await S()));
      await p.evaluate(() => __dz.setBot('1')); await p.evaluate(() => __dz.advance(10)); await shot('04-bot'); log('real-render fps', await fps(4000), JSON.stringify(await S()));
      // pause on hidden tab + blur clears keys
      const pz = await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); const a = __dz.S.paused; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); __dz.togglePause(); return a && !__dz.S.paused; });
      log('pause on hidden', pz ? 'PAUSE_OK' : 'PAUSE_FAIL');
    }
    if (plan === 'win' || plan === 'wingod' || plan === 'smoke') {
      await p.evaluate(() => __dz.setBot('1')); let n = 0, seen = new Set(), deaths = 0, lastStage = -1;
      while (n++ < 900) {
        const st = await p.evaluate(() => { for (let i = 0; i < 5; i++) { __dz.advance(1); if (document.getElementById('card').classList.contains('on') || __dz.S.mode === 'win') break; } return __dz.stats(); });
        if (st.stage !== lastStage) { lastStage = st.stage; log('stage', st.stage, JSON.stringify(st)); if (plan !== 'smoke') { await p.evaluate(() => __dz.advance(3)); await shot('s' + st.stage); } }
        if (st.boss !== null && !seen.has('boss')) { seen.add('boss'); log('boss on', JSON.stringify(st)); await p.evaluate(() => __dz.advance(4)); await shot('boss'); }
        if (st.alive > 500 && !seen.has('500')) { seen.add('500'); log('500+ alive', JSON.stringify(st), 'fps', await fps(3000)); await shot('horde500'); }
        if (st.card && /BIT/.test(st.card)) { deaths++; log('DIED', JSON.stringify(st)); await shot('death' + deaths); if (deaths > 5) break; await p.evaluate(() => { if (document.getElementById('card').classList.contains('on')) { __dz.advance(0.5); __dz.card(1); } }); continue; }
        if (st.mode === 'win' || (st.card && /MADE IT/.test(st.card))) { log('WIN', JSON.stringify(st)); await p.waitForTimeout(1500); await shot('win'); break; }
        if (plan === 'smoke' && st.stage >= 1 && n > 20) break;
      }
      const fin = await S(); log('end', JSON.stringify(fin), 'deaths', deaths);
      if (plan !== 'smoke' && fin.card && /MADE IT/.test(fin.card)) { await shot('win-card'); await p.waitForTimeout(500); await tapBtn('#cardBtn'); await p.waitForTimeout(600); const r = await S(); log('play again', JSON.stringify(r), r.stage === 0 && r.score === 0 ? 'REPLAY_OK' : 'REPLAY_FAIL'); }
    }
    if (plan === 'lose') {
      await p.evaluate(() => __dz.setBot('lose')); let st;
      for (let i = 0; i < 240; i++) { st = await p.evaluate(() => { __dz.advance(1); return __dz.stats(); }); if (st.card) break; }
      await p.waitForTimeout(600); await shot('05-death'); log('death card', JSON.stringify(await S()));
      await tapBtn('#cardBtn'); await p.waitForTimeout(500); let r = await S(); await shot('06-retry-cp'); log('after retry checkpoint', JSON.stringify(r), r.mode === 'play' && r.hp >= 70 ? 'RETRY_CP_OK' : 'RETRY_CP_FAIL');
      for (let i = 0; i < 240; i++) { st = await p.evaluate(() => { __dz.advance(1); return __dz.stats(); }); if (st.card) break; }
      await p.waitForTimeout(600); await tapBtn('#cardBtn2'); await p.waitForTimeout(800);
      if (await p.evaluate(() => document.getElementById('card').classList.contains('on'))) { await tapBtn('#cardBtn'); await p.waitForTimeout(400); }
      r = await S(); log('after restart run', JSON.stringify(r), r.mode === 'play' && r.stage === 0 && r.score === 0 && r.hp === 100 ? 'RESTART_OK' : 'RESTART_FAIL');
    }
    const dom = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
    log('dom', JSON.stringify(dom)); log('events', JSON.stringify(await p.evaluate(() => __dz.log.filter((l) => !/^card:/.test(l) || /BIT|MADE/.test(l)).slice(-60))));
  } catch (e) { errs.push('qa: ' + e.message); }
  log('ERRORS', errs.length, errs.slice(0, 12).join('\n'));
  await b.close();
})();
