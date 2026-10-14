const { _electron } = require('/workspace/work/trailer_v2/node_modules/playwright');
const fs = require('fs'), path = require('path');
const [game, query, mode] = process.argv.slice(2);
const OUT = '/workspace/work/esde_mac/media_src/' + game; fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const app = await _electron.launch({ executablePath: '/workspace/work/esde_mac/app/node_modules/electron/dist/electron',
    args: ['/workspace/work/esde_mac/app', '--game=' + game, '--ozone-platform=headless', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ozone-override-screen-size=1280,720'],
    env: { ...process.env, BROWSER_ARCADE_TEST: '1', BROWSER_ARCADE_DATA: '/tmp/ba_cap', BROWSER_ARCADE_QUERY: query || '' } });
  const page = await app.firstWindow(); await page.waitForLoadState('load');
  if (mode === 'title') { for (let i = 0; i < 6; i++) { await sleep(1000); await page.screenshot({ path: `${OUT}/title_${i}.png` }); } }
  else {
    await sleep(1500);
    for (let k = 0; k < 5; k++) { await page.keyboard.down('Enter'); await sleep(120); await page.keyboard.up('Enter'); await sleep(900); }
    await sleep(+process.env.CAP_WAIT || 12000);
    await page.screenshot({ path: `${OUT}/shot_start.png` });
    await page.evaluate(() => {
      const c = document.getElementById('game'); const st = c.captureStream(30);
      const rec = new MediaRecorder(st, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 6000000 });
      window.__chunks = []; rec.ondataavailable = (e) => e.data.size && window.__chunks.push(e.data); rec.start(1000); window.__rec = rec;
    });
    const plan = ['j','j','k','j','l','j','j','k','j','j'];
    const t0 = Date.now(); let f = 0;
    while (Date.now() - t0 < (+process.env.CAP_MS || 20000)) {
      const dir = (f % 8) < 5 ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(dir); await sleep(250);
      const k = plan[f % plan.length]; await page.keyboard.down(k); await sleep(90); await page.keyboard.up(k);
      await sleep(200); await page.keyboard.up(dir);
      if (f % 6 === 3) await page.screenshot({ path: `${OUT}/shot_${f}.png` });
      f++;
    }
    const b64 = await page.evaluate(() => new Promise((res) => { window.__rec.onstop = async () => { const bl = new Blob(window.__chunks, { type: 'video/webm' }); const buf = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); res(btoa(s)); }; window.__rec.stop(); }));
    fs.writeFileSync(`${OUT}/gameplay.webm`, Buffer.from(b64, 'base64'));
    console.log('frames', f, 'secs', (Date.now() - t0) / 1000);
    
  }
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
