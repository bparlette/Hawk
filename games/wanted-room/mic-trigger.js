/**
 * mic-trigger.js — Universal AR Clip Studio: WebAudio mic auto-trigger engine.
 *
 * Self-contained drop-in module. No dependencies. Load with a plain <script> tag;
 * exposes `window.MicTrigger`. Wire-in ready for any AR overlay app.
 *
 * What it does
 * ------------
 * Opens the microphone via getUserMedia, runs an AnalyserNode, and extracts
 * real-time features on every animation frame:
 *   - RMS level        (time-domain, 0..1)
 *   - bass energy      (frequency-domain average over ~30–160 Hz, 0..1)
 * Spike detection uses an ADAPTIVE threshold: a slow exponential moving
 * average of the recent RMS ("baseline") plus a noise margin. A spike fires
 * when the instantaneous RMS exceeds max(baseline * spikeFactor, floor) by a
 * minimum delta, subject to a refractory period so one shout = one event.
 * Bass events fire similarly on the bass band with their own refractory.
 *
 * DEMO mode
 * ---------
 * If the mic is denied/unavailable (or `demo: true` is passed), the engine
 * falls back to a synthetic source that produces rhythmic bass pulses and
 * periodic spikes, fed through the SAME detector, so callbacks behave
 * identically. `MicTrigger.mode` reports 'mic' | 'demo' | null.
 *
 * API
 * ---
 *   MicTrigger.start({
 *     onSpike:  fn({rms, baseline, threshold, bass, time}),   // optional
 *     onBass:   fn({bass, bassBaseline, rms, time}),          // optional
 *     onLevel:  fn({rms, bass, level}),                       // optional, ~per frame
 *     sensitivity: 1,        // 0.25..4, higher = touchier (default 1)
 *     demo: false,           // force demo source
 *     demoOnDeny: true,      // fall back to demo if mic is denied
 *     spikeRefractoryMs: 350,
 *     bassRefractoryMs: 250
 *   }) -> Promise<{mode:'mic'|'demo'}>
 *
 *   MicTrigger.stop()            // releases mic tracks + AudioContext
 *   MicTrigger.setSensitivity(x) // live-adjust, clamps 0.25..4
 *   MicTrigger.getState()        // {running, mode, sensitivity, features:{rms,bass,level,baseline,bassBaseline}, counts:{spikes,basses}}
 *   MicTrigger.mode              // 'mic' | 'demo' | null
 *   MicTrigger.isRunning()
 *
 * iOS notes (see README.md for the full discussion)
 * -------------------------------------------------
 * - start() MUST be called from a user-gesture handler (tap) so the
 *   AudioContext is allowed to run; we call ctx.resume() defensively.
 * - iOS Safari can hold camera + mic in one getUserMedia session, but the
 *   AR apps here open the camera separately; requesting audio afterwards is
 *   fine in Safari 14.5+. If the page already has an active camera stream,
 *   starting the mic does not stop it.
 * - Set `navigator.audioSession.type = 'playback'` where supported
 *   (iOS 17+) if the host app also plays sound, to avoid the silent-switch
 *   muting the app's own audio. The engine does this opportunistically.
 */
