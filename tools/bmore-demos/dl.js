// node dl.js <id=query> ... : load each live Toad City deep link headless, report which mode is running + console errors, save a screenshot.
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/workspace/work/freeze_test/pw-browsers';
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const { execFileSync } = require('child_process'), fs = require('fs');
const BASE = 'https://toad-city-baltimore.surge.sh/';
const cache = {};
function fetchLive(u) {
  const key = u.split('#')[0].replace(/\?.*$/, '');
  if (cache[key]) return cache[key];
  const f = '/tmp/_tcdl_' + process.pid + '_' + Object.keys(cache).length;
  const code = execFileSync('curl', ['-sL', '--max-time', '90', '-o', f, '-w', '%{http_code}|%{content_type}', u]).toString().split('|');
  return (cache[key] = { status: +code[0], contentType: code[1] || undefined, body: fs.readFileSync(f) });
}
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  for (const arg of process.argv.slice(2)) {
    const [id, q] = arg.split('=', 2).length ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, ''];
    const url = BASE + '?' + q;
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.route('**/*', async (rt) => { const u = rt.request().url(); if (!/^https?:/.test(u)) return rt.continue();
      if (/youtube|ytimg|googlevideo|doubleclick/.test(u)) return rt.abort();
      try { const r = fetchLive(u); await rt.fulfill(r); } catch (e) { await rt.abort(); } });
    const errs = [];
    p.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/GPU stall|GL Driver|swiftshader|Automatic fallback|GroupMarkerNotSet|youtube|ERR_FAILED/i.test(t)) errs.push(t.slice(0, 160)); } });
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160)));
    let gs = 'n/a';
    try {
      await p.goto(url, { waitUntil: 'load', timeout: 120000 });
      await p.waitForTimeout(16000);
      gs = await p.evaluate(() => JSON.stringify({
        duel: window.__duels && __duels.cur && __duels.cur.id, fort: window.__fort && __fort.on, vic: window.__vic && __vic.on,
        rb: window.__rb && __rb.mode, derby: window.__derby && (__derby.on || (__derby.S && __derby.S.on) || null), finale: window.__finale && __finale.F && __finale.F.on,
        frames: window.__cel && __cel.frames, celErr: window.__celErr && __celErr.n }));
    } catch (e) { gs = 'FAIL ' + e.message.slice(0, 120); }
    const shot = '/workspace/work/bmore_demos/shots/' + id + '.png';
    await p.screenshot({ path: shot, timeout: 60000 }).catch(() => {});
    console.log(JSON.stringify({ id, q, errors: errs.length, list: errs.slice(0, 3), gs }));
    await ctx.close();
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
