/* Standard touch controller pad — Moth's house standard for all JS games.
   Left: D-pad cross (▲▼◀▶). Right: action buttons (configurable).
   Buttons dispatch REAL keyboard events (keydown/keyup with .code) on window,
   so any game that already handles the keyboard gets touch for free —
   one input path, no per-game forks.
   Usage: TouchPad.mount({ dpad: true, buttons: [ {label:'SHOOT', code:'Space', cls:'big'}, ... ] })
   Pad only appears on touch devices (pointer: coarse). */
(function () {
  'use strict';
  var css = [
    '#tpad{position:fixed;inset:auto 0 0 0;z-index:60;pointer-events:none;display:none}',
    '@media (pointer:coarse){#tpad.on{display:block}}',
    '#tpad .side{position:absolute;bottom:calc(10px + env(safe-area-inset-bottom));display:flex;pointer-events:none}',
    '#tpad .l{left:10px}#tpad .r{right:10px;align-items:flex-end;gap:10px}',
    '#tpad .cross{position:relative;width:168px;height:168px;pointer-events:none}',
    '#tpad .dbtn{position:absolute;width:56px;height:56px;border-radius:14px;border:3px solid rgba(255,255,255,.85);background:rgba(13,20,40,.55);color:#fff;font-size:22px;font-weight:900;display:flex;align-items:center;justify-content:center;touch-action:none;pointer-events:auto;-webkit-user-select:none;user-select:none}',
    '#tpad .dbtn.u{left:56px;top:0}#tpad .dbtn.d{left:56px;top:112px}#tpad .dbtn.lf{left:0;top:56px}#tpad .dbtn.rt{left:112px;top:56px}',
    '#tpad .abtn{width:64px;height:64px;border-radius:50%;border:3px solid rgba(255,255,255,.85);background:rgba(13,20,40,.55);color:#fff;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;touch-action:none;pointer-events:auto;-webkit-user-select:none;user-select:none;text-align:center}',
    '#tpad .abtn.big{width:80px;height:80px;font-size:15px;background:rgba(200,30,45,.68)}',
    '#tpad .abtn.mid{background:rgba(20,120,220,.62)}',
    '#tpad .down{background:rgba(255,196,0,.8)!important;color:#14213f!important}'
  ].join('');
  function fire(code, down) {
    var ev;
    try { ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code, key: code, bubbles: true, cancelable: true }); }
    catch (e) {
      ev = document.createEvent('Event'); ev.initEvent(down ? 'keydown' : 'keyup', true, true);
      try { Object.defineProperty(ev, 'code', { value: code }); } catch (e2) {}
    }
    window.dispatchEvent(ev);
  }
  function bind(el, code) {
    var isDown = false;
    function dn(e) { e.preventDefault(); if (isDown) return; isDown = true; el.classList.add('down'); fire(code, true); }
    function up(e) { if (!isDown) return; if (e) e.preventDefault(); isDown = false; el.classList.remove('down'); fire(code, false); }
    el.addEventListener('pointerdown', dn);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  window.TouchPad = {
    mount: function (cfg) {
      cfg = cfg || {};
      if (document.getElementById('tpad')) return;
      var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      var root = document.createElement('div'); root.id = 'tpad'; root.className = 'on';
      var html = '<div class="side l"><div class="cross">' +
        '<div class="dbtn u" data-code="ArrowUp">&#9650;</div>' +
        '<div class="dbtn lf" data-code="ArrowLeft">&#9664;</div>' +
        '<div class="dbtn rt" data-code="ArrowRight">&#9654;</div>' +
        '<div class="dbtn d" data-code="ArrowDown">&#9660;</div></div></div>';
      html += '<div class="side r">';
      (cfg.buttons || []).forEach(function (b) {
        html += '<div class="abtn ' + (b.cls || '') + '" data-code="' + b.code + '">' + b.label + '</div>';
      });
      html += '</div>';
      root.innerHTML = html;
      document.body.appendChild(root);
      var nodes = root.querySelectorAll('[data-code]');
      for (var i = 0; i < nodes.length; i++) bind(nodes[i], nodes[i].getAttribute('data-code'));
    }
  };
})();
