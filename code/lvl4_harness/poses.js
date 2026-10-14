// node poses.js : JETWASH pose screenshots next to the turtle (level 4)
const { chromium } = require('playwright');
const OUT = '/workspace/work/lvl4_art/shots/';
const poses = [ // [name, state, t, z, extra js]
  ['idle', 'walk', 0, 12, 'b.walkT=0;b.cool=9999;'],
  ['hover', 'walk', 0, 12, 'b.walkT=16;b.cool=9999;'],
  ['kwind', 'kwind', 2, 6, ''],
  ['kick', 'kick', 3, 6, ''],
  ['tele_glide', 'tele', 12, 20, ''],
  ['charge_dive', 'charge', 2, 5, 'b.dir=-1;'],
  ['throw_bomb', 'throw', 26, 40, ''],
  ['fire', 'fire', 31, 18, ''],
  ['summon_radio', 'summon', 2, 16, ''],
  ['hurt', 'hurt', 1, 12, ''],
  ['fall', 'dying', 1, 30, ''],
  ['down', 'down', 2, 0, ''],
];
(async () => {
  const br = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const pg = await br.newPage({ viewport: { width: 1152, height: 900 } });
  let errs = 0;
  pg.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error') { errs++; console.log('CONSOLE', m.text()); } });
  await pg.goto('file:///workspace/work/lvl4_test/index.html?debug&nocache&level=4');
  await pg.waitForTimeout(800); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => window.__SS && __SS.STATE.scene === 'stage' && __SS.STATE.player, null, { timeout: 60000 });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const S = __SS.STATE; S.enemies.length = 0; S.queue = []; __SS.spawnBoss(__SS.LEVELS[3].boss); });
  await pg.waitForFunction(() => { const b = __SS.STATE.enemies.find(e => e.boss); return b && b.state === 'walk'; }, null, { timeout: 30000 });
  for (const [name, st, t, z, extra] of poses) {
    await pg.evaluate(([st, t, z, extra]) => {
      const S = __SS.STATE, b = S.enemies.find(e => e.boss), p = S.player;
      S.enemies = S.enemies.filter(e => e.boss);
      p.hp = 16; p.inv = 200; p.x = S.camX + 150; p.y = 192; p.facing = 1; p.z = 0;
      b.x = S.camX + 222; b.y = 190; b.facing = -1; b.state = st; b.t = t; b.z = z; b.hp = Math.max(b.hp, b.maxHp * 0.6); b.inv = 200;
      eval(extra);
    }, [st, t, z, extra]);
    await pg.waitForTimeout(40);
    const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png'));
    require('fs').writeFileSync(OUT + name + '.png', Buffer.from(d.split(',')[1], 'base64'));
    console.log('shot', name, await pg.evaluate(() => { const b = __SS.STATE.enemies.find(e => e.boss); return b.state + ' t=' + b.t + ' z=' + b.z.toFixed(1); }));
  }
  console.log('errors', errs); await br.close();
})();
