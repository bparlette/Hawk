'use strict';
/*
 * NEON SWARM — synthesized audio (no samples, no assets).
 * All SFX are small oscillator/noise envelopes. A two-osc bass loop
 * runs underneath at low volume. iOS: opt the page into the 'playback'
 * audio session so the silent switch doesn't mute the game, and resume
 * the context inside the first user gesture.
 */
const Snd = (() => {
  let ac = null, master = null, musicGain = null;
  let started = false;

  function init() {
    if (ac) return;
    try {
      // iOS 17+: without this, the hardware silent switch mutes WebAudio.
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
      musicGain = ac.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
    } catch (e) { ac = null; }
  }

  function resume() {
    init();
    if (ac && ac.state === 'suspended') ac.resume();
    if (ac && !started) { started = true; scheduleLoop(); }
  }

  // ---- tiny synth helpers -------------------------------------------------
  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  let noiseBuf = null;
  function noise(dur, vol, freq, delay = 0) {
    if (!ac) return;
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = ac.currentTime + delay;
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  // ---- game SFX ------------------------------------------------------------
  const shoot  = () => tone(880 + Math.random() * 120, 0.07, 'square', 0.05, 320);
  const hit    = () => noise(0.05, 0.10, 1800);
  const kill   = (big) => { noise(0.16, big ? 0.30 : 0.16, big ? 300 : 700); tone(big ? 160 : 300, 0.16, 'sawtooth', 0.10, 40); };
  const aura   = () => tone(140, 0.22, 'sine', 0.16, 520);
  const hurt   = () => { tone(220, 0.18, 'sawtooth', 0.16, 70); noise(0.12, 0.14, 500); };
  const pickup = (combo) => tone(620 + Math.min(combo, 12) * 45, 0.08, 'sine', 0.09, 990 + Math.min(combo, 12) * 60);
  const levelup = () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.10, null, i * 0.07)); };
  const draftPick = () => { tone(784, 0.10, 'square', 0.10); tone(1180, 0.14, 'square', 0.10, null, 0.06); };
  const gameover = () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.30, 'triangle', 0.14, null, i * 0.16)); };

  // ---- bass loop: A-minor arcade groove, lookahead-scheduled --------------
  const BPM = 116, STEP = 60 / BPM / 2; // 8th notes
  const PATTERN = [55, 0, 55, 55, 0, 55, 0, 65.41, 55, 0, 55, 55, 0, 82.41, 0, 73.42]; // A1 C2 E2 D2
  let stepIdx = 0, nextStepTime = 0, loopTimer = null;

  function scheduleLoop() {
    if (!ac || loopTimer) return;
    nextStepTime = ac.currentTime + 0.06;
    loopTimer = setInterval(() => {
      if (!ac) return;
      while (nextStepTime < ac.currentTime + 0.14) {
        const f = PATTERN[stepIdx % PATTERN.length];
        if (f) {
          const o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
          o.type = 'triangle'; o.frequency.value = f;
          fl.type = 'lowpass'; fl.frequency.value = 420;
          g.gain.setValueAtTime(0.5, nextStepTime);
          g.gain.exponentialRampToValueAtTime(0.001, nextStepTime + STEP * 0.92);
          o.connect(fl); fl.connect(g); g.connect(musicGain);
          o.start(nextStepTime); o.stop(nextStepTime + STEP);
        }
        stepIdx++; nextStepTime += STEP;
      }
    }, 42);
  }

  return { init, resume, shoot, hit, kill, aura, hurt, pickup, levelup, draftPick, gameover,
           state: () => (ac ? ac.state : 'none') };
})();
