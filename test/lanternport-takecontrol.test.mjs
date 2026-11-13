// Take-control rigged hero: taking control inside a converted scene must play
// as juniper_rig.glb (playerrig.js), not the procedural HeroView figure.
// - unit checks cover the pure clip decision + scene coverage;
// - the headless-Chrome check drives three real scenes through
//   READY -> WATCH -> TAKE CONTROL via the page's own scene button and asserts
//   the player rig is ready, visible, fully bound, playing the expected clip,
//   with zero runtime errors. (Skipped when no Chrome is available.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickPlayerClip, PLAYER_DANCE_CLIPS, playerRigScene } from '../games/lanternport/playerrig.js';
import { STANDING_Y_OFFSET, SWIM_Y_OFFSET } from '../games/lanternport/heroglb.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };

test('pickPlayerClip mirrors the watch-mode clip choices', () => {
  const still = pickPlayerClip({ action: 'idle', speed: 0, swimming: false, danceClip: null });
  assert.deepEqual(still, { clip: 'idle-stand', loop: true, rate: 1, yOffset: STANDING_Y_OFFSET });

  // Dance scenes: standing still means dancing, exactly like the staged show.
  assert.equal(pickPlayerClip({ action: 'idle', speed: 0, swimming: false, danceClip: 'dance-cartop' }).clip, 'dance-cartop');
  assert.equal(pickPlayerClip({ action: 'idle', speed: 0, swimming: false, danceClip: 'dance-club' }).clip, 'dance-club');
  // ...but once she moves, locomotion wins over the dance.
  assert.equal(pickPlayerClip({ action: 'walk', speed: 8, swimming: false, danceClip: 'dance-cartop' }).clip, '07_01');

  // Walk and run with speed-scaled rates.
  const walk = pickPlayerClip({ action: 'walk', speed: 11, swimming: false, danceClip: null });
  assert.equal(walk.clip, '07_01'); assert.equal(walk.rate, 1);
  const run = pickPlayerClip({ action: 'walk', speed: 30, swimming: false, danceClip: null });
  assert.equal(run.clip, '09_01'); assert.ok(run.rate > 1);

  // In a stage pool: swim-surface at the staged swim depth; a slow tread at 0.55, as staged.
  const tread = pickPlayerClip({ action: 'idle', speed: 0, swimming: true, danceClip: null });
  assert.equal(tread.clip, 'swim-surface'); assert.equal(tread.rate, 0.55); assert.equal(tread.yOffset, SWIM_Y_OFFSET);
  const swim = pickPlayerClip({ action: 'walk', speed: 6, swimming: true, danceClip: null });
  assert.equal(swim.clip, 'swim-surface'); assert.equal(swim.rate, 1);

  // The SM64 dive move plays the hand-authored dive clip once.
  const dive = pickPlayerClip({ action: 'dive', speed: 20, swimming: false, danceClip: null });
  assert.equal(dive.clip, 'dive'); assert.equal(dive.loop, false); assert.equal(dive.yOffset, STANDING_Y_OFFSET);
  assert.equal(pickPlayerClip({ action: 'bellySlide', speed: 12, swimming: false, danceClip: null }).clip, 'dive');

  // Airborne movement has no library clip: hold the locomotion clip.
  assert.equal(pickPlayerClip({ action: 'freefall', speed: 20, swimming: false, danceClip: null }).clip, '09_01');
  assert.equal(pickPlayerClip({ action: 'jump', speed: 5, swimming: false, danceClip: null }).clip, '07_01');
});

test('playerRigScene covers exactly the 14 converted scenes; dances are the 3 dance scenes', () => {
  for (const id of ['rooftop-dive', 'cartop-dance', 'club-stage', 'pool-surface', 'pool-rimsit', 'pot-rampage',
    'chest-fanfare', 'dock-fishing', 'sword-pedestal', 'ocarina-dawn', 'dawn-shift', 'festival-roundabout',
    'cucco-swarm', 'fairy-orbit']) assert.ok(playerRigScene(id), id);
  for (const id of ['photo-call', 'harbor-run', 'snapper-shop', 'garden-guard', 'stage-test']) {
    assert.equal(playerRigScene(id), null, id);
  }
  assert.deepEqual(Object.keys(PLAYER_DANCE_CLIPS).sort(), ['cartop-dance', 'club-stage', 'festival-roundabout']);
  assert.equal(PLAYER_DANCE_CLIPS['cartop-dance'], 'dance-cartop');
  assert.equal(PLAYER_DANCE_CLIPS['club-stage'], 'dance-club');
  assert.equal(PLAYER_DANCE_CLIPS['festival-roundabout'], 'festival-roundabout');
});

