// Browser Arcade: offline Electron runtime for the HTML5 games, launched from ES-DE.
// Usage: "Browser Arcade" --game=shellshock | --game=sfbrawl   (no --game = small picker)
'use strict';
const { app, BrowserWindow, protocol, session, ipcMain, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const GAMES = {
  shellshock: { title: 'Shell Shock: Live Action', dir: 'shellshock', icon: 'shellshock.png' },
  sfbrawl: { title: 'Street Fighter: World Brawl', dir: 'sfbrawl', icon: 'sfbrawl.png' },
};

// ---- which game ----
function argVal(name) {
  const pre = '--' + name + '=';
  const a = process.argv.find((x) => x.startsWith(pre));
  return a ? a.slice(pre.length) : null;
}
let gameId = argVal('game') || process.env.BROWSER_ARCADE_GAME || null;
if (gameId && !GAMES[gameId]) gameId = null;
const TEST = process.env.BROWSER_ARCADE_TEST === '1';

// ---- per-game userData (localStorage lives here, survives relaunch) ----
// macOS: ~/Library/Application Support/Browser Arcade/<game>
const base = process.env.BROWSER_ARCADE_DATA || path.join(app.getPath('appData'), 'Browser Arcade');
app.setPath('userData', path.join(base, gameId || '_launcher'));

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, allowServiceWorkers: false },
}]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};
const ROOT = path.join(__dirname, 'games');

// app://<game>/<path>  ->  games/<game>/<path>   (launcher: app://launcher/)
function handleApp(req) {
  const u = new URL(req.url);
  if (TEST) console.log('[req]', req.method, req.url);
  let host = u.hostname;
  let dir = host === 'launcher' ? path.join(__dirname, 'launcher') : (GAMES[host] ? path.join(ROOT, GAMES[host].dir) : null);
  if (!dir) return new Response('not found', { status: 404 });
  let rel = decodeURIComponent(u.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(dir, rel));
  if (!file.startsWith(dir + path.sep)) return new Response('forbidden', { status: 403 });
  let st;
  try { st = fs.statSync(file); } catch (_) { return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } }); }
  if (!st.isFile()) return new Response('not found', { status: 404 });
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' };
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers: { ...headers, 'content-length': String(st.size) } });
  const range = req.headers.get('range');
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let s = m[1] ? parseInt(m[1], 10) : 0, e = m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (!m[1] && m[2]) { s = Math.max(0, st.size - parseInt(m[2], 10)); e = st.size - 1; }
      e = Math.min(e, st.size - 1);
      const fd = fs.openSync(file, 'r'); const buf = Buffer.alloc(e - s + 1); fs.readSync(fd, buf, 0, buf.length, s); fs.closeSync(fd);
      return new Response(buf, { status: 206, headers: { ...headers, 'content-range': `bytes ${s}-${e}/${st.size}`, 'content-length': String(buf.length) } });
    }
  }
  return new Response(fs.readFileSync(file), { status: 200, headers: { ...headers, 'content-length': String(st.size) } });
}

let win = null;
let quitting = false;
async function quitApp(why) {
  if (quitting) return; quitting = true;
  if (TEST) console.log('[arcade] quit:', why);
  try { await session.defaultSession.flushStorageData(); } catch (_) {}
  try { if (win && !win.isDestroyed()) await win.webContents.session.flushStorageData(); } catch (_) {}
  app.exit(0);
}

app.whenReady().then(() => {
  protocol.handle('app', handleApp);

  // Minimal menu: keeps Cmd+Q working on macOS, nothing visible in kiosk mode.
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu', submenu: [{ role: 'quit' }] }]));
  else Menu.setApplicationMenu(null);

  const g = gameId ? GAMES[gameId] : null;
  const iconPath = path.join(__dirname, 'icons', g ? g.icon : 'arcade.png');
  if (process.platform === 'darwin' && app.dock && fs.existsSync(iconPath)) { try { app.dock.setIcon(nativeImage.createFromPath(iconPath)); } catch (_) {} }

  win = new BrowserWindow({
    title: g ? g.title : 'Browser Arcade',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#000000',
    show: false,
    kiosk: !TEST || process.env.BROWSER_ARCADE_KIOSK === '1',
    fullscreen: !TEST,
    frame: false,
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
      additionalArguments: ['--arcade-game=' + (gameId || 'launcher')],
    },
  });
  win.setMenuBarVisibility(false);

  // Offline kiosk: never navigate away (e.g. the game's WATCH TRAILER link); only app:// pages load.
  const wc = win.webContents;
  wc.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.session.setPermissionRequestHandler((_wc, perm, cb) => cb(['fullscreen', 'pointerLock'].includes(perm)));
  // Block any network request: everything is bundled.
  wc.session.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(app|data|blob|devtools|chrome-extension):/.test(d.url) }));

  wc.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12' && TEST) wc.openDevTools({ mode: 'detach' });
  });
  wc.on('render-process-gone', (_e, d) => { console.error('[arcade] renderer gone', d.reason); quitApp('renderer-gone'); });
  if (TEST) wc.on('console-message', (e) => { const m = e.message || ''; console.log('[page]', m); });

  win.once('ready-to-show', () => { win.show(); win.focus(); if (process.platform === 'darwin') app.focus({ steal: true }); });
  const q = TEST && process.env.BROWSER_ARCADE_QUERY ? '?' + process.env.BROWSER_ARCADE_QUERY : '';
  win.loadURL(g ? `app://${gameId}/index.html${q}` : 'app://launcher/index.html');
});

ipcMain.on('arcade:quit', (_e, why) => quitApp(why || 'hotkey'));
ipcMain.on('arcade:launch', (_e, id) => {
  if (!GAMES[id]) return;
  // Relaunch as the chosen game so it gets its own save folder.
  app.relaunch({ args: process.argv.slice(1).filter((a) => !a.startsWith('--game=')).concat('--game=' + id) });
  quitApp('launch ' + id);
});
app.on('window-all-closed', () => quitApp('closed'));
