#!/usr/bin/env node
// Automated Viral YouTube Short Generator for MISO: Starlight Adventure
// Captures full beginning-to-end level run, 100% audio (NES chiptune + APU SFX),
// double yarn kill, hop-on stomp kill, mid-air yarn kill, and Golden Bell victory.

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createReadStream, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = normalize(join(__dirname, '..'));
const demosRoot = join(repoRoot, 'brad-demos');
const shortsDir = join(repoRoot, 'dist/shorts');
await mkdir(shortsDir, { recursive: true });

const PORT = 8089;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG || (existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');

console.log('🐱 MISO: Starlight Adventure — YouTube Short Producer');
console.log(`📁 Demos Root: ${demosRoot}`);
console.log(`📁 Shorts Dir: ${shortsDir}`);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4'
};

let rawClipReceived = false;
let resolveClip = null;
const clipPromise = new Promise(r => { resolveClip = r; });

// 1. Launch HTTP Server on PORT 8089
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  // Handle uploaded clip from browser MediaRecorder
  if (req.method === 'POST' && req.url === '/api/save_clip') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      const buf = Buffer.concat(chunks);
      const outWebm = join(shortsDir, 'raw_miso_clip.webm');
      await writeFile(outWebm, buf);
      console.log(`📹 Saved raw WebM recording: ${(buf.length / (1024 * 1024)).toFixed(2)} MB to ${outWebm}`);
      rawClipReceived = true;
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, bytes: buf.length }));
      resolveClip(outWebm);
    });
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  let reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let normalized = normalize(reqPath);
  if (normalized.endsWith('/') || normalized === '.' || normalized === '') {
    normalized = join(normalized, 'index.html');
  }

  const file = join(demosRoot, normalized);
  if (!file.startsWith(demosRoot)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(file);
    if (fileStat.isDirectory()) {
      res.writeHead(302, { Location: reqPath.replace(/\/?$/, '/') }).end();
      return;
    }
    const mime = types[extname(file).toLowerCase()] || 'application/octet-stream';
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': body.length,
      'Cache-Control': 'no-cache'
    }).end(body);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 Not Found');
  }
});

await new Promise(r => server.listen(PORT, '127.0.0.1', r));
console.log(`🚀 HTTP Server active on http://127.0.0.1:${PORT}`);

// 2. Launch Google Chrome headless with CDP
const cdpPort = 9322 + Math.floor(Math.random() * 100);
const userDataDir = mkdtempSync(join(tmpdir(), 'miso-cdp-'));
const targetUrl = `http://127.0.0.1:${PORT}/g/_v2/miso-starlight/?short=1`;

