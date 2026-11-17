// record_check.mjs — proves the recorder end to end in a real browser:
// (A) ?demo&highlight: when the Auto-Director highlight plays, tap SAVE CLIP and
//     require a downloaded file that ffprobes as video+audio, tens of seconds long.
// (B) ?demo: tap REC, let the demo drive ~5 s, tap REC again (stop) and require a
//     valid video file. Downloads are forced (navigator.canShare disabled) so the
//     check exercises the download hand-off deterministically.
// Usage: node tools/record_check.mjs   (CHROME=/path/to/chrome optional)
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'],
});
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-show_entries', 'format=duration,size', '-of', 'json', file], { encoding: 'utf8' });
  const j = JSON.parse(out);
  return { types: (j.streams || []).map(s => s.codec_type), duration: parseFloat(j.format?.duration || 0), size: parseInt(j.format?.size || 0) };
}
async function tapEl(page, sel) {
  const box = await (await page.$(sel)).boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
async function newPage(browser, query) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true });
  page.on('pageerror', e => fails.push('pageerror: ' + String(e).slice(0, 160)));
  await page.addInitScript(() => { try { Object.defineProperty(navigator, 'canShare', { value: () => false }); } catch (_) {} });
  await page.goto(`http://localhost:${PORT}/index.html${query}`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 60000 });
  return page;
}

{ // (A) SAVE CLIP on the highlight
  const page = await newPage(browser, '?demo&highlight');
  await page.waitForFunction(() => !!window.__palm.director.play, null, { timeout: 240000 });
  await page.waitForSelector('#pcSaveBtn', { state: 'visible', timeout: 30000 });
  const dlP = page.waitForEvent('download', { timeout: 240000 });
  await tapEl(page, '#pcSaveBtn');
  const dl = await dlP;
  const file = path.join(os.tmpdir(), 'pc-highlight' + path.extname(dl.suggestedFilename() || '.webm'));
  await dl.saveAs(file);
  const p = probe(file);
  ok(p.types.includes('video'), `highlight: no video stream (${p.types})`);
  ok(p.types.includes('audio'), `highlight: no audio stream (${p.types})`);
  ok(p.duration > 6 && p.duration < 180, `highlight: duration ${p.duration}s out of range`);
  ok(p.size > 200000, `highlight: size ${p.size} too small`);
  console.log(`highlight clip: ${p.duration.toFixed(1)}s, ${(p.size / 1e6).toFixed(2)} MB, streams ${p.types.join('+')}`);
  await page.close();
}
{ // (B) REC during live gameplay
  const page = await newPage(browser, '?demo');
  await page.waitForTimeout(3000);
  await tapEl(page, '#pcRecBtn');
  await page.waitForTimeout(5000);
  const dlP = page.waitForEvent('download', { timeout: 60000 });
  await tapEl(page, '#pcRecBtn');
  const dl = await dlP;
  const file = path.join(os.tmpdir(), 'pc-gameplay' + path.extname(dl.suggestedFilename() || '.webm'));
  await dl.saveAs(file);
  const p = probe(file);
  ok(p.types.includes('video'), `gameplay: no video stream (${p.types})`);
  ok(p.duration > 2 && p.duration < 30, `gameplay: duration ${p.duration}s out of range`);
  ok(p.size > 50000, `gameplay: size ${p.size} too small`);
  console.log(`gameplay clip: ${p.duration.toFixed(1)}s, ${(p.size / 1e6).toFixed(2)} MB, streams ${p.types.join('+')}`);
  await page.close();
}
await browser.close(); server.close();
if (fails.length) { console.log('FAIL record_check: ' + fails.join(' | ')); process.exit(1); }
console.log('PASS record_check (highlight save + live REC both produced real video files)');
