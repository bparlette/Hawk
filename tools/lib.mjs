// Dev harness: serves the repo root, answers the viewer's unpkg three.js r160 request from node_modules (works offline),
// and drives headless Chromium with software GL. Not part of any delivery zip.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = process.env.ROOT ? path.resolve(process.env.ROOT) : path.resolve(here, '..');
const toolsDir = here;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.md': 'text/plain' };

export function serve(port = 0) {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = path.join(root, p === '/' ? 'viewer.html' : p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r({ srv, port: srv.address().port })));
}

export async function open({ w = 1280, h = 720, dpr = 1 } = {}) {
  const { srv, port } = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await ctx.route(/unpkg\.com\/three@0\.160\.0\//, (route) => {
    const u = new URL(route.request().url()); const rel = u.pathname.replace('/three@0.160.0/', ''); const f = path.join(toolsDir, 'node_modules/three', rel);
    if (fs.existsSync(f)) route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) }); else route.fulfill({ status: 404, body: 'nf' });
  });
  const errors = [];
  const newPage = async () => { const page = await ctx.newPage(); page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text()}`); }); page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message)); return page; };
  return { port, errors, newPage, close: async () => { await browser.close(); srv.close(); } };
}

export async function load(page, port, query) {
  await page.goto(`http://127.0.0.1:${port}/viewer.html?${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await page.waitForTimeout(150);
}