console.log(`🌐 Launching Chrome (headless=new, sound enabled, CDP port: ${cdpPort})...`);
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${userDataDir}`,
  '--window-size=1280,720',
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-ui-for-media-stream',
  '--no-sandbox',
  targetUrl,
], { stdio: 'ignore' });

let chromeKilled = false;
const killChrome = () => {
  if (!chromeKilled) {
    chromeKilled = true;
    try { chrome.kill('SIGTERM'); } catch {}
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
};
process.on('exit', killChrome);
process.on('SIGINT', () => { killChrome(); process.exit(130); });

// Wait for CDP
let pageTab = null;
for (let i = 0; i < 50; i++) {
  await new Promise(r => setTimeout(r, 200));
  try {
    const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const tabs = await listRes.json();
    pageTab = tabs.find(t => t.type === 'page');
    if (pageTab) break;
  } catch {}
}

if (!pageTab) {
  killChrome();
  server.close();
  throw new Error('Could not find active page tab in Chrome CDP');
}

console.log(`🎮 Connected to Chrome page. Monitoring speedrun and actions...`);
const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

await new Promise((resolve, reject) => {
  let msgId = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise(res => {
    const i = ++msgId;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  const maxTimer = setTimeout(() => {
    console.log('⏰ Max duration reached, completing capture...');
    resolve();
  }, 45000); // 45s safety timeout

  ws.onopen = async () => {
    await send('Runtime.enable');
    await send('Console.enable');
  };

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      const text = data.params.args.map(a => a.value || a.description).join(' ');
      if (text.includes('__SHORT_RECORDING_DONE__')) {
        console.log('✨ Received __SHORT_RECORDING_DONE__ from game!');
        clearTimeout(maxTimer);
        resolve();
      }
    }
  };

  ws.onerror = (err) => reject(err);
});

// Wait for the uploaded raw clip
console.log('⏳ Waiting for clip upload...');
const rawWebmPath = await Promise.race([
  clipPromise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('Clip upload timeout')), 15000))
]);

ws.close();
killChrome();
server.close();

console.log(`✅ Raw recording secured at: ${rawWebmPath}`);

// 3. Render 1080x1920 Viral Overlay Graphic using Node Canvas or SVG/ImageMagick/Python
// We can generate a pixel-crisp 1080x1920 SVG and render it to PNG with ffmpeg!
const overlaySvgPath = join(shortsDir, 'overlay_1080x1920.svg');
const overlayPngPath = join(shortsDir, 'overlay_1080x1920.png');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <!-- Gradients -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a1026" />
      <stop offset="35%" stop-color="#0f1a3d" />
      <stop offset="65%" stop-color="#0f1a3d" />
      <stop offset="100%" stop-color="#070c1d" />
    </linearGradient>

    <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1b2854" />
      <stop offset="100%" stop-color="#101833" />
    </linearGradient>

    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffe153" />
      <stop offset="100%" stop-color="#ff9900" />
    </linearGradient>

    <linearGradient id="cyanGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5bfbf5" />
      <stop offset="100%" stop-color="#1999e3" />
    </linearGradient>

    <linearGradient id="pinkGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff758c" />
      <stop offset="100%" stop-color="#ff527b" />
    </linearGradient>

    <!-- Drop Shadows -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.8" />
    </filter>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <style>
    .headline { font-family: 'Impact', 'Trebuchet MS', -apple-system, sans-serif; font-weight: 900; text-anchor: middle; }
    .title-sub { font-family: 'Trebuchet MS', -apple-system, sans-serif; font-weight: 800; text-anchor: middle; }
    .badge-txt { font-family: 'Impact', 'Arial Black', sans-serif; font-weight: 900; }
    .feature-txt { font-family: 'Trebuchet MS', -apple-system, sans-serif; font-weight: 800; font-size: 26px; }
  </style>

  <!-- Top Viral Header Card -->
  <g transform="translate(48, 54)">
    <!-- Card Background with Shadow -->
    <rect x="0" y="0" width="984" height="480" rx="36" fill="url(#cardGrad)" stroke="#4965aa" stroke-width="4" filter="url(#shadow)" />

    <!-- Outer Decorative Border -->
    <rect x="12" y="12" width="960" height="456" rx="28" fill="none" stroke="#25386b" stroke-width="2" stroke-dasharray="12,8" />

    <!-- Top Speedrun Badge -->
    <rect x="252" y="38" width="480" height="56" rx="28" fill="url(#goldGrad)" filter="url(#shadow)" />
    <text x="492" y="76" class="badge-txt" font-size="28" fill="#1b1200" text-anchor="middle" letter-spacing="2">★ 100% WORLD 1-1 SPEEDRUN ★</text>

    <!-- Main Viral Hook Text -->
    <text x="492" y="196" class="headline" font-size="64" fill="#ffffff" letter-spacing="2" filter="url(#shadow)">WHEN THE YARN MECHANIC</text>
    <text x="492" y="278" class="headline" font-size="78" fill="url(#goldGrad)" letter-spacing="3" filter="url(#shadow)">ACTUALLY SLAPS 🧶🔥</text>

    <!-- Subtitle Banner -->
    <rect x="180" y="324" width="624" height="52" rx="14" fill="#0d1430" stroke="#ff527b" stroke-width="3" />
    <text x="492" y="360" class="title-sub" font-size="26" fill="#ffffff" letter-spacing="1">MISO: STARLIGHT ADVENTURE</text>

    <!-- Stunt Highlights Chips -->
    <g transform="translate(64, 404)">
      <rect x="0" y="0" width="250" height="46" rx="23" fill="#ff5a76" />
      <text x="125" y="31" class="title-sub" font-size="18" fill="#ffffff">💥 HOP-ON STOMP</text>

      <rect x="280" y="0" width="270" height="46" rx="23" fill="#00d2be" />
      <text x="415" y="31" class="title-sub" font-size="18" fill="#062e2a">✈️ AIR YARN SNIPE</text>

      <rect x="580" y="0" width="275" height="46" rx="23" fill="#ffd94a" />
      <text x="717" y="31" class="title-sub" font-size="18" fill="#302000">🧶 DOUBLE YARN KILL</text>
    </g>
  </g>

  <!-- Gameplay Viewport Cutout Frame (Centered between y=590 and y=1260) -->
  <g transform="translate(36, 580)">
    <!-- Drop Shadow behind Frame -->
    <rect x="0" y="0" width="1008" height="650" rx="32" fill="#000000" filter="url(#shadow)" opacity="0.9" />

    <!-- Neon Cyan Border Frame -->
    <rect x="2" y="2" width="1004" height="646" rx="30" fill="none" stroke="url(#cyanGrad)" stroke-width="6" />

    <!-- Corner Target Accents -->
    <path d="M 12 60 L 12 12 L 60 12" stroke="#ffe153" stroke-width="8" fill="none" stroke-linecap="round" />
    <path d="M 996 60 L 996 12 L 948 12" stroke="#ffe153" stroke-width="8" fill="none" stroke-linecap="round" />
    <path d="M 12 590 L 12 638 L 60 638" stroke="#ffe153" stroke-width="8" fill="none" stroke-linecap="round" />
    <path d="M 996 590 L 996 638 L 948 638" stroke="#ffe153" stroke-width="8" fill="none" stroke-linecap="round" />

    <!-- Live HUD Badge -->
    <rect x="40" y="24" width="160" height="38" rx="19" fill="#ff0055" />
    <circle cx="58" cy="43" r="7" fill="#ffffff" />
    <text x="76" y="50" class="badge-txt" font-size="19" fill="#ffffff" letter-spacing="1">REC ● LIVE</text>

    <!-- Top Right 60 FPS Badge -->
    <rect x="830" y="24" width="138" height="38" rx="19" fill="rgba(10,16,36,0.85)" stroke="#5bfbf5" stroke-width="2" />
    <text x="899" y="49" class="title-sub" font-size="18" fill="#5bfbf5">60 FPS HD</text>
  </g>

  <!-- Bottom Interactive Card: Stunts Completed & Link -->
  <g transform="translate(48, 1280)">
    <!-- Container Card -->
    <rect x="0" y="0" width="984" height="580" rx="36" fill="url(#cardGrad)" stroke="#4965aa" stroke-width="4" filter="url(#shadow)" />
    <rect x="12" y="12" width="960" height="556" rx="28" fill="none" stroke="#25386b" stroke-width="2" stroke-dasharray="12,8" />

    <!-- Section Header: ALL STUNTS UNLOCKED -->
    <rect x="252" y="32" width="480" height="52" rx="26" fill="url(#cyanGrad)" />
    <text x="492" y="68" class="badge-txt" font-size="26" fill="#082038" text-anchor="middle" letter-spacing="2">🎯 PRO SPEEDRUN GOALS</text>

    <!-- 4 Checkmark Rows -->
    <g transform="translate(64, 115)">
      <!-- Row 1 -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="856" height="66" rx="18" fill="rgba(255,255,255,0.06)" stroke="#3b528a" stroke-width="2" />
        <circle cx="44" cy="33" r="20" fill="#2fd4c4" />
        <text x="44" y="41" font-family="sans-serif" font-weight="900" font-size="22" fill="#052e2a" text-anchor="middle">✓</text>
        <text x="84" y="42" class="feature-txt" fill="#ffffff">Hop-On Stomp Kill (First Beetle)</text>
        <rect x="696" y="14" width="136" height="38" rx="19" fill="#ff5a76" />
        <text x="764" y="39" class="title-sub" font-size="18" fill="#ffffff">+200 PTS</text>
      </g>

      <!-- Row 2 -->
      <g transform="translate(0, 80)">
        <rect x="0" y="0" width="856" height="66" rx="18" fill="rgba(255,255,255,0.06)" stroke="#3b528a" stroke-width="2" />
        <circle cx="44" cy="33" r="20" fill="#2fd4c4" />
        <text x="44" y="41" font-family="sans-serif" font-weight="900" font-size="22" fill="#052e2a" text-anchor="middle">✓</text>
        <text x="84" y="42" class="feature-txt" fill="#ffffff">Mid-Air Yarn Snipe on Slime</text>
        <rect x="696" y="14" width="136" height="38" rx="19" fill="#ff5a76" />
        <text x="764" y="39" class="title-sub" font-size="18" fill="#ffffff">+200 PTS</text>
      </g>

      <!-- Row 3 -->
      <g transform="translate(0, 160)">
        <rect x="0" y="0" width="856" height="66" rx="18" fill="rgba(255,255,255,0.06)" stroke="#3b528a" stroke-width="2" />
        <circle cx="44" cy="33" r="20" fill="#2fd4c4" />
        <text x="44" y="41" font-family="sans-serif" font-weight="900" font-size="22" fill="#052e2a" text-anchor="middle">✓</text>
        <text x="84" y="42" class="feature-txt" fill="#ffffff">Double Yarn Collateral Kill</text>
        <rect x="696" y="14" width="136" height="38" rx="19" fill="#ffd94a" />
        <text x="764" y="39" class="title-sub" font-size="18" fill="#302000">+400 PTS</text>
      </g>

      <!-- Row 4 -->
      <g transform="translate(0, 240)">
        <rect x="0" y="0" width="856" height="66" rx="18" fill="rgba(255,255,255,0.06)" stroke="#3b528a" stroke-width="2" />
        <circle cx="44" cy="33" r="20" fill="#2fd4c4" />
        <text x="44" y="41" font-family="sans-serif" font-weight="900" font-size="22" fill="#052e2a" text-anchor="middle">✓</text>
        <text x="84" y="42" class="feature-txt" fill="#ffffff">Golden Bell Course Clear Fanfare</text>
        <rect x="696" y="14" width="136" height="38" rx="19" fill="#7CFC9A" />
        <text x="764" y="39" class="title-sub" font-size="18" fill="#003816">CLEAR!</text>
      </g>
    </g>

    <!-- Bottom Play Callout Banner -->
    <g transform="translate(52, 450)">
      <rect x="0" y="0" width="880" height="96" rx="24" fill="url(#goldGrad)" filter="url(#shadow)" />
      <text x="440" y="42" class="headline" font-size="34" fill="#000000" letter-spacing="1">PLAY FREE IN BROWSER NOW! 🎮</text>
      <text x="440" y="78" class="title-sub" font-size="24" fill="#1b1200">bparlette.github.io/Hawk</text>
    </g>
  </g>
</svg>`;

