// node ci/toadcity/run_finale.js <port> <w> <h> <outDir>
// Finale payoff smoke (hark/finale src/09z_finale.js): ?finale=1&finaleauto=1 plays the celebration (dock + fireworks, DRONE UNLOCKED card, credits),
// returns to the city (CITY SAVED), then flies a scripted drone hop. Then a second load without auto checks tap-to-skip (dock -> credits -> city).
// PASS = every phase reached, credits list >= 19 bosses + radio tracks, drone on/off, crime 0 / CITY SAVED chip, tap skip works, 0 own console errors.
const { open, writeResult } = require('./common');
(async () => {
  const [port, w = '390', h = '844', outDir = 'out'] = process.argv.slice(2);
  const name = `finale_${w}x${h}`; const t0 = Date.now();
  const { b, p, errs, warns, ignored } = await open(w, h);
  const res = { name, viewport: `${w}x${h}`, pass: false, reason: '', wall: 0, errors: errs, warnings: warns, ignored, phases: [], shots: [] };
  const st = () => p.evaluate(() => { const F = __finale.F; return { phase: F.phase, t: +F.t.toFixed(1), bursts: F.bursts, drone: __finale.DR.on, log: F.log.slice(), credits: F.credits, done: !!F.done, celErr: __celErr.n, celLast: __celErr.last }; });
  const shot = async (tag) => { const f = `${outDir}/${name}_${tag}.png`; await p.screenshot({ path: f }).catch(() => {}); res.shots.push(f); };
  try {
    await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&finale=1&finaleauto=1`);
    await p.waitForFunction(() => window.__finale && __finale.F.on, null, { timeout: 120000 });
    const seen = new Set(); const want = { fireworks: false, card: false, cred: false, drone: false };
    for (let i = 0; i < 400; i++) {
      await p.waitForTimeout(300);
      const s = await st(); if (!seen.has(s.phase)) { seen.add(s.phase); res.phases.push(s.phase + '@' + s.t); console.log('PHASE', s.phase, s.t); }
      if (!want.fireworks && s.phase === 'dock' && s.bursts >= 4 && s.t > 2.6) { want.fireworks = true; await shot('fireworks'); }
      if (!want.card && s.phase === 'card' && s.t > 0) { want.card = true; await p.waitForTimeout(500); await shot('card'); }
      if (!want.cred && s.phase === 'cred') { want.cred = true; await p.waitForTimeout(1500); await shot('credits'); }
      if (!want.drone && s.drone) { want.drone = true; await p.waitForTimeout(1800); await shot('drone'); }
      if (s.log.includes('drone:auto:done') || s.log.includes('drone:auto:fail')) break;
    }
    await p.waitForTimeout(800); await shot('city');
    const a = await st();
    const city = await p.evaluate(() => ({ chip: (document.getElementById('fcrime') || {}).textContent || '', chipOn: document.getElementById('fcrime').classList.contains('on'), crime: __duels.BC.cityCrime(),
      ls: JSON.parse(localStorage.getItem('tcb_finale') || '{}'), act: (document.getElementById('albl-c') || {}).textContent || '', modeFree: !__duels.cur, body: document.body.className }));
    res.auto = { log: a.log, credits: a.credits, city };
    console.log('AUTO', JSON.stringify(res.auto));
    // tap-to-skip on a plain ?finale=1 run: tap after 1.2 s -> credits; tap again -> the city
    await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&finale=1`);
    await p.waitForFunction(() => window.__finale && __finale.F.on, null, { timeout: 120000 });
    await p.waitForFunction(() => __finale.F.t > 1.3, null, { timeout: 60000 });
    const box = await p.evaluate(() => { const r = document.getElementById('gl').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.4 }; });
    const tap = async () => { if (+w < 900) await p.touchscreen.tap(box.x, box.y); else await p.mouse.click(box.x, box.y); };
    await tap(); await p.waitForTimeout(400); const s1 = await st();
    await p.waitForFunction(() => __finale.F.pt > 1.3, null, { timeout: 60000 }); await tap(); await p.waitForTimeout(2500); const s2 = await st();
    res.skip = { afterTap1: s1.phase, afterTap2: s2.phase, log: s2.log };
    console.log('SKIP', JSON.stringify(res.skip));
    const ok = {
      phases: ['dock', 'card', 'cred'].every((x) => a.log.includes(x === 'dock' ? 'start:param' : x === 'cred' ? 'credits' : x)),
      fireworks: want.fireworks, hug: a.log.includes('hug'), unlocked: a.log.includes('drone:unlocked'),
      credits: !!a.credits && a.credits.bosses >= 19 && a.credits.tracks > 0 && !!a.credits.final,
      city: a.log.some((l) => l.startsWith('city:saved:0')) && city.chipOn && /CITY SAVED/.test(city.chip) && city.crime === 0 && city.ls.saved === true && city.ls.drone === true,
      drone: a.log.includes('drone:on:auto') && a.log.includes('drone:auto:done') && want.drone,
      skip: s1.phase === 'cred' && s2.phase === 'off' && s2.log.includes('finish'),
      celErr: a.celErr === 0 && s2.celErr === 0,
    };
    res.ok = ok; const bad = Object.keys(ok).filter((k) => !ok[k]);
    res.pass = bad.length === 0;
    res.reason = `phases ${res.phases.join(' ')}; bursts ${a.bursts}; credits ${a.credits ? a.credits.bosses + ' bosses + ' + a.credits.tracks + ' tracks' : 'none'}; chip "${city.chip}"; skip ${s1.phase}->${s2.phase}` + (bad.length ? ' BAD: ' + bad.join(',') : '') + (a.celErr ? ' celErr ' + a.celLast : '');
  } catch (e) { res.reason = 'exception: ' + e.message; await p.screenshot({ path: `${outDir}/${name}_exception.png` }).catch(() => {}); }
  if (errs.length) { res.pass = false; res.reason += ` | ${errs.length} own console error(s)`; }
  res.wall = +((Date.now() - t0) / 1000).toFixed(0);
  writeResult(outDir, name, res);
  await b.close();
  process.exit(res.pass ? 0 : 1);
})();
