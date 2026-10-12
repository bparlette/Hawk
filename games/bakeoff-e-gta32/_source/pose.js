// node pose.js <port> -> T/poses.png: close-ups of every hero / thug pose (sim frozen, camera overridden)
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const POSES = [
  ['hero idle', 'p', {}, 0], ['hero idle back', 'p', {}, 180], ['hero run', 'p', { walkT: 5, run: 1 }, 90], ['c1 wind', 'p', { atk: 'c1', el: 2 }, 30],
  ['c1 strike', 'p', { atk: 'c1', el: 5 }, 30], ['c2 strike', 'p', { atk: 'c2', el: 5 }, 30], ['c3 wind', 'p', { atk: 'c3', el: 3 }, 30], ['c3 strike', 'p', { atk: 'c3', el: 8 }, 30],
  ['jump', 'p', { z: 25, vz: 2 }, 60], ['jump slash', 'p', { atk: 'jump', el: 6, z: 25 }, 60], ['cyclone', 'p', { atk: 'power', el: 10, z: 20 }, 40], ['hurt', 'p', { hurtT: 10 }, 60],
  ['down', 'p', { downT: 40 }, 90], ['thug idle', 'e', { state: 'walk', idle: false }, 0], ['thug walk', 'e', { state: 'walk', walkT: 5, run: 1 }, 70], ['punch', 'e', { state: 'attack', t: 18, a32: { kind: 'punch', hit: 16, end: 32 } }, 70],
  ['kick', 'e', { state: 'attack', t: 17, a32: { kind: 'kick', hit: 15, end: 34 } }, 80], ['dash', 'e', { state: 'attack', t: 22, a32: { kind: 'dash', crouch: 14, run: 32, end: 46 } }, 80], ['e hurt', 'e', { state: 'hurt', t: 3 }, 60], ['e down', 'e', { state: 'down', t: 30, z: 0 }, 90],
];
(async () => {
  const port = process.argv[2], i0 = +(process.argv[3] || 0), i1 = +(process.argv[4] || 99);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://127.0.0.1:${port}/?shot=c`);
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage', null, { timeout: 40000 });
  await p.waitForTimeout(500);
  let i = 0;
  for (const [name, who, st, ang] of POSES) { if (i < i0 || i >= i1) { i++; continue; }
    await p.evaluate(([who, st, ang]) => {
      const S = __ss.STATE, P = S.player, E = __e32; E.freeze = true; S.banner = null;
      // reset hero
      Object.assign(P, { atk: null, attackT: 0, z: 0, vz: 0, hurtT: 0, downT: 0, deadT: 0, walkT: 0, inv: 0, hy: 0 });
      const z = S.zone, place = (o, gx, gz) => { const l = __ss.toLocal(z, gx, gz); o.x = l.x; o.y = l.y; };
      P.gx = 0; P.gz = 0; place(P, 0, 0); P.gy = P.fy;
      S.enemies.forEach((e, k) => { place(e, 30 + k * 3, 30); e.state = 'out'; });
      let tgt = P, h = 1.0;
      if (who === 'p') {
        if (st.atk) { const sw = { c1: [3, 4, 6], c2: [3, 4, 7], c3: [4, 6, 12] }[st.atk]; P.atk = st.atk; if (sw) { P.sw = E.SW[st.atk]; P.atkDur = sw[0] + sw[1] + sw[2]; } else { P.atkDur = st.atk === 'power' ? 36 : 22; P.spec = st.atk === 'power' ? { dmg: 3 } : null; } P.attackT = P.atkDur - st.el; }
        if (st.z) { P.z = st.z; P.gy = P.fy + st.z * 0.028; } if (st.vz) P.vz = st.vz; if (st.hurtT) P.hurtT = st.hurtT; if (st.downT) P.downT = st.downT; if (st.walkT) P.walkT = st.walkT;
      } else {
        const e = S.enemies[0]; place(e, 0, 0); Object.assign(e, { idle: false, home: false, z: 0, hy: 0, flash: 0 }, st); tgt = e; P.gx = 40; P.gz = 40; place(P, 40, 40); h = 1.1;
      }
      const a = ang * Math.PI / 180, d = 3.2;
      E.camO = [Math.sin(a) * d, h + 0.5, Math.cos(a) * d, 0, h * 0.75, 0, 42];
      E.run = st.run ? 1 : 0;
    }, [who, st, ang]);
    // let the pose ease in; for walk cycles keep advancing the gait
    for (let f = 0; f < 12; f++) { await p.evaluate(() => { const S = __ss.STATE; if (__e32.run) { const M = __e32.M32; for (const R of [M.hero, ...M.thugs.values()]) if (R) { R.phase = (R.phase || 0) + 0.25; R.spd = 4; } } }); await p.waitForTimeout(40); }
    await p.locator('#screen').screenshot({ path: `T/pose_${String(i).padStart(2, '0')}.png` }); i++;
  }
  console.log('errs', errs.length, errs.slice(0, 3));
  await b.close();
})();
