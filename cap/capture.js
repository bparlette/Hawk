// Deterministic frame-stepped in-engine capture for Toad City Shorts (does NOT modify the game: hooks are injected at page init).
// node capture.js <port> <name> '<query>' <outdir> [maxSec=120] [afterEndSec=6] [touch=0] [everyN=0 (0 = video pipe, N = save every Nth jpg only)]
// - rAF / performance.now / Date.now / setTimeout / setInterval run on a virtual clock that advances exactly 1/30 s per captured frame.
// - window.AudioContext is replaced by an OfflineAudioContext whose currentTime follows the virtual clock, so every game SFX is rendered
//   sample-accurately in sync with the frames and exported as WAV at the end (no radio: ?radio=0, youtube/bandcamp requests blocked).
// - Per-frame log (jsonl): duel time, result, juice replay flag, new duel log lines, fishing / poe state.
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
let pw; try { pw = require('playwright-core'); } catch (e) { try { pw = require('playwright'); } catch (e2) { pw = require('/workspace/work/trailer_v2/node_modules/playwright-core'); } }
const [port, name, query, outdir, maxSecS = '120', afterS = '6', touchS = '0', everyS = '0'] = process.argv.slice(2);
const FPS = 30, MAXF = Math.round(+maxSecS * FPS), AFTER = Math.round(+afterS * FPS), TOUCH = touchS === '1', EVERY = +everyS;
fs.mkdirSync(outdir, { recursive: true });
const INIT = (secs) => {
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
  const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, isMobile: TOUCH, hasTouch: TOUCH });
  await ctx.route(/youtube|ytimg|google|bandcamp|bcbits|doubleclick/, (r) => r.abort());
  const p = await ctx.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.addInitScript(INIT, (+maxSecS + 30));
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radio=0&${query}`, { waitUntil: 'load' });
  // warm up: step without capturing until the mode is live
  let warm = 0; for (; warm < 1500; warm++) { await p.evaluate(() => window.__step()); if (await p.evaluate(() => !!(window.__duels && __duels.cur))) break; }
  await p.keyboard.down('F9'); await p.keyboard.up('F9'); // first "gesture": audioInit() (F9 does nothing in game)
  for (let k = 0; k < 6; k++) await p.evaluate(() => window.__step());
  console.log('warm frames', warm, 'ac', JSON.stringify(await p.evaluate(() => window.__acInfo())), 'wall', Date.now() - t0);
  const vt0 = await p.evaluate(() => window.__vt());
  const log = fs.createWriteStream(path.join(outdir, name + '.jsonl'));
  let ff = null; if (!EVERY) { ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-pix_fmt', 'yuv420p', path.join(outdir, name + '_raw.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] }); }
  let endAt = -1, lastLog = 0;
  for (let f = 0; f < MAXF; f++) {
    const s = await p.evaluate((ll) => { window.__step(); const D = window.__duels, K = D && D.cur, J = window.__juice, F = window.__fishing, P = window.__poe;
      const lg = D && D.log ? D.log.slice(ll) : []; const st = K && K.st ? K.st : null;
      return { t: D ? +(+D.t || 0).toFixed(2) : 0, cur: K ? K.id : null, res: D ? D.result : null, j: J ? (J.on ? 1 : 0) : 0, jr: J ? J.replays : 0, ll: D && D.log ? D.log.length : 0, lg,
        hp: st ? Math.round(st.hp ?? -1) : null, bhp: st ? Math.round(st.bhp ?? st.bossHp ?? -1) : null,
        fish: F ? { c: F.caught ?? (F.st && F.st.caught), ch: F.save ? F.save.chompy : undefined, j: F.save ? F.save.junk : undefined, ph: F.st ? F.st.phase || F.st.mode : undefined } : undefined,
        poe: P ? { ph: P.st ? P.st.phase || P.st.mode : undefined, al: P.st ? +(P.st.alert || 0).toFixed(2) : undefined } : undefined }; }, lastLog);
    lastLog = s.ll; s.f = f; delete s.ll; log.write(JSON.stringify(s) + '\n');
    if (!EVERY || f % EVERY === 0) { const jpg = await p.screenshot({ type: 'jpeg', quality: 92 }); if (ff) { if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r)); } else fs.writeFileSync(path.join(outdir, `${name}_${String(f).padStart(5, '0')}.jpg`), jpg); }
    if (endAt < 0 && (s.res || !s.cur || (s.lg || []).some((l) => /retry|spotted|lose/i.test(l)))) { endAt = f + AFTER; console.log('end trigger at', f, JSON.stringify(s)); }
    if (endAt >= 0 && f >= endAt && !s.j) break;
    if (f % 150 === 0) console.log('f', f, 'wall', ((Date.now() - t0) / 1000).toFixed(0), JSON.stringify(s).slice(0, 220));
  }
  log.end();
  if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
  // audio: render, then trim to the first captured frame
  const info = await p.evaluate(() => window.__renderWav());
  if (info) { const chunks = []; const SZ = 3 << 20; for (let i = 0; i < info.bytes; i += SZ) chunks.push(Buffer.from(await p.evaluate(([i, sz]) => window.__pcmChunk(i, sz), [i, SZ]), 'base64'));
    const pcm = Buffer.concat(chunks); const ac = await p.evaluate(() => window.__acInfo()); const skip = Math.max(0, Math.round((vt0 - ac.base) / 1000 * 44100)) * 4;
    const data = pcm.subarray(skip); const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(44100, 24); h.writeUInt32LE(44100 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
    fs.writeFileSync(path.join(outdir, name + '_sfx.wav'), Buffer.concat([h, data])); console.log('audio peak', info.peak.toFixed(3), 'skip samples', skip / 4); }
  else console.log('NO AUDIO CONTEXT');
  console.log('done', name, 'wall', ((Date.now() - t0) / 1000).toFixed(0) + 's', 'errors', errs.length, errs.slice(0, 8).join(' | '));
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
