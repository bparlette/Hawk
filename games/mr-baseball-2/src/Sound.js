// Sound.js — all-synth WebAudio SFX for Mr. Baseball 2 (the original was silent).
// iOS rules (house standard): audioSession 'playback', 1-sample silent-buffer
// unlock inside the first gesture, resume on pointerdown / touchend /
// visibilitychange. Every call is wrapped — audio is always optional.
export class Sound {
    constructor() {
        this.ac = null;
        this._noiseBuf = null;
        const resume = () => this.resume();
        document.addEventListener('pointerdown', resume, true);
        document.addEventListener('touchend', resume, true);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
    }

    init() {
        try {
            if ('audioSession' in navigator) { try { navigator.audioSession.type = 'playback'; } catch (e) {} }
            if (!this.ac) {
                const Ctor = window.AudioContext || window.webkitAudioContext;
                if (Ctor) this.ac = new Ctor();
            }
            if (this.ac) {
                if (this.ac.state === 'suspended') this.ac.resume();
                const buf = this.ac.createBuffer(1, 1, 22050);
                const src = this.ac.createBufferSource();
                src.buffer = buf; src.connect(this.ac.destination); src.start(0);
            }
        } catch (e) { /* audio is optional */ }
    }

    resume() { try { if (this.ac && this.ac.state === 'suspended') this.ac.resume(); } catch (e) {} }

    tone(f0, f1, dur, type, vol, delay) {
        if (!this.ac) return;
        try {
            const t0 = this.ac.currentTime + (delay || 0);
            const o = this.ac.createOscillator(), g = this.ac.createGain();
            o.type = type || 'sine';
            o.frequency.setValueAtTime(Math.max(30, f0), t0);
            o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            o.connect(g); g.connect(this.ac.destination);
            o.start(t0); o.stop(t0 + dur + 0.05);
        } catch (e) {}
    }

    noiseBurst(dur, vol, delay, lowHz) {
        if (!this.ac) return;
        try {
            if (!this._noiseBuf) {
                this._noiseBuf = this.ac.createBuffer(1, this.ac.sampleRate * 0.5, this.ac.sampleRate);
                const d = this._noiseBuf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            const t0 = this.ac.currentTime + (delay || 0);
            const src = this.ac.createBufferSource(); src.buffer = this._noiseBuf;
            const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lowHz || 3000;
            const g = this.ac.createGain();
            g.gain.setValueAtTime(vol, t0);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            src.connect(lp); lp.connect(g); g.connect(this.ac.destination);
            src.start(t0); src.stop(t0 + dur + 0.05);
        } catch (e) {}
    }

    // Filtered-noise sweep — the toss / swing whoosh.
    whoosh(dur, vol, fFrom, fTo) {
        if (!this.ac) return;
        try {
            if (!this._noiseBuf) {
                this._noiseBuf = this.ac.createBuffer(1, this.ac.sampleRate * 0.5, this.ac.sampleRate);
                const d = this._noiseBuf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            const t0 = this.ac.currentTime;
            const src = this.ac.createBufferSource(); src.buffer = this._noiseBuf;
            const bp = this.ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
            bp.frequency.setValueAtTime(fFrom, t0);
            bp.frequency.exponentialRampToValueAtTime(fTo, t0 + dur);
            const g = this.ac.createGain();
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.35);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            src.connect(bp); bp.connect(g); g.connect(this.ac.destination);
            src.start(t0); src.stop(t0 + dur + 0.05);
        } catch (e) {}
    }

    toss()  { this.whoosh(0.22, 0.10, 500, 1500); }
    swing() { this.whoosh(0.13, 0.16, 900, 2600); }
    crack() { this.noiseBurst(0.06, 0.32, 0, 4200); this.tone(190, 55, 0.10, 'square', 0.20); }
    pop()   { this.tone(480, 940, 0.09, 'sine', 0.20); this.noiseBurst(0.05, 0.10, 0, 5200); }
    score() { this.tone(660, 660, 0.07, 'triangle', 0.12); this.tone(990, 990, 0.11, 'triangle', 0.12, 0.06); }
    sting() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.94, 0.16, 'sawtooth', 0.10, i * 0.11)); }
    startJingle() { [523, 659, 784].forEach((f, i) => this.tone(f, f, 0.12, 'triangle', 0.11, i * 0.08)); }
}
