// audio.js — all sound is synthesised with WebAudio: engine, city + ocean ambience, siren,
// door/jack thunk, crash, and the busted sting. Started on the first touch/key (iOS rule).

export class Audio {
  constructor() { this.ctx = null; this.on = false; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    if (c.state === 'suspended') c.resume();
    this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);

    // brown noise buffer, shared
    const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    this.noise = buf;
    const white = c.createBuffer(1, c.sampleRate, c.sampleRate), w = white.getChannelData(0);
    for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
    this.white = white;

    // city hum
    const city = this.loop(buf);
    const cf = c.createBiquadFilter(); cf.type = 'lowpass'; cf.frequency.value = 380;
    this.cityG = c.createGain(); this.cityG.gain.value = 0.10;
    city.connect(cf).connect(this.cityG).connect(this.master);
    // ocean swell: noise through a slowly breathing filter + gain
    const sea = this.loop(buf);
    const sf = c.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 900;
    this.seaG = c.createGain(); this.seaG.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.12;
    const lfoG = c.createGain(); lfoG.gain.value = 500;
    lfo.connect(lfoG).connect(sf.frequency); lfo.start();
    sea.connect(sf).connect(this.seaG).connect(this.master);

    // engine: two detuned saws + square sub into a lowpass
    this.engG = c.createGain(); this.engG.gain.value = 0;
    this.engF = c.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 600; this.engF.Q.value = 4;
    this.engO = [c.createOscillator(), c.createOscillator(), c.createOscillator()];
    this.engO[0].type = 'sawtooth'; this.engO[1].type = 'sawtooth'; this.engO[2].type = 'square';
    this.engO[1].detune.value = 18;
    for (const o of this.engO) { o.frequency.value = 40; o.connect(this.engF); o.start(); }
    this.engF.connect(this.engG).connect(this.master);

    // siren: triangle swept by an LFO
    this.sirG = c.createGain(); this.sirG.gain.value = 0;
    const so = c.createOscillator(); so.type = 'triangle'; so.frequency.value = 760;
    const sl = c.createOscillator(); sl.frequency.value = 0.9;
    const slg = c.createGain(); slg.gain.value = 180;
    sl.connect(slg).connect(so.frequency); sl.start(); so.start();
    const sf2 = c.createBiquadFilter(); sf2.type = 'bandpass'; sf2.frequency.value = 900; sf2.Q.value = 0.7;
    so.connect(sf2).connect(this.sirG).connect(this.master);
    this.on = true;
  }

  loop(buf) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }

  update(sim, cam, world) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime;
    const car = sim.player.mode === 'car' ? sim.player.car : null;
    const sp = car ? Math.abs(car.v) : 0;
    const rpm = 38 + (sp % 110) * 0.55 + sp * 0.12;
    for (let i = 0; i < 3; i++) this.engO[i].frequency.setTargetAtTime(rpm * (i === 2 ? 0.5 : 1), t, 0.05);
    this.engF.frequency.setTargetAtTime(300 + sp * 4, t, 0.08);
    this.engG.gain.setTargetAtTime(car ? 0.05 + sp / 290 * 0.07 : 0, t, 0.1);
    const shore = world.shoreX(cam.y);
    this.seaG.gain.setTargetAtTime(Math.max(0, 1 - Math.abs(shore - cam.x) / 600) * 0.22, t, 0.3);
    const bs = sim.player.mode === 'board' && !sim.board.air && !sim.board.grind ? Math.hypot(sim.board.vx, sim.board.vy) : 0;
    if (!this.rollG) {
      const r = this.loop(this.white); const rf = c.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 700; rf.Q.value = 0.8;
      this.rollG = c.createGain(); this.rollG.gain.value = 0; r.connect(rf).connect(this.rollG).connect(this.master);
    }
    this.rollG.gain.setTargetAtTime(Math.min(0.08, bs / 3000), t, 0.05);
    const f = sim.focus();
    let near = 1e9;
    for (const p of sim.cars) if (p.siren) near = Math.min(near, Math.hypot(p.x - f.x, p.y - f.y));
    this.sirG.gain.setTargetAtTime(near < 1200 ? 0.05 * (1 - near / 1300) : 0, t, 0.2);
  }

  env(node, a, peak, d, t0) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    node.connect(g).connect(this.master);
    return g;
  }

  burst(freq, q, peak, dur, type = 'lowpass') {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.white;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    s.connect(f);
    this.env(f, 0.005, peak, dur, t);
    s.start(t); s.stop(t + dur + 0.05);
  }

  note(freq, t0, dur, peak, type = 'sawtooth', cutoff = 1800) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const o2 = c.createOscillator(); o2.type = type; o2.frequency.value = freq * 1.006;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    o.connect(f); o2.connect(f);
    this.env(f, 0.02, peak, dur, t0);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.1); o2.stop(t0 + dur + 0.1);
  }

  play(name, v) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    if (name === 'jack' || name === 'door') { this.burst(180, 1, 0.5, 0.18); this.burst(1200, 4, 0.12, 0.05, 'bandpass'); }
    if (name === 'jack') { this.note(523, t + 0.12, 0.12, 0.08, 'triangle'); this.note(784, t + 0.2, 0.2, 0.08, 'triangle'); }
    if (name === 'crash') this.burst(700, 0.6, Math.min(0.6, (v || 100) / 400), 0.35);
    if (name === 'hit') this.burst(400, 1, 0.3, 0.15);
    if (name === 'hop') this.burst(1500, 2, 0.12, 0.05, 'bandpass');
    if (name === 'bump') this.burst(240, 1, 0.22, 0.09);
    if (name === 'rustle') { this.burst(5200, 0.8, 0.05 + 0.1 * (v || 0.4), 0.4, 'highpass'); this.burst(170, 1, 0.12 + 0.2 * (v || 0.4), 0.1); }
    if (name === 'star') { this.note(880, t, 0.08, 0.06, 'square', 3000); this.note(1175, t + 0.08, 0.12, 0.06, 'square', 3000); }
    if (name === 'busted') {
      // short brass-ish sting: three falling stabs + a low thud
      this.burst(120, 1, 0.6, 0.5);
      const seq = [[392, 0], [370, 0.18], [277, 0.36]];
      for (const [f, dt] of seq) { this.note(f, t + dt, dt === 0.36 ? 0.9 : 0.14, 0.16, 'sawtooth', 1400); this.note(f / 2, t + dt, dt === 0.36 ? 0.9 : 0.14, 0.12, 'square', 600); }
    }
    if (name === 'ollie') { this.burst(2400, 3, 0.25, 0.05, 'bandpass'); this.burst(300, 1, 0.3, 0.08); }
    if (name === 'land') this.burst(900, 2, 0.25, 0.07, 'bandpass');
    if (name === 'grind') { this.burst(3200, 8, 0.18, 0.5, 'bandpass'); this.burst(1600, 6, 0.12, 0.5, 'bandpass'); }
    if (name === 'hood') { this.burst(160, 1, 0.5, 0.18); if (v) this.note(1320, t + 0.05, 0.15, 0.06, 'square', 3000); }
    if (name === 'bail') { this.burst(500, 0.8, 0.5, 0.35); this.burst(2600, 3, 0.15, 0.2, 'bandpass'); }
    if (name === 'trick') this.note(988 + Math.random() * 200, t, 0.06, 0.035, 'triangle', 4000);
    if (name === 'respawn') { this.note(659, t, 0.18, 0.06, 'triangle'); this.note(988, t + 0.15, 0.3, 0.06, 'triangle'); }
  }
}
