// node poses.js : GRIMWALE painted-sheet poses next to a turtle + live move shots (lvl5_test, playwright)
const { chromium } = require('playwright');
const OUT = '/workspace/work/lvl5_art/shots/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 }, deviceScaleFactor: 2 });
  const errs = [];
  pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error') { errs.push(m.text()); console.log('CONSOLE', m.type(), m.text()); } });
  await pg.goto('file:///workspace/work/lvl5_test/index.html?level=5&nocache&debug');
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(5200);
  const shot = async (n) => { await (await pg.$('#game')).screenshot({ path: OUT + n }); console.log('shot', n); };
  // run to the boss deck
  for (let i = 0; i < 400; i++) {
    const st = await pg.evaluate(() => { const S = __SS.STATE, p = S.player; if (!p) return 'x'; p.hp = 20; p.inv = 0; for (const e of S.enemies) if (!e.boss && e.state !== 'dying' && e.state !== 'fly') { e.hp = 0; e.state = 'dying'; e.t = 0; } S.queue = []; if (!S.locked) p.x = Math.min(p.x + 80, 5000); return S.sec + ',' + S.phase + ',' + S.enemies.some((e) => e.boss && e.state !== 'enter'); });
    if (st === '1,boss,true') break; await pg.waitForTimeout(150);
  }
  await pg.waitForTimeout(600);
  // live moves first (engine + level code drive everything)
  const live = async (name, setup, wait) => {
    await pg.evaluate(setup); await pg.waitForTimeout(wait); await shot(name);
  };
  await live('m_harp_aim.png', () => { const S = __SS.STATE, p = S.player, e = S.enemies.find((q) => q.boss); for (const m of S.enemies) if (!m.boss) { m.hp = 0; m.state = 'dying'; } p.x = e.x - 150; p.y = e.y; p.hp = 30; e.facing = -1; e.cool = 999; Object.assign(e, { mv: 'harp', mvS: 'fire', state: 'fire', t: 25 }); }, 300);
  await live('m_harp_fly.png', () => {}, 380);
  await pg.waitForTimeout(1200);
  await live('m_toss_aim.png', () => { const S = __SS.STATE, p = S.player, e = S.enemies.find((q) => q.boss); p.x = e.x - 110; p.y = e.y; p.inv = 60; p.hp = 30; Object.assign(e, { mv: 'toss', mvS: 'throw', state: 'throw', t: 0, facing: -1 }); }, 250);
  await live('m_toss_fly.png', () => {}, 380);
  await pg.waitForTimeout(1200);
  await live('m_sweep_whirl.png', () => { const S = __SS.STATE, p = S.player, e = S.enemies.find((q) => q.boss); p.x = e.x - 50; p.inv = 90; Object.assign(e, { mv: 'sweep', mvS: 'kick', state: 'kick', t: 0 }); }, 400);
  await live('m_sweep_spin.png', () => {}, 330);
  await pg.waitForTimeout(1000);
  // forced poses: wrap the boss draw so the chosen state is shown regardless of the AI
  await pg.evaluate(() => {
    const S = __SS.STATE, e = S.enemies.find((q) => q.boss); for (const m of S.enemies) if (!m.boss) { m.hp = 0; m.state = 'dying'; }
    const d0 = e.cfg.draw; window.__pose = null;
    e.cfg.draw = function (api, e2, sx, sy) { if (window.__pose) Object.assign(e2, window.__pose); return d0(api, e2, sx, sy); };
    e.cfg.update = function () { return true; }; // freeze the AI
  });
  const poses = [['idle', { state: 'walk', walkT: 0, t: 5 }], ['walk1', { state: 'walk', walkT: 1, t: 5 }], ['walk2', { state: 'walk', walkT: 21, t: 5 }],
    ['hurt', { state: 'hurt', t: 3 }], ['charge', { state: 'charge', t: 20 }], ['kick', { state: 'kick', mv: null, t: 5 }], ['slam_crouch', { state: 'slam', t: 5 }],
    ['summon', { state: 'summon', mv: 'hatch', t: 5 }], ['aim', { state: 'fire', mv: 'harp', t: 10 }], ['getup', { state: 'getup', t: 5 }], ['down', { state: 'down', t: 5 }]];
  for (const [n, P] of poses) {
    await pg.evaluate((P) => { const S = __SS.STATE, p = S.player, e = S.enemies.find((q) => q.boss); e.x = S.camX + 230; e.y = 196; e.z = 0; e.facing = -1; e.flash = 0; e.hp = e.maxHp; e.warn = false;
      p.x = e.x - 60; p.y = e.y + 1; p.z = 0; p.facing = 1; p.inv = 0; p.hp = 30; window.__pose = Object.assign({ mv: null, x: e.x, y: 196, z: 0, facing: -1, hp: e.maxHp, flash: 0, warn: false }, P); }, P);
    await pg.waitForTimeout(220); await shot('p_' + n + '.png');
  }
  // KO -> outro
  await pg.evaluate(() => { window.__pose = null; const S = __SS.STATE, e = S.enemies.find((q) => q.boss); e.cfg.update = null; e.hp = 1; });
  await pg.evaluate(() => { const S = __SS.STATE, e = S.enemies.find((q) => q.boss); e.hp = 0; e.state = 'dying'; e.t = 0; S.bossDown = true; });
  await pg.waitForTimeout(700); await shot('ko.png');
  for (let i = 0; i < 60; i++) { if (await pg.evaluate(() => !!__SS.STATE.outro)) break; await pg.waitForTimeout(200); }
  await pg.waitForTimeout(1500); await shot('outro.png');
  console.log('ERRORS', errs.length, JSON.stringify(errs.slice(0, 5)));
  await b.close();
})();
