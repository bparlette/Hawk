// Verification harness for the premium shell demo.
// Serves ~/workspace/miso-3d-walk/shell at http://local.test/ via route
// interception (localhost navigation is blocked here).
//
// FONT MIRROR (harness-only): this sandbox's proxy refuses Chromium's tunnel
// to fonts.googleapis.com (curl through the same proxy succeeds), so the
// harness downloads the exact Google Fonts CSS + woff2 files with curl and
// serves them locally. demo.html / shell.js keep the real CDN links — a
// normal browser (itch) loads them from Google directly.
import { chromium } from '/home/hatch/workspace/hoa-warfare/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/hatch/workspace/miso-3d-walk/shell';
const FDIR = '/tmp/miso-shell-fonts';
const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Jost:ital,wght@0,300;0,400;1,300&display=swap';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp',
  '.png': 'image/png', '.json': 'application/json', '.css': 'text/css',
  '.woff2': 'font/woff2'
};

function buildFontMirror() {
  const marker = path.join(FDIR, 'fonts-local.css');
  if (fs.existsSync(marker)) return;
  fs.mkdirSync(FDIR, { recursive: true });
  const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
  execSync(`curl -s -A "${UA}" "${FONT_CSS_URL}" -o fonts.css`, { cwd: FDIR });
  const css = fs.readFileSync(path.join(FDIR, 'fonts.css'), 'utf8');
  const urls = [...new Set([...css.matchAll(/https:[^)]+/g)].map(m => m[0]))];
  for (const u of urls) execSync(`curl -s -O "${u}"`, { cwd: FDIR });
  const local = css.replace(/https:[^)]*\/([^/)]+\.woff2)/g, 'http://local.test/fontfiles/$1');
  fs.writeFileSync(marker, local);
  console.log('font mirror built:', urls.length, 'woff2 files');
}
buildFontMirror();

const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--disable-gpu-sandbox']
});

async function newDemoPage(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'fonts.googleapis.com')
      return route.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(FDIR, 'fonts-local.css')) });
    if (url.hostname !== 'local.test') return route.continue();
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/demo.html';
    if (p.startsWith('/fontfiles/')) {
      const f = path.join(FDIR, path.basename(p));
      if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
      return route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) });
    }
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
      return route.fulfill({ status: 404, body: 'nf' });
    return route.fulfill({
      status: 200,
      contentType: MIME[path.extname(file)] || 'application/octet-stream',
      body: fs.readFileSync(file)
    });
  });
  await page.goto('http://local.test/demo.html');
  // Wait until the Cinzel/Jost FontFaces are genuinely LOADED (fonts.check()
  // alone returns true vacuously when no @font-face exists — do not trust it).
  const fontsOk = await page.evaluate(() => Promise.race([
    (async () => {
      await document.fonts.load('600 60px Cinzel');
      await document.fonts.load('300 13px Jost');
      await document.fonts.ready;
      const loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family);
      return loaded.includes('Cinzel') && loaded.includes('Jost');
    })(),
    new Promise(r => setTimeout(() => r(false), 12000))
  ]));
  console.log('Cinzel+Jost FontFaces loaded:', fontsOk);
  return { page, errors };
}

/* ------------------------------------------------------------ landscape */
{
  const { page, errors } = await newDemoPage({ width: 1280, height: 720 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(ROOT, 'shots/veil-land.png') });
  console.log('shot veil-land');

  await page.click('#btn-ready');
  await page.waitForTimeout(2100);            // veil fade + title settle
  await page.screenshot({ path: path.join(ROOT, 'shots/title-land.png') });
  console.log('shot title-land');

  await page.click('#btn-zone');              // amber -> teal
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(ROOT, 'shots/title-teal-land.png') });
  console.log('shot title-teal-land');

  await page.click('#btn-walk');
  await page.waitForTimeout(1600);            // title released, caption in
  await page.screenshot({ path: path.join(ROOT, 'shots/walking-land.png') });
  console.log('shot walking-land');

  await page.click('.miso-sound');            // tap for sound
  await page.waitForTimeout(900);
  const soundFired = await page.evaluate(() => window.__soundFired === true);
  const pillGone = await page.evaluate(() => !document.querySelector('.miso-sound'));
  await page.screenshot({ path: path.join(ROOT, 'shots/walking-soundoff-land.png') });
  console.log('sound tap fired callback:', soundFired, '| pill removed:', pillGone);
  console.log('landscape errors:', errors.length ? errors : 'none');
  await page.close();
}

/* ------------------------------------------------------------- portrait */
{
  const { page, errors } = await newDemoPage({ width: 540, height: 960 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(ROOT, 'shots/veil-port.png') });
  console.log('shot veil-port');
  await page.click('#btn-ready');
  await page.waitForTimeout(2100);
  await page.screenshot({ path: path.join(ROOT, 'shots/title-port.png') });
  console.log('shot title-port');
  console.log('portrait errors:', errors.length ? errors : 'none');
  await page.close();
}

await browser.close();
console.log('DONE');
