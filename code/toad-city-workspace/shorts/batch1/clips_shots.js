// clips_shots.js <outdir> : live screenshots of / and /home/ (Clips section) at 390 and 1280. Run under the chrome flock.
const { chromium } = require('/workspace/work/trailer_v2/node_modules/playwright');
const PX=(()=>{const v=process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy;if(!v)return undefined;const u=new URL(v);return {server:u.protocol+'//'+u.host,username:decodeURIComponent(u.username)||undefined,password:decodeURIComponent(u.password)||undefined,bypass:process.env.NO_PROXY||process.env.no_proxy};})();
(async () => {
  const out = process.argv[2]; const U = 'https://toad-city-baltimore.surge.sh';
  const b = await chromium.launch({ proxy: PX, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const res = {};
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    const ctx = { viewport: { width: w, height: h }, hasTouch: w < 600, isMobile: w < 600 };
    let p = await b.newPage(ctx); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await p.goto(U + '/?nc=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 150000 }); await p.waitForTimeout(10000);
    await p.screenshot({ path: `${out}/root_${w}.png` });
    res['root_' + w] = { errs, canvas: await p.evaluate(() => !!document.querySelector('canvas')) }; await p.close();
    p = await b.newPage(ctx); const e2 = []; p.on('pageerror', (e) => e2.push(String(e).slice(0, 200)));
    await p.goto(U + '/home/?nc=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 150000 }); await p.waitForTimeout(2000);
    await p.screenshot({ path: `${out}/home_${w}.png` });
    const el = await p.$('#clips'); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(3000);
    await el.screenshot({ path: `${out}/home_clips_${w}.png` });
    res['home_' + w] = { errs: e2, imgs: await p.$$eval('#clips img', (a) => a.map((i) => i.complete && i.naturalWidth > 0)), overflowX: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth) };
    await p.close();
  }
  console.log(JSON.stringify(res)); await b.close();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
