// node tools/probe.js <port>  -> qa/hf_top.png, qa/probe.json, qa/probe_view.png
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const port = process.argv[2] || '8791';
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto(`http://127.0.0.1:${port}/index.html`);
  await p.waitForFunction(() => window.__probe, null, { timeout: 180000 }).catch((e) => errs.push('timeout ' + e.message));
  const info = await p.evaluate(() => { const P = window.__probe; if (!P) return null; return { ms: P.HF.ms, lm: P.LANDMARKS.map((l) => [l.id, l.x, l.z, l.r]), lmhd: P.LMHD, piers: P.PIERS, url: P.map() }; });
  if (info) { fs.writeFileSync('qa/hf_top.png', Buffer.from(info.url.split(',')[1], 'base64')); delete info.url; fs.writeFileSync('qa/probe.json', JSON.stringify(info, null, 1)); }
  await p.screenshot({ path: 'qa/probe_view.png' });
  console.log('ms', info && info.ms, 'ERR', errs.length, errs.slice(0, 8).join('\n'));
  await b.close();
})();
