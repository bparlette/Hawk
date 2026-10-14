// node qa.js <port> <outdir> <w> <h> <script>   — headless QA for ROADKILL RIG
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const [port = '8761', out = 'T/qa', w = '1280', h = '720', which = 'smoke'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 900;
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|WebGL|ReadPixels/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 300) + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto(`http://127.0.0.1:${port}/index.html${which.includes('bot') ? '?bot=1' : ''}`);
  await p.waitForFunction(() => window.__wv && __wv.G.frames > 3, null, { timeout: 90000 }).catch((e) => errs.push('boot timeout'));
  const S = () => p.evaluate(() => __wv.stats());
  const shot = async (n) => { await p.screenshot({ path: `${out}/${w}x${h}-${n}.png` }); };
  const tag = `${w}x${h}`;
  try {
    await p.waitForTimeout(2500); await shot('01-attract'); log(tag, 'attract', JSON.stringify(await S()));
    for (const step of which.split(',')) {
      if (step === 'smoke' || step === 'bot') {
        await p.keyboard.press('KeyW'); await p.waitForTimeout(300); log(tag, 'started', JSON.stringify(await S()));
        await p.evaluate(() => __wv.bot(true));
        await p.waitForTimeout(3000); await shot('02-play'); log(tag, 'play3s', JSON.stringify(await S()));
        await p.evaluate(() => __wv.advance(25)); await p.waitForTimeout(1200); await shot('03-play28'); log(tag, 'play28', JSON.stringify(await S()));
      }
      if (step === 'full') {
        if ((await S()).st === 'attract') { await p.keyboard.press('KeyW'); await p.waitForTimeout(300); }
        await p.evaluate(() => __wv.bot(true));
        for (let m = 1; m <= 8; m++) { const st = await p.evaluate((m) => { while (__wv.G.t < m * 60 && (__wv.G.state === 'play' || __wv.G.state === 'levelup')) __wv.advance(3); return __wv.stats(); }, m); log(tag, 'full', JSON.stringify(st)); if (st.st === 'dead' || st.st === 'win') { await p.waitForTimeout(800); await shot('17-full-end'); break; } }
      }
      if (step === 'route') {
        if ((await S()).st === 'attract') { await p.keyboard.press('KeyW'); await p.waitForTimeout(300); }
        const st = await p.evaluate(() => { __wv.bot(true); __wv.G.hp = 999; __wv.openExtraction(); __wv.place(2, 30, 0); for (let k = 0; k < 20 && __wv.G.state !== 'win'; k++) __wv.advance(2); return __wv.stats(); });
        log(tag, 'route', JSON.stringify(st));
      }
      if (step === 'thumb') {
        if ((await S()).st === 'attract') { await p.keyboard.press('KeyW'); await p.waitForTimeout(300); }
        await p.evaluate(() => { __wv.bot(true); __wv.G.hp = 999; __wv.advance(70); for (const k of ['flame', 'saw']) __wv.give(k, 5); __wv.evo('halo'); __wv.evo('dragon'); __wv.advance(6); document.getElementById('hud').style.display = 'none'; document.getElementById('ui').style.display = 'none'; });
        await p.waitForTimeout(1500); await shot('18-thumb');
      }
      if (step === 'long') {
        for (const t of [60, 120, 180, 240]) { await p.evaluate((t) => { while (__wv.G.t < t && (__wv.G.state === 'play' || __wv.G.state === 'levelup')) __wv.advance(5); }, t); await p.waitForTimeout(1500); await shot('04-t' + t); log(tag, 't' + t, JSON.stringify(await S())); }
      }
      if (step === 'fps') {
        if ((await S()).st === 'attract') { await p.keyboard.press('KeyW'); await p.waitForTimeout(300); await p.evaluate(() => __wv.bot(true)); }
        await p.evaluate(() => { __wv.G.hp = 9999; __wv.G.maxHp = 9999; let k = 0; while (__wv.HORDE.alive < 1100 && k++ < 80) __wv.advance(5); });
        await p.waitForTimeout(1500);
        const f0 = await p.evaluate(() => __wv.G.frames); const t0 = Date.now(); await p.waitForTimeout(6000); const f1 = await p.evaluate(() => __wv.G.frames);
        const st = await S(); log(tag, 'FPS with', st.alive, 'alive:', ((f1 - f0) / ((Date.now() - t0) / 1000)).toFixed(1), 'simMs', st.simMs, 'rMs', st.rMs, 'calls', st.calls, 'tris', st.tris); await shot('05-horde');
      }
      if (step === 'boss') {
        await p.evaluate(() => { __wv.G.hp = 9999; __wv.G.maxHp = 9999; __wv.spawnBoss(); __wv.advance(4); });
        await p.waitForTimeout(800); await shot('06-boss'); log(tag, 'boss', JSON.stringify(await S()));
        await p.evaluate(() => { for (let k = 0; k < 6; k++) { __wv.hurtBoss(1000); __wv.advance(0.3); } __wv.advance(1.0); });
        await p.waitForTimeout(600); await shot('07-bossdown'); log(tag, 'bossdown', JSON.stringify(await S()));
      }
      if (step === 'win') {
        await p.evaluate(() => { __wv.openExtraction(); __wv.advance(0.5); __wv.place(0, 110, 0); __wv.advance(1.5); });
        await p.waitForTimeout(1500); await shot('08-win'); log(tag, 'win', JSON.stringify(await S()));
        await p.keyboard.press('Enter'); await p.waitForTimeout(500); log(tag, 'retry', JSON.stringify(await S()));
      }
      if (step === 'die') {
        await p.evaluate(() => { __wv.kill(); __wv.advance(1); });
        await p.waitForTimeout(1500); await shot('09-dead'); log(tag, 'dead', JSON.stringify(await S()));
        for (let k = 0; k < 10; k++) { await p.keyboard.press('Enter'); await p.waitForTimeout(150); await p.evaluate(() => { __wv.kill(); __wv.advance(0.5); }); await p.waitForTimeout(800); }
        log(tag, 'after 10 retries', JSON.stringify(await S()));
      }
      if (step === 'cards') {
        await p.evaluate(() => { __wv.bot(false); __wv.G.xp = __wv.G.need - 0.5; __wv.G.pendingLv = 1; __wv.advance(1 / 60); });
        await p.waitForTimeout(600); await shot('10-cards'); log(tag, 'cards', JSON.stringify(await S()));
        await p.waitForTimeout(300); await p.keyboard.press('Digit2'); await p.waitForTimeout(300); log(tag, 'picked', JSON.stringify(await S()));
      }
      if (step === 'drive') { // manual keyboard driving
        await p.evaluate(() => { __wv.bot(false); __wv.place(0, -112, 0); });
        await p.keyboard.down('KeyW'); await p.waitForTimeout(2500); log(tag, 'gas2.5', JSON.stringify(await S()));
        await p.keyboard.down('KeyD'); await p.waitForTimeout(1200); await shot('11-turn'); log(tag, 'turn', JSON.stringify(await S()));
        await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(1000); await shot('12-drift'); log(tag, 'drift', JSON.stringify(await S()));
        await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyD'); await p.keyboard.down('Space'); await p.waitForTimeout(1500); await shot('13-nitro'); log(tag, 'nitro', JSON.stringify(await S()));
        await p.keyboard.up('Space'); await p.keyboard.up('KeyW');
      }
      if (step === 'jump') { // straight at the mega ramp
        await p.evaluate(() => { __wv.bot(false); __wv.place(0, -75, 0); __wv.G.nitro = 200; });
        await p.keyboard.down('KeyW'); await p.keyboard.down('Space');
        for (let k = 0; k < 8; k++) { await p.waitForTimeout(500); const s = await S(); log(tag, 'jump', k, s.pos, 'y', s.y, 'spd', s.spd, 'up', s.up); if (k === 5) await shot('14-air'); }
        await p.keyboard.up('KeyW'); await p.keyboard.up('Space');
      }
      if (step === 'b16') { await p.keyboard.press('KeyH'); await p.waitForTimeout(1200); await shot('15-16bit'); await p.keyboard.press('KeyH'); }
      if (step === 'evo') {
        await p.evaluate(() => { for (const k of ['flame', 'saw', 'harpoon']) __wv.give(k, 5); __wv.give('mg', 5); __wv.evo('halo'); __wv.evo('dragon'); __wv.evo('minigun'); __wv.bot(true); __wv.advance(8); });
        await p.waitForTimeout(1500); await shot('16-evo'); log(tag, 'evo', JSON.stringify(await S()));
      }
    }
  } catch (e) { errs.push('qa: ' + e.message.slice(0, 300)); }
  console.log('ERRORS', errs.length, '\n' + errs.slice(0, 15).join('\n'));
  await b.close();
})();
