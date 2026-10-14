// node qa/capshort.js <ev> <nframes> : 9:16 frames (1080x1920) of the bot playing event <ev> in slow game-time, for the Short
const { chromium } = require('/workspace/work/trailer_v2/node_modules/playwright');
const fs = require('fs');
const ev = +process.argv[2], N = +(process.argv[3] || 40), pre = +(process.argv[4] || 2500);
const CAPS = [['HALF PIPE', 'aerials · hand plants'], ['FOOT BAG', 'keep it up · bonk the seagull'], ['SURFING', 'the judges are watching'], ['ROLLER SKATING', 'duck the beach balls'], ['BMX', 'flips in the desert'], ['FLYING DISK', 'layout diving catch']];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5 });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto('http://127.0.0.1:8817/index.html?nc=' + Date.now(), { waitUntil: 'load' }); await p.waitForTimeout(1200);
  const dir = `shorts/cap/e${ev}`; fs.mkdirSync(dir, { recursive: true });
  await p.evaluate(([i, c]) => { __cg.QA.bot = true; __cg.QA.speed = 2; __cg.Game.handOver(); __cg.startComp('practice', [i]); __cg.QA.cap = c[0]; __cg.QA.cap2 = c[1]; document.getElementById('topbar').style.display = 'none'; }, [ev, CAPS[ev]]);
  await p.waitForTimeout(pre);
  await p.evaluate(() => { __cg.QA.speed = 0.3; });
  for (let i = 0; i < N; i++) await p.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 86 });
  console.log(JSON.stringify({ ev, frames: N, errs, st: await p.evaluate(() => ({ s: __cg.Game.state, sc: __cg.R.score })) }));
  await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