await writeFile(overlaySvgPath, svgContent, 'utf-8');
console.log(`🎨 Wrote overlay SVG to ${overlaySvgPath}`);

// Convert SVG to 1080x1920 PNG using headless Chrome screenshot (supports full CSS and gradients)
console.log(`🎨 Rendering overlay to high-res PNG (${overlayPngPath})...`);
const svgToPngCmd = spawn(CHROME, [
  '--headless=new',
  `--screenshot=${overlayPngPath}`,
  '--window-size=1080,1920',
  '--default-background-color=00000000',
  `file://${overlaySvgPath}`
]);
await new Promise(r => svgToPngCmd.on('close', r));

// 4. Composite the Viral YouTube Short MP4 using FFMPEG!
// The game was captured at 16:9 (960x540).
// In 1080x1920, the game canvas fits inside the cutout frame:
// width = 960x540 placed at x = 60, y = 635!
const outShortMp4 = join(shortsDir, 'miso_starlight_viral_short.mp4');
const artifactShortMp4 = '/Users/braidpairlette/.gemini/antigravity/brain/dc5b35b1-df86-4f06-a385-b6621b4d6267/miso_starlight_viral_short.mp4';

console.log(`🎬 Encoding 1080x1920 Viral YouTube Short with ffmpeg...`);

