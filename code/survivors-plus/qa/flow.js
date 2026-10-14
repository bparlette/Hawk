// node flow.js w h touch — UI/flow acceptance: attract→play handover, level-up card (keyboard/tap), chest evolutions x3,
// pause/resume (button + visibility), death → results → retry x10, win → results, stuck-key check on blur. Screens to shots/.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const [w = 1280, h = 720, touch = 0] = process.argv.slice(2).map(Number);
const tag = `${w}x${h}`;
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const p = await c.newPage(); const errs = []; const R = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall/.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  const ok = (name, cond, extra = '') => { R.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
  const S = () => p.evaluate(() => __vs.snap());
  const adv = (s) => p.evaluate((s) => __vs.advance(s), s);
  const shot = (n) => p.screenshot({ path: `shots/${tag}-${n}.png` });
  await p.goto('http://127.0.0.1:8745/index.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.__vs);
  await p.waitForTimeout(1500);
  let s = await S(); ok('boots into attract (real game playing)', s.state === 'attract' && s.n > 50, JSON.stringify({ n: s.n }));
  ok('title shows goal', await p.evaluate(() => document.getElementById('title').classList.contains('on') && /SURVIVE 10:00/.test(document.getElementById('title').textContent)));
  await shot('01-attract');
  // handover
  if (touch) await p.touchscreen.tap(w * 0.3, h * 0.6); else await p.keyboard.press('KeyD');
  await p.waitForTimeout(200); s = await S();
  ok('first input hands over to a fresh run', s.state === 'play' && s.t < 1 && s.lv === 1, JSON.stringify({ t: s.t, lv: s.lv }));
  ok('no bot input after handover', await p.evaluate(() => { const k = [...__vs.keys]; return !__vs.bot.on && k.every((x) => x !== 'KeyW'); }));
  // movement with keyboard or touch-drag
  const x0 = await p.evaluate(() => __vs.PL.x);
  if (touch) { await p.evaluate(() => { const st = document.getElementById('stage'); const ev = (t, x, y) => st.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })); ev('pointerdown', 100, 600); ev('pointermove', 160, 600); }); await adv(1); await p.evaluate(() => { document.getElementById('stage').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true, pointerType: 'touch' })); }); }
  else { await p.keyboard.down('KeyD'); await adv(1); await p.keyboard.up('KeyD'); }
  const x1 = await p.evaluate(() => __vs.PL.x); ok('moves right with ' + (touch ? 'floating stick' : 'keyboard'), x1 - x0 > 2, (x1 - x0).toFixed(2));
  // stuck keys: hold, blur, check
  await p.keyboard.down('KeyA'); await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.keyboard.up('KeyA').catch(() => {});
  await p.keyboard.down('KeyA'); await p.evaluate(() => window.dispatchEvent(new Event('blur')));
  ok('blur clears held keys', await p.evaluate(() => __vs.keys.size === 0)); await p.keyboard.up('KeyA');
  // level-up card
  await p.evaluate(() => { __vs.Gs.xp = __vs.Gs.xpNext * 0.6; __vs.Gs.pendingLv = Math.max(1, __vs.Gs.pendingLv); }); await adv(0.1); await p.waitForTimeout(500); s = await S();
  ok('level-up card opens', s.ui === 'level'); await shot('02-levelup');
  const nW = s.weapons.length + s.passives.length;
  if (touch) await p.tap('.card >> nth=1'); else { await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); }
  s = await S(); ok('card pick applies', s.ui === '' && s.state === 'play' && (s.weapons.length + s.passives.length >= nW), JSON.stringify(s.weapons.concat(s.passives)));
  // 3 evolutions from chests
  await p.evaluate(() => { __vs.build(); __vs.A.weapons.forEach((w) => { w.evo = null; }); });
  const evos = [];
  for (let k = 0; k < 3; k++) {
    await p.evaluate(() => __vs.chest()); await adv(0.5); await p.waitForTimeout(450); s = await S();
    if (k === 0) await shot('03-chest-evolve');
    evos.push(s.evolved.slice(-1)[0]);
    if (touch) await p.tap('[data-act=continue]'); else await p.keyboard.press('Enter');
  }
  s = await S(); ok('3 evolutions from 3 chests', s.evolved.length >= 3, JSON.stringify(s.evolved));
  // pause button + resume, visibility pause
  await p.click('#bPause'); s = await S(); ok('pause button pauses', s.state === 'pause'); await shot('04-pause');
  await p.click('[data-act=resume]'); s = await S(); ok('resume works', s.state === 'play');
  await p.click('#bMute'); ok('mute toggles', await p.evaluate(() => document.getElementById('bMute').textContent === '🔇')); await p.click('#bMute');
  // fights at 8:00 with the evolved build (screen)
  await p.evaluate(() => { __vs.setTime(480); __vs.spawnN(900); }); await adv(2.5); await shot('05-horde');
  // death
  await p.evaluate(() => { __vs.Gs.iframe = 0; __vs.Gs.hp = 1; __vs.hurt(50); }); await adv(1.8); await p.waitForTimeout(400); s = await S();
  ok('can die → results', s.state === 'dead' && s.ui === 'res'); await shot('06-dead');
  ok('results show time/kills/level/gold', await p.evaluate(() => ['TIME', 'KILLS', 'LEVEL', 'GOLD'].every((k) => document.getElementById('ov').textContent.includes(k))));
  ok('best run saved', await p.evaluate(() => !!localStorage.getItem('survivorsPlus.best')));
  // retry 10x
  let good = 0, worst = 0;
  for (let k = 0; k < 10; k++) {
    const t0 = Date.now();
    if (touch) await p.tap('[data-act=retry]'); else await p.keyboard.press('Enter');
    worst = Math.max(worst, Date.now() - t0);
    s = await S(); if (s.state === 'play' && s.t < 0.5 && s.kills === 0 && s.lv === 1 && s.weapons.length === 1 && s.gems === 0 && s.proj === 0) good++;
    await p.evaluate(() => { __vs.spawnN(200); __vs.Gs.iframe = 0; __vs.Gs.hp = 1; __vs.hurt(50); }); await adv(1.8); await p.waitForTimeout(350);
  }
  ok('retry x10 fully resets', good === 10, `good=${good} worst=${worst}ms`);
  if (touch) await p.tap('[data-act=retry]'); else await p.keyboard.press('Enter');
  // reaper + win
  await p.evaluate(() => { __vs.build(); __vs.Gs.invuln = true; __vs.setTime(599); }); await adv(3); await shot('07-reaper');
  s = await S(); ok('reaper spawns at 10:00', s.boss !== null, 'hp=' + s.boss);
  await adv(1.2); await shot('08-reaper-telegraph');
  await p.evaluate(() => { const H = __vs.H; for (let i = 0; i < H.n; i++) if (H.type[i] === 6) H.hp[i] = 5; }); await adv(3.5); await p.waitForTimeout(400);
  s = await S(); ok('reaper dies → win results', s.state === 'win' && s.ui === 'res'); await shot('09-win');
  // visibility pause
  await p.keyboard.press('Enter'); await adv(0.2);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  s = await S(); ok('tab hide pauses', s.state === 'pause');
  ok('no console errors/warnings (excluding swiftshader GPU-stall notes)', errs.length === 0, JSON.stringify(errs.slice(0, 5)));
  console.log(tag + '\n' + R.join('\n'));
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
