
// ---------------- procedural Web Audio: V8, guns, flames, saws, groans, metal loop ----------------
const AU = { ac: null, on: false, muted: localStorage.getItem('rr_mute') === '1', master: null, sfx: null, mus: null, noise: null, eng: null, nextStep: 0, step: 0, intensity: 0, last: {}, groanT: 0 };
function auInit() {
  if (AU.ac) { if (AU.ac.state === 'suspended') AU.ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const ac = AU.ac = new AC();
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
  AU.master = ac.createGain(); AU.master.gain.value = AU.muted ? 0 : 0.85; AU.master.connect(comp); comp.connect(ac.destination);
  AU.sfx = ac.createGain(); AU.sfx.gain.value = 0.9; AU.sfx.connect(AU.master);
  AU.mus = ac.createGain(); AU.mus.gain.value = 0.3; AU.mus.connect(AU.master);
  const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AU.noise = nb;
  AU.dist = ac.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 6) * 0.8; } AU.dist.curve = curve; AU.curve = curve;
  // guitar bus: distortion -> lowpass "cab"
  AU.gtr = ac.createGain(); AU.gtr.gain.value = 0.5; const gd = ac.createWaveShaper(); gd.curve = curve; const cab = ac.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 2600; cab.Q.value = 0.8;
  const pk = ac.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 900; pk.gain.value = 4; AU.gtr.connect(gd); gd.connect(cab); cab.connect(pk); pk.connect(AU.mus);
  // engine: two saws + square sub -> shaper -> lowpass, amplitude-modulated by a firing-rate LFO (burble)
  const e = AU.eng = {};
  e.o1 = ac.createOscillator(); e.o1.type = 'sawtooth'; e.o2 = ac.createOscillator(); e.o2.type = 'sawtooth'; e.o2.detune.value = -14; e.o3 = ac.createOscillator(); e.o3.type = 'square';
  e.mix = ac.createGain(); e.mix.gain.value = 0.3; e.o1.connect(e.mix); e.o2.connect(e.mix); const g3 = ac.createGain(); g3.gain.value = 0.5; e.o3.connect(g3); g3.connect(e.mix);
  e.sh = ac.createWaveShaper(); e.sh.curve = curve; e.lp = ac.createBiquadFilter(); e.lp.type = 'lowpass'; e.lp.frequency.value = 500; e.lp.Q.value = 2;
  e.am = ac.createGain(); e.am.gain.value = 0.6; e.lfo = ac.createOscillator(); e.lfo.type = 'square'; e.lfoG = ac.createGain(); e.lfoG.gain.value = 0.35; e.lfo.connect(e.lfoG); e.lfoG.connect(e.am.gain);
  e.out = ac.createGain(); e.out.gain.value = 0; e.mix.connect(e.sh); e.sh.connect(e.lp); e.lp.connect(e.am); e.am.connect(e.out); e.out.connect(AU.sfx);
  [e.o1, e.o2, e.o3, e.lfo].forEach((o) => o.start());
  // loops: flame roar, saw whine, wind
  const loop = (type, f, q, g) => { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; const gg = ac.createGain(); gg.gain.value = 0; s.connect(b); b.connect(gg); gg.connect(AU.sfx); s.start(); return { g: gg, f: b, max: g }; };
  AU.flame = loop('bandpass', 700, 0.7, 0.5); AU.wind = loop('bandpass', 400, 0.5, 0.25); AU.skid = loop('bandpass', 2200, 3, 0.18);
  const so = ac.createOscillator(); so.type = 'sawtooth'; so.frequency.value = 880; const sf = ac.createBiquadFilter(); sf.type = 'highpass'; sf.frequency.value = 700; const sg = ac.createGain(); sg.gain.value = 0; so.connect(sf); sf.connect(sg); sg.connect(AU.sfx); so.start();
  AU.saw = { g: sg, o: so };
  AU.nextStep = ac.currentTime + 0.1; AU.on = true;
}
function auMute(m) { AU.muted = m; localStorage.setItem('rr_mute', m ? '1' : '0'); if (AU.master) AU.master.gain.setTargetAtTime(m ? 0 : 0.85, AU.ac.currentTime, 0.03); }
function thr(name, gap) { const t = performance.now(); if ((AU.last[name] || 0) + gap > t) return false; AU.last[name] = t; return true; }
function env(g, t, a, peak, dcy) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); }
function nz(t, dur, type, f, q, peak, dest, f2) {
  const ac = AU.ac, s = ac.createBufferSource(); s.buffer = AU.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const b = ac.createBiquadFilter(); b.type = type; b.frequency.setValueAtTime(f, t); if (f2) b.frequency.exponentialRampToValueAtTime(f2, t + dur); b.Q.value = q;
  const g = ac.createGain(); env(g, t, 0.004, peak, dur); s.connect(b); b.connect(g); g.connect(dest || AU.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function tone(t, type, f, f2, dur, peak, dest, a = 0.005) {
  const ac = AU.ac, o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ac.createGain(); env(g, t, a, peak, dur); o.connect(g); g.connect(dest || AU.sfx); o.start(t); o.stop(t + a + dur + 0.05); return o;
}
const SFX = {
  gun() { if (!AU.on || !thr('gun', 45)) return; const t = AU.ac.currentTime; nz(t, 0.07, 'bandpass', 1900, 1.2, 0.22); tone(t, 'square', 150, 60, 0.06, 0.12); },
  splat(big) { if (!AU.on || !thr('splat', big ? 30 : 55)) return; const t = AU.ac.currentTime; nz(t, big ? 0.25 : 0.12, 'lowpass', big ? 1400 : 900, 1, big ? 0.5 : 0.3, null, 200); tone(t, 'sine', big ? 120 : 95, 38, big ? 0.22 : 0.12, big ? 0.5 : 0.3); },
  boom() { if (!AU.on || !thr('boom', 60)) return; const t = AU.ac.currentTime; nz(t, 1.1, 'lowpass', 1600, 0.7, 0.9, null, 120); tone(t, 'sine', 70, 28, 0.9, 0.8); },
  pick(n) { if (!AU.on || !thr('pick', 40)) return; const t = AU.ac.currentTime; const f = 820 * Math.pow(1.06, n % 14); tone(t, 'sine', f, f * 1.5, 0.07, 0.07); },
  scrap() { if (!AU.on || !thr('scrap', 60)) return; const t = AU.ac.currentTime; tone(t, 'square', 1200, 1500, 0.05, 0.05); tone(t + 0.04, 'square', 1800, 2000, 0.05, 0.04); },
  level() { if (!AU.on) return; const t = AU.ac.currentTime; [0, 4, 7, 12, 16].forEach((s, k) => tone(t + k * 0.06, 'triangle', 330 * Math.pow(2, s / 12), 0, 0.35, 0.18)); },
  hurt() { if (!AU.on || !thr('hurt', 120)) return; const t = AU.ac.currentTime; [220, 331, 497, 703].forEach((f) => tone(t, 'square', f, f * 0.96, 0.18, 0.05)); nz(t, 0.18, 'highpass', 2500, 0.7, 0.2); },
  crash(v) { if (!AU.on || !thr('crash', 150)) return; const t = AU.ac.currentTime; nz(t, 0.35, 'lowpass', 2400, 0.8, Math.min(0.9, v / 20), null, 300); [160, 241, 377].forEach((f) => tone(t, 'square', f, f * 0.9, 0.25, 0.06)); },
  nitro() { if (!AU.on || !thr('nitro', 300)) return; const t = AU.ac.currentTime; nz(t, 0.6, 'bandpass', 500, 1.5, 0.35, null, 3200); tone(t, 'sawtooth', 90, 180, 0.5, 0.12); },
  harpoon() { if (!AU.on) return; const t = AU.ac.currentTime; nz(t, 0.25, 'bandpass', 900, 2, 0.3, null, 2800); tone(t, 'square', 400, 120, 0.12, 0.1); },
  clank() { if (!AU.on || !thr('clank', 90)) return; const t = AU.ac.currentTime; [523, 787, 1170].forEach((f) => tone(t, 'triangle', f, 0, 0.2, 0.08)); },
  roar(big) { if (!AU.on) return; const t = AU.ac.currentTime; const o = tone(t, 'sawtooth', big ? 70 : 110, big ? 45 : 70, big ? 1.4 : 0.9, 0.35, null, 0.08); nz(t, big ? 1.2 : 0.8, 'bandpass', 500, 1.2, 0.35, null, 200); },
  slam() { if (!AU.on) return; const t = AU.ac.currentTime; tone(t, 'sine', 90, 25, 0.7, 0.9); nz(t, 0.5, 'lowpass', 900, 0.7, 0.6, null, 80); },
  card() { if (!AU.on) return; const t = AU.ac.currentTime; tone(t, 'triangle', 660, 990, 0.08, 0.15); },
  win() { if (!AU.on) return; const t = AU.ac.currentTime; [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, k) => tone(t + k * 0.12, 'square', 262 * Math.pow(2, s / 12), 0, 0.3, 0.1)); },
  lose() { if (!AU.on) return; const t = AU.ac.currentTime; [12, 7, 3, 0, -5].forEach((s, k) => tone(t + k * 0.18, 'sawtooth', 196 * Math.pow(2, s / 12), 0, 0.4, 0.12)); nz(t, 1.2, 'lowpass', 800, 0.7, 0.4, null, 100); },
  alarm() { if (!AU.on) return; const t = AU.ac.currentTime; for (let k = 0; k < 3; k++) { tone(t + k * 0.32, 'square', 660, 440, 0.25, 0.1); } },
  groan(n) {
    if (!AU.on) return; const ac = AU.ac, t = ac.currentTime, f = rnd(80, 150);
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * rnd(0.6, 0.85), t + 0.9);
    const b1 = ac.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = rnd(500, 750); b1.Q.value = 5;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.min(0.18, 0.04 + n * 0.004), t + 0.2); g.gain.linearRampToValueAtTime(0.0001, t + 1.0);
    o.connect(b1); b1.connect(g); g.connect(AU.sfx); o.start(t); o.stop(t + 1.05);
  },
};
// engine + loops follow game state every frame
function auEngine(rpm, throttle, boost, flame, saw, sawHit, speed, skid, dt) {
  if (!AU.on) return; const e = AU.eng, t = AU.ac.currentTime;
  const fire = rpm / 60 * 4;           // V8 firing frequency
  e.o1.frequency.setTargetAtTime(fire * 0.5, t, 0.03); e.o2.frequency.setTargetAtTime(fire * 0.25, t, 0.03); e.o3.frequency.setTargetAtTime(fire * 0.125, t, 0.03);
  e.lfo.frequency.setTargetAtTime(fire * 0.125, t, 0.03);
  e.lp.frequency.setTargetAtTime(300 + throttle * 1500 + (boost ? 1200 : 0), t, 0.05);
  e.out.gain.setTargetAtTime(0.16 + throttle * 0.14 + (boost ? 0.08 : 0), t, 0.05);
  AU.flame.g.gain.setTargetAtTime(flame ? AU.flame.max : 0, t, 0.06);
  AU.saw.g.gain.setTargetAtTime(saw ? (sawHit ? 0.05 : 0.012) : 0, t, 0.05); AU.saw.o.frequency.setTargetAtTime(sawHit ? 620 : 900, t, 0.05);
  AU.wind.g.gain.setTargetAtTime(Math.min(1, speed / 45) * AU.wind.max, t, 0.2); AU.wind.f.frequency.setTargetAtTime(300 + speed * 18, t, 0.2);
  AU.skid.g.gain.setTargetAtTime(skid ? AU.skid.max : 0, t, 0.05);
}
function auSilence() { if (!AU.on) return; const t = AU.ac.currentTime; AU.eng.out.gain.setTargetAtTime(0, t, 0.05); AU.flame.g.gain.setTargetAtTime(0, t, 0.05); AU.saw.g.gain.setTargetAtTime(0, t, 0.05); AU.wind.g.gain.setTargetAtTime(0, t, 0.05); AU.skid.g.gain.setTargetAtTime(0, t, 0.05); }
// ---------------- music: 150 bpm metal loop, layers by intensity (0 drums, 1 chugs, 2 bass+chords, 3 lead) ----------------
const RIFF = [ // per 16th: semitone offset from E2 (-1 = rest), bars cycle
  [0, 0, -1, 0, 0, -1, 0, 3, 0, 0, -1, 0, 5, -1, 3, -1],
  [0, 0, -1, 0, 0, -1, 0, 3, 0, 0, -1, 7, 6, -1, 5, -1],
  [8, 8, -1, 8, 8, -1, 8, 7, 5, 5, -1, 5, 5, -1, 3, -1],
  [0, 0, -1, 0, 0, -1, 0, 3, 0, -1, 10, -1, 12, 10, 7, 5],
];
const LEAD = [12, -1, 15, -1, 17, 15, 12, -1, 19, -1, 17, 15, 17, -1, 12, -1];
function auMusic() {
  if (!AU.on) return; const ac = AU.ac; const spb = 60 / 150 / 4;
  if (AU.nextStep < ac.currentTime - 0.2) AU.nextStep = ac.currentTime + 0.05;
  while (AU.nextStep < ac.currentTime + 0.14) {
    const t = AU.nextStep, s = AU.step % 16, bar = ((AU.step / 16) | 0) % 4, I = AU.intensity;
    // drums
    if (s % 4 === 0 || (I >= 2 && (s === 2 || s === 10 || s === 14))) { tone(t, 'sine', 140, 40, 0.16, 0.7, AU.mus); nz(t, 0.02, 'highpass', 3000, 0.7, 0.15, AU.mus); }
    if (s === 4 || s === 12) { nz(t, 0.16, 'bandpass', 1800, 0.6, 0.55, AU.mus); tone(t, 'triangle', 220, 140, 0.08, 0.25, AU.mus); }
    if (I >= 1 && s % 2 === 0) nz(t, 0.03, 'highpass', 7000, 0.7, 0.12, AU.mus);
    // chugs / power chords
    const n = RIFF[bar][s];
    if (I >= 1 && n >= 0) {
      const f = 82.41 * Math.pow(2, n / 12), dur = I >= 2 && (s === 0 || s === 8) ? 0.3 : 0.085;
      for (const m of [1, 1.4983, 2]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * m; const g = ac.createGain(); env(g, t, 0.003, 0.22, dur); o.connect(g); g.connect(AU.gtr); o.start(t); o.stop(t + dur + 0.05); }
      if (I >= 2) tone(t, 'square', f * 0.5, 0, dur + 0.05, 0.12, AU.mus);
    }
    if (I >= 3 && LEAD[s] >= 0 && bar % 2 === 1) { const o = tone(t, 'square', 329.6 * Math.pow(2, (LEAD[s] - 12) / 12), 0, 0.2, 0.06, AU.gtr); }
    AU.nextStep += spb; AU.step++;
  }
}
