// Linux headless test of the Browser Arcade Electron app (Playwright _electron).
// usage: node run.js <appDirOrBinary> [packaged]
const { _electron } = require('/workspace/work/trailer_v2/node_modules/playwright');
const fs = require('fs'), path = require('path');
const target = process.argv[2];
const packaged = process.argv[3] === 'packaged';
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const DATA = '/tmp/ba_test_data';
const FLAGS = ['--ozone-platform=headless', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ozone-override-screen-size=1280,720'];
const results = [];
const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(game, extraEnv = {}) {
  const env = { ...process.env, BROWSER_ARCADE_TEST: '1', BROWSER_ARCADE_DATA: DATA, ...extraEnv };
  const opts = packaged
    ? { executablePath: target, args: ['--game=' + game, ...FLAGS], env }
    : { executablePath: path.join(target, 'node_modules/electron/dist/electron'), args: [target, '--game=' + game, ...FLAGS], env };
  const app = await _electron.launch({ ...opts, timeout: 60000 });
  const logs = [];
  app.process().stdout.on('data', (d) => logs.push(String(d)));
  app.process().stderr.on('data', (d) => logs.push(String(d)));
  const page = await app.firstWindow();
  await page.waitForLoadState('load');
  await sleep(1500);
  return { app, page, logs };
}
function waitExit(app, ms) {
  return new Promise((res) => {
    const p = app.process(); let done = false;
    const t = setTimeout(() => { if (!done) res({ exited: false }); }, ms);
    p.once('exit', (code) => { done = true; clearTimeout(t); res({ exited: true, code }); });
  });
}
async function mockPad(page, pressed) {
  await page.evaluate((pressed) => {
    const mk = () => ({ id: 'Mock Xbox Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), touched: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });
    navigator.getGamepads = () => [mk(), null, null, null];
  }, pressed);
}

(async () => {
  fs.rmSync(DATA, { recursive: true, force: true });
  for (const game of ['shellshock', 'sfbrawl']) {
    // ---------- run 1: boot, layout, assets, levels, gamepad, write save, quit via Esc hold ----------
    let { app, page, logs } = await launch(game, { BROWSER_ARCADE_QUERY: game === 'shellshock' ? 'debug&level=3' : 'level=2' });
    const info = await page.evaluate(() => ({
      url: location.href, title: document.title,
      cls: document.documentElement.className,
      injected: !!window.__arcade,
      gp: typeof navigator.getGamepads, gpList: Array.isArray(Array.from(navigator.getGamepads() || [])),
      canvas: (() => { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
      vp: [innerWidth, innerHeight],
      fsbtn: getComputedStyle(document.getElementById('fsbtn')).display,
      touch: navigator.maxTouchPoints, ontouch: 'ontouchstart' in window,
    }));
    ok(`${game}: boots on app:// with injected tweaks`, info.url.startsWith('app://' + game + '/') && info.injected && /fill/.test(info.cls), info);
    ok(`${game}: navigator.getGamepads available`, info.gp === 'function' && info.gpList);
    ok(`${game}: canvas fills viewport (no cabinet, no fs button)`, info.canvas[0] >= info.vp[0] * 0.9 || info.canvas[1] >= info.vp[1] * 0.9, { canvas: info.canvas, vp: info.vp, fsbtn: info.fsbtn });
    const fetchInfo = await page.evaluate(async (LV) => {
      const r = await fetch(LV, { cache: 'no-cache' }); const t = await r.text();
      const h = await fetch(LV, { method: 'HEAD', cache: 'no-store' });
      const miss = await fetch('levels/level99.js', { method: 'HEAD' });
      return { ok: r.ok, len: t.length, type: r.headers.get('content-type'), head: h.ok, headType: h.headers.get('content-type'), miss: miss.status };
    }, game === 'shellshock' ? 'levels/level2.js' : 'levels/level1.js');
    ok(`${game}: fetch() of levels/*.js as text works, HEAD ok, missing=404`, fetchInfo.ok && fetchInfo.len > 1000 && /javascript/.test(fetchInfo.headType) && fetchInfo.miss === 404, fetchInfo);
    const net = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => !e.name.startsWith('app://')).map((e) => e.name));
    ok(`${game}: no non-local requests`, net.length === 0, net);
    await page.screenshot({ path: path.join(OUT, `${game}_title.png`) });

    // gamepad drives the game: Start (button 9) on the title must change the scene/screen
    const before = await page.screenshot();
    for (let k = 0; k < 4; k++) { await mockPad(page, [9]); await sleep(150); await mockPad(page, []); await sleep(700); }
    const after = await page.screenshot({ path: path.join(OUT, `${game}_after_pad_start.png`) });
    const scene = await page.evaluate(() => (window.__SS ? window.__SS.STATE.scene : null));
    ok(`${game}: mocked gamepad Start is read by the game`, !before.equals(after), { scene });

    // play into a level with keyboard to make the game load a level script
    for (let k = 0; k < 8; k++) { await page.keyboard.press('Enter'); await sleep(600); }
    for (let k = 0; k < 10; k++) { await page.keyboard.down('ArrowRight'); await sleep(300); await page.keyboard.up('ArrowRight'); await page.keyboard.press('j'); await sleep(200); }
    await sleep(1500);
    const lv = await page.evaluate(() => ({
      scripts: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),

      scene: window.__SS ? window.__SS.STATE.scene : null,
    }));
    lv.res = logs.join('').split('\n').filter((l) => l.startsWith('[req]') && l.includes('/levels/')).map((l) => l.split('/levels/')[1]);
    await page.screenshot({ path: path.join(OUT, `${game}_gameplay.png`) });
    ok(`${game}: a level script + level art loaded during play`, lv.res.some((n) => /level\d+\.js/.test(n)) && lv.res.some((n) => /\.(jpg|png)$/.test(n)), lv);

    // write save data the way the game does (JSON via localStorage) plus a marker
    const saved = await page.evaluate(() => { localStorage.setItem('arcade_test_marker', JSON.stringify({ t: 42 })); if (location.host === 'shellshock') localStorage.setItem('ssla_progress', JSON.stringify({ done: [1, 2], last: 2, bro: 1 })); return Object.keys(localStorage); });
    // Esc held 1 s -> quit
    const exitP = waitExit(app, 6000);
    await page.keyboard.down('Escape'); await sleep(1300);
    const ex = await exitP;
    ok(`${game}: Esc held 1 s quits the app`, ex.exited && ex.code === 0, { ex, log: logs.join('').split('\n').filter((l) => l.includes('[arcade]')) });
    if (!ex.exited) await app.close().catch(() => {});

    // ---------- run 2: saves persisted; short Esc tap does NOT quit; gamepad Select+Start quits ----------
    ({ app, page, logs } = await launch(game));
    const keys = await page.evaluate(() => ({ marker: localStorage.getItem('arcade_test_marker'), keys: Object.keys(localStorage) }));
    ok(`${game}: localStorage survives relaunch (userData)`, keys.marker === '{"t":42}' && saved.every((k) => keys.keys.includes(k)), { before: saved, after: keys.keys });
    const tapExit = waitExit(app, 1500);
    await page.keyboard.down('Escape'); await sleep(300); await page.keyboard.up('Escape');
    const t1 = await tapExit;
    ok(`${game}: short Esc tap does not quit`, !t1.exited);
    const padExit = waitExit(app, 6000);
    await mockPad(page, [8, 9]);
    const t2 = await padExit;
    ok(`${game}: gamepad Select+Start held 1 s quits`, t2.exited && t2.code === 0, { t2, log: logs.join('').split('\n').filter((l) => l.includes('[arcade]')) });
    if (!t2.exited) await app.close().catch(() => {});
  }
  const ud = fs.readdirSync(DATA);
  ok('per-game userData folders created', ud.includes('shellshock') && ud.includes('sfbrawl'), ud);
  fs.writeFileSync(path.join(OUT, 'results' + (packaged ? '_packaged' : '') + '.json'), JSON.stringify(results, null, 2));
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
