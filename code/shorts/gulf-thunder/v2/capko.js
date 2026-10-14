// node capko.js OUT STAGE SKIP EVERY MAXFRAMES POST : capture until boss KO + POST frames
const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
const fs = require('fs');
const [OUT, STG, SKIP, EVERY, MAX, POST, SEED] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 270, height: 480 } })).newPage();
  await p.goto(`file:///workspace/work/shorts/gulf-thunder/game/index.html?capture&mute&god&bot&stage=${STG}&seed=${SEED||3}`);
  await p.waitForFunction(() => window.__cap && window.GT && GT.scene);
  let sk = +SKIP; while (sk > 0) { const k = Math.min(sk, 600); await p.evaluate(n => __cap.step(n), k); sk -= k; }
  if (process.env.PRE) { const [pc, pe] = process.env.PRE.split(':').map(Number); for (let i = 0; i < pc; i += 30) await p.evaluate(([k, e]) => { __cap.shots(k, e); }, [Math.min(30, pc - i), pe]); }
  const start = await p.evaluate(() => { __cap.sfx(); return window.__steps; });
  let n = 0, ko = 0; const sfx = [], meta = [];
  while (n < +MAX && !(ko && n >= ko + +POST)) {
    const r = await p.evaluate(([k, e]) => { const out = []; const kos = []; for (let i = 0; i < k; i++) { out.push(__cap.shots(1, e)[0]); const st = GT.scene.st || {}; const bs = st.boss;
        kos.push(!!((bs && (bs.dead || bs.hp <= 0)) || (st.bannerT > 0 && /DOWN/.test(st.banner || '')))); }
      return { s: out, k: kos, f: __cap.sfx(), i: __cap.info(), st: window.__steps }; }, [10, +EVERY]);
    r.s.forEach((d, i) => { fs.writeFileSync(`${OUT}/${String(++n).padStart(5, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')); if (!ko && r.k[i]) ko = n; });
    sfx.push(...r.f); meta.push({ n, st: r.st, ...r.i });
  }
  fs.writeFileSync(OUT + '/sfx.json', JSON.stringify({ start, every: +EVERY, events: sfx, ko }));
  fs.writeFileSync(OUT + '/meta.json', JSON.stringify(meta));
  console.log('DONE', OUT, n, 'start', start, 'ko', ko);
  await b.close();
})();
