import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const fullPath = join(ROOT, rel);
      if (!fullPath.startsWith(ROOT) || !existsSync(fullPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = extname(fullPath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(fullPath));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}/` });
    });
  });
}

async function launchChrome(width = 540, height = 960) {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const profile = mkdtempSync(join(tmpdir(), 'topple-qa-'));
  const port = 9400 + Math.floor(Math.random() * 500);
  const proc = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--window-size=${width},${height}`,
      '--use-angle=metal',
      '--hide-scrollbars',
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  const cleanup = async () => {
    if (proc.exitCode === null) {
      const ex = new Promise((r) => proc.once('exit', r));
      proc.kill('SIGKILL');
      await Promise.race([ex, sleep(2000)]);
    }
    rmSync(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 });
  };

  try {
    let wsUrl = null;
    for (let i = 0; i < 60 && !wsUrl; i++) {
      await sleep(200);
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
      } catch {}
    }
    if (!wsUrl) throw new Error('Chrome CDP did not start');

    const ws = new WebSocket(wsUrl);
    await new Promise((r, j) => {
      ws.onopen = r;
      ws.onerror = j;
    });

    let seq = 0;
    const pending = new Map();
    const consoleErrors = [];
    const pageErrors = [];

    ws.onmessage = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.id && pending.has(d.id)) {
        pending.get(d.id)(d);
        pending.delete(d.id);
      } else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
        consoleErrors.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
      } else if (d.method === 'Runtime.exceptionThrown') {
        pageErrors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
      }
    };

    const send = (method, params = {}) =>
      new Promise((resolve) => {
        const id = ++seq;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });

    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) {
        throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
      }
      return r.result?.result?.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });

    return {
      send,
      evaluate,
      consoleErrors,
      pageErrors,
      close: async () => {
        ws.close();
        await cleanup();
      },
    };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

