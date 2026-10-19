#!/usr/bin/env node
// Zero-dependency static HTTP server for Hawk / Brad's Demos on port 8081
// Supports HTTP Range requests for MP4 video streaming (iOS Safari / mobile)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const demosRoot = normalize(join(__dirname, '..', 'brad-demos'));
const port = Number(process.argv[2]) || 8081;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const server = createServer(async (req, res) => {
  // Allow all origins for local / mobile testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  let reqPath;
  try {
    reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad Request');
    return;
  }

  let normalized = normalize(reqPath);
  if (normalized.endsWith('/') || normalized === '.' || normalized === '') {
    normalized = join(normalized, 'index.html');
  }

  const file = join(demosRoot, normalized);

  // Security: prevent path traversal outside demosRoot
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
    const range = req.headers.range;

    // HTTP Range streaming for video playback (crucial for iOS Safari / Mobile browsers)
    if (range && (extname(file) === '.mp4' || extname(file) === '.webm')) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      const size = fileStat.size;
      let start = m && m[1] !== '' ? Number(m[1]) : NaN;
      let end = m && m[2] !== '' ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (m && m[1] === '' && m[2] !== '') {
        start = Math.max(0, size - Number(m[2]));
        end = size - 1;
      }
      if (!m || !(start >= 0) || start > end || start >= size) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      const chunkSize = (end - start) + 1;
      const stream = createReadStream(file, { start, end });
      stream.on('error', () => res.destroy());
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileStat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
        'Cache-Control': 'no-cache'
      });
      stream.pipe(res);
      return;
    }

    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': body.length,
      'Cache-Control': 'no-cache'
    }).end(body);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found: ' + reqPath);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Hawk Demos server listening on 0.0.0.0:${port}`);
  console.log(`  Local:        http://127.0.0.1:${port}/player.html`);
  console.log(`  Arcade:       http://127.0.0.1:${port}/index.html`);
  console.log(`  Root dir:     ${demosRoot}`);
});
