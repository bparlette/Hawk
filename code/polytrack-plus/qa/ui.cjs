// node qa/ui.cjs <w> <h> <tag> : title (attract), touch/pointer driving, builder place/delete/test, embedded check
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w, h, tag] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|WebGL/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').slice(0, 400)));
  await p.goto('http://127.0.0.1:8811/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(5000); await p.screenshot({ path: `qa/${tag}_title.png` });
  const S = () => p.evaluate(() => ({ m: window.__ptp.st.mode, t: +window.__ptp.st.raceT.toFixed(2), v: +window.__ptp.car.speed.toFixed(1), x: +window.__ptp.car.pos.x.toFixed(2), z: +window.__ptp.car.pos.z.toFixed(1) }));
  console.log('attract', JSON.stringify(await S()));
  const cdp = await c.newCDPSession(p);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const box = async (sel) => { const r = await p.locator(sel).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  if (mob) { // real touch: tap the scene -> handover, then hold GAS + drag the stick right
    await touch('touchStart', [[w / 2, h * 0.3]]); await touch('touchEnd', []); await p.waitForTimeout(400);
    console.log('after tap', JSON.stringify(await S()));
    const g = await box('#gas'); const st = [w * 0.2, h * 0.85];
    await touch('touchStart', [g]); await p.waitForTimeout(1500); console.log('gas held', JSON.stringify(await S()));
    await touch('touchStart', [g, st]); for (let k = 1; k <= 6; k++) { await touch('touchMove', [g, [st[0] + k * 10, st[1]]]); await p.waitForTimeout(60); }
    await p.waitForTimeout(800); const s1 = await S(); console.log('gas+steer right', JSON.stringify(s1), 'steer', await p.evaluate(() => window.__ptp.car.steer.toFixed(3)));
    await p.screenshot({ path: `qa/${tag}_touch.png` });
    await touch('touchEnd', []); await p.waitForTimeout(300);
    const rb = await box('#bRespawn'); await touch('touchStart', [rb]); await touch('touchEnd', []); await p.waitForTimeout(300); console.log('respawn btn (no cp => restart)', JSON.stringify(await S()));
  } else { // keyboard only
    await p.keyboard.press('KeyW'); await p.waitForTimeout(300); console.log('after key', JSON.stringify(await S()));
    await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.down('KeyD'); await p.waitForTimeout(700);
    console.log('W+D', JSON.stringify(await S()), 'steer', await p.evaluate(() => window.__ptp.car.steer.toFixed(3)));
    await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.waitForTimeout(500);
    console.log('after blur keys cleared', await p.evaluate(() => [window.__ptp.car.steer.toFixed(3)]));
    await p.keyboard.up('KeyW'); await p.keyboard.up('KeyD');
    await p.mouse.move(10, 10); // pointer path on the GAS pad isn't shown on desktop; skip
  }
  // builder
  await p.evaluate(() => window.__ptp.toMenu()); await p.waitForTimeout(500);
  await p.click('#bBuild'); await p.waitForTimeout(1500); await p.screenshot({ path: `qa/${tag}_build.png` });
  const n0 = await p.evaluate(() => window.__ptp.B.pieces.length);
  await p.click('#tClear'); await p.waitForTimeout(300);
  // place start + 3 straights + finish going north from the grid cell under screen centre
  const place = async (type, gx, gz, dir = 0) => p.evaluate(([type, gx, gz, dir]) => { const B = window.__ptp.B; B.sel = type; B.dir = dir; B.del = false; B.pieces.push({ type, gx, gz, dir, L: 0, m: 0 }); }, [type, gx, gz, dir]);
  // real UI tap for the first piece: pick START in the palette, tap the canvas centre
  await p.click('.pb[data-t="start"]'); await p.mouse.click(w / 2, h * 0.4); await p.waitForTimeout(500);
  const afterTap = await p.evaluate(() => window.__ptp.B.pieces.map((q) => [q.type, q.gx, q.gz]));
  console.log('placed by tap', JSON.stringify(afterTap));
  const [, sx, sz] = afterTap[0];
  await p.click('.pb[data-t="straight"]');
  for (let k = 1; k <= 3; k++) await place('straight', sx, sz + k);
  await place('kicker', sx, sz + 4); await place('straight', sx, sz + 6); await place('finish', sx, sz + 7);
  await p.evaluate(() => { window.__ptp.B.pieces = window.__ptp.B.pieces.slice(); }); await p.click('#tRot'); await p.waitForTimeout(300);
  await p.click('#tTest'); await p.waitForTimeout(800); console.log('test drive', JSON.stringify(await S()));
  await p.keyboard.down('KeyW'); let fin = null;
  for (let k = 0; k < 40; k++) { await p.waitForTimeout(400); const s = await S(); if (s.m === 'finish') { fin = s; break; } }
  await p.keyboard.up('KeyW'); console.log('test finish', JSON.stringify(fin));
  await p.waitForTimeout(1500); await p.screenshot({ path: `qa/${tag}_testfinish.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(600); console.log('back to builder', JSON.stringify(await S()));
  // delete mode: remove the finish
  await p.click('#tDel'); const before = await p.evaluate(() => window.__ptp.B.pieces.length);
  await p.mouse.click(w / 2, h * 0.4); await p.waitForTimeout(400); const after = await p.evaluate(() => window.__ptp.B.pieces.length);
  console.log('delete by tap', before, '->', after);
  await p.click('#tExit'); await p.waitForTimeout(600); console.log('exit', JSON.stringify(await S()));
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n')); await b.close();
})();
