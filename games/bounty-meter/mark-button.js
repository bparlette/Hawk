/**
 * mark-button.js — Universal AR Clip Studio: MARK moment module.
 *
 * Self-contained drop-in. No dependencies, no CSS files. Load with a plain
 * <script> tag and the UI builds itself on DOMContentLoaded (or call
 * MarkButton.init() yourself). Exposes `window.MarkButton`.
 *
 * Why it exists
 * -------------
 * The rolling 15 s clip buffer depends on canvas.captureStream +
 * MediaRecorder behaving on iOS Safari — historically the shakiest link in
 * the stack (see buffer-feasibility/VERDICT.md). MARK is the interim answer
 * that works everywhere TODAY: while the owner records with the phone's own
 * screen recorder / camera, one tap on MARK stamps the moment. Afterwards the
 * exported list gives the exact session timecodes to scrub to in the
 * recording — no scrubbing through 20 minutes of footage.
 *
 * Behaviour
 * ---------
 * - Big floating MARK button, fixed bottom-right, z-index 99990 (>= 1100
 *   requirement), thumb-sized, above any AR overlay.
 * - On tap: navigator.vibrate(60) where available, a huge timecode stamp
 *   flashes centre-screen for ~1.2 s, and the mark is appended to the
 *   on-screen marks list.
 * - Marks + session start persist in localStorage
 *   (keys 'arMark.marks.v1' / 'arMark.sessionStart.v1'), so a page reload
 *   mid-session keeps the list and the clock honest.
 * - EXPORT button copies the list to the clipboard as plain text
 *   (with a textarea fallback for older WebViews) and also returns it.
 * - CLEAR wipes the marks and restarts the session clock.
 *
 * API
 * ---
 *   MarkButton.init({ position: 'br' })   // optional; auto-inits already
 *   MarkButton.mark(note?)   -> entry {elapsedMs, elapsed, wallISO, wall, note}
 *   MarkButton.getMarks()    -> [entry, ...]
 *   MarkButton.exportText()  -> string (also copied to clipboard)
 *   MarkButton.clear()
 *   MarkButton.sessionStart()-> ms epoch of session start
 *   MarkButton.formatElapsed(ms) -> "MM:SS.s" (or "H:MM:SS.s" past an hour)
 */
