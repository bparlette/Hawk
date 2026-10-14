// Toad City ending capture (finale-crowd). Deterministic virtual clock + OfflineAudioContext, adapted from shorts/batch1/cap/capture.js. Game source untouched.
// node ending.js <port> <outdir> [maxSec] [flySec] [holdSec] [touch]
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const [port, outdir, maxS = '110', flyS = '60', holdS = '5', touchS = '1'] = process.argv.slice(2);
const MAXSEC = +maxS, MAXF = Math.round(MAXSEC * 30), FLYSEC = +flyS, HOLD = +holdS, TOUCH = touchS === '1';
const VW = 390, VH = 693, DSF = 1080 / 390;
const CSS = process.env.CAPCSS || '';
fs.mkdirSync(outdir, { recursive: true });
const INIT = (secs) => {
  { let a = 0x70AD; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let VT = 0; const FR = 1000 / 30; window.__vt = () => VT;
  const rafQ = []; window.requestAnimationFrame = (f) => { rafQ.push(f); return rafQ.length; }; window.cancelAnimationFrame = () => {};
  const D0 = Date.now(); performance.now = () => VT; Date.now = () => D0 + VT;
  let tid = 1; const timers = new Map();
  window.setTimeout = (fn, ms = 0, ...a) => { const id = tid++; timers.set(id, { fn, at: VT + Math.max(0, +ms || 0), a, iv: 0 }); return id; };
  window.setInterval = (fn, ms = 0, ...a) => { const id = tid++; const iv = Math.max(4, +ms || 0); timers.set(id, { fn, at: VT + iv, a, iv }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  const runTimers = () => { for (let guard = 0; guard < 500; guard++) { let best = null, bid = 0; for (const [id, t] of timers) if (t.at <= VT && (!best || t.at < best.at)) { best = t; bid = id; } if (!best) break;
      if (best.iv) best.at += best.iv; else timers.delete(bid); try { typeof best.fn === 'function' ? best.fn(...best.a) : eval(best.fn); } catch (e) { console.error('timer', e && e.message); } } };
  window.__step = () => { VT += FR; runTimers(); const q = rafQ.splice(0); for (const f of q) { try { f(VT); } catch (e) { console.error('raf', e && e.message); } } };
  // ---- offline audio on the virtual clock ----
  const ROAC = window.OfflineAudioContext; let oc = null, base = 0; const now = () => Math.max(0, (VT - base) / 1000);
  window.__acInfo = () => (oc ? { base, sr: oc.sampleRate, len: oc.length } : null);
  function FakeAC() { if (oc) return window.__acProxy; const sr = 44100; oc = new ROAC(2, Math.round(sr * secs), sr); base = VT; window.__oac = oc;
    window.__acProxy = new Proxy(oc, { get(t, p) { if (p === 'currentTime') return now(); if (p === 'state') return 'running'; if (p === 'resume' || p === 'suspend' || p === 'close') return () => Promise.resolve();
      if (p === 'outputLatency' || p === 'baseLatency') return 0; if (p === 'getOutputTimestamp') return () => ({ contextTime: now(), performanceTime: VT });
      if (p === 'addEventListener' || p === 'removeEventListener') return () => {};
      const v = Reflect.get(t, p, t); return typeof v === 'function' ? v.bind(t) : v; }, set(t, p, v) { try { t[p] = v; } catch (e) {} return true; } });
    return window.__acProxy; }
  window.AudioContext = window.webkitAudioContext = FakeAC;
  const clampArg = (proto, m, i) => { const o = proto[m]; if (!o) return; proto[m] = function (...a) { if (oc) a[i] = Math.max(+a[i] || 0, now()); return o.apply(this, a); }; };
  for (const P of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) { if (Object.prototype.hasOwnProperty.call(P, 'start')) clampArg(P, 'start', 0); if (Object.prototype.hasOwnProperty.call(P, 'stop')) clampArg(P, 'stop', 0); }
  const AP = AudioParam.prototype; for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'setValueCurveAtTime']) clampArg(AP, m, 1);
  for (const m of ['cancelScheduledValues', 'cancelAndHoldAtTime']) clampArg(AP, m, 0);
  const vd = Object.getOwnPropertyDescriptor(AP, 'value'); Object.defineProperty(AP, 'value', { get() { return vd.get.call(this); }, set(v) { if (oc) { try { this.setValueAtTime(v, now()); } catch (e) {} } vd.set.call(this, v); }, configurable: true });
  window.__renderWav = async () => { if (!oc) return null; const buf = await oc.startRendering(); const n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)];
    const out = new Int16Array(n * 2); let peak = 0; for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) { const s = ch[c][i]; peak = Math.max(peak, Math.abs(s)); out[i * 2 + c] = Math.max(-32768, Math.min(32767, Math.round(s * 32767))); }
    window.__pcm = new Uint8Array(out.buffer); return { n, peak, bytes: window.__pcm.length }; };
  window.__pcmChunk = (i, sz) => { const a = window.__pcm.subarray(i, i + sz); let s = ''; for (let k = 0; k < a.length; k += 32768) s += String.fromCharCode.apply(null, a.subarray(k, k + 32768)); return btoa(s); };
};

