// node qa.js <url> <outdir> [sizes]  — deterministic: drives the sim with __blox.advance(sec)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const [url = 'file:///workspace/work/blox-raid/index.html', out = '/workspace/work/blox-raid/shots', which = 'desk,mob'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const sizes = { desk: [1280, 720, false], mob: [390, 844, true] };
  for (const name of which.split(',')) {
    const [w, h, mob] = sizes[name];
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
    const p = await c.newPage(); const errs = [];
    p.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|GL Driver|swiftshader|WebGL|407/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 200) + ' ' + (e.stack || '').split('\n')[1]));
    await p.goto(url); await p.waitForTimeout(2000);
    const adv = (s) => p.evaluate((s) => __blox.advance(s), s);
    const ev = (f) => p.evaluate(f);
    const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: `${out}/${name}-${n}.png` }); };
    const S = () => ev(() => JSON.stringify({ st: __blox.G.state, mode: __blox.G.mode, bhp: Math.round(__blox.bs.hp), ph: __blox.bs.phase, php: Math.round(__blox.pl.hp), en: Math.round(__blox.pl.en), hits: __blox.G.hits, vs: __blox.G.vs, t: +__blox.G.t.toFixed(1) }));
    // VIRAL
    await adv(5.0); await shot('01-viral-barrage'); log(name, 'viral@5', await S());
    await adv(2.6); await shot('02-viral-phase2'); log(name, 'viral@7.6', await S());
    await adv(4.3); await shot('03-viral-finisher'); log(name, 'viral@11.9', await S());
    await adv(3.0); await shot('04-viral-victory'); log(name, 'viral@14.6', await S());
    // MANUAL
    await ev(() => __blox.startManual()); await adv(0.6);
    await p.keyboard.down('KeyW'); await adv(0.6); await p.keyboard.up('KeyW');
    await p.keyboard.press('KeyZ'); await adv(0.25); await shot('05-manual-jab');
    await adv(0.5); log(name,'pre X',await S()); await p.keyboard.press('KeyX'); await p.waitForTimeout(100); log(name,'post X',await S()); await adv(0.42); await shot('06-manual-pastry');
    await adv(0.6); await p.keyboard.press('KeyV'); await adv(0.75); await shot('07-manual-barrage');
    await adv(0.9); await p.keyboard.press('KeyC'); await adv(0.3); await shot('08-manual-roll');
    await adv(0.6); log(name, 'after skills', await S());
    log(name, 'V fired with 100 energy?', await ev(() => { const P = __blox.pl; P.en = 100; P.cds.KeyV = 0; P.lock = 0; P.hurt = 0; return __blox.triggerSkill('KeyV'); }));
    // boss telegraph + damage
    await ev(() => { __blox.pl.en = 12845; __blox.bs.stun = 0; __blox.bs.atk = null; __blox.bossAttack('slam'); });
    await adv(0.55); await shot('09-boss-telegraph');
    await adv(1.2); log(name, 'after slam (player stood still)', await S());
    await shot('10-player-hit');
    // phase 2
    await ev(() => { __blox.bs.atk = null; __blox.bs.stun = 0; __blox.bs.hp = __blox.bs.maxHp * 0.5 + 500; __blox.hitBoss(4000, { heavy: 1 }); });
    await adv(1.6); await shot('11-phase2-transform'); await adv(1.2); log(name, 'phase2', await S());
    await ev(() => { __blox.bs.atk = null; __blox.bossAttack('storm'); }); await adv(0.7); await shot('12-phase2-storm'); await adv(1.0);
    // KO
    await ev(() => { __blox.pl.hp = 50; __blox.pl.iframes = 0; __blox.bs.atk = null; __blox.bs.stun = 0; __blox.bossAttack('nova'); __blox.pl.pos.copy(__blox.bs.pos).add({ x: 0, y: 0, z: 2.5 }); });
    await adv(4.0); await shot('13-ko'); log(name, 'KO', await S());
    // restart via Enter, finisher → victory
    await p.keyboard.press('Enter'); await adv(0.5); log(name, 'after Enter', await S());
    await ev(() => { const B = __blox.bs; B.phase = 2; B.hp = 3000; B.atk = null; B.atkCd = 99; __blox.pl.cds.KeyZ = 0; __blox.pl.lock = 0; __blox.triggerSkill('KeyZ'); });
    await adv(0.5); await shot('14-finisher'); await adv(3.0); await shot('15-victory'); log(name, 'victory', await S());
    log(name, 'errors', JSON.stringify(errs));
    await c.close();
  }
  await b.close(); log('DONE');
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
