// compare_shots_v2.mjs — Created by Gemini (v2).
// Reproducible before/after comparison stitcher + golden-hour asphalt RGB check for Palm City v2 look merge.
// Uses Fable's Playwright setup (tools/node_modules/playwright-core) without modifying tools/shot.mjs.
//
// Run (from games/palm-city/):
//   node tools/compare_shots_v2.mjs

import fs from 'node:fs';
import { chromium } from 'playwright-core';

const PAIRS = [
  ['shots/merge-before-golden.png', 'shots/merge-after-golden.png', 'shots/merge-compare-golden.png', 'BEFORE Golden (t=0.1, cam=1240,1240)', 'AFTER Merge Golden (t=0.1, cam=1240,1240)'],
  ['shots/merge-before-dusk.png',   'shots/merge-after-dusk.png',   'shots/merge-compare-dusk.png',   'BEFORE Dusk (t=0.96, cam=1035,1275)',   'AFTER Merge Dusk (t=0.96, cam=1035,1275)'],
  ['shots/merge-before-mid.png',    'shots/merge-after-mid.png',    'shots/merge-compare-mid.png',    'BEFORE Mid (t=0.5, cam=1240,1240)',     'AFTER Merge Mid (t=0.5, cam=1240,1240)'],
];

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 880, height: 920 } });

// Verify sunlit intersection asphalt in golden hour has warm taupe tones (R > G > B), not lavender cast
const goldenB64 = 'data:image/png;base64,' + fs.readFileSync('shots/merge-after-golden.png').toString('base64');
const rgb = await page.evaluate(async (src) => {
  const img = new Image(); img.src = src;
  await new Promise((r) => (img.onload = r));
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
  const pt = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3);
  return { shadowRoad: pt(330, 500), sunlitInter: pt(260, 1200), sunlitInterRight: pt(370, 1200), bottomShadowRoad: pt(330, 1550) };
}, goldenB64);
console.log('GOLDEN ASPHALT RGB:', rgb);

for (const [aPath, bPath, outPath, titleA, titleB] of PAIRS) {
  const srcs = [aPath, bPath].map((p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64'));
  await page.setContent(`
    <html><body style="margin:0;background:#14121c">
      <canvas id="cv" width="880" height="900"></canvas>
      <script>
        Promise.all(${JSON.stringify(srcs)}.map(s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; })))
          .then(([ia, ib]) => {
            const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
            ctx.fillStyle = '#14121c'; ctx.fillRect(0, 0, 880, 900);
            ctx.fillStyle = '#f8e6c8'; ctx.font = 'bold 20px sans-serif';
            ctx.fillText(${JSON.stringify(titleA)}, 20, 32);
            ctx.fillText(${JSON.stringify(titleB)}, 450, 32);
            ctx.drawImage(ia, 20, 44, 410, 840);
            ctx.drawImage(ib, 450, 44, 410, 840);
            window.__done = true;
          });
      </script>
    </body></html>
  `);
  await page.waitForFunction(() => window.__done);
  await page.locator('#cv').screenshot({ path: outPath });
  console.log('wrote', outPath);
}

await browser.close();
