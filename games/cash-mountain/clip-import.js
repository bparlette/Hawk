/**
 * clip-import.js — Universal AR Clip Studio: "Clip Import" mode.
 *
 * Self-contained drop-in module. No dependencies. Load with a plain <script>
 * tag; exposes `window.ClipImport`. Sibling of mic-trigger.js / mark-button.js
 * in this kit; same API conventions (options object, callbacks, getState()).
 *
 * What it does
 * ------------
 * Every AR overlay app in the studio feeds its effects from ONE background
 * <video> element (the scaffold's <video id="cam">): the live camera is its
 * srcObject, and the TV-quad homography, pixel samplers and 3D layers all
 * read that element. Clip Import swaps the SOURCE of that same element:
 *
 *   live camera  --(import a file)-->  camera-roll / console recording
 *   imported clip --(use camera)-->    live camera again
 *
 * Nothing downstream changes: the quad anchor, effects and triggers work
 * identically, because they never knew where the frames came from. Two
 * bonuses fall out of import mode:
 *
 *   - DETERMINISTIC TRIGGERS: the clip's own audio track is exposed as a
 *     MediaElementAudioSourceNode + AnalyserNode, and a trigger runner whose
 *     detector constants mirror mic-trigger.js runs spike/bass detection off
 *     the clip — the same shout in the clip fires the same event every take.
 *   - EXPORT: the composited canvas can be recorded (captureStream +
 *     MediaRecorder) with honest platform tiers (see INTEGRATION.md).
 *
 * API
 * ---
 *   ClipImport.attach({
 *     videoEl,                 // REQUIRED: the app's background <video>
 *     startCamera: fn(videoEl) -> Promise<bool>,  // optional: host camera
 *                              // starter (trio scaffold: AR.startCamera).
 *                              // Omit and a built-in getUserMedia starter
 *                              // with the scaffold's constraints is used.
 *     canvas: exportCanvas,    // optional: enables the REC export button
 *     onSource: fn({mode, name, duration, type}), // optional, fires on swap
 *     ui: true,                // inject the button bar (default true)
 *     position: 'bl',          // 'bl' (default) | 'br' | 'tl' | 'tr'
 *     loop: true,              // imported clip loops (default true)
 *     sound: false             // imported clip starts muted (default)
 *   }) -> ClipImport (chainable)
 *
 *   ClipImport.importFile(file)  -> Promise<{mode:'import', name, duration}>
 *   ClipImport.importBlob(blob, name?)   // same, from a Blob
 *   ClipImport.useCamera()       -> Promise<bool>  (false = camera failed,
 *                                   fallback state restored)
 *   ClipImport.setLoop(bool) / ClipImport.setSound(bool)
 *   ClipImport.getState()  // {attached, mode:'camera'|'import'|null, name,
 *                          //  duration, currentTime, paused, loop, sound,
 *                          //  audioGraph:bool, triggers:bool, exporting:bool,
 *                          //  cleanMode:bool}
 *   ClipImport.mode              // 'camera' | 'import' | null
 *
 *   // --- clip-audio triggers (import mode) ---
 *   ClipImport.getAudioGraph(ctx?) -> {ctx, source, analyser, gain,
 *                                      setAudible(bool), audible()}
 *     Creates the MediaElementAudioSourceNode for the attached <video>
 *     (once per element+context — the platform throws if you create two).
 *     The chain is source -> analyser -> gain -> destination. IMPORTANT:
 *     once audio is routed through a graph, the element's own mute/volume
 *     no longer describe what you hear — audibility is the graph gain.
 *     ClipImport manages this for you when you use setSound(); see
 *     INTEGRATION.md before wiring your own graph.
 *   ClipImport.readFeatures()    // {rms, bass, level} | null — same math as
 *                                // mic-trigger.js's mic source (fftSize 2048,
 *                                // smoothing 0.35, bass band ~30-160 Hz)
 *   ClipImport.startTriggers({onSpike, onBass, onLevel, sensitivity,
 *                             spikeRefractoryMs, bassRefractoryMs})
 *                          // -> {mode:'clip'}; detector constants mirror
 *                          // MicTrigger's, so callbacks behave the same.
 *   ClipImport.stopTriggers()
 *   ClipImport.getTriggerState() // counts etc., mirrors MicTrigger.getState
 *
 *   // --- export ---
 *   ClipImport.probe()           // capability report (see INTEGRATION.md)
 *   ClipImport.exportComposite(canvas, {fps:30, mimeType, filename,
 *                                       maxMs, download:true})
 *                          // -> controller {stop(): Promise<result>, promise}
 *                          // result: {blob, url, mimeType, bytes, durationMs}
 *   ClipImport.enterCleanMode(stageEl, {onExit})  // "Play & Screen-Record":
 *                          // fullscreen (or fixed-position fallback) + app
 *                          // chrome hidden; the reliable iPhone export path.
 *   ClipImport.exitCleanMode()
 *
 * iOS notes (full discussion in INTEGRATION.md; buffer evidence in
 * buffer-feasibility/VERDICT.md)
 * ------------------------------------------------------------------
 * - MediaRecorder exists on iOS Safari 14.5+, but before iOS 18.4 it is
 *   MP4-ONLY, starting it needs a user gesture, and canvas capture frame
 *   rate is unproven on device. exportComposite() negotiates the MIME type
 *   at runtime (webm -> mp4) and reports what it actually got.
 * - A programmatic blob download on iOS Safari opens a preview/share flow
 *   rather than silently saving. Workable, different interaction.
 * - The RELIABLE iPhone export is Tier 2: enterCleanMode() + the phone's
 *   own Screen Recording. No web API is involved in the capture at all.
 * - File picking uses a plain <input type="file" accept="video/*">, which
 *   iOS Safari serves from the photo library / Files app. Object URLs from
 *   local files are same-origin, so canvas sampling of the imported clip
 *   is NOT tainted (unlike cross-origin URLs without CORS).
 */
