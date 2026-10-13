// node ci/toadcity/run_city.js <port> <w> <h> <outDir>
// City smoke (from game-int T/w2b/city.js): load the city, wait for frames, teleport to every boss entry ring present
// in this build and check the ring shows (or, for entries without a BEAM ring such as carl's door, the ACT label). PASS = city renders, every present ring is here, 0 own console errors.
const { open, writeResult } = require('./common');
const IDS = (process.env.CITY_BOSSES || 'crabcake,poolshark,scrubber,honqueen,shellacious,sugarrush,cobblestone,compking,ravenking,brewmaster,carl,rodney,pigeon,chipkid').split(',');
(async () => {
  const [port, w = '1280', h = '720', outDir = 'out'] = process.argv.slice(2);
  const name = `city_${w}x${h}`; const t0 = Date.now();
  const { b, p, errs, warns, ignored } = await open(w, h);
  const res = { name, viewport: `${w}x${h}`, pass: false, reason: '', wall: 0, errors: errs, warnings: warns, ignored, rings: [] };
  try {
    await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&tod=0.1`);
    await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 120000 });
    await p.waitForTimeout(3000);
    await p.screenshot({ path: `${outDir}/${name}_start.png` });
    for (const id of IDS) {
      const r = await p.evaluate(async (id) => { const C = __cel, D = __duels, K = D && D.kinds[id]; if (!K) return { id, missing: true }; const T = K.trigger; if (!T) return { id, noTrigger: true }; const o = { id, trig: { x: +T.x.toFixed(1), z: +T.z.toFixed(1) } }; const CSD = id === 'cobblestone' && window.__cobblestone && __cobblestone.isDay; const NI = (id === 'cobblestone' && !CSD) || id === 'carl'; // cobble-storm builds: the Cobblestone ring is checked BY DAY C.CYC.pin = NI ? 0.5 : 0.1; await new Promise((r) => setTimeout(r, NI ? 2500 : 300));
        C.hero.pos.set(T.x + 0.3, C.groundY(T.x, T.z), T.z + 0.2); await new Promise((r) => setTimeout(r, 1500));
        o.ringHere = D.BEAM.list.some((b) => { const v = b.ring.getWorldPosition(b.ring.position.clone()); return b.ring.visible && Math.hypot(v.x - T.x, v.z - T.z) < 5; });
        o.act = (document.getElementById('albl-c') || {}).textContent || ''; o.hasBeam = D.BEAM.list.some((b) => b.K === K); o.ok = o.hasBeam ? o.ringHere : !!o.act.trim(); if (CSD) { o.day = __cobblestone.isDay(); o.ok = o.ok && o.day && /CAPTAIN/.test(o.act) && !/AFTER DARK/.test(o.act); } return o; }, id).catch((e) => ({ id, evalErr: e.message }));
      res.rings.push(r); console.log('RING', JSON.stringify(r));
      if (!r.missing && !r.noTrigger) await p.screenshot({ path: `${outDir}/${name}_${id}.png` }).catch(() => {});
    }
    res.frames = await p.evaluate(() => __cel.frames);
    const present = res.rings.filter((r) => !r.missing && !r.noTrigger);
    const bad = present.filter((r) => r.evalErr || !r.ok); // bosses with their own entry (e.g. carl's duckpin door) have no BEAM ring: ACT label must show instead
    res.pass = present.length > 0 && bad.length === 0;
    res.reason = `city rendered (${res.frames} frames); rings ok ${present.length - bad.length}/${present.length}` + (bad.length ? ' BAD: ' + bad.map((r) => r.id).join(',') : '') + `; not in build: ${res.rings.filter((r) => r.missing).map((r) => r.id).join(',') || 'none'}`;
  } catch (e) { res.reason = 'exception: ' + e.message; await p.screenshot({ path: `${outDir}/${name}_exception.png` }).catch(() => {}); }
  if (errs.length) { res.pass = false; res.reason += ` | ${errs.length} own console error(s)`; }
  res.wall = +((Date.now() - t0) / 1000).toFixed(0);
  writeResult(outDir, name, res);
  await b.close();
  process.exit(res.pass ? 0 : 1);
})();
