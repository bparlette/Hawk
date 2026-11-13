import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CLIP_FILES,
  HERO_GLB_SCENES,
  isHeroGLBTarget,
  evaluateHeroSchedule,
} from '../games/lanternport/heroglb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSET_DIR = path.join(ROOT, 'games/lanternport/assets/juniper');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

test('juniper binary assets: rig size matches source and all scheduled GLB clips are valid', () => {
  const rigPath = path.join(ASSET_DIR, 'juniper_rig.glb');
  assert.ok(fs.existsSync(rigPath), 'juniper_rig.glb must exist');
  const rigStat = fs.statSync(rigPath);
  assert.equal(rigStat.size, 2336848, 'juniper_rig.glb byte count must match source');
  assert.equal(fs.readFileSync(rigPath).subarray(0, 4).toString('ascii'), 'glTF');

  for (const clip of CLIP_FILES) {
    const p = path.join(ASSET_DIR, 'clips', `${clip}.glb`);
    assert.ok(fs.existsSync(p), `Missing clip GLB: ${clip}.glb`);
    const buf = fs.readFileSync(p);
    assert.ok(buf.length > 1000, `Clip GLB unexpectedly tiny: ${clip}.glb`);
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'glTF', `${clip}.glb must start with glTF magic`);
  }
});

test('isHeroGLBTarget matches only the 8 converted scenes and their target actor IDs', () => {
  assert.equal(Object.keys(HERO_GLB_SCENES).length, 8);
  assert.equal(isHeroGLBTarget('pool-rimsit', { id: 'juniper' }), true);
  assert.equal(isHeroGLBTarget('club-stage', { id: 'dancer' }), true);
  assert.equal(isHeroGLBTarget('dock-fishing', { id: 'fen' }), true);
  assert.equal(isHeroGLBTarget('pool-rimsit', { id: 'fen' }), false);
  assert.equal(isHeroGLBTarget('rooftop-dive', { id: 'juniper' }), true);
  assert.equal(isHeroGLBTarget('sword-pedestal', { id: 'juniper' }), false);
  assert.equal(isHeroGLBTarget(null, { id: 'juniper' }), false);
});

test('HERO_GLB_SCENES clip schedules and deterministic crossfade evaluation', () => {
  assert.equal(HERO_GLB_SCENES['pool-rimsit'].schedule(0).clip, 'sit-rim');
  assert.equal(HERO_GLB_SCENES['pool-rimsit'].schedule(300).clip, 'sit-lookback');
  assert.equal(HERO_GLB_SCENES['pool-rimsit'].schedule(840).clip, 'sit-rim');

  assert.equal(HERO_GLB_SCENES['cartop-dance'].schedule(50).clip, 'dance-cartop');
  assert.equal(HERO_GLB_SCENES['club-stage'].schedule(50).clip, 'dance-club');
  assert.equal(HERO_GLB_SCENES['club-stage'].stageLight, true);

  assert.equal(HERO_GLB_SCENES['pool-surface'].schedule(30).clip, 'swim-surface');
  assert.equal(HERO_GLB_SCENES['pool-surface'].schedule(30).rate, 1.0);
  assert.equal(HERO_GLB_SCENES['pool-surface'].schedule(200).rate, 0.55);

  assert.equal(HERO_GLB_SCENES['dock-fishing'].attachRod, true);
  assert.equal(HERO_GLB_SCENES['dock-fishing'].schedule(30).clip, 'idle-stand');
  assert.equal(HERO_GLB_SCENES['dock-fishing'].schedule(200).clip, 'fish-cast');
  assert.equal(HERO_GLB_SCENES['dock-fishing'].schedule(200).loop, false);

  assert.equal(HERO_GLB_SCENES['cucco-swarm'].schedule(30).clip, '07_01');
  assert.equal(HERO_GLB_SCENES['cucco-swarm'].schedule(100).clip, 'idle-stand');
  assert.equal(HERO_GLB_SCENES['cucco-swarm'].schedule(300).clip, '09_01');
  assert.equal(HERO_GLB_SCENES['cucco-swarm'].schedule(800).clip, 'sit-rim');

  assert.equal(HERO_GLB_SCENES['fairy-orbit'].schedule(100).clip, '07_01');
  assert.equal(HERO_GLB_SCENES['fairy-orbit'].schedule(400).clip, 'idle-stand');
  assert.equal(HERO_GLB_SCENES['fairy-orbit'].schedule(700).clip, '07_01');

  // rooftop-dive (filmscenes.js DIVE beats): hold, strut, dive oneshot timed to the splash tick, swim, rim-sit
  assert.equal(HERO_GLB_SCENES['rooftop-dive'].schedule(30).clip, 'idle-stand');
  assert.equal(HERO_GLB_SCENES['rooftop-dive'].schedule(120).clip, '07_01');
  assert.equal(HERO_GLB_SCENES['rooftop-dive'].schedule(260).clip, 'dive');
  assert.equal(HERO_GLB_SCENES['rooftop-dive'].schedule(260).loop, false);
  assert.equal(HERO_GLB_SCENES['rooftop-dive'].schedule(450).clip, 'swim-surface');
  assert.equal(HERO_GLB_SCENES['rooftop-dive'].schedule(700).clip, 'sit-rim');

  // Verify evaluateHeroSchedule blends deterministically during transition window
  const makeMockAction = (dur) => ({
    enabled: false,
    weight: 0,
    time: 0,
    setEffectiveWeight(w) { this.weight = w; },
    _dur: dur,
  });
  const cfg = HERO_GLB_SCENES['pool-rimsit'];
  const handle = {
    actions: {
      'sit-rim': { act: makeMockAction(3.0), clip: { duration: 3.0 } },
      'sit-lookback': { act: makeMockAction(3.0), clip: { duration: 3.0 } },
    },
    model: {
      position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
      rotation: { y: 0 },
      updateMatrixWorld() {},
    },
    mixer: { time: 0, update() {} },
  };

  const blendRes = evaluateHeroSchedule(handle, cfg, 243);
  assert.equal(blendRes.activeClip, 'sit-lookback');
  assert.equal(blendRes.blendFrom, 'sit-rim');
  assert.ok(handle.actions['sit-lookback'].act.weight > 0 && handle.actions['sit-lookback'].act.weight < 1);
  assert.ok(handle.actions['sit-rim'].act.weight > 0 && handle.actions['sit-rim'].act.weight < 1);

  const steadyA = evaluateHeroSchedule(handle, cfg, 360);
  const posA = { ...handle.model.position };
  const tA = handle.actions['sit-lookback'].act.time;
  const steadyB = evaluateHeroSchedule(handle, cfg, 360);
  assert.deepEqual(steadyA, steadyB);
  assert.deepEqual(handle.model.position, posA);
  assert.equal(handle.actions['sit-lookback'].act.time, tA);
});

