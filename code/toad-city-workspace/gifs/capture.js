// Toad City Baltimore home-page gallery capture (in-engine, headless Chrome, deterministic virtual clock).
// Usage: node capture.js <port> [gifId[,gifId...]] [--seg=segId] [--force]
//   Reads manifest.js, writes frames to frames/<gif>/<seg>/0001.jpg ... plus frames/<gif>/<seg>/done.json.
//   Segments that already have done.json are skipped unless --force (so a run can be resumed / split across shell calls).
// Run it ONLY through: flock /workspace/work/toad-city/locks/chrome.flock node capture.js ...   (start the server outside the flock)
// How it works: an init script swaps performance.now + requestAnimationFrame for a virtual clock. After the game boots the harness
// turns the clock to manual and drives frames itself: SUB sim ticks per captured frame (renderer.render is a no-op on all but the last),
// so the game runs at true speed however slow the software GPU is. Labels are a DOM overlay in the game's own pixel font (PX).
// No game source is touched: only existing debug query params and the window.__* debug handles.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const M = require('./manifest.js');
const ROOT = __dirname;
const args = process.argv.slice(2);
const port = args[0] || '8791';
const only = args[1] && !args[1].startsWith('--') ? args[1].split(',') : null;
const segOnly = (args.find((a) => a.startsWith('--seg=')) || '').slice(6).split(',').filter(Boolean);
const force = args.includes('--force');
// --stale: redo a segment only if its done.json was captured from a different build than snap.rev (makes recapture resumable)
const stale = args.includes('--stale');
const REV = (() => { try { return fs.readFileSync(path.join(__dirname, 'snap.rev'), 'utf8').trim(); } catch (e) { return ''; } })();
// (with --stale a segment is also redone when its query string changed in manifest.js)
const isDone = (dir, q) => { try { const d = JSON.parse(fs.readFileSync(path.join(dir, 'done.json'), 'utf8')); return !stale || (d.rev === REV && (!d.q || d.q === q)); } catch (e) { return false; } };
const W = M.width || 720, H = M.height || 405, FPS = M.fps || 15, SUB = M.sub || 2;

