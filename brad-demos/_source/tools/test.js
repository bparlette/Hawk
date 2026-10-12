// node tools/test.js <port> [phone|desktop|both]
// Full shell test: picker landing, start 4 games by tapping cards, drive each with the on-screen panel (real
// pointer events on the joystick/buttons), switch mid-play, check iframe count <= 2, suspend/resume, scrolling,
// console errors. Writes shots to T/test-* and the phone picker/playing shots to shot-picker.png / shot-playing.png.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const OUT = __dirname + '/..';
const [port, which = 'both'] = process.argv.slice(2);
const results = [];
const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : '')); };

async function diff(p, a, b) {
  return p.evaluate(async ([a, b]) => {
    const load = async (s) => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const A = await load(a), B = await load(b); let n = 0;
    for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 40) n++;
    return +(n / (A.length / 4)).toFixed(4);
  }, [a.toString('base64'), b.toString('base64')]);
}

async function run(b, W, H, tag) {
  const mob = W < 900;
  const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage();
  const shellErr = [], gameErr = [];
  p.on('console', (m) => {
    if (m.type() !== 'error' || /GPU stall|GL Driver|swiftshader|WebGL|GroupMarker/i.test(m.text())) return;
    const u = (m.location() && m.location().url) || '';
    (/\/g\//.test(u) ? gameErr : shellErr).push(u.replace(/^.*\/\/[^/]+/, '') + ' ' + m.text().slice(0, 140));
  });
  p.on('pageerror', (e) => shellErr.push('pageerror ' + e.message.slice(0, 140)));
  p.on('frameattached', (f) => f.on && 0);
  const noScroll = async (when) => {
    const s = await p.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, sy: scrollY }));
    ok(`${tag} no scroll (${when})`, s.sh <= s.ih && s.sw <= s.iw && s.sy === 0, s);
  };
  const frames = () => p.evaluate(() => document.querySelectorAll('#stage iframe').length);
  const gameFrame = (id) => p.frames().find((f) => f.url().includes('/g/' + id + '/'));
  const waitStarted = async (id) => {
    const g = await p.evaluate((id) => fetch('games.json').then((r) => r.json()).then((m) => m.games.find((x) => x.id === id)), id);
    const n = (g.autostart || []).length;
    await p.waitForFunction(([id, n]) => window.__demoShell.active === id && document.getElementById('loading').hidden && (window.__demoLog || []).filter((l) => l.includes(' autostart ' + id + ' ')).length >= n, [id, n], { timeout: 120000, polling: 250 });
    await p.waitForTimeout(2500);
    return g;
  };
  const pick = async (id) => {
    if (await p.isHidden('#picker')) await p.click('#menuBtn');
    await p.waitForSelector('#picker:not([hidden])');
    const card = p.locator(`.card[data-id="${id}"]`);
    await card.scrollIntoViewIfNeeded();
    const t0 = Date.now();
    if (mob) await card.tap(); else await card.click();
    return t0;
  };
  const deckPt = async (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById('deck').getBoundingClientRect(); const S = r.width / 470; return [r.left + x * S, r.top + y * S]; }, [x, y]);
  const stageShot = () => p.locator('#stage').screenshot();
  const keylog = async (id) => { const f = gameFrame(id); return f ? f.evaluate(() => (window.__demo ? window.__demo.keylog.slice() : null)) : null; };
  const gframes = async (id) => { const f = gameFrame(id); return f ? f.evaluate(() => window.__demo && window.__demo.frames) : -1; };
  // drive: hold the stick toward (dx,dy) for ms using a real mouse drag on the panel, then press a button
  const drive = async (id, dirx, diry, btn, shotPath) => {
    const before = await stageShot();
    await p.waitForTimeout(1200);
    const idle = await stageShot();
    const [sx, sy] = await deckPt(70, 77);
    await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx + dirx * 40, sy + diry * 40, { steps: 4 });
    await p.waitForTimeout(1200);
    if (shotPath) await p.screenshot({ path: shotPath });
    const held = await stageShot();
    await p.mouse.up();
    if (btn) {
      const B = { attack: [266, 73], jump: [343, 69], special: [421, 73] }[btn];
      const [bx, by] = await deckPt(B[0], B[1]);
      await p.mouse.move(bx, by); await p.mouse.down(); await p.waitForTimeout(140); await p.mouse.up();
      await p.waitForTimeout(300);
    }
    const kl = await keylog(id);
    const idleD = await diff(p, before, idle), moveD = await diff(p, idle, held);
    fs.writeFileSync(`${OUT}/T/test-${tag}-${id}-idle.png`, idle); fs.writeFileSync(`${OUT}/T/test-${tag}-${id}-held.png`, held);
    return { kl, idleD, moveD };
  };

  // 1) landing = picker
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForSelector('.card');
  await p.waitForTimeout(1500);
  ok(`${tag} picker is the landing screen`, await p.isVisible('#picker'));
  ok(`${tag} no iframe before a pick`, (await frames()) === 0, await frames());
  const cards = await p.locator('.card').count(); ok(`${tag} cards`, cards >= 20, cards);
  const cats = await p.locator('.cat').allTextContents(); ok(`${tag} categories`, cats.length === 4, cats);
  await noScroll('picker');
  await p.screenshot({ path: `${OUT}/T/test-${tag}-picker.png` });
  if (tag === 'phone') await p.screenshot({ path: `${OUT}/shot-picker.png` });

  const plan = [
    ['shell-shock-live', 1, 0, 'attack'],
    ['knockout', -1, 0, 'attack'],
    ['hollow-manor', 0, 1, 'attack'],
    ['knockout', 1, 0, 'jump'],          // swap back to the suspended game
    ['rta-barrel-climb', 1, 0, 'attack'],
  ];
  let prevActive = null;
  for (let i = 0; i < plan.length; i++) {
    const [id, dx, dy, btn] = plan[i];
    const wasSuspended = await p.evaluate(() => window.__demoShell.suspended);
    const t0 = await pick(id);
    if (prevActive) { // mid-play switch: the old game must be paused (rAF parked)
      const pf = gameFrame(prevActive);
      if (pf && prevActive !== id) {
        const f1 = await pf.evaluate(() => window.__demo.frames).catch(() => -1);
        await p.waitForTimeout(700);
        const f2 = await pf.evaluate(() => window.__demo.frames).catch(() => -1);
        ok(`${tag} ${prevActive} suspended (rAF parked) after switching`, f1 >= 0 && f2 === f1, [f1, f2]);
      }
    }
    if (wasSuspended === id) {
      await p.waitForFunction((id) => window.__demoShell.active === id, id);
      ok(`${tag} ${id} resumed from suspended instantly`, Date.now() - t0 < 1500 && await p.isHidden('#loading'), Date.now() - t0);
      await p.waitForTimeout(800);
      const a = await gframes(id); await p.waitForTimeout(600); const bb = await gframes(id);
      ok(`${tag} ${id} running again after resume`, bb > a, [a, bb]);
    } else {
      await waitStarted(id);
    }
    const n = await frames();
    ok(`${tag} iframes <= 2 with ${id}`, n <= 2, n);
    const playingShot = tag === 'phone' && id === 'shell-shock-live' ? `${OUT}/shot-playing.png` : `${OUT}/T/test-${tag}-${id}-${i}.png`;
    const r = await drive(id, dx, dy, btn, playingShot);
    const dirKey = dx > 0 ? 'ArrowRight' : dx < 0 ? 'ArrowLeft' : dy > 0 ? 'ArrowDown' : 'ArrowUp';
    const btnKey = await p.evaluate(([id, btn]) => fetch('games.json').then((r) => r.json()).then((m) => m.games.find((x) => x.id === id).keys[btn]), [id, btn]);
    ok(`${tag} ${id} stick reached the game (${dirKey})`, r.kl && r.kl.includes('d:' + dirKey) && r.kl.includes('u:' + dirKey), r.kl && r.kl.slice(-8));
    ok(`${tag} ${id} ${btn} button reached the game (${btnKey})`, r.kl && r.kl.includes('d:' + btnKey), null);
    ok(`${tag} ${id} screen changed while the stick was held`, r.moveD > 0.002, { idle: r.idleD, held: r.moveD });
    await noScroll(id);
    prevActive = id;
  }
  // destroyed frames really gone
  const ids = await p.evaluate(() => [...document.querySelectorAll('#stage iframe')].map((f) => f.src.replace(/^.*\/g\//, '').split('/')[0]));
  ok(`${tag} final iframes = active + 1 suspended`, ids.length === 2, ids);
  ok(`${tag} 0 console errors from the shell`, shellErr.length === 0, shellErr);
  console.log(`${tag} game-side console errors (not the shell):`, JSON.stringify(gameErr.slice(0, 10)));
  await c.close();
}

(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  if (which !== 'desktop') await run(b, 390, 844, 'phone').catch((e) => ok('phone run', false, e.message.slice(0, 300)));
  if (which !== 'phone') await run(b, 1280, 800, 'desktop').catch((e) => ok('desktop run', false, e.message.slice(0, 300)));
  await b.close();
  const f = results.filter((r) => !r.pass);
  console.log(`DONE ${results.length - f.length}/${results.length} passed`);
  fs.writeFileSync(`${OUT}/T/test-results.json`, JSON.stringify(results, null, 1));
})();