const filterComplex = [
  `[0:v]fps=60,scale=960:540:flags=neighbor[vgame]`,
  `color=c=#0d1430:s=1080x1920:d=30[vbg]`,
  `[vbg][vgame]overlay=60:635:shortest=1[vcomp]`,
  `[vcomp][1:v]overlay=0:0:shortest=1[vout]`,
  `[0:a]volume=1.45,alimiter=limit=0.94[aout]`
].join(';');

const ffmpegArgs = [
  '-y',
  '-i', rawWebmPath,
  '-loop', '1', '-i', overlayPngPath,
  '-filter_complex', filterComplex,
  '-map', '[vout]',
  '-map', '[aout]',
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '17',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '320k',
  '-ar', '48000',
  '-movflags', '+faststart',
  outShortMp4
];

const encodeProcess = spawn(FFMPEG, ffmpegArgs, { stdio: 'inherit' });
await new Promise((resolve, reject) => {
  encodeProcess.on('close', code => {
    if (code === 0) resolve();
    else reject(new Error(`FFmpeg exited with code ${code}`));
  });
});

console.log(`🎉 Master Video rendered successfully: ${outShortMp4}`);
const mp4Stats = await stat(outShortMp4);
console.log(`📦 Final Short Size: ${(mp4Stats.size / (1024 * 1024)).toFixed(2)} MB`);

// Copy to artifact directory for instant viewing
await writeFile(artifactShortMp4, await readFile(outShortMp4));
console.log(`📋 Copied to artifacts: ${artifactShortMp4}`);

console.log('🏁 YouTube Short generation complete!');
