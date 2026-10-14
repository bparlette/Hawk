const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => { const b = await pw.chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome', args: ['--no-sandbox'] });
 const [url, out, w, h, full] = process.argv.slice(2); const p = await b.newPage({ viewport: { width: +w, height: +h } }); const errs = [];
 p.on('pageerror', e => errs.push(String(e))); await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(500);
 const ov = await p.evaluate(() => [...document.querySelectorAll('pre,table')].filter(e => e.scrollWidth > e.clientWidth + 2).length);
 await p.screenshot({ path: out, fullPage: full === '1' }); console.log(JSON.stringify({ errs, scrollers: ov })); await b.close(); })();
