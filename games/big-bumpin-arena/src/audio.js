// Sound: everything is synthesized with WebAudio (engine hum, impacts, goal horn, countdown). No audio files.
// Includes the iOS fixes: 'playback' audio session (so the ring/silent switch does not mute the game), a silent
// buffer played inside the first gesture to unlock the context, and resume on pointerdown / touchend / visibility.
export class Sfx {
  constructor() {
    this.ac = null; this.master = null; this.engine = null; this.muted = false;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    const resume = () => this.unlock();
    for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, resume, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!this.ac) return; if (document.hidden) this.ac.suspend?.(); else this.ac.resume?.(); });
  }
  unlock() {
    try {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ac = new AC(); this.master = this.ac.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ac.destination);
        const src = this.ac.createBufferSource(); src.buffer = this.ac.createBuffer(1, 1, 22050); src.connect(this.ac.destination); src.start(0); // silent unlock buffer
        const len = this.ac.sampleRate * 0.5, buf = this.ac.createBuffer(1, len, this.ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noise = buf;
        const o = this.ac.createOscillator(), o2 = this.ac.createOscillator(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
        o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); o.start(); o2.start();
        this.engine = { o, o2, f, g };
      }
      if (this.ac.state !== 'running') this.ac.resume();
    } catch {}
  }
  _tone(f0, f1, dur, type = 'square', vol = 0.12, delay = 0) {
    if (!this.ac || this.muted) return; const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.03);
  }
  _burst(dur, freq, vol) {
    if (!this.ac || this.muted || !this.noise) return; const t = this.ac.currentTime, s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = this.noise; f.type = 'lowpass'; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.02);
  }
  /** Bumper thump, scaled by how hard the hit was. */
  hit(force, kind) {
    const v = Math.min(0.5, 0.05 + force * 0.045); if (force < 0.8) return;
    if (kind === 'ball-wall') { this._tone(300, 140, 0.09, 'triangle', v * 0.7); return; }
    this._burst(0.12 + Math.min(0.15, force * 0.015), kind.includes('ball') ? 1400 : 700, v);
    this._tone(kind.includes('ball') ? 260 : 150, 60, 0.14, 'sine', v);
  }
  count() { this._tone(520, 520, 0.12, 'square', 0.1); }
  go() { this._tone(1040, 1040, 0.3, 'square', 0.12); }
  horn() { for (const [f, d] of [[233, 0], [311, 0], [233, 0.42], [311, 0.42]]) { this._tone(f, f * 0.98, 0.38, 'sawtooth', 0.16, d); this._tone(f * 1.5, f * 1.47, 0.38, 'sawtooth', 0.07, d); } }
  whistle() { this._tone(1900, 2100, 0.5, 'sine', 0.12); this._tone(1960, 2160, 0.5, 'sine', 0.08); }
  turbo() { this._burst(0.35, 3000, 0.12); this._tone(200, 900, 0.3, 'sawtooth', 0.05); }
  /** Crowd swell: band-passed noise that rises and falls (synthesized, like everything else). */
  crowd(len = 2.2, vol = 0.22) {
    if (!this.ac || this.muted || !this.noise) return; const t = this.ac.currentTime, s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.Q.value = 0.7; f.frequency.setValueAtTime(600, t); f.frequency.linearRampToValueAtTime(1500, t + len * 0.35); f.frequency.linearRampToValueAtTime(800, t + len);
    g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(vol, t + len * 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + len); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + len + 0.05);
  }
  shunt() { this._burst(0.12, 2600, 0.14); this._tone(420, 180, 0.1, 'square', 0.06); }
  spin() { this._tone(900, 200, 0.45, 'sawtooth', 0.09); this._tone(1350, 300, 0.45, 'square', 0.04); }
  pickup() { this._tone(660, 660, 0.07, 'square', 0.1); this._tone(990, 990, 0.07, 'square', 0.1, 0.07); this._tone(1320, 1320, 0.12, 'square', 0.1, 0.14); }
  item() { this._tone(300, 900, 0.18, 'triangle', 0.12); }
  shock() { this._burst(0.5, 500, 0.4); this._tone(180, 40, 0.5, 'sine', 0.35); this._tone(240, 200, 0.35, 'sawtooth', 0.12); }
  zing() { this._tone(700, 2400, 0.22, 'sawtooth', 0.1); this._tone(1400, 2800, 0.22, 'square', 0.05); }
  splat() { this._burst(0.3, 900, 0.35); this._tone(200, 50, 0.3, 'square', 0.14); }
  thunk() { this._tone(160, 90, 0.12, 'square', 0.1); }
  hot(heat) { this._tone(500 + heat * 900, 700 + heat * 1100, 0.08, 'triangle', 0.05 + heat * 0.05); }
  /** Call every frame with the player's speed as a share of top speed. */
  setEngine(speed, turbo, on) {
    const e = this.engine; if (!e || !this.ac) return; const t = this.ac.currentTime, f = 48 + speed * 95 + (turbo ? 40 : 0);
    e.o.frequency.setTargetAtTime(f, t, 0.05); e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05); e.f.frequency.setTargetAtTime(350 + speed * 900, t, 0.08);
    e.g.gain.setTargetAtTime(on && !this.muted ? 0.035 + speed * 0.035 : 0, t, 0.08);
  }
}
