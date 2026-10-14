// node qa/events.js <tag> <w> <h> <eventIdx...> : bot plays each event as the human turn (practice), screenshots at 3 points
const { chromium } = require('/workspace/work/trailer_v2/node_modules/playwright');
const [tag, W, H, ...evs] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const w = +W, h = +H, res = {};
  const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: w < 600, isMobile: w < 600 });
  const errs = []; p.on('pageerror', e => errs.push('PE ' + String(e.stack || e).slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|GL Driver/.test(m.text()))) errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
  await p.goto('http://127.0.0.1:8817/index.html?nc=' + Date.now(), { waitUntil: 'load' }); await p.waitForTimeout(1500);
  for (const i of evs.map(Number)) {
    await p.evaluate(i => { __cg.QA.bot = true; __cg.QA.speed = 3; __cg.Game.handOver(); __cg.startComp('practice', [i]); }, i);
    await p.waitForTimeout(700); await p.screenshot({ path: `qa/${tag}_e${i}_${w}_a.png` });
    await p.waitForTimeout(4500); await p.screenshot({ path: `qa/${tag}_e${i}_${w}_b.png` }); let early = await p.evaluate(() => __cg.QLOG.slice(0));
    await p.waitForTimeout(4500); await p.screenshot({ path: `qa/${tag}_e${i}_${w}_c.png` });
    let st, logs = []; for (let k = 0; k < 14; k++) { st = await p.evaluate(() => ({ s: __cg.Game.state, sc: __cg.R.score, f: __cg.R.falls, t: Math.round(__cg.R.time), best: __cg.R.best, ended: __cg.R.ended, log: __cg.QLOG.splice(0) })); logs.push(...st.log); if (st.ended) break; await p.waitForTimeout(1000); } st.log = early.concat(logs);
    await p.screenshot({ path: `qa/${tag}_e${i}_${w}_d.png` });
    res['e' + i] = st; console.log('EV', i, JSON.stringify(st), JSON.stringify(errs.slice(-3)));
  }
  console.log(JSON.stringify({ res, errs: errs.slice(0, 12) }, null, 1)); await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
