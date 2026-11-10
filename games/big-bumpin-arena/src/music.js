// Adaptive music: three synthesized stems on one lookahead clock, crossfaded by mood. No audio files.
//   calm = airy pad + sparse bell (menus, countdown) · play = bass + hats + arp (live ball) · goal = bright stabs (celebration)
// Every stem is scheduled from the same step counter, so a crossfade is always on the beat.
const BPM = 112, STEP = 60 / BPM / 4, AHEAD = 0.14;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Am - F - C - G, one bar each: root (bass) + triad
const PROG = [{ r: 45, t: [57, 60, 64] }, { r: 41, t: [53, 57, 60] }, { r: 48, t: [60, 64, 67] }, { r: 43, t: [55, 59, 62] }];
export const STEMS = ['calm', 'play', 'goal'];

export class Music {
  constructor(ac, bus, noise) {
    this.ac = ac; this.noise = noise; this.out = ac.createGain(); this.out.gain.value = 0; this.out.connect(bus);
    this.stem = {}; this.level = { calm: 0, play: 0, goal: 0 }; this.mood = null; this.step = 0; this.nextT = 0; this.timer = null; this.muted = false;
    for (const s of STEMS) { const g = ac.createGain(); g.gain.value = 0; g.connect(this.out); this.stem[s] = g; }
  }
  start() { if (this.timer) return; this.nextT = this.ac.currentTime + 0.05; this.timer = setInterval(() => this._pump(), 25); this.out.gain.setTargetAtTime(0.5, this.ac.currentTime, 0.4); }
  stop() { clearInterval(this.timer); this.timer = null; }
  setMuted(m) { this.muted = m; if (this.timer) this.out.gain.setTargetAtTime(m ? 0 : 0.5, this.ac.currentTime, 0.1); }
  /** Crossfade to a mood ('calm' | 'play' | 'goal'). Cheap to call every frame. */
  setMood(mood) {
    if (mood === this.mood || !STEMS.includes(mood)) return; this.mood = mood; const t = this.ac.currentTime;
    for (const s of STEMS) { const on = s === mood; this.level[s] = on ? 1 : 0; this.stem[s].gain.setTargetAtTime(on ? (s === 'goal' ? 0.95 : 0.8) : 0, t, on ? 0.12 : 0.35); }
  }
  _pump() { if (this.ac.state !== 'running') { this.nextT = Math.max(this.nextT, this.ac.currentTime); return; } while (this.nextT < this.ac.currentTime + AHEAD) { this._step(this.step, this.nextT); this.nextT += STEP; this.step = (this.step + 1) % 64; } }
  _v(stem, type, f0, f1, t, dur, vol, attack = 0.004) {
    const o = this.ac.createOscillator(), g = this.ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.stem[stem]); o.start(t); o.stop(t + dur + 0.03);
  }
  _hat(stem, t, vol) {
    if (!this.noise) return; const s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain(); s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(f); f.connect(g); g.connect(this.stem[stem]); s.start(t); s.stop(t + 0.05);
  }
  _step(step, t) {
    const bar = (step >> 4) & 3, s = step & 15, ch = PROG[bar], lv = this.level, beat = STEP * 16;
    if (lv.calm) {
      if (s === 0) for (const n of ch.t) { this._v('calm', 'triangle', hz(n), hz(n), t, beat * 1.05, 0.05, beat * 0.4); this._v('calm', 'sine', hz(n - 12), hz(n - 12), t, beat * 1.05, 0.04, beat * 0.4); }
      if (s === 8 || s === 14) this._v('calm', 'sine', hz(ch.t[(step >> 3) % 3] + 12), hz(ch.t[(step >> 3) % 3] + 12), t, 0.7, 0.05, 0.01);
    }
    if (lv.play) {
      if (s % 4 === 0) this._v('play', 'sine', 130, 42, t, 0.16, 0.16);                                              // kick
      if (s % 2 === 1) this._hat('play', t, s % 4 === 3 ? 0.07 : 0.04);                                              // hats
      if (s % 2 === 0) { const n = s === 6 || s === 14 ? ch.r + 7 : ch.r; this._v('play', 'square', hz(n), hz(n), t, STEP * 1.7, 0.05); } // bass
      if (s % 2 === 0) { const n = ch.t[(s >> 1) % 3] + 12; this._v('play', 'triangle', hz(n), hz(n), t, STEP * 1.5, 0.05); }       // arp
    }
    if (lv.goal) {
      if (s % 4 === 0) for (const n of ch.t) this._v('goal', 'sawtooth', hz(n + 12), hz(n + 12), t, STEP * 3.2, 0.035);              // stabs
      if (s % 2 === 0) { const n = ch.t[(s >> 1) % 3] + 24; this._v('goal', 'square', hz(n), hz(n), t, STEP * 1.4, 0.03); }          // sparkle
      if (s % 4 === 0) this._v('goal', 'sine', 150, 45, t, 0.18, 0.15);
    }
  }
}
