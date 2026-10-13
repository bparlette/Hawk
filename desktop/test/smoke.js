// Linux headless smoke test of the Toad City desktop wrapper (Playwright _electron, ozone headless + SwiftShader).
// usage: node test/smoke.js <electron binary> [appDir]   (appDir defaults to desktop/, which needs site/ copied in)
// Env: PLAYWRIGHT (path to the playwright package). Writes test/out/*.png + results.json.
'use strict';
const { _electron } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
const bin = process.argv[2];
const appDir = process.argv[3] || path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const DATA = '/tmp/toadcity_smoke_data';
const FLAGS = ['--ozone-platform=headless', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ozone-override-screen-size=1280,720'];
const results = [];
const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 600) : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(extraEnv = {}, windowed = false) {
  const env = { ...process.env, TOADCITY_TEST: '1', TOADCITY_DATA: DATA, ...(windowed ? { TOADCITY_WINDOWED: '1' } : {}), ...extraEnv };
  const app = await _electron.launch({ executablePath: bin, args: [appDir, ...FLAGS], env, timeout: 90000 });
  const logs = [];
  app.process().stdout.on('data', (d) => logs.push(String(d)));
  app.process().stderr.on('data', (d) => logs.push(String(d)));
  const page = await app.firstWindow();
  await page.waitForLoadState('load');
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
  // ---------- run 1: default (kiosk + fullscreen) boot ----------
  let { app, page, logs } = await launch();
  await sleep(12000); // three.js city boot under SwiftShader
  const win = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return { title: w.getTitle(), kiosk: w.isKiosk(), fullscreen: w.isFullScreen(), focused: w.isFocused(), bounds: w.getBounds() }; });
  ok('window title is "Toad City Baltimore"', win.title === 'Toad City Baltimore', win);
  ok('kiosk + fullscreen by default', win.kiosk && win.fullscreen, win);
  const info = await page.evaluate(() => ({
    url: location.href, cls: document.documentElement.className, injected: !!window.__toadcityDesktop, host: !!(window.__toadcityHost && window.__toadcityHost.desktop),
    cursor: getComputedStyle(document.body).cursor, gl: (() => { const c = document.getElementById('gl'); if (!c) return null; const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
    vp: [innerWidth, innerHeight], gp: typeof navigator.getGamepads, cel: typeof window.__cel, celErr: window.__celErr ? window.__celErr.n : null,
    ac: (() => { try { const a = new AudioContext(); const s = a.state; a.close(); return s; } catch (e) { return String(e); } })(),
  }));
  ok('serves bundled site/ from 127.0.0.1', /^http:\/\/127\.0\.0\.1:\d+\/index\.html/.test(info.url), info.url);
  ok('desktop tweaks injected (quit bridge)', info.injected && info.host, info);
  ok('cursor hidden', /tc-nocursor/.test(info.cls) && info.cursor === 'none', { cls: info.cls, cursor: info.cursor });
  ok('game canvas fills the viewport', info.gl && info.gl[0] >= info.vp[0] * 0.95 && info.gl[1] >= info.vp[1] * 0.95, { gl: info.gl, vp: info.vp });
  ok('AudioContext starts without a gesture (autoplay policy)', info.ac === 'running', info.ac);
  ok('Gamepad API available', info.gp === 'function');
  const pageErr = logs.join('').split('\n').filter((l) => /Uncaught|pageerror|TypeError|ReferenceError/.test(l) && !/youtube|bandcamp|ytimg|google/i.test(l));
  ok('no own page errors in boot log', pageErr.length === 0, pageErr.slice(0, 5));
  await page.screenshot({ path: path.join(OUT, 'boot_1280.png') });
  const shotA = await page.screenshot();
  // gamepad input reaches the game without any click: hold left stick up / A for a moment and expect the frame to change
  await page.evaluate(() => { const mk = (ax, b) => ({ id: 'Mock (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: ax, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: b.includes(i), touched: b.includes(i), value: b.includes(i) ? 1 : 0 })) }); window.__mockAx = [0, -1, 0, 0]; navigator.getGamepads = () => [mk(window.__mockAx, [0]), null, null, null]; });
  await sleep(2500);
  const shotB = await page.screenshot({ path: path.join(OUT, 'after_pad_1280.png') });
  ok('mocked gamepad input changes the frame (no click needed)', !shotA.equals(shotB));
  await mockPad(page, []);
  // short Esc tap must NOT quit
  const tapExit = waitExit(app, 1500);
  await page.keyboard.down('Escape'); await sleep(250); await page.keyboard.up('Escape');
  ok('short Esc tap does not quit', !(await tapExit).exited);
  // Esc held 1 s quits with code 0
  const escExit = waitExit(app, 8000);
  await page.keyboard.down('Escape');
  const e1 = await escExit;
  ok('Esc held 1 s quits cleanly (exit 0)', e1.exited && e1.code === 0, { e1, log: logs.join('').split('\n').filter((l) => /quit/.test(l)) });
  if (!e1.exited) await app.close().catch(() => {});

  // ---------- run 2: gamepad Select+Start quits ----------
  ({ app, page, logs } = await launch({}, true));
  await sleep(6000);
  const padExit = waitExit(app, 8000);
  await mockPad(page, [8, 9]);
  const e2 = await padExit;
  ok('gamepad Select+Start held 1 s quits cleanly (exit 0)', e2.exited && e2.code === 0, { e2, log: logs.join('').split('\n').filter((l) => /quit/.test(l)) });
  if (!e2.exited) await app.close().catch(() => {});

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