(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF, isMobile: TOUCH, hasTouch: TOUCH });
  await ctx.route(/youtube|ytimg|google|bandcamp|bcbits|doubleclick/, (r) => r.abort());
  const p = await ctx.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.addInitScript(INIT, MAXSEC + 40);
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radio=0&finale=1`, { waitUntil: 'load' });
  const ai = await p.evaluate(() => { try { audioInit(); return 'ok ' + (typeof AC !== 'undefined' && !!AC); } catch (e) { return 'ERR ' + e.message; } });
  console.log('audioInit', ai);
  let warm = 0; for (; warm < 1500; warm++) { await p.evaluate(() => window.__step()); if (await p.evaluate(() => !!(window.__finale && __finale.F.on))) break; }
  console.log('warm frames', warm, 'ac', JSON.stringify(await p.evaluate(() => window.__acInfo())), 'wall', Date.now() - t0);
  if (CSS) await p.addStyleTag({ content: CSS });
  const vt0 = await p.evaluate(() => window.__vt());
  const log = fs.createWriteStream(path.join(outdir, 'frames.jsonl'), { flags: 'a' });
  const FD = path.join(outdir, 'frames'); fs.mkdirSync(FD, { recursive: true });
  let have = 0; while (fs.existsSync(path.join(FD, String(have).padStart(5, '0') + '.jpg'))) have++; have = Math.max(0, have - 1); console.log('resume from frame', have);
  let flyAt = -1, landAt = -1, endAt = MAXF;
  for (let f = 0; f < MAXF; f++) {
    const skipR = f < have; const s = await p.evaluate((skipR) => { const R = window.__cel && __cel.renderer, keep = R && R.render; if (skipR && R) R.render = () => {}; try { window.__step(); } finally { if (skipR && R) R.render = keep; } const X = window.__finale, F = X.F; return { ph: F.phase, t: +F.t.toFixed(2), on: F.on, b: F.bursts, dr: X.DR.on, ap: !!(X.AP && X.AP.on), u: X.AP ? +X.AP.u.toFixed(3) : null, cr: F.cred ? +F.cred.t.toFixed(1) : null, fly: F.log.includes('flyover'), last: F.log[F.log.length - 1] }; }, skipR);
    s.f = f; log.write(JSON.stringify(s) + '\n');
    if (flyAt < 0 && s.fly) { flyAt = f; landAt = f + Math.round(FLYSEC * 30); console.log('flyover at', f); }
    if (f === landAt) { await p.keyboard.press('v'); console.log('land key at', f); endAt = f + Math.round(HOLD * 30); }
    if (!skipR) { const fn = path.join(FD, String(f).padStart(5, '0') + '.jpg'); fs.writeFileSync(fn + '.tmp', await p.screenshot({ type: 'jpeg', quality: 93 })); fs.renameSync(fn + '.tmp', fn); }
    if (f % 150 === 0) console.log('f', f, 'wall', ((Date.now() - t0) / 1000).toFixed(0), JSON.stringify(s));
    if (f >= endAt) break;
  }
  log.end(); fs.writeFileSync(path.join(outdir, 'nframes.txt'), String(endAt < MAXF ? endAt + 1 : MAXF));
  const info = await p.evaluate(() => window.__renderWav());
  if (info) { const chunks = []; const SZ = 3 << 20; for (let i = 0; i < info.bytes; i += SZ) chunks.push(Buffer.from(await p.evaluate(([i, sz]) => window.__pcmChunk(i, sz), [i, SZ]), 'base64'));
    const pcm = Buffer.concat(chunks); const ac = await p.evaluate(() => window.__acInfo()); const skip = Math.max(0, Math.round((vt0 - ac.base) / 1000 * 44100)) * 4;
    const pad = Math.max(0, Math.round((ac.base - vt0) / 1000 * 44100)) * 4; const data = Buffer.concat([Buffer.alloc(pad), pcm.subarray(skip)]); console.log('pad samples', pad / 4); const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(44100, 24); h.writeUInt32LE(44100 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
    fs.writeFileSync(path.join(outdir, 'sfx.wav'), Buffer.concat([h, data])); console.log('audio peak', info.peak.toFixed(3), 'skip samples', skip / 4); }
  else console.log('NO AUDIO CONTEXT');
  console.log('done wall', ((Date.now() - t0) / 1000).toFixed(0) + 's', 'errors', errs.length, errs.slice(0, 8).join(' | '));
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
