/**
 * Notebook Arcade shared NES pad + viewport lock.
 *
 * Discrete hit zones (Bad Dudes bindBtn model):
 *   each [data-act]/[data-btn] is its own button
 *   setPointerCapture, no pointerleave, no center-tracking / sliding D-pad
 *   Left/Right/Up/Down and A/B can be held at the same time (one pointer each)
 *
 * Viewport: no pinch, no iOS double-tap zoom — including D-pad / A / B taps.
 */
;(function (global) {
  'use strict'

  var held = new Set()
  var pressed = new Set()
  var bound = new WeakSet()

  function lockViewport() {
    var opts = { capture: true, passive: false }

    function onTouch(event) {
      if (event.touches && event.touches.length > 1) event.preventDefault()
    }
    function onGesture(event) {
      event.preventDefault()
    }

    document.addEventListener('touchstart', onTouch, opts)
    document.addEventListener('touchmove', onTouch, opts)
    ;['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
      document.addEventListener(type, onGesture, opts)
    })
    document.addEventListener(
      'dblclick',
      function (event) {
        event.preventDefault()
      },
      opts,
    )

    var lastTap = 0
    var lastX = 0
    var lastY = 0
    document.addEventListener(
      'touchend',
      function (event) {
        var touch = event.changedTouches && event.changedTouches[0]
        var now = Date.now()
        if (touch && now - lastTap < 350) {
          var dx = touch.clientX - lastX
          var dy = touch.clientY - lastY
          if (dx * dx + dy * dy < 1600) event.preventDefault()
        }
        lastTap = now
        if (touch) {
          lastX = touch.clientX
          lastY = touch.clientY
        }
      },
      opts,
    )
  }

  function emit(el, act, on, first) {
    el.dispatchEvent(
      new CustomEvent('nespad', {
        bubbles: true,
        detail: { act: act, on: on, first: !!first },
      }),
    )
  }

  function bindBtn(el, act) {
    if (bound.has(el)) return
    bound.add(el)

    var down = function (event) {
      event.preventDefault()
      if (typeof event.pointerId === 'number') {
        try {
          el.setPointerCapture(event.pointerId)
        } catch (err) {
          /* older WebKit */
        }
      }
      var first = !held.has(act)
      held.add(act)
      if (first) pressed.add(act)
      el.classList.add('held', 'on')
      emit(el, act, true, first)
    }

    var up = function (event) {
      event.preventDefault()
      held.delete(act)
      el.classList.remove('held', 'on')
      emit(el, act, false, false)
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
  }

  function bindPad(root) {
    if (!root) return
    root.querySelectorAll('[data-act], [data-btn]').forEach(function (el) {
      var act = el.getAttribute('data-act') || el.getAttribute('data-btn')
      if (act) bindBtn(el, act)
    })
  }

  var api = {
    down: function (act) {
      return held.has(act)
    },
    just: function (act) {
      return pressed.has(act)
    },
    held: held,
    endFrame: function () {
      pressed.clear()
    },
    bindPad: bindPad,
    bindBtn: bindBtn,
    lockViewport: lockViewport,
  }

  global.NesPad = api
  lockViewport()

  function boot() {
    bindPad(document.getElementById('nes-pad'))
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})(window)