(function (global) {
  'use strict';

  var MicTrigger = { version: '1.0.0', mode: null };
  var S = null; // active session state

  function noop() {}
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function makeDetector(opts, cb) {
    return {
      baseline: 0.02,        // EMA of RMS (room tone)
      bassBaseline: 0.05,    // EMA of bass energy
      lastSpikeAt: -1e9,
      lastBassAt: -1e9,
      spikes: 0,
      basses: 0,
      feed: function (rms, bass, now) {
        var sens = opts.sensitivity;
        // Adaptive baselines: creep toward the signal slowly, but freeze
        // while a spike is in progress so a long shout doesn't raise the bar.
        var spikeThresh = Math.max(this.baseline * (2.4 / sens), 0.055 / sens);
        var inSpike = rms > spikeThresh;
        if (!inSpike) this.baseline += (rms - this.baseline) * 0.03;
        this.bassBaseline += (bass - this.bassBaseline) * 0.04;

        cb.onLevel({ rms: rms, bass: bass, level: clamp(rms * 1.6, 0, 1) });

        if (inSpike && (rms - this.baseline) > 0.045 / sens &&
            now - this.lastSpikeAt > opts.spikeRefractoryMs) {
          this.lastSpikeAt = now;
          this.spikes++;
          cb.onSpike({ rms: rms, baseline: this.baseline, threshold: spikeThresh, bass: bass, time: now });
        }
        var bassThresh = Math.max(this.bassBaseline * (1.9 / sens), 0.22 / sens);
        if (bass > bassThresh && now - this.lastBassAt > opts.bassRefractoryMs) {
          this.lastBassAt = now;
          this.basses++;
          cb.onBass({ bass: bass, bassBaseline: this.bassBaseline, rms: rms, time: now });
        }
        return { spikeThresh: spikeThresh, bassThresh: bassThresh };
      }
    };
  }

  function startLoop(source) {
    var lastFeatures = { rms: 0, bass: 0, level: 0, baseline: 0, bassBaseline: 0 };
    function tick() {
      if (!S) return;
      var f = source.read();
      var info = S.detector.feed(f.rms, f.bass, performance.now());
      lastFeatures = { rms: f.rms, bass: f.bass, level: clamp(f.rms * 1.6, 0, 1),
                       baseline: S.detector.baseline, bassBaseline: S.detector.bassBaseline };
      S.features = lastFeatures; S.thresholds = info;
      S.raf = requestAnimationFrame(tick);
    }
    S.features = lastFeatures;
    S.raf = requestAnimationFrame(tick);
  }

  /* ---------------- mic source ---------------- */
  function micSource(stream, opts) {
    var AC = global.AudioContext || global.webkitAudioContext;
    var ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    var src = ctx.createMediaStreamSource(stream);
    var analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.35;
    src.connect(analyser);
    var td = new Uint8Array(analyser.fftSize);
    var fd = new Uint8Array(analyser.frequencyBinCount);
    var binHz = ctx.sampleRate / analyser.fftSize;
    var bassLo = Math.max(1, Math.floor(30 / binHz));
    var bassHi = Math.min(fd.length - 1, Math.ceil(160 / binHz));
    return {
      ctx: ctx, stream: stream,
      read: function () {
        analyser.getByteTimeDomainData(td);
        var sum = 0;
        for (var i = 0; i < td.length; i++) { var v = (td[i] - 128) / 128; sum += v * v; }
        var rms = Math.sqrt(sum / td.length);
        analyser.getByteFrequencyData(fd);
        var b = 0;
        for (var j = bassLo; j <= bassHi; j++) b += fd[j];
        var bass = (b / ((bassHi - bassLo + 1) * 255));
        return { rms: rms, bass: bass };
      },
      close: function () {
        try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        try { ctx.close(); } catch (e) {}
      }
    };
  }

  /* ---------------- demo source (synthetic pulses through the same detector) ---------------- */
  function demoSource() {
    var t0 = performance.now();
    // Deterministic-ish pattern: bass beat every 1200 ms (200 ms wide),
    // a spike (broadband burst) every 2800 ms (160 ms wide), quiet room tone
    // in between. Headless tests can rely on: >=1 bass within ~1.4 s,
    // >=1 spike within ~3 s.
    return {
      read: function () {
        var t = performance.now() - t0;
        var rms = 0.03 + 0.008 * Math.sin(t / 300);          // room tone
        var bass = 0.06 + 0.02 * Math.sin(t / 500);
        var beatPhase = t % 1200;
        if (beatPhase < 200) bass = 0.75 + 0.1 * Math.sin(beatPhase / 200 * Math.PI);
        var spikePhase = t % 2800;
        if (spikePhase < 160) { rms = 0.65 + 0.15 * Math.sin(spikePhase / 160 * Math.PI); bass = Math.max(bass, 0.5); }
        return { rms: Math.max(0, rms), bass: Math.max(0, bass) };
      },
      close: function () {}
    };
  }

  function begin(source, mode, opts, cb) {
    S = {
      source: source, opts: opts, cb: cb,
      detector: makeDetector(opts, cb),
      raf: 0, features: null, thresholds: null
    };
    MicTrigger.mode = mode;
    startLoop(source);
  }

  MicTrigger.start = function (userOpts) {
    var opts = {
      sensitivity: 1, demo: false, demoOnDeny: true,
      spikeRefractoryMs: 350, bassRefractoryMs: 250
    };
    userOpts = userOpts || {};
    for (var k in userOpts) opts[k] = userOpts[k];
    opts.sensitivity = clamp(+opts.sensitivity || 1, 0.25, 4);
    var cb = {
      onSpike: typeof userOpts.onSpike === 'function' ? userOpts.onSpike : noop,
      onBass:  typeof userOpts.onBass  === 'function' ? userOpts.onBass  : noop,
      onLevel: typeof userOpts.onLevel === 'function' ? userOpts.onLevel : noop
    };
    if (S) MicTrigger.stop();

    // Opportunistic iOS nicety: keep app audio audible under the silent switch.
    try { if (global.navigator && 'audioSession' in global.navigator) global.navigator.audioSession.type = 'playback'; } catch (e) {}

    if (opts.demo || !global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
      begin(demoSource(), 'demo', opts, cb);
      return Promise.resolve({ mode: 'demo' });
    }
    return global.navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    }).then(function (stream) {
      begin(micSource(stream, opts), 'mic', opts, cb);
      return { mode: 'mic' };
    }).catch(function (err) {
      if (opts.demoOnDeny) {
        begin(demoSource(), 'demo', opts, cb);
        return { mode: 'demo', error: err && err.name };
      }
      throw err;
    });
  };

  MicTrigger.stop = function () {
    if (!S) return;
    cancelAnimationFrame(S.raf);
    try { S.source.close(); } catch (e) {}
    S = null;
    MicTrigger.mode = null;
  };

  MicTrigger.setSensitivity = function (x) {
    var v = clamp(+x || 1, 0.25, 4);
    if (S) S.opts.sensitivity = v;
    return v;
  };

  MicTrigger.isRunning = function () { return !!S; };

  MicTrigger.getState = function () {
    if (!S) return { running: false, mode: null };
    return {
      running: true,
      mode: MicTrigger.mode,
      sensitivity: S.opts.sensitivity,
      features: S.features,
      thresholds: S.thresholds,
      counts: { spikes: S.detector.spikes, basses: S.detector.basses }
    };
  };

  global.MicTrigger = MicTrigger;
})(typeof window !== 'undefined' ? window : this);
