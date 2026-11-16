// DUSTLINE — procedural WebAudio: engine, skid/dust noise, splashes, blips. No audio files.
'use strict';

class DustAudio {
  constructor() {
    this.ctx = null;
    this.ok = false;
  }
  init() {
    if (this.ok) { this.resume(); return; }
    try {
      if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (e) {} }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = 0.42;
      this.master.connect(ctx.destination);
      // engine: saw + square through lowpass
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 420;
      this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth'; this.osc1.frequency.value = 55;
      this.osc2 = ctx.createOscillator(); this.osc2.type = 'square'; this.osc2.frequency.value = 28;
      const og2 = ctx.createGain(); og2.gain.value = 0.5;
      this.osc1.connect(this.engFilter); this.osc2.connect(og2); og2.connect(this.engFilter);
      this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
      this.osc1.start(); this.osc2.start();
      // looping noise buffer for skid / dust / water
      const len = ctx.sampleRate * 1.2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = (last * 2.4 + w * 0.25) * 0.7; }
      this.noiseBuf = buf;
      this.skidGain = ctx.createGain(); this.skidGain.gain.value = 0;
      this.skidFilter = ctx.createBiquadFilter(); this.skidFilter.type = 'bandpass'; this.skidFilter.frequency.value = 800; this.skidFilter.Q.value = 0.7;
      const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
      ns.connect(this.skidFilter); this.skidFilter.connect(this.skidGain); this.skidGain.connect(this.master);
      ns.start();
      this.ok = true;
    } catch (e) { /* audio unavailable — game continues silently, not a render path */ }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  // speedFrac 0..1, throttle 0..1, slip 0..1, inWater bool, racing bool
  update(speedFrac, throttle, slip, inWater, racing) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const rpm = 52 + speedFrac * 165 + throttle * 14;
    this.osc1.frequency.setTargetAtTime(rpm, t, 0.06);
    this.osc2.frequency.setTargetAtTime(rpm * 0.5 + 1.5, t, 0.06);
    this.engFilter.frequency.setTargetAtTime(inWater ? 300 : 380 + speedFrac * 700, t, 0.1);
    this.engGain.gain.setTargetAtTime(racing ? 0.05 + throttle * 0.075 + speedFrac * 0.03 : 0, t, 0.09);
    const skid = racing ? Math.min(0.16, slip * 0.13 + (inWater && speedFrac > 0.12 ? 0.075 : 0)) : 0;
    this.skidFilter.frequency.setTargetAtTime(inWater ? 480 : 760 + slip * 500, t, 0.08);
    this.skidGain.gain.setTargetAtTime(skid, t, 0.07);
  }
  blip(freq, dur, type, vol, when) {
    if (!this.ok) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime + (when || 0);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  pickup() { this.blip(660, 0.09, 'square', 0.1); this.blip(990, 0.14, 'square', 0.1, 0.07); }
  repair() { this.blip(520, 0.1, 'triangle', 0.14); this.blip(780, 0.16, 'triangle', 0.12, 0.08); }
  countBeep(final) { this.blip(final ? 880 : 440, final ? 0.34 : 0.16, 'square', 0.13); }
  thud(strength) {
    if (!this.ok) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.min(0.3, 0.1 + strength * 0.05), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t, Math.random()); src.stop(t + 0.18);
    } catch (e) {}
  }
}