(function (global) {
  'use strict';

  var ClipImport = { version: '1.0.0', mode: null };

  var A = null;   // attach session
  var T = null;   // trigger session
  var X = null;   // export session
  var CLEAN = null;

  function noop() {}
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ================= attach / source swap ================= */

  function defaultStartCamera(video) {
    if (!global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
      return Promise.resolve(false);
    }
    // Same constraints as the trio scaffold's AR.startCamera.
    return global.navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    }).then(function (stream) {
      video.srcObject = stream;
      return video.play().then(function () { return true; });
    }).catch(function () { return false; });
  }

  function stopTracks(video) {
    var s = video && video.srcObject;
    if (s && s.getTracks) { try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
  }

  function fireSource(info) {
    ClipImport.mode = info.mode;
    if (A) A.lastSource = info;
    if (A && A.opts.onSource) { try { A.opts.onSource(info); } catch (e) {} }
    renderStatus();
  }

  function applySound() {
    if (!A) return;
    var v = A.videoEl;
    if (A.graph) {
      // Audio is routed through the graph: the element must stay unmuted
      // or the source node itself goes silent; audibility is the gain.
      v.muted = false;
      A.graph.setAudible(A.sound);
    } else {
      v.muted = !A.sound;
    }
  }

  function importBlob(blob, name) {
    if (!A) return Promise.reject(new Error('ClipImport.attach() first'));
    if (!blob) return Promise.reject(new Error('importBlob: no blob'));
    var v = A.videoEl;
    // Release whatever fed the element before (camera tracks or old clip).
    stopTracks(v);
    if (A.objectURL) { try { global.URL.revokeObjectURL(A.objectURL); } catch (e) {} A.objectURL = null; }
    A.hadNoCam = document.body.classList.contains('nocam');
    var url = global.URL.createObjectURL(blob);
    A.objectURL = url;
    A.clipName = name || blob.name || 'imported clip';
    v.removeAttribute('srcObject');
    v.srcObject = null;
    v.src = url;
    v.playsInline = true;
    v.loop = A.loop;
    applySound();
    document.body.classList.remove('nocam'); // the element has real frames now
    return new Promise(function (resolve, reject) {
      var done = false;
      function ok() {
        if (done) return; done = true;
        cleanup();
        var info = { mode: 'import', name: A.clipName, duration: v.duration, type: blob.type || '' };
        // play() can reject under strict autoplay policies when unmuted;
        // the clip is muted by default, so this normally resolves. A
        // rejection leaves a paused-but-loaded clip the user can start
        // with the play toggle — still a successful import.
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
        fireSource(info);
        resolve(info);
      }
      function bad() {
        if (done) return; done = true;
        cleanup();
        reject(new Error('could not load clip: ' + A.clipName));
      }
      function cleanup() {
        v.removeEventListener('loadedmetadata', ok);
        v.removeEventListener('error', bad);
      }
      v.addEventListener('loadedmetadata', ok);
      v.addEventListener('error', bad);
      v.load();
    });
  }

  function useCamera() {
    if (!A) return Promise.reject(new Error('ClipImport.attach() first'));
    var v = A.videoEl;
    try { v.pause(); } catch (e) {}
    if (A.objectURL) { try { global.URL.revokeObjectURL(A.objectURL); } catch (e) {} A.objectURL = null; }
    v.removeAttribute('src');
    A.clipName = null;
    var starter = A.opts.startCamera || defaultStartCamera;
    return Promise.resolve()
      .then(function () { return starter(v); })
      .then(function (ok) {
        if (ok) {
          document.body.classList.remove('nocam');
          fireSource({ mode: 'camera' });
          return true;
        }
        // Camera failed: restore the fallback presentation the scaffold
        // would have shown (body.nocam unless an import removed it before).
        if (A.hadNoCam !== false) document.body.classList.add('nocam');
        fireSource({ mode: null });
        return false;
      })
      .catch(function () {
        if (A.hadNoCam !== false) document.body.classList.add('nocam');
        fireSource({ mode: null });
        return false;
      });
  }

  /* ================= injected UI ================= */

  var CSS = [
    '#ci-root{position:fixed;z-index:99980;display:flex;flex-direction:column;gap:6px;',
    '  font-family:system-ui,-apple-system,sans-serif;max-width:78vw}',
    '#ci-root.ci-bl{left:12px;bottom:calc(12px + env(safe-area-inset-bottom))}',
    '#ci-root.ci-br{right:12px;bottom:calc(12px + env(safe-area-inset-bottom));align-items:flex-end}',
    '#ci-root.ci-tl{left:12px;top:calc(12px + env(safe-area-inset-top))}',
    '#ci-root.ci-tr{right:12px;top:calc(12px + env(safe-area-inset-top));align-items:flex-end}',
    '#ci-row{display:flex;gap:6px;flex-wrap:wrap}',
    '#ci-root button{background:rgba(12,16,24,.88);color:#e8ecf3;border:1px solid #475569;',
    '  border-radius:9px;padding:9px 11px;font-size:13px;font-weight:700;min-height:40px;',
    '  cursor:pointer;touch-action:manipulation}',
    '#ci-root button:active{transform:scale(.95)}',
    '#ci-root button.on{border-color:#22c55e;color:#86efac}',
    '#ci-root button.rec{border-color:#ef4444;color:#fca5a5}',
    '#ci-status{color:#e8ecf3;background:rgba(12,16,24,.72);border-radius:6px;',
    '  padding:3px 8px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#ci-exitclean{position:fixed;right:14px;top:calc(14px + env(safe-area-inset-top));z-index:99985;',
    '  background:rgba(12,16,24,.55);color:#e8ecf3;border:1px solid rgba(255,255,255,.35);',
    '  border-radius:999px;padding:10px 16px;font-size:13px;font-weight:700;display:none;',
    '  cursor:pointer;touch-action:manipulation}',
    'body.ci-cleanmode #ci-exitclean{display:block}',
    'body.ci-cleanmode #ci-root{display:none}',
    /* Scaffold apps put their chrome in .bar; hosts can extend this rule. */
    'body.ci-cleanmode .bar{display:none!important}',
    '.ci-stage-full{position:fixed!important;inset:0!important;width:100%!important;',
    '  height:100%!important;z-index:99970!important;background:#000}'
  ].join('\n');

  var els = {};
  function buildUI() {
    if (!A || !A.opts.ui || els.root) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.style.display = 'none';
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) {
        importBlob(input.files[0], input.files[0].name).catch(function () {});
      }
      input.value = '';
    });
    document.body.appendChild(input);
    els.input = input;

    var root = document.createElement('div');
    root.id = 'ci-root';
    root.className = 'ci-' + (A.opts.position || 'bl');
    var html =
      '<div id="ci-status">source: live camera</div>' +
      '<div id="ci-row">' +
        '<button id="ci-import" type="button">📥 IMPORT CLIP</button>' +
        '<button id="ci-camera" type="button">📷 LIVE</button>' +
        '<button id="ci-play" type="button">⏸</button>' +
        '<button id="ci-sound" type="button">🔇 SOUND</button>' +
        '<button id="ci-loop" type="button">🔁 LOOP</button>' +
        (A.opts.canvas ? '<button id="ci-rec" type="button">⏺ EXPORT</button>' : '') +
        '<button id="ci-clean" type="button">🎬 REC MODE</button>' +
      '</div>';
    root.innerHTML = html;
    document.body.appendChild(root);
    els.root = root;
    els.status = root.querySelector('#ci-status');

    root.querySelector('#ci-import').addEventListener('click', function () { input.click(); });
    root.querySelector('#ci-camera').addEventListener('click', function () { useCamera(); });
    root.querySelector('#ci-play').addEventListener('click', function () {
      var v = A.videoEl;
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); this.textContent = '⏸'; }
      else { v.pause(); this.textContent = '▶️'; }
    });
    els.soundBtn = root.querySelector('#ci-sound');
    els.soundBtn.addEventListener('click', function () { ClipImport.setSound(!A.sound); });
    els.loopBtn = root.querySelector('#ci-loop');
    els.loopBtn.addEventListener('click', function () { ClipImport.setLoop(!A.loop); });
    els.recBtn = root.querySelector('#ci-rec');
    if (els.recBtn) {
      els.recBtn.addEventListener('click', function () {
        if (X) { X.stop(); return; }
        var ctl;
        try {
          ctl = exportComposite(A.opts.canvas, {});
        } catch (e) { return; }
        els.recBtn.textContent = '⏹ SAVE';
        els.recBtn.classList.add('rec');
        ctl.promise.then(function () {
          els.recBtn.textContent = '⏺ EXPORT';
          els.recBtn.classList.remove('rec');
        }, function () {
          els.recBtn.textContent = '⏺ EXPORT';
          els.recBtn.classList.remove('rec');
        });
      });
    }
    root.querySelector('#ci-clean').addEventListener('click', function () {
      enterCleanMode(document.body);
    });

    var exitBtn = document.createElement('button');
    exitBtn.id = 'ci-exitclean';
    exitBtn.type = 'button';
    exitBtn.textContent = '✕ EXIT REC MODE';
    exitBtn.addEventListener('click', function () { exitCleanMode(); });
    document.body.appendChild(exitBtn);

    renderStatus();
  }

  function renderStatus() {
    if (!els.status || !A) return;
    var s;
    if (ClipImport.mode === 'import') {
      s = 'source: 📼 ' + (A.clipName || 'clip');
      if (isFinite(A.videoEl.duration) && A.videoEl.duration > 0) {
        s += ' · ' + A.videoEl.duration.toFixed(1) + 's';
      }
    } else if (ClipImport.mode === 'camera') {
      s = 'source: 📷 live camera';
    } else {
      s = 'source: none (fallback)';
    }
    els.status.textContent = s;
    if (els.soundBtn) {
      els.soundBtn.textContent = A.sound ? '🔊 SOUND' : '🔇 SOUND';
      els.soundBtn.classList.toggle('on', !!A.sound);
    }
    if (els.loopBtn) els.loopBtn.classList.toggle('on', !!A.loop);
  }

  /* ================= clip audio: graph + triggers ================= */

  var graphCache = { el: null, ctx: null, graph: null };

  function getAudioGraph(ctx) {
    if (!A) throw new Error('ClipImport.attach() first');
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) throw new Error('WebAudio unavailable');
    ctx = ctx || (A.graph && A.graph.ctx) || new AC();
    if (graphCache.graph && graphCache.el === A.videoEl && graphCache.ctx === ctx) {
      return graphCache.graph;
    }
    if (ctx.state === 'suspended') ctx.resume();
    var source = ctx.createMediaElementSource(A.videoEl); // once per el+ctx
    var analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.35;
    var gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
    var graph = {
      ctx: ctx, source: source, analyser: analyser, gain: gain,
      setAudible: function (on) { gain.gain.value = on ? 1 : 0; },
      audible: function () { return gain.gain.value > 0; }
    };
    graphCache = { el: A.videoEl, ctx: ctx, graph: graph };
    A.graph = graph;
    applySound(); // element must unmute now or the source itself is silent
    return graph;
  }

  function readFeatures() {
    if (!A || !A.graph) return null;
    var an = A.graph.analyser, ctx = A.graph.ctx;
    var td = new Uint8Array(an.fftSize);
    var fd = new Uint8Array(an.frequencyBinCount);
    an.getByteTimeDomainData(td);
    var sum = 0;
    for (var i = 0; i < td.length; i++) { var v = (td[i] - 128) / 128; sum += v * v; }
    var rms = Math.sqrt(sum / td.length);
    an.getByteFrequencyData(fd);
    var binHz = ctx.sampleRate / an.fftSize;
    var lo = Math.max(1, Math.floor(30 / binHz));
    var hi = Math.min(fd.length - 1, Math.ceil(160 / binHz));
    var b = 0;
    for (var j = lo; j <= hi; j++) b += fd[j];
    var bass = b / ((hi - lo + 1) * 255);
    return { rms: rms, bass: bass, level: clamp(rms * 1.6, 0, 1) };
  }

  // Detector constants mirror mic-trigger.js makeDetector() exactly, so a
  // callback set tuned against the mic behaves the same against a clip.
  function makeDetector(opts, cb) {
    return {
      baseline: 0.02, bassBaseline: 0.05,
      lastSpikeAt: -1e9, lastBassAt: -1e9, spikes: 0, basses: 0,
      feed: function (rms, bass, now) {
        var sens = opts.sensitivity;
        var spikeThresh = Math.max(this.baseline * (2.4 / sens), 0.055 / sens);
        var inSpike = rms > spikeThresh;
        if (!inSpike) this.baseline += (rms - this.baseline) * 0.03;
        this.bassBaseline += (bass - this.bassBaseline) * 0.04;
        cb.onLevel({ rms: rms, bass: bass, level: clamp(rms * 1.6, 0, 1) });
        if (inSpike && (rms - this.baseline) > 0.045 / sens &&
            now - this.lastSpikeAt > opts.spikeRefractoryMs) {
          this.lastSpikeAt = now; this.spikes++;
          cb.onSpike({ rms: rms, baseline: this.baseline, threshold: spikeThresh, bass: bass, time: now });
        }
        var bassThresh = Math.max(this.bassBaseline * (1.9 / sens), 0.22 / sens);
        if (bass > bassThresh && now - this.lastBassAt > opts.bassRefractoryMs) {
          this.lastBassAt = now; this.basses++;
          cb.onBass({ bass: bass, bassBaseline: this.bassBaseline, rms: rms, time: now });
        }
      }
    };
  }

  function startTriggers(userOpts) {
    if (!A) throw new Error('ClipImport.attach() first');
    var opts = { sensitivity: 1, spikeRefractoryMs: 350, bassRefractoryMs: 250 };
    userOpts = userOpts || {};
    for (var k in userOpts) opts[k] = userOpts[k];
    opts.sensitivity = clamp(+opts.sensitivity || 1, 0.25, 4);
    var cb = {
      onSpike: typeof userOpts.onSpike === 'function' ? userOpts.onSpike : noop,
      onBass:  typeof userOpts.onBass  === 'function' ? userOpts.onBass  : noop,
      onLevel: typeof userOpts.onLevel === 'function' ? userOpts.onLevel : noop
    };
    if (!A.graph) getAudioGraph(userOpts.ctx);
    stopTriggers();
    T = { detector: makeDetector(opts, cb), opts: opts, raf: 0, features: null };
    (function tick() {
      if (!T) return;
      var f = readFeatures();
      if (f) { T.detector.feed(f.rms, f.bass, performance.now()); T.features = f; }
      T.raf = requestAnimationFrame(tick);
    })();
    return { mode: 'clip' };
  }

  function stopTriggers() {
    if (!T) return;
    cancelAnimationFrame(T.raf);
    T = null;
  }

  /* ================= export ================= */

  var MIME_CHAIN = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];

  function probeMime(m) {
    try { return !!(global.MediaRecorder && global.MediaRecorder.isTypeSupported(m)); }
    catch (e) { return false; }
  }
  function bestMime(preferred) {
    if (preferred && probeMime(preferred)) return preferred;
    for (var i = 0; i < MIME_CHAIN.length; i++) if (probeMime(MIME_CHAIN[i])) return MIME_CHAIN[i];
    return ''; // '' = let MediaRecorder pick its default
  }

  function probe() {
    var mimes = {};
    MIME_CHAIN.forEach(function (m) { mimes[m] = probeMime(m); });
    var best = null;
    for (var i = 0; i < MIME_CHAIN.length; i++) if (mimes[MIME_CHAIN[i]]) { best = MIME_CHAIN[i]; break; }
    var AC = global.AudioContext || global.webkitAudioContext;
    return {
      fileInput: typeof document !== 'undefined' && 'files' in document.createElement('input'),
      objectURL: !!(global.URL && global.URL.createObjectURL),
      mediaRecorder: !!global.MediaRecorder,
      captureStream: !!(global.HTMLCanvasElement && global.HTMLCanvasElement.prototype.captureStream),
      mediaElementSource: !!(AC && AC.prototype.createMediaElementSource),
      mimeTypes: mimes,
      bestMime: best,
      elementFullscreen: !!(document.documentElement && document.documentElement.requestFullscreen),
      videoFullscreen: !!(global.HTMLVideoElement &&
        ('webkitEnterFullscreen' in global.HTMLVideoElement.prototype)),
      userAgent: global.navigator ? global.navigator.userAgent : ''
    };
  }

  function exportComposite(canvas, userOpts) {
    if (!canvas) throw new Error('exportComposite: canvas required');
    if (X) throw new Error('exportComposite: an export is already running');
    if (!global.MediaRecorder || !canvas.captureStream) {
      throw new Error('exportComposite unsupported here — use REC MODE (clean mode + phone screen recording)');
    }
    var opts = { fps: 30, download: true, filename: 'ar-clip', maxMs: 0 };
    userOpts = userOpts || {};
    for (var k in userOpts) opts[k] = userOpts[k];
    var mimeType = bestMime(opts.mimeType);
    var stream = canvas.captureStream(opts.fps || 0);
    var recOpts = mimeType ? { mimeType: mimeType } : {};
    var rec = new global.MediaRecorder(stream, recOpts);
    var chunks = [];
    var startedAt = performance.now();
    var resolveP, rejectP;
    var promise = new Promise(function (res, rej) { resolveP = res; rejectP = rej; });
    X = { rec: rec, stop: null };
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      // Assemble ONLY after onstop — assembling from a still-running
      // recorder truncates the file (buffer-feasibility/VERDICT.md).
      var type = rec.mimeType || mimeType || 'video/webm';
      var blob = new Blob(chunks, { type: type });
      var result = {
        blob: blob,
        url: global.URL.createObjectURL(blob),
        mimeType: type,
        bytes: blob.size,
        durationMs: Math.round(performance.now() - startedAt)
      };
      X = null;
      if (opts.download) {
        var ext = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
        var a = document.createElement('a');
        a.href = result.url;
        a.download = opts.filename + '.' + ext;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { try { document.body.removeChild(a); } catch (e) {} }, 400);
      }
      resolveP(result);
    };
    rec.onerror = function (e) { X = null; rejectP(e.error || new Error('MediaRecorder error')); };
    rec.start(250);
    if (opts.maxMs > 0) setTimeout(function () { if (X) X.stop(); }, opts.maxMs);
    X.stop = function () {
      if (rec.state !== 'inactive') { try { rec.stop(); } catch (e) {} }
      return promise;
    };
    X.promise = promise;
    return X;
  }

  /* ================= clean mode ("Play & Screen-Record") ================= */

  function onFsChange() {
    if (!document.fullscreenElement && CLEAN && CLEAN.usedFullscreen) exitCleanMode();
  }

  function enterCleanMode(stageEl, opts) {
    opts = opts || {};
    stageEl = stageEl || document.body;
    if (CLEAN) return CLEAN;
    CLEAN = { stage: stageEl, onExit: typeof opts.onExit === 'function' ? opts.onExit : noop, usedFullscreen: false };
    document.body.classList.add('ci-cleanmode');
    if (stageEl !== document.body) stageEl.classList.add('ci-stage-full');
    document.addEventListener('fullscreenchange', onFsChange);
    // Real fullscreen where the platform allows it (desktop, Android,
    // iPad). iPhone Safari refuses element fullscreen — the fixed-position
    // stage + hidden chrome above is the fallback, and the capture itself
    // is the phone's Screen Recording either way.
    var target = stageEl.requestFullscreen ? stageEl : document.documentElement;
    if (target && target.requestFullscreen) {
      var session = CLEAN; // the promise may settle after exitCleanMode()
      try {
        var p = target.requestFullscreen({ navigationUI: 'hide' });
        if (p && p.then) {
          session.usedFullscreen = true;
          p.catch(function () { session.usedFullscreen = false; });
        } else { session.usedFullscreen = true; }
      } catch (e) { session.usedFullscreen = false; }
    }
    renderStatus();
    return CLEAN;
  }

  function exitCleanMode() {
    if (!CLEAN) return;
    var c = CLEAN; CLEAN = null;
    document.body.classList.remove('ci-cleanmode');
    if (c.stage && c.stage !== document.body) c.stage.classList.remove('ci-stage-full');
    document.removeEventListener('fullscreenchange', onFsChange);
    if (document.fullscreenElement) {
      try { var p = document.exitFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    try { c.onExit(); } catch (e) {}
    renderStatus();
  }

  /* ================= public object ================= */

  ClipImport.attach = function (userOpts) {
    userOpts = userOpts || {};
    if (!userOpts.videoEl) throw new Error('ClipImport.attach: {videoEl} is required');
    var opts = { ui: true, position: 'bl', loop: true, sound: false, onSource: null, startCamera: null, canvas: null };
    for (var k in userOpts) opts[k] = userOpts[k];
    A = {
      videoEl: userOpts.videoEl, opts: opts,
      loop: opts.loop !== false,
      sound: !!opts.sound,
      objectURL: null, clipName: null, hadNoCam: null,
      graph: null, lastSource: null
    };
    ClipImport.mode = userOpts.videoEl.srcObject ? 'camera' : null;
    userOpts.videoEl.loop = A.loop;
    buildUI();
    renderStatus();
    return ClipImport;
  };

  ClipImport.importFile = function (file) { return importBlob(file, file && file.name); };
  ClipImport.importBlob = function (blob, name) { return importBlob(blob, name); };
  ClipImport.useCamera = useCamera;

  ClipImport.setLoop = function (on) {
    if (!A) return false;
    A.loop = !!on;
    A.videoEl.loop = A.loop;
    renderStatus();
    return A.loop;
  };
  ClipImport.setSound = function (on) {
    if (!A) return false;
    A.sound = !!on;
    applySound();
    renderStatus();
    return A.sound;
  };

  ClipImport.getAudioGraph = getAudioGraph;
  ClipImport.readFeatures = readFeatures;
  ClipImport.startTriggers = startTriggers;
  ClipImport.stopTriggers = stopTriggers;
  ClipImport.getTriggerState = function () {
    if (!T) return { running: false, mode: null };
    return {
      running: true, mode: 'clip', sensitivity: T.opts.sensitivity,
      features: T.features,
      counts: { spikes: T.detector.spikes, basses: T.detector.basses }
    };
  };

  ClipImport.probe = probe;
  ClipImport.exportComposite = exportComposite;
  ClipImport.enterCleanMode = enterCleanMode;
  ClipImport.exitCleanMode = exitCleanMode;
  ClipImport.isCleanMode = function () { return !!CLEAN; };

  ClipImport.getState = function () {
    if (!A) return { attached: false, mode: null };
    var v = A.videoEl;
    return {
      attached: true,
      mode: ClipImport.mode,
      name: A.clipName,
      duration: v.duration,
      currentTime: v.currentTime,
      paused: v.paused,
      loop: A.loop,
      sound: A.sound,
      audioGraph: !!A.graph,
      triggers: !!T,
      exporting: !!X,
      cleanMode: !!CLEAN
    };
  };

  global.ClipImport = ClipImport;
})(typeof window !== 'undefined' ? window : this);
