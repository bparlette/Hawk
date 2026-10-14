// node ci/toadcity/run_finale.js <port> <w> <h> <outDir>
// Finale payoff smoke (src/09z_finale.js + src/09z_finale_crowd.js).
// CROWD builds (window.__finale.AP present, hark/finale-crowd): ?finale=1&finaleauto=1 plays dock + fireworks -> DRONE UNLOCKED card -> the drone launches on its own
//   into the AUTOPILOT FLYOVER (credits rolling over it). PASS needs: autopilot on + the camera moving along the tour, the cheering-crowd instances in the scene
//   (people, lit windows, signs), a real input (touch tap at 390, key W at 1280) taking over, the ▶ AUTO chip resuming the tour, V landing (crowd removed from the
//   scene = normal city unchanged), a second V launch starting on autopilot again, CITY SAVED chip + crime 0. Then a plain ?finale=1 load: tap after 1.3 s skips
//   to the flyover, a second tap takes over.
// OLD builds (hark/finale before the crowd): the original checks (credits phase, scripted drone hop, tap skip dock -> credits -> city).
const { open, writeResult } = require('./common');
(async () => {
  const [port, w = '390', h = '844', outDir = 'out'] = process.argv.slice(2);
  const name = `finale_${w}x${h}`; const t0 = Date.now(); const mob = +w < 900;
  const { b, p, errs, warns, ignored } = await open(w, h);
  const res = { name, viewport: `${w}x${h}`, pass: false, reason: '', wall: 0, errors: errs, warnings: warns, ignored, phases: [], shots: [] };
  const st = () => p.evaluate(() => { const F = __finale.F; return { phase: F.phase, t: +F.t.toFixed(1), bursts: F.bursts, drone: __finale.DR.on, ap: !!(__finale.AP && __finale.AP.on), log: F.log.slice(), credits: F.credits, done: !!F.done, celErr: __celErr.n, celLast: __celErr.last,
    pos: __finale.DR.on ? camPos() : null, crowd: window.__crowd ? __crowd.stats() : null, perf: __finale.perf ? __finale.perf() : null };
    function camPos() { return [__finale.DR.pos.x, __finale.DR.pos.y, __finale.DR.pos.z]; } });
  const shot = async (tag) => { const f = `${outDir}/${name}_${tag}.png`; await p.screenshot({ path: f }).catch(() => {}); res.shots.push(f); };
  const box = async () => p.evaluate(() => { const r = document.getElementById('gl').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.4 }; });
  const tap = async () => { const c = await box(); if (mob) await p.touchscreen.tap(c.x, c.y); else await p.mouse.click(c.x, c.y); };
  try {
    await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&finale=1&finaleauto=1`);
    await p.waitForFunction(() => window.__finale && __finale.F.on, null, { timeout: 120000 });
    const crowdBuild = await p.evaluate(() => !!(__finale.AP && window.__crowd));
    res.crowdBuild = crowdBuild;
    if (crowdBuild) {
      const want = { fireworks: false, card: false };
      for (let i = 0; i < 500; i++) {
        await p.waitForTimeout(300); const s = await st();
        if (!res.phases.includes(s.phase)) { res.phases.push(s.phase); console.log('PHASE', s.phase, s.t); }
        if (!want.fireworks && s.phase === 'dock' && s.bursts >= 4 && s.t > 2.6) { want.fireworks = true; await shot('fireworks'); }
        if (!want.card && s.phase === 'card') { want.card = true; await p.waitForTimeout(500); await shot('card'); }
        if (s.drone && s.ap && s.crowd && s.crowd.people > 0) break;
      }
      await p.waitForTimeout(1500);
      // the autopilot advances by min(frame dt, 0.05 s) per frame, so on a slow swiftshader runner (700-1000 ms frames) 3 s of wall clock is only 3-4 frames
      // (~0.77 m each) and "moved > 3 m" became a coin flip on frame count. Sample over >= 3 s AND >= 6 rendered frames (cap 15 s) so the check measures the tour moving.
      const fr = () => p.evaluate(() => window.__cel ? __cel.frames : 0);
      const a0 = await st(); const f0 = await fr(), w0 = Date.now(); await p.waitForTimeout(3000);
      while ((await fr()) - f0 < 6 && Date.now() - w0 < 15000) await p.waitForTimeout(400);
      const a1 = await st(); const flyFrames = (await fr()) - f0, flyMs = Date.now() - w0; await shot('flyover');
      const moved = a0.pos && a1.pos ? Math.hypot(a1.pos[0] - a0.pos[0], a1.pos[1] - a0.pos[1], a1.pos[2] - a0.pos[2]) : 0;
      console.log('FLYOVER', JSON.stringify({ moved, frames: flyFrames, ms: flyMs, crowd: a1.crowd, perf: a1.perf }));
      // input takes over
      if (mob) await tap(); else { await p.keyboard.down('w'); await p.waitForTimeout(600); await p.keyboard.up('w'); }
      await p.waitForTimeout(800); const tk = await st(); await shot('takeover');
      // the AUTO chip resumes
      const chip = await p.evaluate(() => { const e = document.querySelector('#fdrone .dauto'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, vis: getComputedStyle(e).display !== 'none' }; });
      if (mob) await p.touchscreen.tap(chip.x, chip.y); else await p.mouse.click(chip.x, chip.y);
      await p.waitForTimeout(800); const rs = await st();
      // land (crowd leaves the scene), relaunch (autopilot again), land
      await p.keyboard.press('v'); await p.waitForTimeout(1200); const ld = await st();
      await p.keyboard.press('v'); await p.waitForTimeout(1500); const re = await st();
      await p.keyboard.press('v'); await p.waitForTimeout(1200); const ld2 = await st(); await shot('city');
      const city = await p.evaluate(() => ({ chip: (document.getElementById('fcrime') || {}).textContent || '', chipOn: document.getElementById('fcrime').classList.contains('on'), crime: __duels.BC.cityCrime(),
        ls: JSON.parse(localStorage.getItem('tcb_finale') || '{}'), modeFree: !__duels.cur, body: document.body.className }));
      res.auto = { log: ld2.log, credits: a1.credits, city, moved: +moved.toFixed(1), crowd: a1.crowd, perf: a1.perf, takeover: { ap: tk.ap, drone: tk.drone }, resume: { ap: rs.ap, chipVisible: chip.vis }, landed: ld.crowd, relaunch: { drone: re.drone, ap: re.ap, crowd: re.crowd } };
      console.log('AUTO', JSON.stringify(res.auto));
      // plain ?finale=1: tap skips the dock straight to the flyover, a second tap takes over
      await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&finale=1`);
      await p.waitForFunction(() => window.__finale && __finale.F.on, null, { timeout: 120000 });
      await p.waitForFunction(() => __finale.F.t > 1.3, null, { timeout: 60000 });
      await tap(); await p.waitForFunction(() => __finale.DR.on && __finale.AP.on, null, { timeout: 60000 }).catch(() => {}); const s1 = await st();
      await p.waitForTimeout(1200); await tap(); await p.waitForTimeout(800); const s2 = await st();
      res.skip = { afterTap1: { drone: s1.drone, ap: s1.ap }, afterTap2: { drone: s2.drone, ap: s2.ap }, log: s2.log };
      console.log('SKIP', JSON.stringify(res.skip));
      const L = ld2.log, has = (x) => L.includes(x), cr = a1.crowd || {};
      const ok = {
        phases: has('start:param') && has('card') && has('credits') && has('flyover'), fireworks: want.fireworks, hug: has('hug'), unlocked: has('drone:unlocked'),
        credits: !!a1.credits && a1.credits.bosses >= 19 && a1.credits.tracks > 0 && !!a1.credits.final,
        autopilot: has('drone:on:finale') && has('drone:autopilot:finale') && moved > 3,
        crowd: cr.inScene === true && cr.people >= 60 && cr.windows >= 1 && cr.signs >= 1,
        takeover: tk.drone && !tk.ap && L.some((x) => x.startsWith('drone:takeover:')),
        resume: rs.ap && has('drone:autopilot:chip'),
        land: !ld.drone && ld.crowd && ld.crowd.inScene === false && ld.crowd.people === 0 && has('drone:off:v'),
        relaunchAuto: re.drone && re.ap && has('drone:autopilot:v') && !ld2.drone,
        city: L.some((l) => l.startsWith('city:saved:0')) && city.chipOn && /CITY SAVED/.test(city.chip) && city.crime === 0 && city.ls.saved === true && city.ls.drone === true,
        skip: s1.drone && s1.ap && s2.drone && !s2.ap && s2.log.includes('finish'),
        celErr: ld2.celErr === 0 && s2.celErr === 0,
      };
      res.ok = ok; const bad = Object.keys(ok).filter((k) => !ok[k]); res.pass = bad.length === 0;
      res.reason = `CROWD build; phases ${res.phases.join(' ')}; bursts ${a1.bursts}; flyover moved ${moved.toFixed(1)} m in ${flyFrames} frames / ${(flyMs / 1000).toFixed(1)} s; crowd ${cr.people} people / ${cr.windows} windows / ${cr.signs} signs / ${cr.stoops} stoops; draw calls ${a1.perf && a1.perf.calls}; frame ${a1.perf && a1.perf.ftAvg} ms (swiftshader); takeover ${tk.ap ? 'NO' : 'yes'}; chip resume ${rs.ap}; chip "${city.chip}"`
        + (bad.length ? ' BAD: ' + bad.join(',') : '') + (ld2.celErr ? ' celErr ' + ld2.celLast : '');
    } else {
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
      await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&finale=1`);
      await p.waitForFunction(() => window.__finale && __finale.F.on, null, { timeout: 120000 });
      await p.waitForFunction(() => __finale.F.t > 1.3, null, { timeout: 60000 });
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
    }
  } catch (e) { res.reason = 'exception: ' + e.message; await p.screenshot({ path: `${outDir}/${name}_exception.png` }).catch(() => {}); }
  if (errs.length) { res.pass = false; res.reason += ` | ${errs.length} own console error(s)`; }
  res.wall = +((Date.now() - t0) / 1000).toFixed(0);
  writeResult(outDir, name, res);
  await b.close();
  process.exit(res.pass ? 0 : 1);
})();
