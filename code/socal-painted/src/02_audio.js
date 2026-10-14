/* ---------------- audio: procedural, one shared noise buffer, lookahead scheduler ---------------- */
const Audio = (() => {
  let ac = null, master = null, comp = null, musicBus = null, sfxBus = null, verb = null, noise = null, amb = null, ambF = null, ambG = null;
  let muted = false, started = false, nextT = 0, step = 0, mode = 'menu', intensity = 0;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const BASS = [40,0,40,40,43,0,40,0,45,0,45,43,40,0,38,0, 45,0,45,45,48,0,45,0,47,0,47,45,43,0,42,0,
                40,0,40,40,43,0,40,0,45,0,45,43,40,0,38,0, 47,0,47,47,50,0,47,0,45,0,45,43,42,0,43,0];
  const LEAD = [64,-1,67,-1,69,-1,71,-1,74,-1,71,69,67,-1,64,-1, 69,-1,72,-1,74,-1,76,-1,74,72,69,-1,67,-1,69,-1,
                64,-1,67,-1,69,-1,71,-1,76,-1,74,71,69,-1,67,-1, 71,-1,74,-1,71,-1,69,-1,67,-1,66,-1,64,-1,-1,-1];
  const SPB = 60 / 152 / 4; // seconds per 16th
  function init() {
    if (ac) { if (ac.state === 'suspended' && !document.hidden) ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC();
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    // spring-ish reverb: two feedback delays
    verb = ac.createGain(); verb.gain.value = 1;
    const d1 = ac.createDelay(0.5), d2 = ac.createDelay(0.5), fb1 = ac.createGain(), fb2 = ac.createGain(), lp = ac.createBiquadFilter(), wet = ac.createGain();
    d1.delayTime.value = 0.083; d2.delayTime.value = 0.131; fb1.gain.value = 0.42; fb2.gain.value = 0.36; lp.type = 'lowpass'; lp.frequency.value = 2600; wet.gain.value = 0.5;
    verb.connect(d1); verb.connect(d2); d1.connect(lp); d2.connect(lp); lp.connect(fb1); lp.connect(fb2); fb1.connect(d1); fb2.connect(d2); lp.connect(wet); wet.connect(musicBus);
    // one shared 2 s white-noise buffer
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // persistent ambience bed (surf rumble / wheels / gravel): looped noise → filter → gain
    amb = ac.createBufferSource(); amb.buffer = noise; amb.loop = true;
    ambF = ac.createBiquadFilter(); ambF.type = 'lowpass'; ambF.frequency.value = 500; ambG = ac.createGain(); ambG.gain.value = 0;
    amb.connect(ambF); ambF.connect(ambG); ambG.connect(sfxBus); amb.start();
    nextT = ac.currentTime + 0.08; started = true;
  }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function tone(type, f, t, dur, vol, bus, f2, filt) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, 0.005, vol, dur);
    if (filt) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05); return g;
  }
  function nz(t, dur, vol, type, freq, q, bus, f2) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = type; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); f.Q.value = q || 1;
    env(g, t, 0.004, vol, dur); s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function schedStep(t, s) {
    const i = s % 64, b = i % 16, play = mode === 'play', inten = intensity;
    // drums
    if (play) {
      if (b === 0 || b === 8 || b === 10) { tone('sine', 140, t, 0.16, 0.5, musicBus, 42); }
      if (b === 4 || b === 12) { nz(t, 0.16, 0.32, 'bandpass', 1800, 0.8, musicBus); tone('triangle', 220, t, 0.06, 0.12, musicBus, 140); }
      if (i >= 60) nz(t, 0.09, 0.22, 'bandpass', 900 - (i - 60) * 120, 2, musicBus);
    }
    if (b % 2 === 0) nz(t, 0.035, play ? (b % 4 === 2 ? 0.11 : 0.06) : 0.035, 'highpass', 7000, 0.7, musicBus);
    // bass (twangy, filtered saw)
    const bn = BASS[i]; if (bn) tone('sawtooth', mtof(bn), t, SPB * 1.8, play ? 0.2 : 0.13, musicBus, 0, 700);
    // rhythm stabs (intensity layer)
    if (play && inten > 0.45 && (b === 2 || b === 6 || b === 10 || b === 14)) {
      const root = BASS[i - (i % 8)] || 40;
      tone('square', mtof(root + 12), t, 0.07, 0.05, musicBus, 0, 1600); tone('square', mtof(root + 19), t, 0.07, 0.04, musicBus, 0, 1600);
    }
    // surf lead: tremolo-picked, sent to the spring reverb
    let ln = LEAD[i];
    if (ln === -1) { let j = i; while (j > 0 && LEAD[j] === -1) j--; ln = LEAD[j]; }
    if (ln > 0) {
      const lv = play ? (inten > 0.2 ? 0.075 : 0.05) : 0.05;
      for (let k = 0; k < 2; k++) { const g = tone('sawtooth', mtof(ln), t + k * SPB / 2, SPB * 0.45, lv * (k ? 0.75 : 1), musicBus, 0, 2400); g.connect(verb); }
    }
  }
  return {
    init, mtof,
    get ctx() { return ac; },
    tick() { // called once per rAF: schedule ~120 ms ahead on the audio clock
      if (!ac || ac.state !== 'running' || !started) return;
      if (nextT < ac.currentTime - 0.25) nextT = ac.currentTime + 0.02;
      while (nextT < ac.currentTime + 0.12) { schedStep(nextT, step); step++; nextT += SPB; }
    },
    setMode(m) { mode = m; }, setIntensity(v) { intensity = v; },
    amb(type, level, freq) { if (!ac) return; const t = ac.currentTime; ambF.type = type; ambF.frequency.setTargetAtTime(freq, t, 0.08); ambG.gain.setTargetAtTime(level, t, 0.1); },
    toggleMute() { init(); muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.02); document.getElementById('bMute').classList.toggle('on', muted); },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended' && started) ac.resume(); },
    sfx(name, v) {
      if (!ac || ac.state !== 'running') return; const t = ac.currentTime; v = v === undefined ? 1 : v;
      switch (name) {
        case 'pop': tone('sine', 420 + v * 260, t, 0.09, 0.3, 0, 900 + v * 300); nz(t, 0.04, 0.12, 'bandpass', 2500, 2); break;
        case 'kick': tone('triangle', 300, t, 0.08, 0.35, 0, 120); nz(t, 0.05, 0.2, 'lowpass', 1200, 1); break;
        case 'land': nz(t, 0.12, 0.35 * v, 'lowpass', 900, 1); tone('sine', 120, t, 0.1, 0.3 * v, 0, 60); break;
        case 'whoosh': nz(t, 0.3, 0.18 * v, 'bandpass', 600, 1.2, 0, 2800); break;
        case 'trick': [0, 4, 7].forEach((n, k) => tone('square', Audio.mtof(76 + n + v), t + k * 0.05, 0.12, 0.09, 0, 0, 3000)); break;
        case 'big': [0, 4, 7, 12].forEach((n, k) => tone('sawtooth', Audio.mtof(72 + n), t + k * 0.06, 0.3, 0.1, 0, 0, 3200)); nz(t, 0.5, 0.08, 'highpass', 5000, 0.5); break;
        case 'bail': nz(t, 0.45, 0.5, 'lowpass', 1400, 1, 0, 200); tone('sawtooth', 200, t, 0.4, 0.22, 0, 45, 1200); break;
        case 'splash': nz(t, 0.7, 0.45, 'lowpass', 3000, 0.7, 0, 300); break;
        case 'cheer': for (let k = 0; k < 6; k++) tone('sine', 500 + Math.random() * 500, t + Math.random() * 0.25, 0.4, 0.035, 0, 900 + Math.random() * 600); nz(t, 1.2, 0.22 * v, 'bandpass', 1300, 0.6); break;
        case 'groan': nz(t, 0.8, 0.15, 'bandpass', 500, 0.8, 0, 250); tone('sine', 300, t, 0.6, 0.06, 0, 160); break;
        case 'ding': tone('sine', 1320, t, 0.35, 0.18); tone('sine', 1980, t, 0.25, 0.06); break;
        case 'tick': tone('square', 900, t, 0.03, 0.06, 0, 0, 2500); break;
        case 'pedal': nz(t, 0.05, 0.12, 'bandpass', 3000, 3); break;
        case 'stride': nz(t, 0.08, 0.13, 'bandpass', 1600, 1.5, 0, 700); break;
        case 'squawk': tone('triangle', 1300, t, 0.08, 0.2, 0, 1900); tone('triangle', 1800, t + 0.08, 0.18, 0.2, 0, 800); break;
        case 'throw': nz(t, 0.25, 0.2, 'bandpass', 1200, 2, 0, 3500); break;
        case 'meter': tone('square', 600 + v * 500, t, 0.05, 0.06, 0, 0, 2000); break;
        case 'catch': tone('square', 660, t, 0.06, 0.12); tone('square', 990, t + 0.06, 0.1, 0.12); break;
        case 'buzz': tone('sawtooth', 110, t, 0.35, 0.15, 0, 80, 900); break;
        case 'fanfare': [60, 64, 67, 72, 67, 72, 76].forEach((n, k) => { const g = tone('sawtooth', Audio.mtof(n), t + k * 0.12, k === 6 ? 0.8 : 0.16, 0.1, musicBus, 0, 2800); g.connect(verb); }); break;
        case 'go': tone('square', 880, t, 0.12, 0.12); tone('square', 1320, t + 0.13, 0.25, 0.12); break;
      }
    }
  };
})();
document.getElementById('bMute').addEventListener('click', e => { e.stopPropagation(); anyUserInput('mouse'); Audio.toggleMute(); e.currentTarget.blur(); });
