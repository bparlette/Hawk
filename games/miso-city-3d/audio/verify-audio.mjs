// Verification for the adaptive audio pack: serve ~/workspace/miso-3d-walk at
// http://local.test/ (route interception, same pattern as ../verify.mjs),
// load audio/test.html, unlock via a real click, then measure output with the
// module's own AnalyserNode: RMS + peak per zone and after footstep().
// Software audio only — this proves non-silence and relative balance; it is
// NOT a listening test.
import { chromium } from '/home/hatch/workspace/hoa-warfare/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/hatch/workspace/miso-3d-walk';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp',
  '.png': 'image/png', '.json': 'application/json', '.css': 'text/css'
};

const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.hostname !== 'local.test') return route.continue();
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
    return route.fulfill({ status: 404, body: 'nf' });
  return route.fulfill({
    status: 200,
    contentType: MIME[path.extname(file)] || 'application/octet-stream',
    body: fs.readFileSync(file)
  });
});

await page.goto('http://local.test/audio/test.html');
await page.waitForFunction(() => !!window.__audio, null, { timeout: 30000 });

// Measure helper installed in-page: sample the analyser over `ms` and
// return { rms, peak, dbRms, dbPeak }.
await page.evaluate(() => {
  window.__measure = (ms) => new Promise(resolve => {
    const an = window.__audio.getAnalyser();
    const buf = new Float32Array(an.fftSize);
    let sumSq = 0, n = 0, peak = 0;
    const t0 = performance.now();
    (function tick() {
      an.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i];
        sumSq += v * v; n++;
        if (Math.abs(v) > peak) peak = Math.abs(v);
      }
      if (performance.now() - t0 < ms) requestAnimationFrame(tick);
      else {
        const rms = Math.sqrt(sumSq / n);
        resolve({
          rms: +rms.toFixed(5), peak: +peak.toFixed(5),
          dbRms: +(20 * Math.log10(rms || 1e-9)).toFixed(1),
          dbPeak: +(20 * Math.log10(peak || 1e-9)).toFixed(1)
        });
      }
    })();
  });
});

// Baseline: before unlock, must be silent (context suspended / bed not built).
const before = await page.evaluate(() => window.__measure(500));
console.log('PRE-UNLOCK (expect ~silent):', JSON.stringify(before));

await page.click('#enable');
await page.waitForFunction(() => window.__audio.getState().running === true, null, { timeout: 15000 });
console.log('state after unlock:', JSON.stringify(await page.evaluate(() => window.__audio.getState())));

const results = {};
for (const zone of ['amber', 'teal', 'pink']) {
  await page.evaluate(z => window.__audio.setZone(z), zone);
  await page.waitForTimeout(3800); // pad attack + gain glides settle
  results[zone] = await page.evaluate(() => window.__measure(1800));
  console.log('ZONE', zone, JSON.stringify(results[zone]));
}

// Footsteps: fire steps for ~1.6s while measuring.
const stepRes = await page.evaluate(() => new Promise(async resolve => {
  const p = window.__measure(1600);
  let i = 0;
  const iv = setInterval(() => {
    window.__audio.footstep(i % 2 === 0 ? 0.25 : 0.75);
    if (++i >= 5) clearInterval(iv);
  }, 300);
  resolve(await p);
}));
console.log('FOOTSTEPS over bed:', JSON.stringify(stepRes));

console.log('SUMMARY errors:', errors.length ? errors : 'none');
await browser.close();
