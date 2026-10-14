// node shots.js outdir  -- feature screenshots in headless Chromium
const { chromium } = require('playwright');
const SITE = process.env.SITE || '/workspace/work/ss_feat';
(async () => {
  const out = process.argv[2] || 'shots';
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 }, deviceScaleFactor: 2.5 });
  const errs = [];
  pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error' || /hook error|rejected/.test(m.text())) console.log('CONSOLE', m.text()); });
  const W8 = (ms) => pg.waitForTimeout(ms);
  const shot = async (n) => { await (await pg.$('#game')).screenshot({ path: out + '/' + n + '.png' }); console.log('shot', n); };
  const ev = (f) => pg.evaluate(f);
  await pg.goto('file://' + SITE + '/index.html?debug');
  await W8(1200);
  await ev(() => window.__SS.titleAttract()); await W8(900); await shot('hiscore_title');
  await pg.keyboard.press('Enter'); await W8(500);
  await pg.keyboard.press('ArrowUp'); await W8(300); await shot('difficulty_select');
  await pg.keyboard.press('ArrowDown'); await W8(200);
  await pg.keyboard.press('Enter'); await W8(4200);
  // pickups + props around the player
  await ev(() => { const S = window.__SS, p = S.STATE.player; S.STATE.enemies = []; S.STATE.queue = [];
    S.spawnItem({ kind: 'slice', x: p.x + 40, y: p.y }); S.spawnItem({ kind: 'pizza', x: p.x + 80, y: p.y + 12 });
    S.spawnProp({ kind: 'crate', x: p.x + 120, y: p.y - 14 }); S.spawnProp({ kind: 'trash', x: p.x + 150, y: p.y + 8 }); S.spawnProp({ kind: 'cone', x: p.x + 175, y: p.y + 20 }); S.spawnProp({ kind: 'barrel', x: p.x + 200, y: p.y - 6 }); });
  await W8(400); await shot('pickups_props');
  // special
  await ev(() => { const S = window.__SS, p = S.STATE.player; p.hp = 16; S.STATE.enemies = []; for (let i = 0; i < 2; i++) { S.STATE.queue = []; } });
  await pg.keyboard.down('j'); await pg.keyboard.down('k'); await W8(60); await pg.keyboard.up('j'); await pg.keyboard.up('k');
  await W8(150); await ev(() => { window.__SS.STATE.specT = 300; }); await W8(120); await shot('special'); await ev(() => { window.__SS.STATE.specT = 0; });
  await W8(1200);
  await ev(() => { const S = window.__SS, st = S.STATE, p = st.player; const c = S.spawnProp({ kind: 'crate', x: p.x + 6, y: p.y }); c.state = 'held'; p.carry = c; });
  await W8(300); await shot('carry');
  await ev(() => { const S = window.__SS, st = S.STATE, p = st.player; if (p.carry) { p.carry.state = 'idle'; p.carry = null; } });
  // throw: grab the nearest spawned foot soldier and slam him
  await ev(() => { const S = window.__SS, st = S.STATE; st.queue = ['purple', 'purple', 'blue']; st.spawnT = 0; st.locked = true; st.camX = Math.max(0, Math.min(1840 - 384, st.player.x - 150)); st.wave = 1; });
  await W8(2500);
  const held = await ev(() => { const S = window.__SS, st = S.STATE, p = st.player; const e = st.enemies.find((o) => o.state === 'walk');
    if (!e) return 'none'; e.x = p.x + 14; e.y = p.y; e.entered = true; S.startHold(p, e); return 'held ' + e.type; });
  console.log(held); await W8(250); await shot('throw_hold');
  await ev(() => { const S = window.__SS, p = S.STATE.player; if (p.hold) S.sideSlam(p, p.hold); });
  await W8(330); await shot('throw_slam');
  await W8(1200);
  const tossed = await ev(() => { const S = window.__SS, st = S.STATE, p = st.player; const e = st.enemies.find((o) => o.state === 'walk' || o.state === 'hurt');
    if (!e) return 'none'; e.state = 'walk'; e.x = p.x + 14; e.y = p.y; e.entered = true; S.startHold(p, e); S.tossAtScreen(p, e); return 'toss'; });
  console.log(tossed); await W8(700); await shot('throw_toss');
  // barrel roll into enemies
  await W8(800);
  await ev(() => { const S = window.__SS, st = S.STATE, p = st.player; st.queue = ['purple', 'purple']; st.spawnT = 0; st.locked = true; st.props = []; const b = S.spawnProp({ kind: 'barrel', x: p.x + 14, y: p.y }); p.facing = 1; });
  await W8(1500);
  await ev(() => { const S = window.__SS, st = S.STATE, p = st.player; const b = st.props.find((q) => q.kind === 'barrel'); if (b) { b.x = p.x + 16; b.y = p.y; b.state = 'roll'; b.vx = 3.4; b.hit = new Set(); b.rollT = 0; }
    st.enemies.forEach((e, i) => { e.x = p.x + 70 + i * 30; e.y = p.y; e.state = 'walk'; e.entered = true; }); });
  await W8(450); await shot('barrel_roll');
  // stage map
  await pg.evaluate((n) => { const S = window.__SS; S.startMap(0, n, { score: S.STATE.score }); }, +(process.env.MAPN || 2));
  await W8(2600); await shot('stage_map');
  // high score entry
  await ev(() => { const S = window.__SS; S.STATE.scene = 'stage'; S.STATE.score = 98765; S.endRun(); });
  await W8(400); await pg.keyboard.press('ArrowUp'); await W8(200); await pg.keyboard.press('j'); await W8(300); await shot('initials');
  await pg.keyboard.press('j'); await W8(200); await pg.keyboard.press('j'); await W8(3500); await shot('hiscore_after');
  console.log('ERRORS', errs.length);
  await b.close();
})();