async function runTests() {
  const t0 = Date.now();
  const { server, url } = await startStaticServer();
  const chrome = await launchChrome(540, 960);

  const report = {
    url,
    startedAt: new Date().toISOString(),
    tests: {},
  };

  try {
    await chrome.send('Page.navigate', { url });
    await sleep(1600);

    // Wait for Matter.js and __TOPPLE__ readiness
    const ready = await chrome.evaluate(`(async () => {
      for (let i = 0; i < 40; i++) {
        if (window.__TOPPLE__ && window.Matter) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    })()`);
    if (!ready) throw new Error('Game did not finish initializing');

    // TEST 2 & 3: StuntBot run + Determinism
    const determinism = await chrome.evaluate(`(() => {
      const run1 = window.__TOPPLE__.runBotHeadless(19860221);
      const run2 = window.__TOPPLE__.runReplayHeadless(run1.replayLog);
      return { run1, run2 };
    })()`);

    const r1 = determinism.run1;
    const r2 = determinism.run2;
    const detPass = r1.finalScore > 0 && r1.finalScore === r2.finalScore && r1.digest === r2.digest;
    const botPass =
      r1.stats.potsSmashed >= 10 &&
      r1.stats.bombsDetonated >= 5 &&
      r1.stats.carsFlipped >= 2 &&
      r1.stats.cuccoSwarmTriggered === true &&
      r1.stats.swarmChickensSpawned >= 30 &&
      r1.stats.finaleTriggered === true;

    report.tests.determinism = {
      pass: detPass,
      seed: 19860221,
      run1Score: r1.finalScore,
      run2Score: r2.finalScore,
      run1Digest: r1.digest,
      run2Digest: r2.digest,
      totalTicks: r1.totalTicks,
    };

    report.tests.stuntBot = {
      pass: botPass,
      stats: r1.stats,
    };

    console.log('TEST 2 (Determinism):', report.tests.determinism);
    console.log('TEST 3 (Stunt Bot):', report.tests.stuntBot);

    // TEST 5: Scan ticks of the replay to find exact peak Explosion Chain and peak Cucco Swarm frames
    const peakTicks = await chrome.evaluate(`(() => {
      const run = window.__TOPPLE__.runBotHeadless(19860221);
      const replay = run.replayLog;
      const g = window.__TOPPLE__.game;
      const ReplayPlayer = window.__TOPPLE__.replayPlayer.constructor;
      const p = new ReplayPlayer(replay);
      p.start(g);
      let bestBombTick = -1;
      let bestBombMetric = -1;
      let bestSwarmTick = -1;
      let bestSwarmMetric = -1;
      while (p.stepTick(g)) {
        const fireCount = g.particles.filter(pt => pt.style === 'fire').length;
        const bombMetric = g.shockwaves.length * 45 + fireCount + (!g.swarmActive ? 50 : 0);
        if (g.stats.bombsDetonated >= 2 && g.shockwaves.length > 0 && bombMetric > bestBombMetric) {
          bestBombMetric = bombMetric;
          bestBombTick = g.tick;
        }
        const featherCount = g.particles.filter(pt => pt.style === 'feather').length;
        const swarmMetric = g.swarmCuccos.length * 20 + featherCount + (g.phase === 'play' ? 150 : 0);
        if (g.swarmActive && g.swarmCuccos.length >= 20 && swarmMetric > bestSwarmMetric) {
          bestSwarmMetric = swarmMetric;
          bestSwarmTick = g.tick;
        }
      }
      return { bestBombTick, bestBombMetric, bestSwarmTick, bestSwarmMetric, replay };
    })()`);

    // Capture Screenshot 1: Mid-explosion chain reaction
    await chrome.evaluate(`(() => {
      window.__TOPPLE__.stepToTick(${peakTicks.bestBombTick}, ${JSON.stringify(peakTicks.replay)});
    })()`);
    await sleep(120);
    const shot1 = await chrome.send('Page.captureScreenshot', { format: 'png' });
    const shot1Path = join(ROOT, 'screenshot-explosion-chain.png');
    writeFileSync(shot1Path, Buffer.from(shot1.result.data, 'base64'));

    // Capture Screenshot 2: Cucco swarm at peak chaos
    await chrome.evaluate(`(() => {
      window.__TOPPLE__.stepToTick(${peakTicks.bestSwarmTick}, ${JSON.stringify(peakTicks.replay)});
    })()`);
    await sleep(120);
    const shot2 = await chrome.send('Page.captureScreenshot', { format: 'png' });
    const shot2Path = join(ROOT, 'screenshot-cucco-swarm.png');
    writeFileSync(shot2Path, Buffer.from(shot2.result.data, 'base64'));

    report.tests.screenshots = {
      pass: existsSync(shot1Path) && existsSync(shot2Path),
      explosionTick: peakTicks.bestBombTick,
      swarmTick: peakTicks.bestSwarmTick,
      files: ['screenshot-explosion-chain.png', 'screenshot-cucco-swarm.png'],
    };
    console.log('TEST 5 (Screenshots):', report.tests.screenshots);

    // TEST 4: Make-Short exporter (live 9:16 video + real WebAudio stream)
    const shortRes = await chrome.evaluate(`(async () => {
      const res = await window.__TOPPLE__.exportShortRun();
      return {
        filename: res.filename,
        mimeType: res.mimeType,
        ext: res.ext,
        byteLength: res.byteLength,
        durationMs: res.durationMs,
        totalTicks: res.totalTicks,
        finalScore: res.finalScore,
        stats: res.stats,
        base64: res.base64,
      };
    })()`);

    const videoFilename = `topple-vice-hyrule-short.${shortRes.ext}`;
    const videoPath = join(ROOT, videoFilename);
    writeFileSync(videoPath, Buffer.from(shortRes.base64, 'base64'));

    const ffprobeRaw = execFileSync('ffprobe', [
      '-v',
      'error',
      '-count_frames',
      '-show_entries',
      'format=duration,size,format_name:stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_read_frames,duration,sample_rate,channels',
      '-of',
      'json',
      videoPath,
    ]).toString();
    const probe = JSON.parse(ffprobeRaw);

    const vStream = probe.streams.find((s) => s.codec_type === 'video');
    const aStream = probe.streams.find((s) => s.codec_type === 'audio');

    const shortPass =
      Boolean(vStream) &&
      Boolean(aStream) &&
      vStream.width === 540 &&
      vStream.height === 960 &&
      Number(probe.format.duration) > 3 &&
      Number(aStream.duration || 0) > 3;

    report.tests.shortExporter = {
      pass: shortPass,
      file: videoFilename,
      mimeType: shortRes.mimeType,
      sizeBytes: Number(probe.format.size),
      formatDurationSec: Number(probe.format.duration),
      videoStream: vStream,
      audioStream: aStream,
      runScore: shortRes.finalScore,
      runStats: shortRes.stats,
    };
    console.log('TEST 4 (Short Exporter ffprobe):', JSON.stringify(report.tests.shortExporter, null, 2));

    // TEST 1: Zero console errors across entire run
    const allErrors = [...chrome.consoleErrors, ...chrome.pageErrors];
    report.tests.zeroConsoleErrors = {
      pass: allErrors.length === 0,
      consoleErrors: chrome.consoleErrors,
      pageErrors: chrome.pageErrors,
    };
    console.log('TEST 1 (Zero Console Errors):', report.tests.zeroConsoleErrors);

    report.elapsedSec = Math.round(((Date.now() - t0) / 1000) * 100) / 100;
    writeFileSync(join(ROOT, 'test-results.json'), JSON.stringify(report, null, 2));

    const allPass = Object.values(report.tests).every((t) => t.pass);
    if (!allPass) {
      console.error('SOME TESTS FAILED');
      process.exitCode = 1;
    } else {
      console.log('ALL 5 TESTS PASSED in', report.elapsedSec, 's');
    }
  } finally {
    await chrome.close();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
