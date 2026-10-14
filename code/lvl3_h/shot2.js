// node shot2.js out.png mode  (mode: boss-wave | boss-surf | boss-vents)
const { chromium } = require('playwright');
(async () => {
  const [out, mode] = process.argv.slice(2);
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  pg.on('console', m => { if (m.type() === 'error' || m.type()==='warning') console.log('CONSOLE', m.text()); });
  await pg.goto('file:///workspace/work/lvl3_test/index.html?debug&level=3&nocache');
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(6000);
  if (mode !== 'gameplay') // fast-forward: clear waves, push the player right until the boss is up
  for (let i = 0; i < 400; i++) {
    const st = await pg.evaluate(() => { const S = __SS.STATE, p = S.player; p.hp = 16;
      for (const e of S.enemies) if (!e.boss) { e.hp = 0; e.state = "dying"; e.t = 0; }
      if (S.queue) S.queue.length = 0;
      if (!S.locked && !S.fadeOut) p.x = Math.min(p.x + 40, S.camX + 370);
      const bo = S.enemies.find((e) => e.boss); return bo ? bo.mv || bo.state : (S.sec + ":" + S.phase); });
    if (mode === 'boss-surf' && st === 'surf') { await pg.waitForTimeout(450); break; }
    if (st === 'walk') break;
    await pg.waitForTimeout(100);
  }
  if (mode === 'gameplay') {
    for (let i = 0; i < 60; i++) { const L = await pg.evaluate(() => { const S = __SS.STATE, p = S.player; if (!S.locked) { p.x += 30; p.y = 165; } return S.locked; }); if (L) break; await pg.waitForTimeout(100); }
    await pg.evaluate(() => { const S = __SS.STATE; S.player.y = 166; S.player.x = S.camX + 120; });
    for (let i = 0; i < 300; i++) { const n = await pg.evaluate(() => { const S = __SS.STATE; S.player.hp = 16; return S.enemies.filter((e) => e.entered).length + (S.enemies.some((e) => e._drop) ? 10 : 0); }); if (n >= +(process.env.GN || 3)) break; await pg.waitForTimeout(100); }
    await pg.waitForTimeout(+(process.env.GW || 0));
    console.log(await pg.evaluate(() => { const S = __SS.STATE; return JSON.stringify({ cam: S.camX, locked: S.locked, wave: S.wave, q: S.queue, en: S.enemies.map((e) => [e.type, e.x | 0, e.y | 0, e.z | 0, e.state]), t: S.t, scene: S.scene, card: S.cardT }); }));
    await (await pg.$('#game')).screenshot({ path: out }); await b.close(); return;
  }
  if (mode === 'wavepose') {
    await pg.evaluate(() => { const S = __SS.STATE, p = S.player, e = S.enemies.find((e) => e.boss);
      p.x = 70; p.y = 200; e.x = 320; e.y = 196; e.state = "throw"; e.mv = "wave"; e.mt = 47; e.band = 0; e.p2 = true; e.facing = -1;
      const hz = S.haz.find((z) => z.st.tele); hz.st.list.push({ x: 230, y0: 154, y1: 186, vx: -3.1, t: 0, hit: new Set() }); hz.st.tele.push({ y0: 186, y1: 218, dir: -1, t: 0, life: 82 }); });
    await pg.waitForTimeout(120);
    await (await pg.$('#game')).screenshot({ path: out }); await b.close(); return;
  }
  if (mode === 'gallery') {
    const sts = [["walk",0],["charge",0],["kick",0],["fire",0],["hurt",0],["down",0],["throw","wave"]];
    for (let i = 0; i < sts.length; i++) {
      await pg.evaluate(([st, mv, f]) => { const S = __SS.STATE, p = S.player, e = S.enemies.find((e) => e.boss);
        p.x = 40; p.y = 160; e.x = 200; e.y = 200; e.state = st; e.t = 0; e.mv = mv || null; e.mt = 50; e.cool = 999; e.walkT = 15; e.flash = 0; e.facing = f; }, sts[i].concat([+(process.env.FACE||-1)]));
      await pg.waitForTimeout(60);
      await (await pg.$('#game')).screenshot({ path: out.replace('.png', '_' + i + '.png') });
    }
    await b.close(); return;
  }
  if (mode !== 'boss-surf') {
    await pg.evaluate((mode) => { const S = __SS.STATE, p = S.player, e = S.enemies.find((e) => e.boss);
      p.x = 80; p.y = 200; e.x = 280; e.y = 190; e.state = "throw"; e.mv = mode === 'boss-wave' ? 'wave' : 'vents'; e.mt = 0; e.hp = 15; }, mode);
    if (mode === 'boss-wave') { for (const ms of [400, 450, 350, 300]) { await pg.waitForTimeout(ms); await (await pg.$('#game')).screenshot({ path: out.replace('.png', '_' + ms + '.png') }); } }
    else await pg.waitForTimeout(900);
  }
  await (await pg.$('#game')).screenshot({ path: out });
  console.log('shot', out);
  await b.close();
})();
