// node T/qa.js <w> <h> <course> <tag>: full flow QA at one viewport.
// menu shot -> lose (stand still: FOXTROT busts you) -> tap RETRY -> fall off a roof -> RESTART -> bot run to the finish -> results shot -> tap RETRY
// Runs the sim fast (?sim / ?rskip / low dpr) and bumps the resolution back up for each screenshot.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [w = '1280', h = '720', course = '0', tag = 'L'] = process.argv.slice(2);
  const D = __dirname + '/qa'; fs.mkdirSync(D, { recursive: true });
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|ReadPixels/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  const R = {}; const log = (...a) => { console.log(...a); };
  await p.goto(`http://127.0.0.1:8761/index.html?bot=1&sim=6&rskip=6&dpr=0.4`);
  await p.waitForFunction(() => window.__rt && __rt.frames > 3, null, { timeout: 150000 });
  const st = () => p.evaluate(() => { const G = __rt.GAME, P = __rt.PL.P; return { st: G.st, t: +G.time.toFixed(2), ps: +G.ps.toFixed(1), len: +G.B.len.toFixed(1), p: P.st, y: +P.pos.y.toFixed(1), why: G.why, cpi: G.cpi, gap: +__rt.DRN.D.gap.toFixed(1), err: __celErr.n, errl: __celErr.last.slice(0, 300) }; });
  const shot = async (name, dpr = 1) => { await p.evaluate((d) => __rt.setDpr(d), dpr); await p.waitForTimeout(2500); await p.screenshot({ path: `${D}/${tag}_${name}.png` }); await p.evaluate(() => __rt.setDpr(0.4)); };
  const waitSt = async (re, secs) => { for (let i = 0; i < secs; i++) { const s = await st(); if (re.test(s.st)) return s; await p.waitForTimeout(1000); } return await st(); };
  const tap = async (sel) => { const bb = await p.locator(sel).boundingBox(); if (!bb) return 'nobox'; if (mob) await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); return 'ok'; };
  // 1. menu
  await shot('01_menu');
  R.menuCards = await p.locator('.card').count();
  // overflow check
  R.overflow = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  // 2. start the course by tapping its card
  R.tapCard = await tap('#card' + course);
  let s = await waitSt(/run/, 30); log('started', JSON.stringify(s));
  // 3. lose: bot off, stand still until FOXTROT busts us
  await p.evaluate(() => { __rt.BOTS.off = true; });
  s = await waitSt(/failed/, 90); log('lose', JSON.stringify(s)); R.lose = s.st === 'failed' ? s.why : 'NO:' + s.st;
  await shot('02_busted');
  // 4. tap RETRY
  R.tapRetry = await tap('#fretry'); s = await waitSt(/run|count/, 10); R.retryState = s.st; log('retry', JSON.stringify(s));
  // 5. fall off: shove the runner off the roof edge into the street
  await waitSt(/run/, 20);
  await p.evaluate(() => { const P = __rt.PL.P; P.pos.y += 0.3; P.vel.set(0, 3, 0); P.st = 'air'; P.pos.x += 0; const B = __rt.GAME.B; P.pos.z += 0; // teleport over the street beside the block
    const r = __rt.RK.roofAt(P.pos.x, P.pos.z); if (r) { P.pos.x = r.x1 + 4; } });
  s = await waitSt(/failed/, 30); log('fall', JSON.stringify(s)); R.fall = s.st === 'failed' ? s.why : 'NO:' + s.st;
  await shot('03_fell');
  // 6. RESTART course, bot on, run to the finish
  await p.evaluate(() => { __rt.BOTS.off = false; });
  R.tapRestart = await tap('#frestart');
  let mid = false;
  for (let i = 0; i < 200; i++) {
    s = await st(); if (/done|failed/.test(s.st)) break;
    if (!mid && s.st === 'run' && s.ps > s.len * 0.45) { mid = true; await shot('04_run_mid'); }
    await p.waitForTimeout(1000);
  }
  if (s.st === 'finishing') s = await waitSt(/done/, 30);
  log('finish', JSON.stringify(s)); R.win = s.st === 'done' ? s.t : 'NO:' + s.st + ' ' + s.why + ' ps=' + s.ps + '/' + s.len + ' p=' + s.p;
  R.botlog = await p.evaluate(() => __rt.BOTS.log.join(' '));
  await shot('05_results');
  R.resultText = await p.evaluate(() => [document.getElementById('rtime').textContent, document.getElementById('rmname').textContent, document.getElementById('rbest').textContent].join(' | '));
  R.tapRetry2 = await tap('#rretry'); s = await waitSt(/run|count/, 10); R.retry2State = s.st;
  R.errCount = errs.length; R.celErr = s.err; R.errs = errs.slice(0, 8);
  fs.writeFileSync(`${D}/${tag}_result.json`, JSON.stringify(R, null, 1));
  log('RESULT', JSON.stringify(R));
  await b.close();
})().catch((e) => { console.log('QA CRASH', e.stack); process.exit(1); });
