// node tests/coop/areas.js <port> <w> <h> : co-op split / merge inside the 2026-10-15 street-life + gear areas, P2 pickups, and feature smoke.
// For each area (horde, brawl, party/sneak, stoop ambush, weapons, rooftop, dirt bike): two pads, P2 walks apart, 2 s edge hold -> split view, walks back -> merged shared camera.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const [port, w = '1280', h = '720'] = process.argv.slice(2);
const src = fs.readFileSync(path.join(__dirname, 'coop.js'), 'utf8'); const i0 = src.indexOf('const INIT = `') + 14, INIT = src.slice(i0, src.indexOf('`;', i0));
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  await ctx.addInitScript(INIT); const p = await ctx.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => { const u = r.url(); if (!/youtube|ytimg|google|doubleclick|gstatic|bandcamp|bcbits/.test(u)) errs.push('reqfail: ' + u); });
  let fails = 0; const T = (n, ok, info) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + ' ' + JSON.stringify(info)); };
  const E = (fn, a) => p.evaluate(fn, a);
  const t0w = Date.now();
  const waitGame = async (sec) => { const t0 = await E(() => __cel.S.time); await p.waitForFunction((t) => __cel.S.time >= t, t0 + sec, { timeout: 240000, polling: 50 }); };
  const st = () => E(() => { const c = __coop, H = __cel.hero, P = __cel.partner; return { on: c.on, split: c.C.split, k: +c.C.k.toFixed(2), sep: +Math.hypot(P.pos.x - H.pos.x, P.pos.z - H.pos.z).toFixed(2), splits: c.C.splits, merges: c.C.merges, MS: c.MAXSEP(), hs: H.state, ps: P.state, hp: [+H.pos.x.toFixed(1), +H.pos.z.toFixed(1)], pp: [+P.pos.x.toFixed(1), +P.pos.z.toFixed(1)], fps: __cel.FPS.v }; });
  await p.goto(`http://127.0.0.1:${port}/?nointro&radiotest=1&tod=0&sim=3&street=0`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 5 && window.__coop && window.__street && window.__gear, null, { timeout: 120000 });
  await E(() => { for (const e of __cel.enemies) { e.set('dead'); e.respawn = 1e9; e.root.visible = false; e.hpS.visible = false; } const H = __cel.hero; H.pos.set(-45, H.pos.y, -32.6); __pads[0] = __mkPad(0); });
  await waitGame(0.3); await E(() => { __pads[1] = __mkPad(1); __pads[1].buttons[9].pressed = true; }); await waitGame(0.4); await E(() => { __pads[1].buttons[9].pressed = false; }); await waitGame(0.3);
  let s = await st(); T('join: two pads, co-op on', s.on, s);
  const place = (hx, hz, px, pz) => E(([hx, hz, px, pz]) => { const C = __cel, H = C.hero, P = C.partner; H.rt = P.rt = false; H.pos.set(hx, C.groundY(hx, hz), hz); P.pos.set(px, C.groundY(px, pz), pz); H.vel.set(0, 0); P.vel.set(0, 0); H.y = P.y = 0; if (H.state !== 'ride') H.set('move'); if (P.state !== 'ride') P.set('move'); H.inv = P.inv = 1e9; }, [hx, hz, px, pz]);
  const splitMerge = async (name, away) => {
    await E(() => { __cel.hero.inv = __cel.partner.inv = 1e9; });
    const s0 = await st(); await E((a) => { __drv.p2 = a; }, away); await waitGame(3.0);
    let s1 = await st(); if (!s1.split) { await waitGame(2.0); s1 = await st(); }
    T(name + ': walk apart + 2 s edge hold -> split', s1.split && s1.splits > s0.splits, { s0: { splits: s0.splits, sep: s0.sep }, s1: { split: s1.split, sep: s1.sep, splits: s1.splits, hp: s1.hp, pp: s1.pp, ps: s1.ps } });
    await E(() => { __drv.p2 = 'toward'; }); await p.waitForFunction(() => !__coop.C.split, null, { timeout: 150000, polling: 50 }).catch(() => {});
    await E(() => { __drv.p2 = 'stop'; }); await waitGame(1.2); const s2 = await st();
    T(name + ': walk back -> merged shared camera', !s2.split && s2.merges > s0.merges && s2.k === 0, { split: s2.split, merges: s2.merges, k: s2.k, sep: s2.sep });
    return s2; };
  const awayE = { x: 15, z: -32.6 };
  // 1. HORDE
  await place(-45, -32.6, -43.5, -32.6); await E(() => __street.ev('horde')); await waitGame(2.5);
  s = await E(() => ({ live: __street.live().filter((x) => x[0] > 30).length, chip: document.getElementById('slchip').textContent }));
  T('horde: mooks pour in, counter chip shows', s.live >= 3 && /HORDE/.test(s.chip), s);
  await splitMerge('horde', awayE);
  await E(() => { const H = __cel.hero; H.inv = 1e9; for (const e of __cel.enemies) if (e.alive && e.pool) { e.hp = 1; } });
  // 2. BRAWL (mixed archetypes, comic combo pops)
  await E(() => { __street.EV.horde = null; for (const e of __cel.enemies) if (e.pool && e.alive) __street.X.sleep(e); }); await place(-45, -32.6, -43.5, -32.6); await E(() => __street.ev('brawl')); await waitGame(2.5);
  s = await E(() => ({ arch: [...new Set(__street.live().filter((x) => x[0] > 30).map((x) => x[1]))], chip: document.getElementById('slchip').textContent }));
  T('brawl: mixed thugs, STREET BRAWL chip', s.arch.length >= 1 && /BRAWL/.test(s.chip), s);
  await splitMerge('brawl', awayE);
  // 3. PARTY + spidey sense
  await E(() => { __street.EV.brawl = null; for (const e of __cel.enemies) if (e.pool && e.alive) __street.X.sleep(e); }); await place(-45, -32.6, -43.5, -32.6);
  const party = await E(() => { const P = __street.ev('party'); return P ? { x: P.x, z: P.z, n: P.members.length } : null; });
  T('party: spawns with dancers + boombox', !!party && party.n >= 3, party);
  if (party) { await place(party.x + 6, party.z, party.x + 7.5, party.z); await E(([x, z]) => { const P = __cel.partner; __cel.partner.yaw = 0; for (const e of __cel.enemies) if (e.state === 'xparty') e.yaw = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z); }, [party.x, party.z]); await waitGame(1.2);
    s = await E(() => ({ sus: __street.sus(), log: __street.S.log.slice(-4), op: +document.getElementById('slsense').style.opacity }));
    T('spidey sense: P2 (Mavis) in a sight cone -> tingle + edge flash', s.sus[1] > 0.25 || s.log.some((l) => /sense:p2|spotted/.test(l)), s);
    await place(-45, -32.6, -43.5, -32.6); }
  await splitMerge('party', awayE);
  // 4. STOOP AMBUSH
  await E(() => { for (const e of __cel.enemies) if (e.pool && e.alive) __street.X.sleep(e); for (const P of __street.EV.parties.slice()) P.prop.visible = false; __street.EV.parties.length = 0; });
  const amb = await E(() => { const A = __street.ev('ambush'); return A ? { n: A.members.length, x: A.members[0].pos.x, z: A.members[0].pos.z } : null; });
  T('ambush: lurkers sit on stoops', !!amb && amb.n >= 3, amb);
  if (amb) { await place(amb.x + 2, amb.z + 2, amb.x + 3, amb.z + 2); await waitGame(1.0); s = await E(() => ({ log: __street.S.log.slice(-3), st: __street.live().filter((x) => x[0] > 30).map((x) => x[2]) }));
    T('ambush: pass close -> they pop out and fan out to encircle', s.log.includes('ambush:sprung') && s.st.some((q) => q === 'xflank' || q === 'chase' || q === 'xpop'), s); }
  await place(-45, -32.6, -43.5, -32.6); await waitGame(0.5); await splitMerge('ambush', awayE);
  // 5. WEAPONS: P2 grabs a pickup and uses it
  await E(() => { for (const e of __cel.enemies) if (e.pool && e.alive) __street.X.sleep(e); __street.EV.ambush = null; }); await place(-45, -32.6, -43.5, -32.6);
  await E(() => { const P = __cel.partner; __street.drop('mallet', P.pos.x + 2.5, P.pos.z); __drv.p2 = { x: P.pos.x + 2.6, z: P.pos.z }; }); await waitGame(1.4); await E(() => { __drv.p2 = 'stop'; });
  s = await E(() => ({ wpn: __cel.partner.wpn, hud: document.getElementById('slwpn').textContent, log: __street.S.log.filter((l) => /pick/.test(l)) }));
  T('P2 grabs a weapon pickup (HUD icon + uses)', !!s.wpn && s.wpn.k === 'mallet' && /MALLET/.test(s.hud), s);
  await E(() => { __pads[1].buttons[2].pressed = true; }); await waitGame(0.15); await E(() => { __pads[1].buttons[2].pressed = false; }); await waitGame(0.3);
  s = await E(() => ({ wpn: __cel.partner.wpn, fired: __gear.ST.fired })); T('P2 swings the mallet (uses tick down)', s.fired.mallet >= 1 && (!s.wpn || s.wpn.n === 5), s);
  await E(() => { const P = __cel.partner; __street.drop('cake', P.pos.x + 1.5, P.pos.z); P.hp = 50; __drv.p2 = { x: P.pos.x + 1.6, z: P.pos.z }; }); await waitGame(1.0); await E(() => { __drv.p2 = 'stop'; });
  s = await E(() => ({ hp: __cel.partner.hp })); T('P2 grabs a crab-cake heal', s.hp > 50, s);
  await E(() => { __gear.give('p1', 'brick'); }); await splitMerge('weapons', awayE);
  // 6. ROOFTOP: Harold up on the Fells roofs, P2 on the street
  const R = await E(() => __gear.route.LAD); T('rooftop route: ladder + planks built', !!R && __gear !== null, R);
  if (R) { await place(R.x, R.z, R.x + 1.5, R.z + 1); await E(() => { __cel.press('e'); }); await waitGame(1.6);
    s = await E(() => ({ rt: !!__cel.hero.rt, y: +__cel.hero.pos.y.toFixed(1), log: __gear.ST.log.slice(-3) })); T('rooftop: CLIMB UP puts Harold on the roof', s.rt && s.y > 6, s);
    await splitMerge('rooftop', { x: R.x + 50, z: R.z + 1.2 }); }
  // 7. DIRT BIKE: P2 rides at speed
  await place(-40, -37.5, -37.6, -37.5); await E(() => { __gear.mount('p2', 0); }); await waitGame(0.3);
  s = await E(() => ({ ps: __cel.partner.state, bike: !!__cel.partner.bike })); T('P2 hops on a dirt bike', s.bike && s.ps === 'ride', s);
  await E(() => { __pads[1].buttons[0].pressed = false; }); const sb = await splitMerge('bike', { x: 30, z: -37.8 });
  await E(() => { __drv.p2 = { x: 0, z: -37.8 }; __pads[1].buttons[0].pressed = true; }); await waitGame(1.2); await E(() => { __pads[1].buttons[0].pressed = false; __drv.p2 = 'stop'; }); await waitGame(1.0);
  s = await E(() => ({ log: __gear.ST.log.slice(-4), w: __gear.ST.wheelies, wo: __gear.ST.wipeouts })); T('bike: wheelie banks or wipes out (meter works)', s.w + s.wo >= 1 || s.log.some((l) => /wheelie|wipeout/.test(l)), s);
  await E(() => __gear.dismount('p2'));
  s = await st(); const own = errs.filter((e) => !/\[3rd/.test(e));
  console.log('FPS', s.fps, 'WALL', ((Date.now() - t0w) / 1000).toFixed(0) + 's');
  console.log('ERRORS', own.length, own.slice(0, 6).join(' | ')); console.log(fails === 0 && own.length === 0 ? 'AREAS_ALL_PASS' : 'AREAS_FAIL ' + fails);
  await b.close();
})().catch((e) => { console.log('CRASH', e && e.stack || e); process.exit(1); });
