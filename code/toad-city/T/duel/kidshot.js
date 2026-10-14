// node T/duel/kidshot.js <port> <w> <h> <outprefix> : Chip Kid design shots. Starts the duel, freezes it (DUELS.hold), and parks the camera
// (a) close on the kid in the cockpit dome, (b) on the whole mech from the front. Writes <outprefix>_kid.png and <outprefix>_mech.png.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, w = '1280', h = '720', pre = 'T/duel/kid'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&duel=chipkid&duelbot=lose&sim=1`);
  await p.waitForFunction(() => window.__duels && __duels.cur && __duels.t > 3.2, null, { timeout: 90000 });
  const park = (k) => p.evaluate((k) => { const D = __duels, C = D.cur; D.hold = true; document.querySelectorAll('#duel .dsay,#duel .dban,#duel .dtell').forEach((e) => e.classList.remove('on'));
    C.R.root.updateMatrixWorld(true); const e = C.R.kid.root.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
    if (k === 'kid') { C.camP.set(x + 0.35, y + 0.75, z - 1.55); C.camL.set(x, y + 0.5, z); } else { C.camP.set(2.2, 3.4, -2.6); C.camL.set(0, 2.7, 4.4); } }, k);
  for (const k of ['kid', 'mech']) { await park(k); await p.waitForTimeout(700); await p.screenshot({ path: `${pre}_${k}.png` }); console.log('SHOT', k); }
  console.log('ERR', errs.length, errs.slice(0, 3).join(' | ')); await b.close();
})();
