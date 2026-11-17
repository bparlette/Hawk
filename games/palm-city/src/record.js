// record.js — SAVE the Auto-Director highlight, and record live gameplay.
// The director already replays the run's best ~20 s (letterbox, camera cuts,
// 0.35x slow-mo, real audio); until now none of it could be kept. This module
// only OBSERVES the screen: canvas.captureStream for the picture plus a tap on
// the audio master bus (audio.tap()), muxed by MediaRecorder into one file the
// player downloads or shares. It never touches the sim, the director, or input:
// the buttons are HTML above the canvas, and the game's pointer listeners live
// on the canvas itself, so a tap on SAVE CLIP can never skip the replay.
const MIMES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export class Recorder {
  constructor(canvas, audio) {
    this.canvas = canvas; this.audio = audio;
    this.mr = null; this.chunks = []; this.kind = 'gameplay'; this.t0 = 0; this.timer = null; this.wantShare = false;
    this.mime = MIMES.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || null;
    this.supported = !!(this.mime && canvas.captureStream);
    // CHANNEL 7 broadcast frame (polish bundle): drawn into the game canvas by main.js, so it is
    // baked into the recorded picture. Default ON for highlight saves, OFF for live REC; the NEWS
    // button flips both together and the choice lasts the session.
    this.newsHL = true; this.newsLive = false;
    this.buildUi();
  }

  buildUi() {
    const css = document.createElement('style');
    css.textContent = `
      .pcRecBtn{position:fixed;z-index:1200;font:700 13px "Avenir Next",Futura,system-ui,sans-serif;
        color:#ffd45c;background:rgba(14,8,28,.72);border:1px solid rgba(255,212,92,.55);border-radius:999px;
        padding:10px 14px;touch-action:none;-webkit-tap-highlight-color:transparent;cursor:pointer}
      .pcRecBtn.on{color:#ff6b5e;border-color:rgba(255,107,94,.7)}
      #pcRecBtn{right:10px;top:58%}
      #pcNewsBtn{right:10px;top:calc(58% + 52px)}
      #pcSaveBtn{left:50%;transform:translateX(-50%);bottom:96px;display:none}
      #pcToast{position:fixed;z-index:1201;left:50%;transform:translateX(-50%);bottom:150px;max-width:86vw;
        font:600 13px "Avenir Next",Futura,system-ui,sans-serif;color:#fff1d8;background:rgba(14,8,28,.85);
        border-radius:10px;padding:9px 13px;opacity:0;transition:opacity .25s;pointer-events:none;text-align:center}`;
    document.head.appendChild(css);
    const mk = (id, label) => {
      const b = document.createElement('button');
      b.id = id; b.className = 'pcRecBtn'; b.textContent = label;
      b.addEventListener('pointerdown', e => e.stopPropagation());
      // input.js preventDefaults EVERY document touchstart (to kill scroll/zoom on the
      // canvas) — and a canceled touchstart makes the browser suppress the click event,
      // which left these buttons dead to real taps. Shield the button's own touchstart
      // so it never reaches that listener and the click fires. The tap still cannot
      // reach the game: its listeners live on the canvas, which is not an ancestor.
      b.addEventListener('touchstart', e => e.stopPropagation());
      document.body.appendChild(b); return b;
    };
    this.recBtn = mk('pcRecBtn', '● REC');
    this.newsBtn = mk('pcNewsBtn', '📺 NEWS ✓');
    this.saveBtn = mk('pcSaveBtn', 'SAVE CLIP');
    this.newsBtn.addEventListener('click', () => {
      const target = !(this.newsHL || this.newsLive);   // any on -> all off; all off -> all on
      this.newsHL = target; this.newsLive = target;
      this.newsBtn.textContent = target ? '📺 NEWS ✓' : '📺 NEWS ✕';
      this.toast(target ? 'Channel 7 frame ON — it will appear in your clips' : 'Channel 7 frame OFF — clips stay clean');
    });
    this.toastEl = document.createElement('div'); this.toastEl.id = 'pcToast'; document.body.appendChild(this.toastEl);
    this.recBtn.addEventListener('click', () => { if (this.mr) this.stop(true); else this.start('gameplay'); });
    this.saveBtn.addEventListener('click', () => {
      if (this.mr && this.kind === 'highlight') this.stop(true);
      else if (!this.mr) this.start('highlight');
    });
  }

  // The help/start panel owns the screen while it is up: the floating REC/NEWS pills hide —
  // they sit at the right edge mid-screen, exactly where the menu's JUMP buttons live
  // (owner phone screenshot, Nov 16). They come back the moment the panel closes.
  setMenuOpen(open) {
    if (this._menuOpen === open) return;
    this._menuOpen = open;
    const d = open ? 'none' : '';
    this.recBtn.style.display = d; this.newsBtn.style.display = d;
    if (open) this.saveBtn.style.display = 'none';   // replayStarted() restores it for a highlight
  }

  toast(msg) {
    this.toastEl.textContent = msg; this.toastEl.style.opacity = '1';
    clearTimeout(this.toastT); this.toastT = setTimeout(() => { this.toastEl.style.opacity = '0'; }, 2600);
  }

  get recording() { return !!this.mr; }

  start(kind) {
    if (!this.supported) { this.toast("Recording isn't supported in this browser"); return false; }
    if (this.mr) return false;
    try {
      const tracks = [...this.canvas.captureStream(30).getVideoTracks()];
      const as = this.audio.tap && this.audio.tap();
      if (as) tracks.push(...as.getAudioTracks());
      this.chunks = []; this.kind = kind; this.wantShare = false;
      this.mr = new MediaRecorder(new MediaStream(tracks), { mimeType: this.mime, videoBitsPerSecond: 5_000_000 });
      this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.mr.onstop = () => this.finish();
      this.mr.start(250);
      this.t0 = performance.now();
      this.tickLabel();
      this.timer = setInterval(() => this.tickLabel(), 250);
      return true;
    } catch (_) { this.mr = null; this.toast("Recording isn't supported in this browser"); return false; }
  }

  tickLabel() {
    const s = Math.floor((performance.now() - this.t0) / 1000);
    const t = `● REC ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (this.kind === 'highlight') { this.saveBtn.textContent = `${t} — TAP TO STOP`; this.saveBtn.classList.add('on'); }
    else { this.recBtn.textContent = `${t} — STOP`; this.recBtn.classList.add('on'); }
  }

  stop(fromTap) {
    if (!this.mr) return;
    this.wantShare = !!fromTap;
    try { this.mr.stop(); } catch (_) { this.mr = null; }
  }

  finish() {
    clearInterval(this.timer);
    const mime = this.mime, kind = this.kind, wantShare = this.wantShare;
    this.mr = null;
    this.recBtn.textContent = '● REC'; this.recBtn.classList.remove('on');
    this.saveBtn.textContent = 'SAVE CLIP'; this.saveBtn.classList.remove('on');
    const blob = new Blob(this.chunks, { type: mime }); this.chunks = [];
    if (!blob.size) { this.toast('Nothing was recorded'); return; }
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const file = new File([blob], `palm-city-${kind}-${stamp}.${ext}`, { type: mime });
    const download = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      this.toast('Clip saved — check your downloads');
    };
    if (wantShare && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(() => download());
    } else download();
  }

  // The Channel 7 frame, drawn by main.js onto the game canvas (so captureStream records it):
  // a lower-third news bar, the wanted stars and the score / combo multiplier. `highlight` sits
  // the bar just above the replay's letterbox; live play parks it clear of the touch buttons.
  drawBroadcast(g, vw, vh, dpr, sim, highlight) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const w = Math.min(vw - 24, 336), h = 54, x = 12;
    const y = highlight ? vh - 54 - h - 10 : vh - h - 118;
    g.fillStyle = 'rgba(14,8,28,0.85)';
    g.beginPath(); g.roundRect(x, y, w, h, 8); g.fill();
    g.fillStyle = '#e0232e'; g.fillRect(x, y, w, 4);                       // the news-red top rule
    // LIVE chip
    g.fillStyle = '#e0232e'; g.beginPath(); g.roundRect(x + 10, y + 11, 52, 18, 4); g.fill();
    g.fillStyle = '#fff'; g.font = '900 11px "Avenir Next", Futura, system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('● LIVE', x + 36, y + 20.5);
    // channel name
    g.textAlign = 'left'; g.fillStyle = '#fff1d8';
    g.font = '900 15px "Avenir Next", Futura, system-ui, sans-serif';
    g.fillText('PALM CITY NEWS', x + 72, y + 20);
    const titleW = g.measureText('PALM CITY NEWS').width;
    g.fillStyle = '#ffd45c'; g.font = '800 11px "Avenir Next", Futura, system-ui, sans-serif';
    g.fillText('CHANNEL 7', x + 72 + titleW + 10, y + 20.5);
    // score + multiplier
    const mult = sim.combo ? sim.combo.mult : (sim.lastTrick ? sim.lastTrick.mult || 1 : 1);
    g.fillStyle = 'rgba(255,241,216,0.92)'; g.font = '800 13px "Avenir Next", Futura, system-ui, sans-serif';
    g.fillText(`SCORE ${(sim.score || 0).toLocaleString()}${mult > 1 ? `  ·  ×${mult}` : ''}`, x + 12, y + 41);
    // wanted stars, right end of the bar
    for (let i = 0; i < 5; i++) {
      const sx = x + w - 18 - (4 - i) * 17, sy = y + 40, r = 7.5, on = i < sim.stars;
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
        g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
      }
      g.closePath();
      g.fillStyle = on ? '#ffd45c' : 'rgba(255,241,216,0.22)'; g.fill();
      if (on) { g.lineWidth = 1.2; g.strokeStyle = '#7a3a1a'; g.stroke(); }
    }
    g.textBaseline = 'alphabetic';
  }

  // Highlight lifecycle, driven from main.js frame() transitions.
  replayStarted() { this.saveBtn.style.display = 'block'; }
  replayEnded() {
    this.saveBtn.style.display = 'none';
    if (this.mr && this.kind === 'highlight') this.stop(false);   // auto-save the finished clip
  }
}