(function (global) {
  'use strict';

  var LS_MARKS = 'arMark.marks.v1';
  var LS_START = 'arMark.sessionStart.v1';
  var built = false;
  var els = {};

  function lsGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { global.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { global.localStorage.removeItem(k); } catch (e) {} }

  function sessionStart() {
    var s = parseInt(lsGet(LS_START) || '0', 10);
    if (!s || isNaN(s)) { s = Date.now(); lsSet(LS_START, String(s)); }
    return s;
  }

  function getMarks() {
    try { return JSON.parse(lsGet(LS_MARKS) || '[]'); } catch (e) { return []; }
  }
  function saveMarks(m) { lsSet(LS_MARKS, JSON.stringify(m)); }

  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function formatElapsed(ms) {
    var t = Math.max(0, ms) / 1000;
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    var core = pad(m) + ':' + pad(Math.floor(s)) + '.' + Math.floor((s % 1) * 10);
    return h > 0 ? h + ':' + core : core;
  }
  function formatWall(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
           ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function exportText() {
    var marks = getMarks();
    var lines = ['AR MARK LIST — session started ' + formatWall(new Date(sessionStart())),
                 marks.length + ' mark(s)', ''];
    marks.forEach(function (e, i) {
      lines.push((i + 1) + '. ' + e.elapsed + '   (wall ' + e.wall + ')' + (e.note ? '   — ' + e.note : ''));
    });
    return lines.join('\n');
  }

  function copyToClipboard(text) {
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      return global.navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
    }
    legacyCopy(text);
    return Promise.resolve();
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {}
  }

  function renderList() {
    if (!els.list) return;
    var marks = getMarks();
    els.count.textContent = marks.length ? marks.length + ' mark' + (marks.length > 1 ? 's' : '') : 'no marks yet';
    els.list.innerHTML = '';
    marks.slice().reverse().forEach(function (e) {
      var li = document.createElement('li');
      li.textContent = '⏱ ' + e.elapsed + ' · ' + e.wall + (e.note ? ' · ' + e.note : '');
      els.list.appendChild(li);
    });
  }

  function flashStamp(text) {
    if (!els.stamp) return;
    els.stamp.textContent = text;
    els.stamp.style.opacity = '1';
    els.stamp.style.transform = 'translate(-50%,-50%) scale(1)';
    clearTimeout(flashStamp._t);
    flashStamp._t = setTimeout(function () {
      els.stamp.style.opacity = '0';
      els.stamp.style.transform = 'translate(-50%,-50%) scale(1.15)';
    }, 1200);
  }

  function mark(note) {
    var now = new Date();
    var elapsedMs = now.getTime() - sessionStart();
    var entry = {
      elapsedMs: elapsedMs,
      elapsed: formatElapsed(elapsedMs),
      wallISO: now.toISOString(),
      wall: formatWall(now),
      note: note || ''
    };
    var marks = getMarks();
    marks.push(entry);
    saveMarks(marks);
    try { if (global.navigator.vibrate) global.navigator.vibrate(60); } catch (e) {}
    flashStamp('⏱ ' + entry.elapsed);
    renderList();
    return entry;
  }

  function clear() {
    saveMarks([]);
    lsDel(LS_START);
    sessionStart(); // restart the clock now
    renderList();
  }

  var CSS = [
    '#ar-mark-root{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:99990;',
    '  display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-family:system-ui,-apple-system,sans-serif}',
    '#ar-mark-btn{background:#dc2626;color:#fff;border:3px solid #fff;border-radius:999px;',
    '  width:84px;height:84px;font-size:19px;font-weight:800;letter-spacing:.5px;cursor:pointer;',
    '  box-shadow:0 6px 24px rgba(0,0,0,.5);touch-action:manipulation}',
    '#ar-mark-btn:active{transform:scale(.94)}',
    '#ar-mark-row{display:flex;gap:6px}',
    '#ar-mark-row button{background:rgba(12,16,24,.85);color:#e8ecf3;border:1px solid #475569;',
    '  border-radius:8px;padding:8px 10px;font-size:12px;min-height:36px;cursor:pointer;touch-action:manipulation}',
    '#ar-mark-count{color:#e8ecf3;background:rgba(12,16,24,.7);border-radius:6px;padding:2px 8px;font-size:12px}',
    '#ar-mark-list{list-style:none;margin:0;padding:6px 8px;max-height:132px;overflow:auto;width:250px;',
    '  background:rgba(12,16,24,.85);border:1px solid #334155;border-radius:10px;color:#cbd5e1;',
    '  font:11px/1.6 ui-monospace,Menlo,monospace;display:none}',
    '#ar-mark-list.show{display:block}',
    '#ar-mark-stamp{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(1.15);z-index:99991;',
    '  font:800 44px/1 ui-monospace,Menlo,monospace;color:#fff;text-shadow:0 2px 18px rgba(0,0,0,.8);',
    '  opacity:0;pointer-events:none;transition:opacity .25s,transform .25s}'
  ].join('\n');

  function build() {
    if (built) return;
    built = true;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'ar-mark-root';
    root.innerHTML =
      '<div id="ar-mark-count">no marks yet</div>' +
      '<ul id="ar-mark-list"></ul>' +
      '<div id="ar-mark-row">' +
        '<button id="ar-mark-listbtn" type="button">LIST</button>' +
        '<button id="ar-mark-export" type="button">EXPORT</button>' +
        '<button id="ar-mark-clear" type="button">CLEAR</button>' +
      '</div>' +
      '<button id="ar-mark-btn" type="button">MARK</button>';
    document.body.appendChild(root);

    var stamp = document.createElement('div');
    stamp.id = 'ar-mark-stamp';
    document.body.appendChild(stamp);

    els = {
      list: root.querySelector('#ar-mark-list'),
      count: root.querySelector('#ar-mark-count'),
      stamp: stamp
    };
    root.querySelector('#ar-mark-btn').addEventListener('click', function () { mark(); });
    root.querySelector('#ar-mark-export').addEventListener('click', function () { copyToClipboard(exportText()); });
    root.querySelector('#ar-mark-clear').addEventListener('click', function () { clear(); });
    root.querySelector('#ar-mark-listbtn').addEventListener('click', function () { els.list.classList.toggle('show'); });
    sessionStart();
    renderList();
  }

  var MarkButton = {
    version: '1.0.0',
    init: function () { build(); },
    mark: function (note) { build(); return mark(note); },
    getMarks: getMarks,
    exportText: exportText,
    clear: function () { clear(); },
    sessionStart: sessionStart,
    formatElapsed: formatElapsed
  };
  global.MarkButton = MarkButton;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})(typeof window !== 'undefined' ? window : this);