function findChrome() {
  const candidates = [process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  return candidates.find((candidate) => candidate.startsWith('/') || candidate.includes('/')) || null;
}

async function serve() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const rel = decodeURIComponent(url.pathname.replace(/^\/+/, '')) || 'index.html';
      const file = path.resolve(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

class CdpClient {
  constructor(ws) {
    this.ws = ws; this.seq = 0; this.pending = new Map(); this.exceptions = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.exceptionThrown') this.exceptions.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
      if (msg.id && this.pending.has(msg.id)) { const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
    });
  }
  call(method, params = {}) {
    const id = ++this.seq;
    // CDP flatten mode: sessionId is a TOP-LEVEL message field. Nesting it in
    // params (the original draft) silently dispatches to the browser target,
    // which answers "'Page.enable' wasn't found".
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params, sessionId: this.sessionId })); });
  }
  async eval(expression) {
    const result = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async waitFor(expression, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      try { if (await this.eval(expression)) return true; } catch (error) { lastError = error; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw lastError || new Error(`Timed out waiting for ${expression}`);
  }
}

test('headless Chrome: TAKE CONTROL plays as juniper_rig.glb in land, pool and dance scenes', { timeout: 600000 }, async (t) => {
  const chromeBin = findChrome();
  if (!chromeBin) { t.skip('No Chrome/Chromium executable found (set CHROME_BIN)'); return; }
  const { server, origin } = await serve();
  const port = 9400 + Math.floor(Math.random() * 400);
  const chrome = spawn(chromeBin, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/lanternport-takecontrol-${process.pid}`, '--window-size=420,860', '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    let version;
    for (let i = 0; i < 100 && !version; i++) {
      try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    if (!version) throw new Error('Chrome exited ' + chrome.exitCode);
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    const browser = new CdpClient(ws);
    const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.call('Target.attachToTarget', { targetId, flatten: true });
    // One client, one id sequence: from here it speaks to the page session.
    const page = browser;
    page.sessionId = sessionId;
    await page.call('Page.enable'); await page.call('Runtime.enable');

    const cases = [
      { scene: 'pot-rampage', clip: 'idle-stand' },   // land: she stands at the staged spot, rigged
      { scene: 'pool-surface', clip: 'swim-surface' }, // pool: spawn is in the water — swimming at once
      { scene: 'cartop-dance', clip: 'dance-cartop' }, // dance: standing still in a dance scene = dancing
    ];
    for (const { scene, clip } of cases) {
      page.exceptions.length = 0;
      // No &loop=1: loop mode STARTS in watch (sceneMode='watch', button hidden),
      // so the first click would take control instead of starting the watch.
      // Plain ?scene= starts 'ready': click 1 = WATCH, click 2 = TAKE CONTROL.
      await page.call('Page.navigate', { url: `${origin}/games/lanternport/index.html?scene=${scene}` });
      // The staged rig loads first (it also warms the shared asset cache).
      await page.waitFor('Boolean(window.__lanternportHeroGLB && __lanternportHeroGLB.ready)', 120000);
      // WATCH: the player rig must stay hidden — the staged performance owns the scene.
      await page.eval('document.getElementById("sceneBtn").click()');
      await page.waitFor('window.__dbg && __dbg.scene && __dbg.scene.mode === "watch"', 30000);
      assert.equal(await page.eval('Boolean(window.__lanternportPlayerRig && __lanternportPlayerRig.visible)'), false, `${scene}: player rig visible during watch`);
      // TAKE CONTROL: the rigged hero takes over, fully bound, playing the expected clip.
      await page.eval('document.getElementById("sceneBtn").click()');
      await page.waitFor('Boolean(window.__lanternportPlayerRig && __lanternportPlayerRig.ready && __lanternportPlayerRig.visible)', 120000);
      const state = await page.eval('({ ready: __lanternportPlayerRig.ready, visible: __lanternportPlayerRig.visible, boundBones: __lanternportPlayerRig.boundBones, activeClip: __lanternportPlayerRig.activeClip, error: __lanternportPlayerRig.error })');
      assert.equal(state.error, null, `${scene}: player rig error`);
      assert.equal(state.boundBones, 127, `${scene}: bound bones`);
      assert.equal(state.activeClip, clip, `${scene}: active clip`);
      assert.deepEqual(page.exceptions, [], `${scene}: runtime exceptions during take-control`);
    }
    ws.close();
  } finally {
    chrome.kill('SIGTERM');
    server.close();
  }
});
