// node live.js — loads the live GitHub Pages shell with #blox-dough-raid-plus (requests proxied through node's fetch, since headless Chromium here has no direct internet)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const BASE = 'https://bparlette.github.io/Hawk/brad-demos/';
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [w, h, name] of [[1280, 720, 'desk'], [390, 844, 'mob']]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 });
    await c.route('**/*', async (route) => {
      const u = route.request().url();
      if (!/^https?:/.test(u)) return route.continue();
      try { const r = await fetch(u); const body = Buffer.from(await r.arrayBuffer()); await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream' }, body }); }
      catch (e) { await route.abort(); }
    });
    const p = await c.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160)));
    p.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|GL Driver|WebGL/i.test(m.text())) errs.push(m.text().slice(0, 160)); });
    await p.goto(BASE + '#blox-dough-raid-plus');
    await p.waitForTimeout(9000);
    const fr = p.frames().find((f) => /\/g\/blox-dough-raid-plus\//.test(f.url()));
    let info = { frame: !!fr };
    if (fr) info = { ...info, url: fr.url(), three: await fr.evaluate(() => typeof THREE).catch((e) => 'ERR ' + e.message), blox: await fr.evaluate(() => window.__blox ? __blox.G.mode + '/' + __blox.G.state : 'none').catch((e) => 'ERR ' + e.message) };
    if (fr) { await fr.evaluate(() => __blox.advance(5)).catch(() => {}); }
    await p.waitForTimeout(500);
    await p.screenshot({ path: `/workspace/work/blox-raid/shots/live-${name}.png` });
    const picker = await p.evaluate(() => [...document.querySelectorAll('.card .nm')].map((n) => n.textContent).filter((t) => /Blox/i.test(t)));
    console.log(name, JSON.stringify({ ...info, picker, errs }));
    await c.close();
  }
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