const CHROME = findChrome();
test('headless Chrome: all 8 converted scenes load juniper_rig.glb with 127 bound bones and zero runtime errors', { skip: !CHROME }, async () => {
  const server = http.createServer((req, res) => {
    const cleanUrl = (req.url || '/').split('?')[0];
    const rel = cleanUrl === '/' ? '/index.html' : decodeURIComponent(cleanUrl);
    const full = path.resolve(ROOT, '.' + rel);
    if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    let target = full;
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  });

  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/games/lanternport/index.html`;
  const profDir = `/tmp/lp-heroglb-test-${process.pid}`;
  fs.rmSync(profDir, { recursive: true, force: true });

  const proc = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profDir}`,
    '--window-size=800,500',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  try {
    const wsBrowserUrl = await new Promise((res, rej) => {
      let buf = '';
      const to = setTimeout(() => rej(new Error('Chrome launch timeout')), 10000);
      proc.stderr.on('data', (d) => {
        buf += d.toString();
        const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (m) { clearTimeout(to); res(m[1]); }
      });
      proc.on('exit', (c) => { clearTimeout(to); rej(new Error('Chrome exited ' + c)); });
    });

    const dbgPort = new globalThis.URL(wsBrowserUrl).port;
    const targets = await (await fetch(`http://127.0.0.1:${dbgPort}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let nextId = 0;
    const pending = new Map();
    const errors = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = pending.get(msg.id);
        if (p) {
          pending.delete(msg.id);
          if (msg.error) p.rej(new Error(JSON.stringify(msg.error)));
          else p.res(msg.result);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(JSON.stringify(msg.params));
      }
    });
    const send = (method, params = {}) => new Promise((res, rej) => {
      const id = ++nextId;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalExpr = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('Eval failed: ' + JSON.stringify(r.exceptionDetails));
      return r.result?.value;
    };

    await send('Runtime.enable');
    await send('Page.enable');

    for (const sceneId of Object.keys(HERO_GLB_SCENES)) {
      await send('Page.navigate', { url: `${baseUrl}?scene=${sceneId}&loop=1` });
      let dbg = null;
      for (let i = 0; i < 80; i++) {
        dbg = await evalExpr(`window.__lanternportHeroGLB && window.__lanternportHeroGLB.sceneId === '${sceneId}' && window.__lanternportHeroGLB.ready ? window.__lanternportHeroGLB : null`);
        if (dbg) break;
        await sleep(120);
      }
      assert.ok(dbg, `GLB hero did not ready cleanly for ${sceneId}`);
      assert.equal(dbg.boundBones, 127, `${sceneId} boundBones`);
      assert.ok(dbg.meshCount > 0, `${sceneId} meshCount`);

      const snap = await evalExpr('window.__lanternportHeroGLB.inspect()');
      assert.equal(snap.ready, true, `${sceneId} inspect ready`);
      assert.equal(snap.error, null, `${sceneId} inspect error`);
      assert.equal(snap.nodeVis, true, `${sceneId} nodeVis`);
      assert.equal(snap.fallbackVis, false, `${sceneId} fallbackVis must be hidden`);
      assert.equal(snap.modelVis, true, `${sceneId} modelVis`);
      assert.ok(snap.skinnedBox && snap.skinnedBox.min.every(Number.isFinite) && snap.skinnedBox.max.every(Number.isFinite), `${sceneId} finite skinned bounds`);
    }

    assert.deepEqual(errors, [], `Unexpected browser runtime exceptions: ${errors.join('; ')}`);
    ws.close();
  } finally {
    proc.kill('SIGKILL');
    await Promise.race([new Promise((r) => proc.once('exit', r)), sleep(1000)]);
    try { fs.rmSync(profDir, { recursive: true, force: true }); } catch {}
    server.closeAllConnections?.();
    server.close();
  }
});
