// Toad City Baltimore: desktop wrapper (Electron) for ES-DE on macOS.
// Serves the bundled site/ from a loopback HTTP server (so the radio's YouTube/Bandcamp embeds see a normal
// http origin, exactly like the web build) and shows it fullscreen + kiosk with the cursor hidden.
// Quit back to ES-DE: hold Esc 1 s, hold Select+Start (Back+Start) 1 s, or Cmd+Q.
// Env (for testing): TOADCITY_WINDOWED=1 (no kiosk/fullscreen), TOADCITY_TEST=1 (logs), TOADCITY_QUERY="a=1&b=2",
//                    TOADCITY_DATA=<dir> (userData), TOADCITY_PORT=<n>.
'use strict';
const { app, BrowserWindow, Menu, ipcMain, session, shell } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

const TITLE = 'Toad City Baltimore';
const TEST = process.env.TOADCITY_TEST === '1';
const WINDOWED = process.env.TOADCITY_WINDOWED === '1';
// A fixed port keeps the page origin (and so localStorage saves) the same on every launch.
const PORT = parseInt(process.env.TOADCITY_PORT || '47391', 10);
const SITE = path.join(__dirname, 'site');
const log = (...a) => { if (TEST) console.log('[toadcity]', ...a); };

app.setName(TITLE);
if (process.env.TOADCITY_DATA) app.setPath('userData', process.env.TOADCITY_DATA);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
// Xbox Wireless / Series / One controllers on macOS: read them through Apple's GameController framework (standard mapping
// incl. View/Menu/stick clicks, Bluetooth and USB). Chromium turned this on by default in April 2026 (crbug 400455006,
// 374313514: newer Xbox pads not detected over USB / inverted axes on the old HID path); force it in case this Electron's
// Chromium predates that. An unknown feature name is ignored.
app.commandLine.appendSwitch('enable-features', 'XboxUseGameControllerDataFetcherMac');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// One copy only: a second launch from ES-DE just focuses the running game.
if (!app.requestSingleInstanceLock()) { app.exit(0); }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
};

function serve(req, res) {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { res.writeHead(400); return res.end(); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(SITE, rel));
  if (file !== SITE && !file.startsWith(SITE + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    const headers = { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache', 'accept-ranges': 'bytes' };
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      let s = range[1] ? +range[1] : 0, e = range[2] ? +range[2] : st.size - 1;
      if (!range[1] && range[2]) { s = Math.max(0, st.size - +range[2]); e = st.size - 1; }
      e = Math.min(e, st.size - 1);
      res.writeHead(206, { ...headers, 'content-range': `bytes ${s}-${e}/${st.size}`, 'content-length': e - s + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start: s, end: e }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'content-length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer(serve);
    srv.once('error', () => { // port busy: fall back to any free port (saves made this session use a different origin)
      const s2 = http.createServer(serve);
      s2.listen(0, '127.0.0.1', () => resolve(s2.address().port));
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(PORT));
  });
}

let win = null, quitting = false;
async function quitApp(why) {
  if (quitting) return; quitting = true;
  log('quit:', why);
  try { await session.defaultSession.flushStorageData(); } catch (_) {}
  app.exit(0); // exits the process, so ES-DE (waiting on it) comes back
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

app.whenReady().then(async () => {
  const port = await startServer();
  const origin = `http://127.0.0.1:${port}`;
  log('serving', SITE, 'at', origin);

  // Cmd+Q keeps working; nothing is visible in kiosk mode.
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: TITLE, submenu: [{ role: 'quit', label: 'Quit ' + TITLE }] }]));
  else Menu.setApplicationMenu(null);

  win = new BrowserWindow({
    title: TITLE,
    backgroundColor: '#0b0f17',
    show: false,
    kiosk: !WINDOWED,
    fullscreen: !WINDOWED,
    frame: WINDOWED,
    autoHideMenuBar: true,
    width: 1280, height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false);
  // The page's own <title> would rename the window; keep ours.
  win.on('page-title-updated', (e) => { e.preventDefault(); win.setTitle(TITLE); });

  const wc = win.webContents;
  // The top-level page never leaves the bundled game. Links meant for a new tab (e.g. a Bandcamp "buy" link) open in the
  // default browser instead of replacing the game. The radio's YouTube/Bandcamp iframes load normally (network if online).
  wc.on('will-navigate', (e, url) => { if (!url.startsWith(origin)) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  wc.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  wc.session.setPermissionRequestHandler((_wc, perm, cb) => cb(['fullscreen', 'pointerLock', 'media', 'clipboard-sanitized-write'].includes(perm)));
  wc.on('render-process-gone', (_e, d) => { console.error('[toadcity] renderer gone:', d.reason); quitApp('renderer-gone'); });
  if (TEST) wc.on('console-message', (e) => log('[page]', e.message || ''));

  win.once('ready-to-show', () => {
    win.show(); win.focus(); wc.focus();
    if (process.platform === 'darwin') app.focus({ steal: true }); // gamepad + keys work at once, no click needed
  });
  wc.on('did-finish-load', () => { win.focus(); wc.focus(); });

  const q = process.env.TOADCITY_QUERY ? '?' + process.env.TOADCITY_QUERY : '';
  win.loadURL(`${origin}/index.html${q}`);
});

ipcMain.on('toadcity:quit', (_e, why) => quitApp(String(why || 'hotkey')));
app.on('window-all-closed', () => quitApp('window closed'));
