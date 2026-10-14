// audio.js — all procedural Web Audio: engine (pitch follows speed through 5 virtual gears), tyre screech, wind,
// checkpoint chime, landing thump, scrape, splash, finish fanfare, and a step-sequenced music loop with layers.
export class Sfx {
  constructor() { this.ac = null; this.muted = false; this.ok = false; }
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ac = this.ac = new AC();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(comp); comp.connect(ac.destination);
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0); let s = 12345;
    for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
    this.noise = nb;
    // engine
    this.eg = ac.createGain(); this.eg.gain.value = 0; this.ef = ac.createBiquadFilter(); this.ef.type = 'lowpass'; this.ef.frequency.value = 900; this.ef.Q.value = 3;
    this.o1 = ac.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = ac.createOscillator(); this.o2.type = 'square'; this.o3 = ac.createOscillator(); this.o3.type = 'triangle';
    const g2 = ac.createGain(); g2.gain.value = 0.45; const g3 = ac.createGain(); g3.gain.value = 0.6;
    this.o1.connect(this.ef); this.o2.connect(g2); g2.connect(this.ef); this.o3.connect(g3); g3.connect(this.eg); this.ef.connect(this.eg); this.eg.connect(this.master);
    this.o1.start(); this.o2.start(); this.o3.start();
    // tyres + wind (looped noise)
    const mk = (type, f, q) => { const src = ac.createBufferSource(); src.buffer = nb; src.loop = true; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ac.createGain(); g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(this.master); src.start(); return { g, fl }; };
    this.tyre = mk('bandpass', 1900, 4); this.wind = mk('lowpass', 420, 0.7);
    this.music = ac.createGain(); this.music.gain.value = 0.0; this.music.connect(this.master);
    this.step = 0; this.nextT = ac.currentTime + 0.1; this.layer = 0; this.musicOn = false; this.ok = true;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ac.currentTime, 0.03); }
  suspend() { if (this.ac && this.ac.state === 'running') this.ac.suspend(); }
  resume() { if (this.ac && this.ac.state === 'suspended') this.ac.resume(); }
  // per-frame continuous layers
  drive(speed, throttle, slip, grounded, on) {
    if (!this.ok) return; const t = this.ac.currentTime, k = 0.05;
    const bands = [0, 11, 21, 31, 41, 70]; let gear = 0; while (gear < 4 && speed > bands[gear + 1]) gear++;
    const r = Math.min(1, (speed - bands[gear]) / (bands[gear + 1] - bands[gear])), rpm = 0.25 + 0.75 * r;
    const f = 48 + rpm * 92 + gear * 9 + throttle * 6;
    this.o1.frequency.setTargetAtTime(f, t, k); this.o2.frequency.setTargetAtTime(f * 0.5, t, k); this.o3.frequency.setTargetAtTime(f * 2.01, t, k);
    this.ef.frequency.setTargetAtTime(380 + rpm * 900 + throttle * 700, t, k);
    this.eg.gain.setTargetAtTime(on ? 0.055 + throttle * 0.06 + rpm * 0.025 : 0, t, 0.08);
    const sl = on && grounded ? Math.min(1, Math.max(0, (slip - 2.2) / 6)) : 0;
    this.tyre.g.gain.setTargetAtTime(sl * 0.2, t, 0.04); this.tyre.fl.frequency.setTargetAtTime(1600 + sl * 900, t, 0.05);
    this.wind.g.gain.setTargetAtTime(on ? Math.min(0.16, speed * speed * 0.00007) : 0, t, 0.1); this.wind.fl.frequency.setTargetAtTime(300 + speed * 14, t, 0.1);
    this.sched();
  }
  env(g, t, a, peak, dcy) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); }
  tone(type, f, t, dur, vol, f2, dest) {
    const o = this.ac.createOscillator(), g = this.ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    this.env(g, t, 0.006, vol, dur); o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  burst(t, dur, vol, type, f, q = 1, dest) {
    const s = this.ac.createBufferSource(); s.buffer = this.noise; const fl = this.ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = this.ac.createGain();
    this.env(g, t, 0.004, vol, dur); s.connect(fl); fl.connect(g); g.connect(dest || this.master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  chime(n) { if (!this.ok) return; const t = this.ac.currentTime, base = [659, 784, 880, 988][Math.min(3, n)] || 659; [1, 1.26, 1.5, 2].forEach((m, i) => this.tone('triangle', base * m, t + i * 0.055, 0.32, 0.16)); this.tone('sine', base * 4, t + 0.2, 0.5, 0.05); }
  land(v) { if (!this.ok) return; const t = this.ac.currentTime, a = Math.min(1, v / 14); this.tone('sine', 120, t, 0.22, 0.25 * a + 0.05, 42); this.burst(t, 0.12, 0.18 * a, 'lowpass', 900); }
  scrape(v) { if (!this.ok) return; const t = this.ac.currentTime; this.burst(t, 0.18, Math.min(0.25, 0.05 + v * 0.012), 'highpass', 2400, 0.8); this.tone('square', 210, t, 0.08, 0.04, 90); }
  splash() { if (!this.ok) return; const t = this.ac.currentTime; this.burst(t, 0.7, 0.35, 'lowpass', 1400); this.burst(t + 0.05, 0.4, 0.2, 'bandpass', 3000, 1.5); this.tone('sine', 300, t, 0.3, 0.12, 80); }
  whoosh() { if (!this.ok) return; const t = this.ac.currentTime; this.burst(t, 0.35, 0.16, 'bandpass', 900, 0.7); this.tone('sine', 260, t, 0.25, 0.08, 620); }
  go() { if (!this.ok) return; const t = this.ac.currentTime; this.tone('square', 523, t, 0.12, 0.09); this.tone('square', 1046, t + 0.1, 0.25, 0.09); }
  wrong() { if (!this.ok) return; const t = this.ac.currentTime; this.tone('square', 220, t, 0.14, 0.08); this.tone('square', 165, t + 0.13, 0.22, 0.08); }
  click() { if (!this.ok) return; const t = this.ac.currentTime; this.tone('square', 880, t, 0.04, 0.05); }
  place() { if (!this.ok) return; const t = this.ac.currentTime; this.tone('triangle', 520, t, 0.08, 0.12); this.burst(t, 0.05, 0.1, 'lowpass', 800); }
  finish(medal) {
    if (!this.ok) return; const t = this.ac.currentTime, notes = [523, 659, 784, 1046, 1318];
    notes.forEach((f, i) => { this.tone('square', f, t + i * 0.09, 0.3, 0.07); this.tone('triangle', f / 2, t + i * 0.09, 0.3, 0.1); });
    if (medal >= 0) [1568, 2093, 2637].slice(0, 1 + Math.min(2, 3 - medal)).forEach((f, i) => this.tone('sine', f, t + 0.55 + i * 0.12, 0.6, 0.08));
  }
  // music: 16-step loop, 124 bpm. layer 0 = bass+hats, 1 = + claps, 2 = + lead arp (set from race progress)
  startMusic() { this.musicOn = true; if (this.ok) { this.music.gain.setTargetAtTime(0.32, this.ac.currentTime, 0.4); this.nextT = Math.max(this.nextT, this.ac.currentTime + 0.05); } }
  stopMusic() { this.musicOn = false; if (this.ok) this.music.gain.setTargetAtTime(0, this.ac.currentTime, 0.25); }
  sched() {
    if (!this.musicOn) return; const ac = this.ac, spb = 60 / 124 / 4;
    if (this.nextT < ac.currentTime - 0.5) this.nextT = ac.currentTime + 0.02; // after a suspend, never burst-catch-up
    while (this.nextT < ac.currentTime + 0.12) {
      const s = this.step % 16, bar = Math.floor(this.step / 16) % 4, t = this.nextT;
      const roots = [55, 55, 49, 65.4][bar];
      if (s === 0 || s === 3 || s === 6 || s === 8 || s === 10 || s === 11 || s === 14) this.tone('square', roots * (s === 11 ? 2 : 1), t, spb * 1.4, 0.13, 0, this.music);
      if (s % 2 === 0) this.burst(t, 0.03, s % 4 === 2 ? 0.07 : 0.04, 'highpass', 7000, 1, this.music);
      if (s === 0 || s === 8) this.tone('sine', 140, t, 0.16, 0.3, 45, this.music);
      if (this.layer >= 1 && (s === 4 || s === 12)) this.burst(t, 0.12, 0.13, 'bandpass', 1800, 0.8, this.music);
      if (this.layer >= 2 && s % 2 === 0) { const arp = [0, 7, 12, 15, 19, 15, 12, 7][(s / 2) % 8]; this.tone('triangle', roots * 4 * Math.pow(2, arp / 12), t, spb * 1.6, 0.05, 0, this.music); }
      this.step++; this.nextT += spb;
    }
  }
}
