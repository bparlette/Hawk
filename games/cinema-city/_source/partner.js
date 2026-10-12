// node partner.js <port> <outPrefix> <w> <h> [sim]
// Checks the AI partner: intro landing, follow distance + camera line, solo KOs, catch-up teleport, revive both ways, game over,
// BOOST up the fire escape (+ partner climbs after, hops down after the leap), tag-team QTE finisher.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, pre, w = '1280', h = '720', sim = '4', phases = 'intro,follow,tp,kos,revive,over,boost,tag'] = process.argv.slice(2); const PH = new Set(phases.split(','));
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [], R = {};
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  const ok = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); };
  const wf = (fn, arg, t = 240000) => p.waitForFunction(fn, arg, { timeout: t, polling: 100 });
  const ev = (fn, a) => p.evaluate(fn, a);
  const simWait = async (sec) => { const t0 = await ev(() => __cel.S.time); await wf((t) => __cel.S.time > t, t0 + sec); };
  const shot = async (n) => { await p.evaluate(() => { __cel.pause = true; document.getElementById('proto').classList.remove('open'); }); await p.waitForTimeout(300); await p.screenshot({ path: pre + n + '.png', timeout: 120000 }); await p.evaluate(() => { __cel.pause = false; }); }; // freeze the sim while the slow software-GL capture runs
  await p.goto(`http://127.0.0.1:${port}/?sim=${sim}${PH.has('intro') ? '' : '&nointro=1'}`);
  await wf(() => window.__cel && __cel.frames > 3);
  // ---- intro: partner hidden at first, drops in, settles beside the hero ----
  if (PH.has('intro')) {
  ok('intro_start', await ev(() => ({ intro: !!__cel.CINE.intro, pvis: __cel.partner.root.visible, pst: __cel.partner.state })));
  await wf(() => __cel.CINE.intro && __cel.CINE.intro.t > 2.75); await shot('intro_drop');
  ok('intro_mid', await ev(() => ({ t: +__cel.CINE.intro.t.toFixed(2), pvis: __cel.partner.root.visible, py: +__cel.partner.y.toFixed(2) })));
  await wf(() => __cel.CINE.stats.introDone); await p.waitForTimeout(500); await shot('intro_end');
  ok('intro_end', await ev(() => { const C = __cel, P = C.partner, H = C.hero, v = P.root.position.clone().setY(P.pos.y + 1).project(C.camera);
    return { pst: P.state, d: +Math.hypot(P.pos.x - H.pos.x, P.pos.z - H.pos.z).toFixed(2), onScreen: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1, sx: +v.x.toFixed(2) }; }));
  }
  if (PH.has('follow')) {
  // ---- follow: walk the hero around (forward, turn, run back) and sample the gap ----
  const samp = [];
  const walk = async (mx, my, sec, look = 0) => { await ev(([mx, my, look]) => { __cel.IN.bot = { mx, my, look }; }, [mx, my, look]); const t0 = await ev(() => __cel.S.time);
    while ((await ev(() => __cel.S.time)) < t0 + sec) { await p.waitForTimeout(250); samp.push(await ev(() => { const C = __cel, P = C.partner, H = C.hero; const cp = C.CAM.pos, hx = H.pos.x - cp.x, hz = H.pos.z - cp.z, L2 = hx * hx + hz * hz, u = ((P.pos.x - cp.x) * hx + (P.pos.z - cp.z) * hz) / L2, qx = cp.x + hx * u, qz = cp.z + hz * u;
      return { d: Math.hypot(P.pos.x - H.pos.x, P.pos.z - H.pos.z), block: u > 0 && u < 1 && Math.hypot(P.pos.x - qx, P.pos.z - qz) < 0.6 }; })); } };
  await ev(() => { __cel.hero.inv = 1e9; for (const e of __cel.enemies) { e.set('dead'); e.root.visible = false; e.respawn = 1e9; } }); // street cleared for the walk
  await walk(0, 1, 3); await walk(1, 0.3, 2); await walk(0, 1, 2, 0.6); await walk(-1, 0, 2); await walk(0, 0, 1.5);
  await ev(() => { __cel.IN.bot = null; });
  const ds = samp.map((s) => s.d);
  ok('follow', { n: ds.length, min: +Math.min(...ds).toFixed(2), max: +Math.max(...ds).toFixed(2), mean: +(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(2), in2to4_5: +(ds.filter((d) => d >= 1.6 && d <= 4.6).length / ds.length).toFixed(2), blocking: samp.filter((s) => s.block).length, tps: await ev(() => __cel.PART.teleports) });
  }
  if (PH.has('tp')) {
  const tp0 = await ev(() => __cel.PART.teleports);
  await ev(() => { const H = __cel.hero; H.pos.set(0, 0, 4); H.vel.set(0, 0); });
  await simWait(1.5);
  ok('teleport', { before: tp0, after: await ev(() => __cel.PART.teleports), why: await ev(() => __cel.PART.lastTp), d: await ev(() => +Math.hypot(__cel.partner.pos.x - __cel.hero.pos.x, __cel.partner.pos.z - __cel.hero.pos.z).toFixed(2)) });
  }
  await ev(() => { for (const e of __cel.enemies) { e.hp = e.maxHp; e.dead = false; e.pos.set(e.post.x, 0, e.post.z); e.yaw = e.post.yaw; e.root.visible = true; e.y = 0; e.J.tilt.rotation.set(0, 0, 0); e.bang = null; e.set('idle'); } });
  if (PH.has('kos')) {
  // ---- the partner fights on its own: hero parked (invulnerable, idle) near the south-arm pair ----
  await ev(() => { __cel.hero.inv = 1e9; });
  await ev(() => { const H = __cel.hero; H.pos.set(0.2, 0, 21.5); H.yaw = Math.PI; });
  let shotFight = false; const k0 = await ev(() => __cel.PART.kos);
  for (let i = 0; i < 160; i++) {
    await p.waitForTimeout(400);
    const st = await ev(() => ({ kos: __cel.PART.kos, pst: __cel.partner.state, near: __cel.enemies.filter((e) => e.alive && e.state !== 'idle' && Math.hypot(e.pos.x - __cel.partner.pos.x, e.pos.z - __cel.partner.pos.z) < 2.6).length, t: __cel.S.time }));
    if (!shotFight && st.pst === 'atk' && st.near) { await ev(() => { __cel.press('j'); }); await p.waitForTimeout(150); await shot('duo_fight'); shotFight = true; }
    if (st.kos - k0 >= 2) break;
  }
  ok('partner_kos', { kos: await ev(() => __cel.PART.kos), fightT: await ev(() => +__cel.PART.fightT.toFixed(1)), hits: await ev(() => __cel.S.hits), partnerHp: await ev(() => __cel.partner.hp) });
  }
  // move to a quiet spot (south end) for the revive checks
  const quiet = async () => { await ev(() => { const C = __cel, H = C.hero, P = C.partner; H.roof = P.roof = false; H.pos.set(1, 0, 33); H.vel.set(0, 0); H.set('move'); P.pos.set(-1.2, 0, 33.2); P.vel.set(0, 0); P.set('move'); P.inv = 0; P.hp = 100; H.hp = 100; C.CAM.yaw = 0;
    for (const e of C.enemies) if (e.alive && e.state !== 'dying') { e.pos.set(e.post.x, 0, e.post.z); e.set('idle'); } }); await simWait(0.8); };
  await quiet();
  if (PH.has('revive')) {
  // ---- AI revives the hero ----
  await ev(() => { const H = __cel.hero; H.inv = 0; __cel.hurtTurtle(H, 999, H.pos.x + 1, H.pos.z, false); });
  await wf(() => __cel.hero.state === 'ko'); const tKo = await ev(() => __cel.S.time);
  const pr0 = await ev(() => __cel.CINE.prompt);
  await wf(() => __cel.partner.state === 'revive'); await simWait(0.7); await shot('revive_ai');
  await wf(() => __cel.CINE.stats.revivesByPartner > 0);
  ok('revive_ai', { prompt: pr0, sec: +((await ev(() => __cel.S.time)) - tKo).toFixed(2), heroHp: await ev(() => __cel.hero.hp), heroSt: await ev(() => __cel.hero.state) });
  await simWait(1.2);
  // ---- the player revives the partner by HOLDING E ----
  await ev(() => { const H = __cel.hero; H.inv = 1e9; const P = __cel.partner; P.inv = 0; __cel.hurtTurtle(P, 999, P.pos.x - 1, P.pos.z, false); });
  await wf(() => __cel.partner.state === 'ko');
  const far = await ev(() => __cel.CINE.prompt);
  await ev(() => { const H = __cel.hero, P = __cel.partner; H.pos.set(P.pos.x + 1.2, H.pos.y, P.pos.z + 0.3); });
  await simWait(0.3); const nearP = await ev(() => __cel.CINE.prompt);
  const tP = await ev(() => __cel.S.time);
  await p.keyboard.down('e');
  await wf(() => __cel.hero.state === 'revive', null, 300000).catch(() => {}); await simWait(0.6); await shot('revive_player');
  await wf(() => __cel.CINE.stats.revivesByPlayer > 0, null, 300000).catch(() => {});
  await p.keyboard.up('e');
  ok('revive_player', { farPrompt: far, nearPrompt: nearP, done: await ev(() => __cel.CINE.stats.revivesByPlayer), sec: +((await ev(() => __cel.S.time)) - tP).toFixed(2), partnerHp: await ev(() => __cel.partner.hp) });
  // releasing early cancels
  await simWait(1.5);
  }
  if (PH.has('over')) {
  // ---- both down = game over, then both back up ----
  await ev(() => { const H = __cel.hero, P = __cel.partner; H.inv = 0; P.inv = 0; H.set('move'); P.set('move'); __cel.hurtTurtle(P, 999, P.pos.x - 1, P.pos.z, false); __cel.hurtTurtle(H, 999, H.pos.x + 1, H.pos.z, false); });
  await wf(() => __cel.PART.over, null, 240000).catch(() => {}); const go = await ev(() => ({ over: __cel.PART.over, banner: document.getElementById('banner').textContent }));
  await wf(() => !__cel.PART.over && __cel.hero.state === 'move' && __cel.partner.state === 'move', null, 240000).catch(() => {});
  ok('game_over', { ...go, gameOvers: await ev(() => __cel.CINE.stats.gameOvers), heroHp: await ev(() => __cel.hero.hp), partnerHp: await ev(() => __cel.partner.hp) });
  await quiet();
  }
  if (PH.has('boost')) {
  // ---- BOOST: hero at the ladder, partner close by ----
  await ev(() => { const H = __cel.hero, P = __cel.partner; H.inv = 1e9; H.roof = P.roof = false; H.pos.set(17.7, 0.16, 9.9); H.vel.set(0, 0); H.yaw = 0; H.set('move'); P.pos.set(15.2, 0.16, 8.0); P.vel.set(0, 0); P.set('move'); __cel.CAM.yaw = Math.PI; });
  await simWait(0.4);
  const bp = await ev(() => __cel.CINE.prompt);
  await ev(() => __cel.press('e'));
  await wf(() => __cel.hero.state === 'boost', null, 200000).catch(() => {});
  await wf(() => __cel.CINE.boost && __cel.CINE.boost.t > 0.5); await shot('boost_cup');
  await wf(() => __cel.CINE.boost && __cel.CINE.boost.t > 1.15); await shot('boost_launch');
  const midB = await ev(() => ({ cineCam: __cel.CINE.boost ? __cel.CINE.boost.shot : null, heroY: +(__cel.hero.pos.y + __cel.hero.y).toFixed(2), pst: __cel.partner.state }));
  await wf(() => __cel.hero.roof && __cel.hero.state === 'move');
  await wf(() => __cel.partner.roof && __cel.partner.state === 'move', null, 400000).catch(() => {});
  ok('boost', { prompt: bp, mid: midB, heroRoof: await ev(() => __cel.hero.roof), partnerRoof: await ev(() => __cel.partner.roof), boosts: await ev(() => __cel.CINE.stats.boosts), pclimbs: await ev(() => __cel.PART.climbs), tps: await ev(() => __cel.PART.teleports) });
  await simWait(1); await shot('roof_duo');
  // ---- leap down: partner follows with a flip ----
  await ev(() => { const H = __cel.hero; H.pos.set(12.6, H.pos.y, 22.4); });
  await simWait(0.3); await ev(() => __cel.press('e'));
  await wf(() => !__cel.hero.roof && __cel.hero.state === 'move');
  const h0 = await ev(() => __cel.PART.hops);
  await wf(() => !__cel.partner.roof && __cel.partner.state === 'move', null, 300000).catch(() => {});
  ok('leap_follow', { hops: await ev(() => __cel.PART.hops), hopsBefore: h0, partnerRoof: await ev(() => __cel.partner.roof), d: await ev(() => +Math.hypot(__cel.partner.pos.x - __cel.hero.pos.x, __cel.partner.pos.z - __cel.hero.pos.z).toFixed(2)) });
  }
  if (PH.has('tag')) {
  // ---- tag-team finisher on a south-arm thug ----
  await ev(() => document.getElementById('proto').classList.remove('open'));
  await ev(() => { const C = __cel; for (const e of C.enemies) if (e.id <= 1 && !e.alive) { e.respawn = 0; } });
  await ev(() => { const H = __cel.hero, P = __cel.partner; H.pos.set(-2.8, 0, 19.6); H.yaw = Math.PI; P.pos.set(-5.0, 0, 21.0); });
  let q = null;
  for (let k = 0; k < 90 && !q; k++) {
    await ev(() => { const C = __cel, H = C.hero; const e = C.enemies.filter((e) => e.alive && e.state !== 'dying' && !e.dizzied && Math.hypot(e.pos.x - H.pos.x, e.pos.z - H.pos.z) < 12).sort((a, b) => Math.hypot(a.pos.x - H.pos.x, a.pos.z - H.pos.z) - Math.hypot(b.pos.x - H.pos.x, b.pos.z - H.pos.z))[0];
      if (e && e.state !== 'dizzy' && Math.hypot(e.pos.x - H.pos.x, e.pos.z - H.pos.z) > 1.8) { H.pos.x = e.pos.x; H.pos.z = e.pos.z + 1.4; } C.press('j'); });
    await p.waitForTimeout(300);
    q = await ev(() => __cel.QTE && __cel.QTE.e.state === 'dizzy' && Math.hypot(__cel.partner.pos.x - __cel.QTE.e.pos.x, __cel.partner.pos.z - __cel.QTE.e.pos.z) < 8.5 && (__cel.partner.state === 'move' || __cel.partner.state === 'atk') ? { id: __cel.QTE.e.id, pd: +Math.hypot(__cel.partner.pos.x - __cel.QTE.e.pos.x, __cel.partner.pos.z - __cel.QTE.e.pos.z).toFixed(2) } : null);
  }
  await p.waitForTimeout(200);
  await ev(() => __cel.press('e'));
  await wf(() => !!__cel.CINE.fin, null, 200000).catch(() => {});
  const tagged = await ev(() => !!(__cel.CINE.fin && __cel.CINE.fin.tag));
  await wf(() => !__cel.CINE.fin || __cel.CINE.fin.tagHit, null, 300000).catch(() => {});
  await wf(() => !__cel.CINE.fin || __cel.CINE.fin.t > __cel.CINE.fin.tagHit + 0.04, null, 300000).catch(() => {});
  await shot('tag_hit');
  const mid = await ev(() => __cel.CINE.fin ? { t: +__cel.CINE.fin.t.toFixed(2), shot: __cel.CINE.fin.shot, pst: __cel.partner.state, slowmo: __cel.CINE.fin.t > 1.02 && __cel.CINE.fin.t < 1.62 } : null);
  await wf(() => !__cel.CINE.fin || __cel.CINE.fin.t > 1.2, null, 300000).catch(() => {}); await shot('tag_flip');
  await wf(() => !__cel.CINE.fin && __cel.hero.state === 'move', null, 300000);
  ok('tag', { dizzy: q, tagged, mid, tags: await ev(() => __cel.CINE.stats.tags), finishers: await ev(() => __cel.CINE.stats.finishers), pstAfter: await ev(() => __cel.partner.state) });
  }
  await simWait(2);
  const info = await ev(() => ({ err: __celErr, sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, stats: __cel.CINE.stats, part: { tpLog: __cel.PART.tpLog, kos: __cel.PART.kos, teleports: __cel.PART.teleports, hops: __cel.PART.hops, climbs: __cel.PART.climbs, downs: __cel.PART.downs },
    hud: (() => { const r = document.getElementById('hpbox').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom)]; })() }));
  ok('info', info);
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
