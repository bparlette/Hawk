// node ccheck.js <port> <outPrefix> <w> <h> : Toad City phase-1 checks
// intro -> water edge collision -> building collision -> Fed Hill climb -> bot walk east past landmarks fighting thugs (+QTE) -> cycle values -> draw calls -> console errors
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, pre, w = '1280', h = '720'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const errs = []; const watch = (p) => { p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url())); };
  const ok = (k, v) => console.log(k, JSON.stringify(v));
  let p = await ctx.newPage(); watch(p);
  const wf = (fn, arg, t = 200000) => p.waitForFunction(fn, arg, { timeout: t, polling: 100 });
  await p.goto(`http://127.0.0.1:${port}/?sim=4&tod=0.1`);
  await wf(() => window.__cel && __cel.frames > 3);
  await wf(() => __cel.CINE.stats.introDone);
  ok('intro', await p.evaluate(() => ({ sec: __cel.CINE.stats.introSec, hero: [__cel.hero.pos.x, __cel.hero.pos.z], cycleLen: __cel.CYC.len, landmarks: __cel.LANDMARKS.length, bosses: __cel.LANDMARKS.filter((l) => l.boss).length })));
  const walk = async (x, z, camYaw, ms) => { await p.evaluate(([x, z, cy]) => { const C = __cel, H = C.hero; H.inv = 1e9; H.pos.set(x, C.groundY(x, z), z); H.vel.set(0, 0); H.set('move'); H.dry = { x, z }; H.wet = 0; C.CAM.yaw = cy; }, [x, z, camYaw]);
    await p.keyboard.down('w'); await p.waitForTimeout(ms); await p.keyboard.up('w'); await p.waitForTimeout(200);
    return p.evaluate(() => { const H = __cel.hero; return { x: +H.pos.x.toFixed(2), z: +H.pos.z.toFixed(2), y: +H.pos.y.toFixed(2), inWater: __cel.isWater(H.pos.x, H.pos.z), wetFrames: H.wet || 0 }; }); };
  // 1. water: walk south off the north promenade into the basin (camera faces +z)
  ok('water_north', await walk(-20, -33, Math.PI, 1500));
  ok('water_west', await walk(-63, 10, Math.PI / 2, 1500)); // west promenade, walking east (+x)
  ok('water_pier_tip', await walk(19, -6, Math.PI, 1500));   // aquarium pier, walking off its south tip
  // 2. buildings: walk north from Pratt St into a block's storefronts, and into the aquarium hall
  ok('building_pratt', await walk(-20, -44, 0, 1500));
  ok('building_aquarium', await walk(19, -6, 0, 1500));
  // 3. Federal Hill is walkable: walk up from Key Hwy
  ok('fedhill', await walk(12, 45, Math.PI, 7000));
  await p.screenshot({ path: pre + 'fedhill.png' });
  // 4. cycle values (default 600 s loop) + clock
  ok('cycle', await p.evaluate(async () => { const C = __cel.CYC, len = C.len; C.pin = null; const out = [];
    for (const tod of [0, 0.25, 0.5, 0.75]) { C.t = tod * C.len; await new Promise((r) => setTimeout(r, 500)); out.push({ tod: +C.tod.toFixed(2), n: +C.n.toFixed(2), lamps: +C.lamps.toFixed(2), fogFar: +__cel.scene.fog.far.toFixed(1), neon: +__cel.NIGHTFX.neon.light.intensity.toFixed(1), clock: document.getElementById('clock').textContent }); }
    return { len, out }; }));
  // 5. draw calls (one rendered frame) at three spots, day
  ok('drawcalls', await p.evaluate(async () => { const C = __cel, R = C.renderer, out = []; C.CYC.pin = 0.1;
    for (const [x, z, y] of [[-45, -32.6, Math.PI / 2], [19, -33, Math.PI / 2], [-3, 40, Math.PI]]) { C.hero.pos.set(x, C.groundY(x, z), z); C.CAM.yaw = -y; await new Promise((r) => setTimeout(r, 1200));
      R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); out.push({ at: [x, z], calls: R.info.render.calls, tris: R.info.render.triangles }); R.info.autoReset = true; R.info.reset(); }
    return out; }));
  // 6. ACT = POWER move in a fight (touch: tap the panel's ACT button; desktop: E), and the arcade stick (touch: drag on the panel's left side)
  await p.evaluate(() => { const C = __cel, e = C.enemies[2]; C.CYC.pin = 0.1; C.hero.inv = 1e9; C.hero.hp = 100; C.hero.pos.set(e.pos.x - 1.6, 0.16, e.pos.z); C.hero.set('move'); C.POWER.cd = 0; C.partner.hp = 100; C.partner.set('move'); C.partner.pos.set(e.pos.x - 3, 0.16, e.pos.z - 2); });
  await p.waitForTimeout(1500);
  const ctx0 = await p.evaluate(() => { const c = __cel.actContext(); return c ? c.kind + ':' + c.label : null; });
  let taps = 0; for (; taps < 3; taps++) { if (await p.evaluate(() => __cel.POWER.uses > 0)) break;
    if (mob) { const bb = await p.locator('#aact').boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(120); await p.mouse.up(); }
    else await p.keyboard.press('e');
    await p.waitForTimeout(700); }
  await p.waitForTimeout(2500);
  await p.screenshot({ path: pre + 'power.png' });
  ok('power', { taps, ctxBefore: ctx0, label: await p.evaluate(() => document.getElementById('albl-c').textContent), stats: await p.evaluate(() => ({ uses: __cel.POWER.uses, hits: __cel.POWER.hits, joins: __cel.POWER.joins, cd: +__cel.POWER.cd.toFixed(1) })) });
  // 7. WATER KILLS: a thug at the promenade edge, POWER move from the land side -> it flies in, splashes, sinks, counts as a KO; Harold knocked in -> back on the dock
  const k0 = await p.evaluate(() => { const C = __cel, e = C.enemies[4]; e.hp = e.maxHp; e.dizzied = true; e.set('chase'); e.pos.set(-27, 0.16, -30.6); e.root.visible = true; C.hero.pos.set(-27, 0.16, -32.5); C.partner.hp = 100; C.partner.pos.set(-30, 0.16, -34); C.partner.set('move'); C.hero.set('move'); C.hero.yaw = 0; C.POWER.cd = 0; return C.S.kills; });
  await p.waitForTimeout(300); await p.evaluate(() => __cel.press('e'));
  await p.waitForFunction(() => __cel.WATERK.drowned > 0, null, { timeout: 25000 }).catch(() => {}); await p.waitForTimeout(600);
  await p.screenshot({ path: pre + 'splash.png' });
  const wk = await p.evaluate(() => ({ drowned: __cel.WATERK.drowned, e4: __cel.enemies[4].state, kills: __cel.S.kills, power: __cel.POWER.uses }));
  await p.evaluate(() => { const H = __cel.hero; H.inv = 0; H.pos.set(-27, 0.16, -30.6); H.dry = { x: -27, z: -31 }; H.set('down'); H.kb.set(0, 6); H.vy = 3; H.y = 0.01; });
  await p.waitForFunction(() => __cel.WATERK.heroSplash > 0, null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  ok('waterkills', Object.assign(wk, { killsBefore: k0, heroSplash: await p.evaluate(() => __cel.WATERK.heroSplash), heroAfter: await p.evaluate(() => { const H = __cel.hero; return [+H.pos.x.toFixed(1), +H.pos.z.toFixed(1), H.state, __cel.isWater(H.pos.x, H.pos.z)]; }) }));
  if (mob) {
    const r = await p.evaluate(() => { const b = document.getElementById('adeck').getBoundingClientRect(), a = document.getElementById('aact').getBoundingClientRect(), s = document.getElementById('astick').getBoundingClientRect(), j = document.getElementById('acap-a').getBoundingClientRect(), g = document.getElementById('gl').getBoundingClientRect();
      return { deck: [Math.round(b.width), Math.round(b.height)], act: Math.round(a.width), swing: Math.round(j.width), stick: [Math.round(s.width), Math.round(s.height)], game: [Math.round(g.width), Math.round(g.height)], panelH: getComputedStyle(document.documentElement).getPropertyValue('--panel') }; });
    await p.evaluate(() => { const C = __cel; C.hero.pos.set(-20, 0.16, -33); C.hero.set('move'); C.CAM.yaw = -Math.PI / 2; });
    const x0 = await p.evaluate(() => __cel.hero.pos.x);
    const bb = await p.locator('#adeck').boundingBox(); const cx = bb.x + bb.width * 0.15, cy = bb.y + bb.height * 0.55;
    await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 10, cy - 30, { steps: 4 }); await p.waitForTimeout(1200);
    await p.screenshot({ path: pre + 'stick.png' });
    const st = await p.evaluate(() => document.getElementById('astick').style.transform);
    await p.mouse.up(); await p.waitForTimeout(200);
    ok('panel', Object.assign(r, { stickTransform: st, heroMovedX: +(await p.evaluate(() => __cel.hero.pos.x) - x0).toFixed(2) }));
  }
  await p.close();
  // 7. bot run: east along the promenade past Harborplace, Constellation, WTC, Aquarium, Power Plant, Four Seasons; fights every thug met, presses QTEs
  p = await ctx.newPage(); watch(p);
  await p.goto(`http://127.0.0.1:${port}/?bot=1&sim=4&nointro=1&tod=0.1`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 60000 });
  const t0 = Date.now(); let shot = 0;
  while (Date.now() - t0 < 330000) {
    const st = await p.evaluate(() => ({ done: __cel.BOTR.done, fight: __cel.lockT ? 1 : 0, fin: !!__cel.CINE.fin }));
    if (st.done) break;
    if ((st.fight || st.fin) && shot < 3) { await p.screenshot({ path: pre + 'fight' + shot + '.png' }); shot++; await p.waitForTimeout(1500); }
    await p.waitForTimeout(1000);
  }
  await p.screenshot({ path: pre + 'botend.png' });
  ok('bot', await p.evaluate(() => { const C = __cel; return { done: C.BOTR.done, simSec: +C.S.time.toFixed(1), route: C.BOTR.log, landmarksVisited: C.CITY.log, kills: C.S.kills, hits: C.S.hits, qtePressed: C.BOTR.qtePressed || 0, finishers: C.CINE.stats.finishers, drowned: C.WATERK.drowned, power: C.POWER.uses, powerHits: C.POWER.hits, powerJoins: C.POWER.joins, tags: C.CINE.stats.tags, heroHp: C.hero.hp, heroDowns: C.S.playerDowns, partnerTp: C.PART.teleports, partnerKos: C.PART.kos, hero: [+C.hero.pos.x.toFixed(1), +C.hero.pos.z.toFixed(1)], err: __celErr }; }));
  ok('info', await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, fps: __cel.FPS.v })));
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})();