const INIT = `(() => {
  const realNow = performance.now.bind(performance), realRAF = window.requestAnimationFrame.bind(window);
  let manual = false, vnow = 0, pending = [], id = 1;
  performance.now = () => (manual ? vnow : realNow());
  window.requestAnimationFrame = (cb) => { if (manual) { pending.push(cb); return id++; } return realRAF((t) => { if (manual) pending.push(cb); else cb(t); }); };
  window.__cap = {
    manual: () => { if (!manual) { vnow = realNow(); manual = true; } },
    tick(ms, render) { const R = window.__cel && __cel.renderer; const keep = R && R.render; if (R && !render) R.render = () => {};
      vnow += ms; const cbs = pending; pending = []; try { for (const cb of cbs) cb(vnow); } finally { if (R && !render) R.render = keep; } },
    run(n, ms, renderLast) { for (let i = 0; i < n; i++) this.tick(ms, renderLast && i === n - 1); },
    label(text, opt) { opt = opt || {}; let el = document.getElementById('__caplbl'); if (!el) { el = document.createElement('div'); el.id = '__caplbl'; document.body.appendChild(el); }
      if (!text) { el.style.display = 'none'; return; }
      const pos = opt.pos || 'bottom'; const fs = opt.size || Math.min(30, Math.floor(innerWidth * 0.92 / Math.max(8, text.length)));
      el.style.cssText = 'position:fixed;left:0;right:0;z-index:2147483647;text-align:center;pointer-events:none;font-family:PX,monospace;color:#fff;line-height:1.25;'
        + (pos === 'top' ? 'top:' + (opt.off || 14) + 'px;' : 'bottom:' + (opt.off || 16) + 'px;') + 'font-size:' + fs + 'px;letter-spacing:1px;'
        + 'text-shadow:3px 3px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,0 3px 0 #000;';
      el.innerHTML = '<span style="display:inline-block;background:rgba(10,8,30,.55);padding:8px 12px;border-radius:6px;box-shadow:0 0 0 3px ' + (opt.color || '#ffd23c') + '">' + text
        + (opt.sub ? '<br><span style="font-size:' + Math.round(fs * 0.55) + 'px;color:' + (opt.color || '#ffd23c') + '">' + opt.sub + '</span>' : '') + '</span>';
      el.style.display = 'block'; },
    hideUI(on) { const gl = document.getElementById('gl'); for (const e of document.body.querySelectorAll('*')) { if (e === gl || e.contains(gl) || e.id === '__caplbl' || e.closest('#__caplbl')) continue; if (on) { if (e.dataset.caph == null) { e.dataset.caph = e.style.visibility || ''; e.style.visibility = 'hidden'; } } else if (e.dataset.caph != null) { e.style.visibility = e.dataset.caph; delete e.dataset.caph; } } },
  };
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const gifs = M.gifs.filter((g) => !only || only.includes(g.id));
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const report = []; let live = null;
  for (const g of gifs) for (const s of g.segments) {
    if (segOnly.length && !segOnly.includes(s.id)) continue;
    const dir = path.join(ROOT, 'frames', g.id, s.id);
    if (!force && isDone(dir, s.q || M.baseQuery || '?nointro=1&radiotest=1')) continue;
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const t0 = Date.now(); let n = 0, note = '';
    const q = (s.q || M.baseQuery || '?nointro=1&radiotest=1');
    const reuse = s.reuse && live && live.q === q && !live.bad;
    if (!reuse && live) { await live.ctx.close(); live = null; }
    if (!live) { const ctx = await b.newContext({ viewport: { width: W, height: H } }); await ctx.addInitScript(INIT); const p = await ctx.newPage(); live = { ctx, p, q, errs: [] };
      p.on('pageerror', (e) => live && live.errs.push('pageerror: ' + e.message));
      p.on('console', (m) => { const t = m.text(); if (live && m.type() === 'error' && !/youtube|407|Proxy|ytimg|google|bandcamp|net::ERR|Failed to load resource|GPU stall|GL Driver/i.test(t)) live.errs.push(t); }); }
    const p = live.p; const errs = live.errs; errs.length = 0;
    try {
      if (!reuse) {
        await p.goto(`http://127.0.0.1:${port}/${q}`, { timeout: 120000 });
        await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 120000 });
        await sleep(s.bootWait || 1500); // real-time settle (textures, fonts)
        await p.evaluate(() => document.fonts && document.fonts.ready);
        await p.evaluate(() => __cap.manual());
      }
      if (s.hideUI) await p.evaluate(() => __cap.hideUI(true));
      // pre/after are statement strings (may hold newlines / blocks): run through indirect eval, not as a Playwright expression
      if (s.pre) await p.evaluate((c) => { (0, eval)(c); }, s.pre);
      const dt = 1000 / FPS / SUB;
      if (s.warm) { // fast-forward sim-only (no render) in chunks so a long warm doesn't block the page
        let left = Math.round(s.warm * 1000 / dt);
        while (left > 0) { const k = Math.min(left, 60); await p.evaluate(([k, dt]) => __cap.run(k, dt, false), [k, dt]); left -= k; }
      }
      if (s.until) { // keep fast-forwarding (sim-only) until a JS condition holds, at most s.maxWarm seconds
        let left = Math.round((s.maxWarm || 60) * 1000 / dt), hit = false;
        while (left > 0 && !hit) { hit = await p.evaluate(([dt, c]) => { for (let i = 0; i < 6; i++) { if ((0, eval)(c)) return true; __cap.run(1, dt, false); } return !!(0, eval)(c); }, [dt, s.until]); left -= 6; }
        note += 'until:' + (hit ? 'hit' : 'MISSED') + ' ';
        if (s.untilExtra) { let k = Math.round(s.untilExtra * 1000 / dt); while (k > 0) { const m = Math.min(k, 60); await p.evaluate(([m, dt]) => __cap.run(m, dt, false), [m, dt]); k -= m; } }
      }
      if (s.after) await p.evaluate((c) => { (0, eval)(c); }, s.after);
      for (const k of s.hold || []) await p.keyboard.down(k);
      if (s.label) await p.evaluate(([t, o]) => __cap.label(t, o), [s.label, s.labelOpt || {}]);
      const frames = Math.round((s.dur || 2) * FPS);
      for (let i = 0; i < frames; i++) {
        const u = i / Math.max(1, frames - 1);
        const ks = s.keys && s.keys[i] ? [].concat(s.keys[i]) : (s.every && i % s.every[0] === 0 ? [].concat(s.every[1]) : []);
        for (const k of ks) await p.keyboard.down(k);
        await p.evaluate(([u, i, tick, dt, sub]) => { window.__capU = u; window.__capI = i; if (tick) (0, eval)(tick); __cap.run(sub, dt, true); }, [u, i, s.tick || '', dt, SUB]);
        for (const k of ks) await p.keyboard.up(k);
        await p.screenshot({ path: path.join(dir, String(i + 1).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 88, timeout: 120000 });
        n++;
      }
      for (const k of s.hold || []) await p.keyboard.up(k);
      if (s.check) note += String(await p.evaluate((c) => (0, eval)(c), s.check));
    } catch (e) { errs.push('harness: ' + e.message.split('\n')[0]); live.bad = true; }
    const rec = { gif: g.id, seg: s.id, rev: REV, q, frames: n, secs: Math.round((Date.now() - t0) / 1000), errors: errs.slice(0, 6), check: note };
    if (n > 0) fs.writeFileSync(path.join(dir, 'done.json'), JSON.stringify(rec));
    console.log(JSON.stringify(rec)); report.push(rec);
  }
  if (live) await live.ctx.close();
  await b.close();
})();
