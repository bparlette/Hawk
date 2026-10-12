// node bot.js <port> <outPrefix> <w> <h> <maxSec> [sim]
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, pre, w = '1280', h = '720', maxS = '240', sim = '8'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto(`http://127.0.0.1:${port}/?bot=1&sim=${sim}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 60000 });
  const t0 = Date.now(); let k = 0, fightShots = 0, lastShot = 0;
  while (Date.now() - t0 < +maxS * 1000) {
    await p.waitForTimeout(1500);
    const st = await p.evaluate(() => { const C = __cel, H = C.hero; const near = C.enemies.filter((e) => e.alive && Math.hypot(e.pos.x - H.pos.x, e.pos.z - H.pos.z) < 3.5).length;
      return { done: C.BOTR.done, t: +C.S.time.toFixed(1), st: H.state, near, hurt: C.enemies.some((e) => e.state === 'hurt' || e.state === 'down'), pos: [+H.pos.x.toFixed(1), +H.pos.z.toFixed(1)], corners: C.BOTR.corners.join(','), kills: C.S.kills, pk: C.PART.kos, pst: C.partner.state, php: C.partner.hp, hhp: H.hp, fin: C.CINE.stats.finishers, tags: C.CINE.stats.tags, rev: [C.CINE.stats.revivesByPlayer, C.CINE.stats.revivesByPartner], pd: +Math.hypot(C.partner.pos.x - H.pos.x, C.partner.pos.z - H.pos.z).toFixed(1), lb: +C.CINE.lb.toFixed(2) }; });
    if (st.near && (st.st === 'atk' || st.hurt) && fightShots < 3 && Date.now() - lastShot > 20000) { await p.screenshot({ path: `${pre}fight${fightShots++}.png`, timeout: 120000 }); lastShot = Date.now(); }
    if (k++ % 6 === 0) { console.log(JSON.stringify(st)); }
    if (st.done) break;
  }
  await p.screenshot({ path: `${pre}end.png`, timeout: 120000 });
  const info = await p.evaluate(() => { const C = __cel; return { t: C.S.time.toFixed(1), corners: C.BOTR.corners, log: C.BOTR.log, kills: C.S.kills, hits: C.S.hits, maxCombo: C.S.maxCombo, downs: C.S.playerDowns, hp: C.hero.hp, done: C.BOTR.done,
    yawSpread: (() => { const y = C.BOTR.yaws; if (!y.length) return 0; const s = new Set(y.map((v) => Math.round(v * 2))); return s.size; })(), fightT: C.BOTR.fightT.toFixed(1), cine: C.CINE.stats, qtePressed: C.BOTR.qtePressed || 0, lbMax: C.CINE.lbMax, part: { kos: C.PART.kos, heroKos: C.PART.heroKos, teleports: C.PART.teleports, why: C.PART.lastTp, hops: C.PART.hops, downs: C.PART.downs, fightT: +C.PART.fightT.toFixed(1), followIn: +(C.PART.followIn / Math.max(1, C.PART.followSamples)).toFixed(2), hp: C.partner.hp, st: C.partner.state }, err: __celErr, sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, calls: C.renderer.info.render.calls }; });
  console.log(JSON.stringify(info)); console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})();
