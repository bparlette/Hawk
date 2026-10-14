// node multi.js plan.json : sequence of {js?, wait, shot?}
const { chromium } = require('playwright');
const plan = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text()); });
  if (process.env.BOSSFIRST) await pg.addInitScript(() => {
    let real; Object.defineProperty(window, 'SS', { configurable: true, get() { return real; }, set(v) {
      const r = v.registerLevel; v.registerLevel = (d) => { if (d && d.number === 13 && d.sections.length > 1) d.sections = d.sections.slice(1); return r(d); }; real = v; } });
  });
  await pg.addInitScript(() => {
    window.__rafq = null; const real = window.requestAnimationFrame.bind(window);
    window.__manual = false;
    window.requestAnimationFrame = (cb) => { if (window.__manual) { window.__rafq = cb; return 1; } return real(cb); };
    window.__step = (n, cond) => { let i = 0; for (; i < n; i++) { if (cond && cond()) break; const cb = window.__rafq; if (!cb) break; window.__rafq = null; cb(performance.now()); } return i; };
  });
  await pg.goto('file:///workspace/work/lvl13_test/index.html?debug&nocache&level=13');
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(5200);
  for (const s of plan) {
    if (s.manual) { await pg.evaluate(() => { window.__manual = true; }); await pg.waitForTimeout(200); }
    if (s.step) { const r = await pg.evaluate(([n, c]) => window.__step(n, c ? new Function('return ' + c) : null), [s.step, s.cond || null]); console.log('stepped', r); }
    if (s.until) { for (let i = 0; i < 900; i++) { if (await pg.evaluate(s.until)) break; await pg.waitForTimeout(100); } }
    if (s.js) { const r = await pg.evaluate(s.js); if (r !== undefined) console.log('js->', JSON.stringify(r)); }
    if (s.wait) await pg.waitForTimeout(s.wait);
    if (s.shot) { const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png')); require('fs').writeFileSync(s.shot, Buffer.from(d.split(',')[1], 'base64')); console.log('shot', s.shot); }
  }
  await b.close();
})();
