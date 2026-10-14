// Renders the game's OWN WebAudio music + sfx code offline (OfflineAudioContext) for given event lists.
// node audio_render.js jobs.json OUTDIR   -> OUTDIR/<name>.wav (stereo float->int16, 44.1k)
const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
const fs = require('fs');
const jobs = JSON.parse(fs.readFileSync(process.argv[2]));
const OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
function wav(l, r, sr) {
  const n = l.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(l[i] * 32767))), 44 + i * 4); b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(r[i] * 32767))), 46 + i * 4); }
  return b;
}
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 270, height: 480 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///workspace/work/shorts/gulf-thunder/game/index.html?capture&seed=3');
  await p.waitForFunction(() => window.__cap && window.GT && GT.scene && window.__sched);
  for (const job of jobs) {
    const res = await p.evaluate(async (job) => {
      const SR = 44100;
      window.AudioContext = function () { return new OfflineAudioContext(2, Math.ceil(SR * job.len), SR); };
      const AU = GT.AU; AU.ac = null; AU.pending = null; AU.song = null; AU.songName = null;
      for (const k of Object.keys(window.__sfxLast)) delete window.__sfxLast[k];
      GT.__T = 0; GT.audioInit();
      const ev = job.events.slice().sort((a, b) => a[0] - b[0]); let k = 0;
      for (let T = 0; T <= job.len; T += 0.01) {
        GT.__T = T;
        while (k < ev.length && ev[k][0] <= T + 1e-9) { const e = ev[k++]; GT.__T = e[0]; if (e[1] === 'music') GT.music(e[2]); else GT.sfx(e[2]); GT.__T = T; }
        window.__sched();
      }
      AU.song = null; AU.songName = null;
      const buf = await AU.ac.startRendering();
      const enc = a => { const u = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
      return { l: enc(buf.getChannelData(0)), r: enc(buf.getChannelData(1)), sr: buf.sampleRate };
    }, job);
    const f = s => new Float32Array(new Uint8Array(Buffer.from(s, 'base64')).buffer);
    fs.writeFileSync(`${OUT}/${job.name}.wav`, wav(f(res.l), f(res.r), res.sr));
    console.log('rendered', job.name, job.len, 'events', job.events.length);
  }
  console.log('errors', errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
})();
