
// ======================= audio: motor whine, race SFX, and a Baltimore-club beat (all WebAudio synthesis, no files) =======================
const AUD = (function () {
  let motor = null, music = null, musicOn = localStorage.getItem('tcdr.music') !== '0', master = null;
  function init() {
    audioInit(); if (!AC) return; if (AC.state === 'suspended') AC.resume();
    if (motor) return;
    master = SFXBUS;
    // motor: two detuned saws + band-passed noise; pitch / level follow throttle + speed
    const g = AC.createGain(); g.gain.value = 0; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; f.Q.value = 2;
    const o1 = AC.createOscillator(), o2 = AC.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 160; o2.frequency.value = 163;
    const n = AC.createBufferSource(); n.buffer = NOISE; n.loop = true; const nf = AC.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2200; nf.Q.value = 0.8; const ng = AC.createGain(); ng.gain.value = 0.25;
    o1.connect(f); o2.connect(f); n.connect(nf); nf.connect(ng); ng.connect(f); f.connect(g); g.connect(master);
    o1.start(); o2.start(); n.start();
    motor = { g, f, o1, o2, nf };
    if (musicOn) startMusic();
  }
  function setMotor(thr, spd, on) {
    if (!motor) return; const t = AC.currentTime, base = 120 + thr * 260 + spd * 4;
    motor.o1.frequency.setTargetAtTime(base, t, 0.05); motor.o2.frequency.setTargetAtTime(base * 1.013 + 2, t, 0.05);
    motor.f.frequency.setTargetAtTime(900 + thr * 2600, t, 0.08); motor.nf.frequency.setTargetAtTime(1600 + spd * 60, t, 0.1);
    motor.g.gain.setTargetAtTime(on ? 0.035 + thr * 0.05 : 0, t, 0.08);
  }
  const env = (node, t, a, peak, d) => { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function tone(freq, t, dur, type = 'square', vol = 0.12, slide = 0) {
    const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    o.connect(g); g.connect(master); env(g, t, 0.005, vol, dur); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, f0, f1, vol = 0.2, type = 'bandpass') {
    const s = AC.createBufferSource(); s.buffer = NOISE; s.loop = true; const f = AC.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = AC.createGain(); s.connect(f); f.connect(g); g.connect(master); env(g, t, 0.01, vol, dur); s.start(t); s.stop(t + dur + 0.05);
  }
  function play(kind) {
    if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
    try {
      if (kind === 'gate') { tone(880, t, 0.09, 'square', 0.09); tone(1320, t + 0.06, 0.14, 'square', 0.08); }
      else if (kind === 'clean') { tone(988, t, 0.08, 'triangle', 0.12); tone(1319, t + 0.05, 0.08, 'triangle', 0.12); tone(1976, t + 0.1, 0.18, 'triangle', 0.1); }
      else if (kind === 'beep') tone(660, t, 0.16, 'square', 0.12);
      else if (kind === 'go') { tone(1320, t, 0.4, 'square', 0.14); tone(660, t, 0.4, 'sawtooth', 0.06); }
      else if (kind === 'boost') noise(t, 0.5, 400, 3200, 0.16);
      else if (kind === 'crash') { noise(t, 0.6, 1800, 120, 0.4, 'lowpass'); tone(220, t, 0.35, 'sawtooth', 0.14, 0.3); sfx('heavy'); }
      else if (kind === 'close') noise(t, 0.22, 3000, 700, 0.12);
      else if (kind === 'lap') { [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.12, 'square', 0.09)); }
      else if (kind === 'finish') { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.09, 0.22, 'square', 0.1)); sfx('ko'); }
      else if (kind === 'lose') { [392, 349, 311, 262].forEach((f, i) => tone(f, t + i * 0.16, 0.24, 'triangle', 0.12)); }
      else if (kind === 'ui') tone(1100, t, 0.05, 'square', 0.06);
    } catch (e) { /* audio is optional */ }
  }
  // Baltimore club: 130 BPM, the kick on 1, 2, 3, "and" of 3, 4 with the swung "Think" break hats + claps on 2 and 4, a minor bass riff
  function startMusic() {
    if (!AC || music) return; const bus = AC.createGain(); bus.gain.value = 0.55; bus.connect(master);
    const spb = 60 / 130 / 4; let step = 0, next = AC.currentTime + 0.1;
    const KICK = [1,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,0,0], CLAP = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1], HAT = [0,0,1,0, 0,1,1,0, 0,0,1,0, 0,1,1,1];
    const BASS = [41, 0, 0, 41, 0, 0, 44, 0, 41, 0, 0, 46, 0, 44, 0, 0];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const kick = (t) => { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); o.connect(g); g.connect(bus); env(g, t, 0.003, 0.5, 0.22); o.start(t); o.stop(t + 0.3); };
    const clap = (t) => { for (let k = 0; k < 3; k++) { const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.2; const g = AC.createGain(); s.connect(f); f.connect(g); g.connect(bus); env(g, t + k * 0.011, 0.002, 0.22, 0.09); s.start(t + k * 0.011); s.stop(t + 0.2); } };
    const hat = (t, v) => { const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = AC.createGain(); s.connect(f); f.connect(g); g.connect(bus); env(g, t, 0.002, v, 0.04); s.start(t); s.stop(t + 0.08); };
    const bass = (t, m) => { const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'square'; o.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + 0.2); o.connect(f); f.connect(g); g.connect(bus); env(g, t, 0.005, 0.13, 0.22); o.start(t); o.stop(t + 0.3); };
    const id = setInterval(() => {
      if (!AC) return; while (next < AC.currentTime + 0.25) { const s = step % 16, bar = Math.floor(step / 16) % 4;
        if (KICK[s]) kick(next); if (CLAP[s]) clap(next); if (HAT[s]) hat(next, s % 4 === 2 ? 0.07 : 0.045);
        const b = BASS[s]; if (b) bass(next, b + (bar === 3 ? -2 : 0));
        next += spb * (s % 2 ? 0.92 : 1.08); step++; }
    }, 60);
    music = { bus, id };
  }
  function stopMusic() { if (!music) return; clearInterval(music.id); music.bus.gain.setTargetAtTime(0, AC.currentTime, 0.05); music = null; }
  function toggleMusic() { musicOn = !musicOn; localStorage.setItem('tcdr.music', musicOn ? '1' : '0'); if (musicOn) startMusic(); else stopMusic(); return musicOn; }
  return { init, setMotor, play, toggleMusic, get musicOn() { return musicOn; } };
})();
