// node gpose.js : L3 Gulch Gator pose screenshots next to the player turtle -> /workspace/work/lvl3_art/shots/g_*.png
const { chromium } = require('playwright');
const OUT = '/workspace/work/lvl3_art/shots/';
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  let errs = 0;
  pg.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error') { errs++; console.log('CONSOLE', m.text()); } });
  await pg.goto('file:///workspace/work/lvl3_test/index.html?debug&level=3&nocache');
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(6000);
  for (let i = 0; i < 600; i++) {
    const st = await pg.evaluate(() => { const S = __SS.STATE, p = S.player; p.hp = 16;
      for (const e of S.enemies) if (!e.boss) { e.hp = 0; e.state = "dying"; e.t = 0; }
      if (S.queue) S.queue.length = 0;
      if (!S.locked && !S.fadeOut) p.x = Math.min(p.x + 40, S.camX + 370);
      const bo = S.enemies.find((e) => e.boss); return bo ? bo.mv || bo.state : (S.sec + ":" + S.phase); });
    if (process.env.SURF && st === 'surf') { await pg.waitForTimeout(500); await shot('g_surf_entrance'); }
    if (st === 'walk') break;
    await pg.waitForTimeout(100);
  }
  async function shot(n) { await pg.evaluate(() => { __SS.STATE.player.inv = 0; }); await pg.waitForTimeout(40); const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png')); require('fs').writeFileSync(OUT + n + '.png', Buffer.from(d.split(',')[1], 'base64')); console.log('shot', n); }
  const setup = (o) => pg.evaluate((o) => { const S = __SS.STATE, b = S.enemies.find((e) => e.boss), p = S.player;
    for (const e of S.enemies) if (!e.boss) { e.hp = 0; e.state = "dying"; e.t = 0; }
    p.hp = 16; p.inv = 60; p.x = S.camX + (o.px || 120); p.y = 200; p.facing = 1; p.attackT = 0;
    Object.assign(b, { x: S.camX + (o.bx || 215), y: 198, z: 0, facing: o.f || -1, cool: 9999, walkT: -100000, flash: 0, inv: 30, mv: null, mt: 0, t: 0, hp: Math.max(b.hp, 30) }, o.s); }, o);
  const until = async (fn) => { for (let i = 0; i < 200; i++) { if (await pg.evaluate(fn)) return; await pg.waitForTimeout(16); } console.log('until timeout'); };
  const P = [
    ['g_idle', { s: { state: 'walk' } }, 300],
    ['g_idle_facing', { px: 110, bx: 200, f: 1, s: { state: 'walk' } }, 0, () => { const S = __SS.STATE; S.player.x = S.camX + 270; S.player.facing = -1; }],
    ['g_walk1', { s: { state: 'walk', walkT: 1 } }, 0],
    ['g_walk2', { s: { state: 'walk', walkT: 19 } }, 0],
    ['g_tele', { s: { state: 'tele', t: 4 } }, 0],
    ['g_charge', { s: { state: 'charge', t: 2 } }, 0],
    ['g_kwind', { s: { state: 'kwind', t: 1 } }, 0],
    ['g_kick', { s: { state: 'kick', t: 3 } }, 0],
    ['g_throw', { s: { state: 'throw', t: 4 } }, 0],
    ['g_throw_release', { s: { state: 'throw', t: 15 } }, 0],
    ['g_summon', { s: { state: 'summon', t: 25 } }, 0],
    ['g_wave_raise', { s: { state: 'throw', mv: 'wave', mt: 20, t: 20 } }, 0],
    ['g_wave_send', { s: { state: 'throw', mv: 'wave', mt: 50, t: 20 } }, 0],
    ['g_vents_stomp', { s: { state: 'throw', mv: 'vents', mt: 4, t: 20 } }, 0],
    ['g_surf', { s: { state: 'throw', mv: 'surf', mt: 40, t: 20 } }, 0],
    ['g_hurt', { s: { state: 'hurt', t: 3 } }, 0],
    ['g_fall', { s: { state: 'down', t: 3 } }, 0],
    ['g_down', { s: { state: 'down', t: 30 } }, 0],
    ['g_getup', { s: { state: 'getup', t: 12 } }, 0],
  ];
  for (const [n, o, w, extra] of P) { await setup(o); if (extra) await pg.evaluate(extra); await pg.waitForTimeout(w || 30); await shot(n); }
  // slam: jump (engine-driven), then landing
  await setup({ s: { state: 'slam', t: 0 } }); await until(() => { const b = __SS.STATE.enemies.find((e) => e.boss); return b.state !== 'slam' || b.t >= 5; }); await shot('g_slam_crouch');
  await until(() => { const b = __SS.STATE.enemies.find((e) => e.boss); return b.state !== 'slam' || b.t >= 28; }); await shot('g_slam_leap');
  await until(() => { const b = __SS.STATE.enemies.find((e) => e.boss); return b.state !== 'slam' || b.t >= 47; }); await shot('g_slam_land');
  // white hit flash + red telegraph
  await setup({ s: { state: 'walk', flash: 3 } }); await pg.waitForTimeout(0); await shot('g_flash');
  // KO
  await setup({ s: { state: 'walk' } });
  await pg.evaluate(() => { const S = __SS.STATE, b = S.enemies.find((e) => e.boss); b.inv = 0; SS.api.hitEnemy(b, 999, true, 1, 4, true); });
  await until(() => __SS.STATE.enemies.some((e) => e.boss && e.state === 'dying' && e.t > 8)); await shot('g_ko_fall');
  await until(() => __SS.STATE.enemies.some((e) => e.boss && e.state === 'dying' && e.t > 40)); await shot('g_ko');
  await until(() => __SS.STATE.outro && __SS.STATE.outro.t > 60); await shot('g_outro');
  console.log('PAGE ERRORS', errs);
  await b.close();
})();
