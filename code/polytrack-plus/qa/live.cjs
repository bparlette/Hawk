const { chromium } = require('/workspace/work/trailer_v2/node_modules/playwright');
const PX=(()=>{const v=process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy;if(!v)return undefined;const u=new URL(v);return {server:u.protocol+'//'+u.host,username:decodeURIComponent(u.username)||undefined,password:decodeURIComponent(u.password)||undefined,bypass:process.env.NO_PROXY||process.env.no_proxy};})();
(async () => {
  const b = await chromium.launch({ proxy: PX, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  for (const [w, h, url, out] of [[1280, 720, 'https://bparlette.github.io/Hawk/brad-demos/g/polytrack-plus/index.html?nc=' + Date.now(), 'qa/live_direct.png'], [390, 844, 'https://bparlette.github.io/Hawk/brad-demos/?nc=' + Date.now() + '#polytrack-plus', 'qa/live_shell390.png']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: w < 600, isMobile: w < 600 }); const errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForTimeout(12000);
    const st = await p.evaluate(() => { const f = document.querySelector('iframe'); const W = f ? f.contentWindow : window; return W.__ptp ? { mode: W.__ptp.st.mode, z: W.__ptp.car.pos.z.toFixed(1), embed: W.document.documentElement.className } : 'no __ptp'; }).catch((e) => e.message);
    await p.screenshot({ path: out }); console.log(out, JSON.stringify(st), 'errs', JSON.stringify(errs)); await p.close();
  }
  await b.close();
})();
