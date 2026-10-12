// node tools/probe.js <port> <ids comma|all> <w> <h> <outdir> [waitMs]
// For each game: load the shell with #id, wait for autostart, shot "a"; hold RIGHT 1.2s + ATTACK via the shell's
// key injection, shot "b". Prints JSON lines with errors + iframe count. Run detached (tools/bg.sh).
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [port, idsArg, w = '390', h = '844', out = 'T/probe', waitArg = ''] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const man = JSON.parse(fs.readFileSync(__dirname + '/../site/games.json', 'utf8'));
  const ids = idsArg === 'all' ? man.games.map((g) => g.id) : idsArg.split(',');
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 900;
  for (const id of ids) {
    const g = man.games.find((x) => x.id === id);
    const auto = (g.autostart || []).reduce((s, x) => s + x[0], 0);
    const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
    const p = await c.newPage(); const errs = [];
    p.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|GL Driver|swiftshader|WebGL/i.test(m.text())) errs.push((m.location().url || '').replace(/^.*\/g\//, 'g/') + ': ' + m.text().slice(0, 160)); });
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160)));
    const t0 = Date.now();
    await p.goto(`http://127.0.0.1:${port}/#${id}`);
    const n = (g.autostart || []).length;
    await p.waitForFunction((n) => (window.__demoLog || []).filter((l) => / autostart /.test(l)).length >= n && document.getElementById('loading').hidden, n, { timeout: 90000, polling: 250 }).catch(() => {});
    await p.waitForTimeout(+waitArg || 3500);
    await p.screenshot({ path: `${out}/${id}-a.png` });
    await p.evaluate(() => __demoShell.keyDown('ArrowRight'));
    await p.waitForTimeout(1200);
    const k = g.keys && g.keys.attack;
    if (k) await p.evaluate((k) => __demoShell.key(k, 120), k);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${out}/${id}-b.png` });
    await p.evaluate(() => __demoShell.keyUp('ArrowRight'));
    const info = await p.evaluate(() => ({ frames: __demoShell.frames(), active: __demoShell.active, sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
    console.log(JSON.stringify({ id, ms: Date.now() - t0, ...info, errs }));
    await c.close();
  }
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
