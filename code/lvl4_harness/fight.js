// natural boss fight (moves cycle) -> KO -> outro -> results, count page errors
const { chromium } = require('playwright');
const OUT = '/workspace/work/lvl4_art/shots/';
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
  await pg.evaluate(() => { const S = __SS.STATE; S.enemies.length = 0; S.queue = []; __SS.spawnBoss(__SS.LEVELS[3].boss); window.__st = {}; 
    setInterval(() => { const b = S.enemies.find(e => e.boss); if (b) { __st[b.state] = (__st[b.state] || 0) + 1; if (b.state === 'walk' && b.cool > 20) b.cool = 20; } if (S.player) { S.player.hp = Math.max(S.player.hp, 10); } }, 30); });
  for (let i = 0; i < 8; i++) { await pg.waitForTimeout(2500); const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png')); require('fs').writeFileSync(OUT + 'fight_' + i + '.png', Buffer.from(d.split(',')[1], 'base64')); }
  await pg.evaluate(() => { const b = __SS.STATE.enemies.find(e => e.boss); b.hp = Math.round(b.maxHp * 0.4); });
  for (let i = 8; i < 12; i++) { await pg.waitForTimeout(2500); const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png')); require('fs').writeFileSync(OUT + 'fight_' + i + '.png', Buffer.from(d.split(',')[1], 'base64')); }
  console.log('states', await pg.evaluate(() => JSON.stringify(__st)));
  await pg.evaluate(() => { const b = __SS.STATE.enemies.find(e => e.boss); b.hp = 0; b.state = 'dying'; b.t = 0; });
  await pg.waitForTimeout(700); { const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png')); require('fs').writeFileSync(OUT + 'ko.png', Buffer.from(d.split(',')[1], 'base64')); }
  let outro = false, results = false;
  for (let i = 0; i < 300 && !results; i++) { await pg.waitForTimeout(100); const r = await pg.evaluate(() => [!!__SS.STATE.outro, !!__SS.STATE.results || !!__SS.STATE.pizza]); if (r[0] && !outro) { outro = true; await pg.waitForTimeout(1500); const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png')); require('fs').writeFileSync(OUT + 'outro.png', Buffer.from(d.split(',')[1], 'base64')); } results = r[1]; }
  console.log('outro', outro, 'results/pizza', results, 'errors', errs); await br.close();
})();
