// Shared bits for the Toad City CI runners (GitHub Actions on bparlette/Hawk).
const fs = require('fs');
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

// Hosts whose failures are not ours (third-party embeds / fonts / music).
const IGNORE_HOST = /youtube|ytimg|googlevideo|google|gstatic|doubleclick|bandcamp|bcbits/i;
// Console noise from software GL / autoplay that is not a game bug.
const IGNORE_MSG = /GPU stall|GL Driver|swiftshader|Automatic fallback|AudioContext was not allowed|WebGL: too many errors|GroupMarkerNotSet|Permissions policy/i;

async function open(w, h) {
  const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage();
  const errs = [], warns = [], ignored = [];
  p.on('console', (m) => {
    const t = m.type(); if (t !== 'error' && t !== 'warning') return;
    const txt = m.text(), loc = (m.location() && m.location().url) || '';
    if (IGNORE_MSG.test(txt)) return;
    if (IGNORE_HOST.test(loc) || (/Failed to load resource|net::ERR_/i.test(txt) && IGNORE_HOST.test(txt + ' ' + loc))) { ignored.push(t + ': ' + txt.slice(0, 200) + ' @' + loc); return; }
    (t === 'error' ? errs : warns).push(t + ': ' + txt.slice(0, 300) + (loc ? ' @' + loc.slice(0, 120) : ''));
  });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').slice(0, 300)));
  p.on('requestfailed', (r) => { const u = r.url(); if (IGNORE_HOST.test(u)) ignored.push('reqfail: ' + u); else errs.push('reqfail: ' + u + ' ' + ((r.failure() || {}).errorText || '')); });
  return { b, p, errs, warns, ignored };
}

function writeResult(outDir, name, res) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(res, null, 2));
  console.log('RESULT', JSON.stringify({ name: res.name, pass: res.pass, reason: res.reason, wall: res.wall, errors: res.errors.length }));
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${res.pass ? 'PASS' : 'FAIL'} ${res.name}\n- ${res.reason}\n- wall ${res.wall}s, own console errors ${res.errors.length}, warnings ${res.warnings.length}, ignored 3rd-party ${res.ignored.length}\n` + (res.errors.length ? '```\n' + res.errors.slice(0, 10).join('\n') + '\n```\n' : ''));
  }
}

module.exports = { pw, open, writeResult };
