import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:8765/games/lanternport/index.html';
const urls = [
  `${BASE_URL}?scene=cucco-swarm&loop=1`,
  `${BASE_URL}?scene=pot-rampage&loop=1`,
  `${BASE_URL}?scene=chest-fanfare&loop=1`,
  `${BASE_URL}?scene=dock-fishing&loop=1`,
  `${BASE_URL}?scene=fairy-orbit&loop=1`,
];

for (const u of urls) {
  test(`headless page loads clean: ${u.split('?')[1]}`, () => {
    const out = execSync(`"${CHROME}" --headless --user-data-dir=/tmp/gate-p --window-size=390,844 --dump-dom "${u}"`, { timeout: 15000, encoding: 'utf8' });
    assert.ok(out.includes('<canvas'), 'canvas present');
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withChromeCdp(fn) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-cdp-'));
  const proc = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`,
    '--window-size=1280,720', '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const wsBrowser = await new Promise((res, rej) => {
      let buf = '';
      const to = setTimeout(() => rej(new Error('Chrome launch timeout: ' + buf)), 10000);
      proc.stderr.on('data', (d) => {
        buf += d.toString();
        const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (m) { clearTimeout(to); res(m[1]); }
      });
    });
    const port = new URL(wsBrowser).port;
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0;
    const pending = new Map(), errors = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params);
    });
    const send = (method, params = {}) => new Promise((res, rej) => {
      const id = ++seq; pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalExpr = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
      return r.result?.value;
    };
    const waitReady = async () => {
      for (let i = 0; i < 60; i++) {
        if (await evalExpr('Boolean(window.__dbg && window.__dbg.replay && document.querySelector("canvas"))')) return;
        await sleep(120);
      }
      throw new Error('Page did not become ready');
    };
    await send('Runtime.enable'); await send('Page.enable');
    await fn({ send, evalExpr, waitReady, errors });
    ws.close();
  } finally {
    proc.kill('SIGKILL');
    fs.rmSync(prof, { recursive: true, force: true });
  }
}

test('headless film mode: live record, FreeCam replay bit-exact digest, phone HUD reachability', async () => {
  await withChromeCdp(async ({ send, evalExpr, waitReady, errors }) => {
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: BASE_URL });
    await waitReady();
    await evalExpr('document.getElementById("title").click()');
    await evalExpr('document.getElementById("recBtn").click()');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
    await sleep(450);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await sleep(200);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
    const stopInfo = await evalExpr(`(() => {
      document.getElementById("recBtn").click();
      const takes = JSON.parse(localStorage.getItem("lanternport:film:takes:v1") || "[]");
      return { liveDigest: window.__dbg.digest, savedEnd: takes[0]?.endDigest, count: takes.length };
    })()`);
    assert.equal(stopInfo.count, 1);
    assert.equal(stopInfo.savedEnd, stopInfo.liveDigest);

    await evalExpr('document.getElementById("takesBtn").click(); document.querySelector("#takesList .trow button").click();');
    await sleep(150);
    await evalExpr('document.getElementById("rbGuideBtn").click();');
    assert.equal(await evalExpr('window.__dbg.guide && window.__dbg.freecam.on'), true);

    const camBefore = await evalExpr('window.__dbg.freecam.yaw');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 740, y: 330, button: 'left', buttons: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 740, y: 330, button: 'left', clickCount: 1 });
    assert.notEqual(await evalExpr('window.__dbg.freecam.yaw'), camBefore);

    await evalExpr('document.getElementById("rbSpd2").click();');
    let endState = null;
    for (let i = 0; i < 60; i++) {
      await sleep(80);
      endState = await evalExpr('({ replay: window.__dbg.replay, digest: window.__dbg.digest })');
      if (endState.replay.done) break;
    }
    assert.equal(endState.replay.done, true);
    assert.equal(endState.replay.preludeMatch, true);
    assert.equal(endState.replay.digestMatch, true);
    assert.equal(endState.digest, stopInfo.liveDigest);

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Page.navigate', { url: BASE_URL });
    await waitReady();
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 195, y: 422, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 195, y: 422, button: 'left', clickCount: 1 });
    await sleep(200);

    const phone = await evalExpr(`(() => {
      const box = (id) => document.getElementById(id).getBoundingClientRect();
      const vis = ['who', 'heat', 'goal', 'festbar'];
      const overlaps = [];
      for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
        const a = box(vis[i]), b = box(vis[j]);
        if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) overlaps.push([vis[i], vis[j]]);
      }
      const hitAll = (ids) => ids.every((id) => {
        const el = document.getElementById(id), r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return el === top || el.contains(top);
      });
      const hudOk = hitAll(['journalBtn', 'festBtn', 'tourBtn', 'recBtn', 'takesBtn']);
      document.getElementById('takesBtn').click();
      const modalOk = hitAll(['takesClose', 'takesRecBtn', 'takesFreshBtn']);
      document.querySelector('#takesList .trow button').click();
      const replayOk = hitAll(['rbPlayBtn', 'rbRestartBtn', 'rbSpd05', 'rbSpd1', 'rbSpd2', 'rbGuideBtn', 'rbAimBtn', 'rbExitBtn']);
      return { overlaps, hudOk, modalOk, replayOk, isTouch: document.body.classList.contains('touch') };
    })()`);
    assert.deepEqual(phone.overlaps, []);
    assert.equal(phone.isTouch, true);
    assert.equal(phone.hudOk, true);
    assert.equal(phone.modalOk, true);
    assert.equal(phone.replayOk, true);
    assert.equal(errors.length, 0);
  });
});
